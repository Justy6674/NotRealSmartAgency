import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'
import {
  PRODUCT_CONTEXT_PATHS,
  appendRepositoryContext,
  repositoryContentUnavailableMessage,
} from '@/lib/github/repository-context'

const SyncSchema = z.object({
  brand_id: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = SyncSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const brandId = parsed.data.brand_id

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, github_url')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  if (!brand.github_url) {
    return NextResponse.json({ error: 'No GitHub repository configured for this brand' }, { status: 400 })
  }

  // Extract owner and repo from URL
  const match = brand.github_url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) {
    return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })
  }

  const owner = match[1]
  const repo = match[2].replace(/\.git$/, '')

  try {
    let readme = ''
    let packageJson = ''

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3.raw',
      'User-Agent': 'NotRealSmart-App',
    }
    // A web request must never inherit a deployment-wide GitHub credential.
    // Private repositories are connected only via the project-scoped GitHub App.

    // Fetch README, package metadata and optional product documentation in parallel.
    // The latter carries actual capabilities into marketing context rather than
    // leaving the Director to infer a product from its framework alone.
    const [readmeRes, packageRes, ...productContextResponses] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers }),
      ...PRODUCT_CONTEXT_PATHS.map((path) =>
        fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers })
      ),
    ])

    const unavailableMessage = repositoryContentUnavailableMessage([
      readmeRes.ok,
      packageRes.ok,
      ...productContextResponses.map((response) => response.ok),
    ])
    if (unavailableMessage) {
      throw new Error(unavailableMessage)
    }

    if (readmeRes.ok) readme = await readmeRes.text()
    if (packageRes.ok) packageJson = await packageRes.text()

    let summary = `GitHub Repository: ${owner}/${repo}\n\n`

    if (packageJson) {
      try {
        const parsedPkg = JSON.parse(packageJson)
        summary += `Project Name: ${parsedPkg.name || 'Unknown'}\n`
        summary += `Description: ${parsedPkg.description || 'None'}\n`

        const deps = { ...(parsedPkg.dependencies || {}), ...(parsedPkg.devDependencies || {}) }
        const keyDeps = ['react', 'next', 'vue', 'express', 'supabase', 'tailwindcss', 'typescript', 'stripe']
        const foundDeps = keyDeps.filter((d) => deps[d] || deps[`@${d}`])

        if (foundDeps.length > 0) {
          summary += `Core Tech Stack: ${foundDeps.join(', ')}\n`
        }
        summary += '\n'
      } catch {
        // Ignore package.json parse error
      }
    }

    if (readme) {
      const truncatedReadme = readme.length > 3000 ? readme.substring(0, 3000) + '... (truncated)' : readme
      summary += `README Snippet:\n${truncatedReadme}`
    }

    for (const [index, response] of productContextResponses.entries()) {
      if (!response.ok) continue
      summary = appendRepositoryContext(summary, PRODUCT_CONTEXT_PATHS[index], await response.text())
    }

    // Save GitHub context
    const { error: updateError } = await supabase
      .from('brands')
      .update({ github_context: summary })
      .eq('id', brandId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    // ── Auto-enrich: extract structured brand data from the repo ──
    // Use a quick LLM call to pull products, description, niche from the README
    try {
      // Fetch current brand to see what's already filled
      const { data: fullBrand } = await supabase
        .from('brands')
        .select('description, niche, products_services')
        .eq('id', brandId)
        .single()

      const needsProducts = !fullBrand?.products_services?.length
      const needsDescription = !fullBrand?.description

      if (needsProducts || needsDescription) {
        const enrichResult = await generateObject({
          model: gateway(getGatewayModel('fast')),
          providerOptions: getGatewayProviderOptions('fast'),
          schema: z.object({
            description: z.string().describe('One-sentence brand description based on the repo'),
            niche: z.string().describe('Business niche, e.g. "telehealth", "saas", "ecommerce"'),
            products: z.array(z.object({
              name: z.string(),
              description: z.string(),
              price: z.string().optional(),
              target_audience: z.string().optional(),
            })).describe('Products or services extracted from the README'),
          }),
          prompt: `Extract structured brand information from this GitHub repository context. Be concise.\n\n${summary}`,
        })

        const updates: Record<string, unknown> = {}
        if (needsDescription && enrichResult.object.description) {
          updates.description = enrichResult.object.description
        }
        if (enrichResult.object.niche && fullBrand?.niche === 'general') {
          updates.niche = enrichResult.object.niche
        }
        if (needsProducts && enrichResult.object.products?.length) {
          updates.products_services = enrichResult.object.products
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('brands').update(updates).eq('id', brandId)
        }
      }
    } catch (enrichErr) {
      // Non-fatal — GitHub context is already saved, enrichment is a bonus
      console.error('[github-sync] Auto-enrich failed:', enrichErr)
    }

    return NextResponse.json({ success: true, context: summary })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
