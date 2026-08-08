/**
 * deep_competitor_scan — deep competitive analysis comparing a competitor
 * website against the current brand across pricing, features, messaging,
 * SEO, and social presence.
 */

import { tool } from 'ai'
import { z } from 'zod/v3'
import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGatewayRouteProviderOptions, resolveAgentModelRoute } from '@/lib/ai/model-routing'
import { scanWebsiteCore } from './scan-website'

// ---------------------------------------------------------------------------
// Analysis schema (returned by generateObject)
// ---------------------------------------------------------------------------

const analysisSchema = z.object({
  competitor_name: z.string(),
  competitor_url: z.string(),
  pricing: z
    .object({
      found: z.boolean(),
      details: z.string(),
      comparison: z.string().describe('How their pricing compares to ours'),
    })
    .optional(),
  features: z
    .array(
      z.object({
        feature: z.string(),
        they_have: z.boolean(),
        we_have: z.boolean(),
        our_advantage: z.string().optional(),
      })
    )
    .optional(),
  messaging: z
    .object({
      their_positioning: z.string(),
      their_target_audience: z.string(),
      their_tone: z.string(),
      our_differentiation: z.string(),
    })
    .optional(),
  seo: z
    .object({
      their_title: z.string(),
      their_meta: z.string(),
      their_h1s: z.array(z.string()),
      keyword_overlap: z.string(),
    })
    .optional(),
  social: z
    .object({
      platforms_found: z.array(z.string()),
      their_presence: z.string(),
      our_gaps: z.string(),
    })
    .optional(),
  recommendations: z
    .array(z.string())
    .describe('3-5 actionable recommendations based on the comparison'),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBrandContext(brand: Record<string, unknown>): string {
  const parts: string[] = []
  if (brand.name) parts.push(`Brand: ${brand.name}`)
  if (brand.website_url) parts.push(`Website: ${brand.website_url}`)
  if (brand.description) parts.push(`Description: ${brand.description}`)
  if (brand.niche) parts.push(`Niche: ${brand.niche}`)
  if (brand.tagline) parts.push(`Tagline: ${brand.tagline}`)

  const products = brand.products_services as
    | Array<{ name: string; description: string }>
    | undefined
  if (products && products.length > 0) {
    parts.push(
      `Products/Services: ${products.map((p) => `${p.name} — ${p.description}`).join('; ')}`
    )
  }

  const competitors = brand.competitors as
    | Array<{ name: string; url?: string; why?: string }>
    | undefined
  if (competitors && competitors.length > 0) {
    parts.push(
      `Known competitors: ${competitors.map((c) => c.name + (c.url ? ` (${c.url})` : '')).join(', ')}`
    )
  }

  const social = brand.social_urls as Record<string, string> | undefined
  if (social && Object.keys(social).length > 0) {
    parts.push(
      `Social profiles: ${Object.entries(social)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}`
    )
  }

  return parts.join('\n')
}

type FocusArea = 'pricing' | 'features' | 'messaging' | 'seo' | 'social' | 'all'

function buildFocusInstructions(focus: FocusArea[]): string {
  const all = focus.includes('all')
  const areas: string[] = []
  if (all || focus.includes('pricing'))
    areas.push('- PRICING: Look for pricing pages, plan comparisons, cost indicators.')
  if (all || focus.includes('features'))
    areas.push('- FEATURES: Identify their key features and compare to ours.')
  if (all || focus.includes('messaging'))
    areas.push('- MESSAGING: Analyse their positioning, target audience, and tone of voice.')
  if (all || focus.includes('seo'))
    areas.push('- SEO: Examine their title tag, meta description, H1 headings, and likely keywords.')
  if (all || focus.includes('social'))
    areas.push('- SOCIAL: Identify any social media links or mentions on their site.')
  return areas.join('\n')
}

function formatAsMarkdown(
  analysis: z.infer<typeof analysisSchema>,
  focus: FocusArea[]
): string {
  const all = focus.includes('all')
  const lines: string[] = []

  lines.push(`## Competitive Deep Scan: ${analysis.competitor_name}`)
  lines.push(`**URL:** ${analysis.competitor_url}\n`)

  if (analysis.pricing && (all || focus.includes('pricing'))) {
    lines.push(`### Pricing`)
    lines.push(
      analysis.pricing.found
        ? `${analysis.pricing.details}\n\n**Comparison:** ${analysis.pricing.comparison}`
        : `No pricing information found on their website.\n\n**Note:** ${analysis.pricing.comparison}`
    )
    lines.push('')
  }

  if (analysis.features && analysis.features.length > 0 && (all || focus.includes('features'))) {
    lines.push(`### Feature Comparison`)
    lines.push('| Feature | They have | We have | Our advantage |')
    lines.push('|---------|-----------|---------|---------------|')
    for (const f of analysis.features) {
      lines.push(
        `| ${f.feature} | ${f.they_have ? 'Yes' : 'No'} | ${f.we_have ? 'Yes' : 'No'} | ${f.our_advantage ?? '—'} |`
      )
    }
    lines.push('')
  }

  if (analysis.messaging && (all || focus.includes('messaging'))) {
    lines.push(`### Messaging & Positioning`)
    lines.push(`**Their positioning:** ${analysis.messaging.their_positioning}`)
    lines.push(`**Target audience:** ${analysis.messaging.their_target_audience}`)
    lines.push(`**Tone:** ${analysis.messaging.their_tone}`)
    lines.push(`**Our differentiation:** ${analysis.messaging.our_differentiation}`)
    lines.push('')
  }

  if (analysis.seo && (all || focus.includes('seo'))) {
    lines.push(`### SEO Snapshot`)
    lines.push(`**Title:** ${analysis.seo.their_title}`)
    lines.push(`**Meta description:** ${analysis.seo.their_meta}`)
    if (analysis.seo.their_h1s.length > 0) {
      lines.push(`**H1 headings:** ${analysis.seo.their_h1s.join(' | ')}`)
    }
    lines.push(`**Keyword overlap:** ${analysis.seo.keyword_overlap}`)
    lines.push('')
  }

  if (analysis.social && (all || focus.includes('social'))) {
    lines.push(`### Social Presence`)
    lines.push(`**Platforms found:** ${analysis.social.platforms_found.join(', ') || 'None detected'}`)
    lines.push(`**Their presence:** ${analysis.social.their_presence}`)
    lines.push(`**Our gaps:** ${analysis.social.our_gaps}`)
    lines.push('')
  }

  if (analysis.recommendations.length > 0) {
    lines.push(`### Recommendations`)
    for (const rec of analysis.recommendations) {
      lines.push(`- ${rec}`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createDeepCompetitorScanTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Run a deep competitive scan on a competitor website. Fetches and analyses their website, then compares them against our brand across pricing, features, messaging, SEO, and social presence. Returns a structured comparison with actionable recommendations. Use this when the user wants to understand a competitor in depth, compare themselves to a rival, or get competitive intelligence.',
    inputSchema: z.object({
      competitor_url: z
        .string()
        .url()
        .describe('Competitor website URL to scan'),
      competitor_name: z
        .string()
        .optional()
        .describe('Competitor name if known'),
      focus: z
        .array(
          z.enum(['pricing', 'features', 'messaging', 'seo', 'social', 'all'])
        )
        .default(['all'])
        .describe(
          'Focus areas for the scan — pick specific areas or use "all" for a full scan'
        ),
    }),
    execute: async ({ competitor_url, competitor_name, focus }) => {
      // 1. Scan the competitor website
      const competitorScan = await scanWebsiteCore(
        supabase,
        userId,
        brandId,
        competitor_url,
        'general'
      )

      if ('error' in competitorScan) {
        return {
          error: `Could not scan ${competitor_url}`,
          suggestion:
            'The website may be blocking automated requests. Try pasting their homepage copy into the chat instead.',
        }
      }

      // 2. Fetch brand context
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single()

      if (!brand) {
        return {
          error: 'No active brand found. Select a brand first.',
        }
      }

      const brandContext = buildBrandContext(brand)
      const focusInstructions = buildFocusInstructions(focus as FocusArea[])

      // 3. Use generateObject to produce structured analysis
      const modelRoute = resolveAgentModelRoute({
        agentType: 'competitor',
        input: `${competitor_url}\n${focus.join(' ')}`,
        taskCapability: 'competitor_research',
      })
      const { object: analysis } = await generateObject({
        model: gateway(modelRoute.model),
        providerOptions: getGatewayRouteProviderOptions(modelRoute),
        schema: analysisSchema,
        prompt: `You are an expert competitive intelligence analyst. Analyse the following competitor website data and compare it to our brand.

## Our Brand
${brandContext}

## Competitor Website Data
URL: ${competitor_url}
Name: ${competitor_name ?? 'Unknown — infer from their website'}
Title: ${competitorScan.title ?? 'N/A'}
Meta description: ${competitorScan.description ?? 'N/A'}
Headings: ${competitorScan.headings?.map((h: { level: string; text: string }) => `${h.level}: ${h.text}`).join('\n') ?? 'N/A'}

Body content (first 3000 chars):
${competitorScan.bodyText ?? 'N/A'}

## Focus Areas
${focusInstructions}

## Instructions
- For each focus area, provide thorough analysis based on the available data.
- If pricing is not visible, mark found=false but still provide comparison context.
- For features, compare what you can infer from both websites.
- Be specific and actionable in recommendations — no generic advice.
- Use Australian English throughout.
- If the competitor name was not provided, infer it from their website content.
- Provide exactly 3-5 recommendations.`,
      })

      // 4. Save competitor to brand.competitors if not already there
      const resolvedName =
        analysis.competitor_name || competitor_name || 'Unknown Competitor'
      const existingCompetitors = (brand.competitors ?? []) as Array<{
        name: string
        url?: string
        why?: string
        is_active?: boolean
      }>
      const alreadyTracked = existingCompetitors.some(
        (c) =>
          c.name.toLowerCase() === resolvedName.toLowerCase() ||
          (c.url && c.url.toLowerCase().includes(new URL(competitor_url).hostname))
      )

      if (!alreadyTracked) {
        const updatedCompetitors = [
          ...existingCompetitors,
          {
            name: resolvedName,
            url: competitor_url,
            why: 'Added via deep competitor scan',
            is_active: true,
          },
        ]
        await supabase
          .from('brands')
          .update({ competitors: updatedCompetitors })
          .eq('id', brandId)
      }

      // 5. Return formatted markdown
      const markdown = formatAsMarkdown(analysis, focus as FocusArea[])

      return {
        markdown,
        competitor_name: resolvedName,
        competitor_url,
        focus,
        competitor_added: !alreadyTracked,
        analysis,
      }
    },
  })
}
