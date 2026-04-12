import { tool } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand, PostPlatform } from '@/types/database'

// ─── Synthetic Personas Tool ─────────────────────────────────────────────────
//
// Generates 3-5 synthetic personas from the brand's target audience data,
// then simulates their reactions to a draft caption. Fast feedback without
// posting live — the Director can iterate on copy before scheduling.

const personaSchema = z.object({
  personas: z.array(z.object({
    name: z.string().describe('Realistic first name for this persona'),
    age: z.number().describe('Age in years'),
    description: z.string().describe('One-sentence persona summary — who they are and what they care about'),
    would_engage: z.boolean().describe('Would this person like, comment, share, or save the post?'),
    reaction: z.string().describe('Honest gut reaction in 1-2 sentences, written in first person as the persona'),
    suggestion: z.string().describe('One actionable improvement this persona would want'),
  })),
})

export function createTestWithAudienceTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Test a caption with synthetic audience personas before posting. Generates 3-5 realistic personas based on the brand\'s target audience, then simulates their reactions. Returns an engagement likelihood score and actionable suggestions.',
    inputSchema: z.object({
      caption: z.string().describe('The draft caption to test'),
      platform: z.enum([
        'instagram', 'facebook', 'linkedin', 'twitter',
        'tiktok', 'youtube', 'bluesky', 'mastodon',
        'pinterest', 'threads', 'google_business',
      ] as const).describe('Target platform — affects persona behaviour'),
      persona_count: z.number().min(2).max(5).default(3).describe('Number of personas to generate (default 3)'),
    }),
    execute: async ({ caption, platform, persona_count }) => {
      try {
        // Fetch brand audience data
        const { data: brand, error: brandErr } = await supabase
          .from('brands')
          .select('name, target_audience, niche, tone_of_voice, content_pillars, products_services')
          .eq('id', brandId)
          .single()

        if (brandErr || !brand) {
          return { success: false, error: `Could not fetch brand: ${brandErr?.message ?? 'not found'}` }
        }

        const typedBrand = brand as Pick<Brand, 'name' | 'target_audience' | 'niche' | 'tone_of_voice' | 'content_pillars' | 'products_services'>

        const audienceContext = buildAudienceContext(typedBrand)

        // Generate personas + reactions via Claude Haiku
        const { object } = await generateObject({
          model: gateway('anthropic/claude-haiku-4-5-20251001'),
          schema: personaSchema,
          prompt: `You are a social media audience research expert. Based on the following brand and audience data, create exactly ${persona_count} realistic synthetic personas and simulate their reaction to a draft post.

BRAND: ${typedBrand.name}
NICHE: ${typedBrand.niche}
PLATFORM: ${platform}

TARGET AUDIENCE:
${audienceContext}

DRAFT CAPTION TO TEST:
"""
${caption}
"""

INSTRUCTIONS:
- Create ${persona_count} distinct personas that represent REAL segments of this brand's audience
- Include at least one sceptic or unlikely-to-engage persona for balance
- Each persona should react authentically based on their profile — not all positive
- Suggestions should be specific and actionable (not generic "make it more engaging")
- Consider platform culture: ${getPlatformCulture(platform)}
- Use Australian context where relevant (spelling, cultural references)`,
        })

        // Calculate aggregate score
        const engagedCount = object.personas.filter((p) => p.would_engage).length
        const totalCount = object.personas.length
        const engagementScore = Math.round((engagedCount / totalCount) * 100)

        // Format response
        const personaFeedback = object.personas.map((p, i) => ({
          persona: `${p.name}, ${p.age}`,
          description: p.description,
          would_engage: p.would_engage,
          reaction: p.reaction,
          suggestion: p.suggestion,
        }))

        const verdict = engagementScore >= 80
          ? 'Strong — most of your audience would engage.'
          : engagementScore >= 50
            ? 'Decent — consider the suggestions below to improve reach.'
            : 'Needs work — the majority of your audience wouldn\'t engage. Iterate on the copy.'

        return {
          success: true,
          platform,
          engagement_score: engagementScore,
          engaged_count: engagedCount,
          total_personas: totalCount,
          verdict,
          personas: personaFeedback,
          message: `Tested with ${totalCount} synthetic personas on ${platform}. Engagement likelihood: **${engagementScore}%** (${engagedCount}/${totalCount} would engage). ${verdict}`,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAudienceContext(brand: Pick<Brand, 'target_audience' | 'content_pillars' | 'products_services'>): string {
  const parts: string[] = []

  if (brand.target_audience?.demographics) {
    parts.push(`Demographics: ${brand.target_audience.demographics}`)
  }
  if (brand.target_audience?.pain_points?.length) {
    parts.push(`Pain points: ${brand.target_audience.pain_points.join(', ')}`)
  }
  if (brand.target_audience?.desires?.length) {
    parts.push(`Desires: ${brand.target_audience.desires.join(', ')}`)
  }
  if (brand.content_pillars?.length) {
    parts.push(`Content pillars: ${brand.content_pillars.join(', ')}`)
  }
  if (brand.products_services?.length) {
    const productNames = brand.products_services.map((p) => p.name).join(', ')
    parts.push(`Products/services: ${productNames}`)
  }

  return parts.length ? parts.join('\n') : 'No detailed audience data available — generate general consumer personas.'
}

function getPlatformCulture(platform: string): string {
  const cultures: Record<string, string> = {
    instagram: 'Visual-first, aspirational, Stories/Reels culture, emoji-friendly',
    facebook: 'Conversational, community groups, older demographic skew, shareable',
    linkedin: 'Professional tone, thought leadership, industry insights, less emoji',
    twitter: 'Punchy, opinionated, thread culture, trending topics, ratio risk',
    tiktok: 'Authentic, trend-driven, short attention span, sound-on, Gen Z/Millennial',
    youtube: 'Long-form context, SEO-driven titles, community tab engagement',
    bluesky: 'Tech-savvy early adopters, decentralisation values, conversational',
    mastodon: 'Privacy-conscious, anti-corporate, niche communities',
    pinterest: 'Search + discovery, aspirational boards, DIY/how-to, evergreen',
    threads: 'Conversational, text-first, Instagram-adjacent audience',
    google_business: 'Local search intent, reviews-driven, trust signals',
  }
  return cultures[platform] ?? 'General social media audience'
}
