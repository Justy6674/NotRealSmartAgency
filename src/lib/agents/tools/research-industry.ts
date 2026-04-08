/**
 * research_industry — Auto-research a brand's industry using web search,
 * then synthesise findings into structured proforma knowledge.
 *
 * Follows the deep-competitor-scan pattern: generateText (with Perplexity
 * search tool for multi-step research) → generateObject (structured synthesis)
 * → proforma update.
 *
 * Cost: ~$0.005 per brand (Haiku for search + synthesis).
 */

import { tool, generateText, generateObject, stepCountIs } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Structured output schema for industry knowledge
// ---------------------------------------------------------------------------

const industryKnowledgeSchema = z.object({
  industry_overview: z.string().describe('2-3 paragraph overview of this industry, its current state, and market dynamics'),
  target_audience_insights: z.string().describe('Deep audience psychology — who buys, why, triggers, objections, purchase journey'),
  marketing_best_practices: z.array(z.string()).describe('8-12 specific, actionable marketing tactics that work for this industry'),
  content_pillars_suggested: z.array(z.string()).describe('5-7 content themes/pillars ideal for this industry'),
  platform_recommendations: z.string().describe('Which social platforms matter most for this industry and why'),
  competitor_landscape: z.string().describe('Overview of the competitive landscape — key players, market segments, positioning'),
  seasonal_opportunities: z.string().describe('Seasonal/calendar marketing opportunities specific to this industry'),
  compliance_notes: z.string().describe('Any industry-specific regulatory, compliance, or ethical considerations'),
  key_trends: z.array(z.string()).describe('5-8 current industry trends affecting marketing strategy'),
  content_format_recommendations: z.string().describe('Which content formats (carousels, reels, blogs, etc.) perform best in this industry'),
})

// ---------------------------------------------------------------------------
// Core reusable function (called by tool, backfill endpoint, and heartbeat)
// ---------------------------------------------------------------------------

export async function researchIndustryCore(
  supabase: SupabaseClient,
  brandId: string,
  userId: string,
  depth: 'quick' | 'deep' = 'deep'
): Promise<{ success: boolean; summary: string; error?: string }> {
  // 1. Fetch brand
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('name, niche, industry, website_url, github_url, description, extra_context, products_services, business_stage')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return { success: false, summary: '', error: 'Brand not found.' }
  }

  const industry = brand.niche || brand.industry || 'general business'
  const brandName = brand.name || 'this brand'

  // 2. Research phase — use Haiku + Perplexity search
  const maxSteps = depth === 'deep' ? 4 : 2

  const { text: researchText } = await generateText({
    model: gateway('anthropic/claude-haiku-4-5-20251001'),
    tools: {
      web_search: gateway.tools.perplexitySearch({
        maxResults: 5,
        searchLanguageFilter: ['en'],
        searchRecencyFilter: 'month',
      }),
    },
    stopWhen: stepCountIs(maxSteps),
    prompt: `You are a marketing research analyst. Research the "${industry}" industry to build deep marketing intelligence for a brand called "${brandName}".

Brand context:
- Niche: ${industry}
- Description: ${brand.description || 'Not provided'}
- Business stage: ${brand.business_stage || 'Unknown'}
- Website: ${brand.website_url || 'None'}
- Products/services: ${JSON.stringify(brand.products_services || [])}

Your task: Search for and compile comprehensive marketing intelligence about this industry. Make ${depth === 'deep' ? '3-4' : '1-2'} searches covering:

1. "${industry} marketing trends 2025 2026" — what's working now in this industry
2. "${industry} social media content strategy best practices" — platform-specific tactics
3. "${industry} customer psychology buying triggers" — audience insights
${depth === 'deep' ? `4. "${industry} content marketing what format performs best" — content format data` : ''}

For each search, extract specific, actionable insights — not generic marketing advice. Include data points, percentages, and examples where available.

Also note if there are any GitHub repositories, open-source tools, or knowledge bases relevant to this industry (e.g. fragrance taxonomies, breed databases, recipe databases, etc.).

Compile everything into a comprehensive research brief.`,
  })

  if (!researchText) {
    return { success: false, summary: '', error: 'Research produced no results.' }
  }

  // 3. Synthesis phase — structure the research into proforma-ready knowledge
  const { object: knowledge } = await generateObject({
    model: gateway('anthropic/claude-haiku-4-5-20251001'),
    schema: industryKnowledgeSchema,
    prompt: `You are a marketing strategist synthesising research into structured intelligence for a "${industry}" brand called "${brandName}".

## Raw Research
${researchText}

## Brand Context
- Niche: ${industry}
- Description: ${brand.description || 'Not provided'}
- Business stage: ${brand.business_stage || 'Unknown'}
- Products: ${JSON.stringify(brand.products_services || [])}

## Instructions
- Synthesise ALL the research into the structured fields
- Be specific to this industry — no generic advice
- Include data points and percentages where the research provided them
- For compliance_notes: note any industry-specific regulations (e.g. AHPRA/TGA for health, food safety for restaurants, financial services regulations)
- For Australian businesses where relevant
- Write in Australian English (colour, organisation, analyse, etc.)`,
  })

  // 4. Write to proforma sections
  const proformaUpdates = [
    {
      section_key: 'market_context',
      section_data: {
        industry_overview: knowledge.industry_overview,
        competitor_landscape: knowledge.competitor_landscape,
        key_trends: knowledge.key_trends,
        seasonal_opportunities: knowledge.seasonal_opportunities,
        last_researched: new Date().toISOString(),
        research_depth: depth,
      },
      rag_status: 'green',
    },
    {
      section_key: 'audience',
      section_data: {
        industry_insights: knowledge.target_audience_insights,
      },
      rag_status: 'amber', // amber because it's auto-generated, needs human validation
    },
    {
      section_key: 'content_creative',
      section_data: {
        suggested_pillars: knowledge.content_pillars_suggested,
        platform_recommendations: knowledge.platform_recommendations,
        format_recommendations: knowledge.content_format_recommendations,
      },
      rag_status: 'amber',
    },
    {
      section_key: 'gaps_opportunities',
      section_data: {
        industry_opportunities: knowledge.marketing_best_practices,
      },
      rag_status: 'amber',
    },
    {
      section_key: 'compliance_profile',
      section_data: {
        industry_compliance_notes: knowledge.compliance_notes,
      },
      rag_status: knowledge.compliance_notes.toLowerCase().includes('ahpra') ||
                  knowledge.compliance_notes.toLowerCase().includes('tga')
        ? 'red' // flag for human review if health-related
        : 'amber',
    },
  ]

  for (const update of proformaUpdates) {
    // Fetch existing section
    const { data: existing } = await supabase
      .from('brand_proforma_sections')
      .select('id, section_data')
      .eq('brand_id', brandId)
      .eq('section_key', update.section_key)
      .single()

    if (existing) {
      // Merge with existing data (preserve manually set fields)
      const currentData = (existing.section_data ?? {}) as Record<string, unknown>
      const mergedData: Record<string, unknown> = { ...currentData }

      for (const [key, value] of Object.entries(update.section_data)) {
        if (Array.isArray(value) && Array.isArray(currentData[key])) {
          // Append arrays, dedup
          const existingArr = currentData[key] as unknown[]
          const newItems = (value as unknown[]).filter(item => {
            const itemStr = JSON.stringify(item)
            return !existingArr.some(e => JSON.stringify(e) === itemStr)
          })
          mergedData[key] = [...existingArr, ...newItems]
        } else {
          mergedData[key] = value
        }
      }

      await supabase
        .from('brand_proforma_sections')
        .update({
          section_data: mergedData,
          rag_status: update.rag_status,
          last_reviewed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
  }

  // Build summary
  const summary = [
    `**Industry Research Complete for ${brandName}** (${industry})`,
    '',
    `**Overview:** ${knowledge.industry_overview.slice(0, 200)}...`,
    '',
    `**Key Trends:** ${knowledge.key_trends.slice(0, 5).join(', ')}`,
    '',
    `**Suggested Content Pillars:** ${knowledge.content_pillars_suggested.join(', ')}`,
    '',
    `**Best Platforms:** ${knowledge.platform_recommendations.slice(0, 200)}...`,
    '',
    `**Top Marketing Tactics:**`,
    ...knowledge.marketing_best_practices.slice(0, 5).map(t => `- ${t}`),
    '',
    `Updated proforma sections: market_context (GREEN), audience, content_creative, gaps_opportunities, compliance_profile.`,
  ].join('\n')

  return { success: true, summary }
}

// ---------------------------------------------------------------------------
// AI SDK Tool factory
// ---------------------------------------------------------------------------

export function createResearchIndustryTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Research the brand\'s industry to build deep marketing intelligence. ' +
      'Searches the web for industry trends, audience psychology, content strategies, ' +
      'and competitive landscape. Saves findings to the brand proforma. ' +
      'Use this when a brand has no industry research yet (market_context is RED) ' +
      'or when the user asks to refresh industry knowledge.',
    inputSchema: z.object({
      depth: z.enum(['quick', 'deep']).default('deep')
        .describe('quick = 1-2 searches, deep = 3-4 searches with more synthesis'),
    }),
    execute: async ({ depth }) => {
      const result = await researchIndustryCore(supabase, brandId, userId, depth)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true, message: result.summary }
    },
  })
}
