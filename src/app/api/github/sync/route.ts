import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'

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
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    // Fetch README and package.json in parallel
    const [readmeRes, packageRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers }),
    ])

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

    // Save back to brand
    const { error: updateError } = await supabase
      .from('brands')
      .update({ github_context: summary })
      .eq('id', brandId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({ success: true, context: summary })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
