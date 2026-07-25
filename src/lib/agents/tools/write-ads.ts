import { tool, generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand } from '@/types/database'
import { runComplianceFilter } from '../compliance-filter'

// --- Platform-specific output schemas ---

const GoogleSearchAdSchema = z.object({
  headlines: z
    .array(z.string().max(30).describe('Max 30 characters'))
    .length(15)
    .describe('15 headlines for Responsive Search Ad'),
  descriptions: z
    .array(z.string().max(90).describe('Max 90 characters'))
    .length(4)
    .describe('4 descriptions'),
  display_url_paths: z
    .array(z.string().max(15))
    .max(2)
    .describe('Up to 2 URL path segments (15 chars each)'),
  final_url_suggestion: z.string().describe('Suggested landing page path'),
})

const GoogleDisplayAdSchema = z.object({
  headline: z.string().max(25).describe('Short headline, max 25 characters'),
  long_headline: z.string().max(90).describe('Long headline, max 90 characters'),
  description: z.string().max(90).describe('Description, max 90 characters'),
  business_name: z.string().max(25),
})

const MetaAdSchema = z.object({
  primary_text: z.string().max(125).describe('Text above the creative, max 125 characters'),
  headline: z.string().max(40).describe('Below the creative, max 40 characters'),
  description: z.string().max(30).describe('Below the headline, max 30 characters'),
  cta_button: z
    .enum([
      'Learn More',
      'Shop Now',
      'Sign Up',
      'Book Now',
      'Get Offer',
      'Contact Us',
      'Download',
      'Apply Now',
      'Subscribe',
      'Get Quote',
    ])
    .describe('Call-to-action button'),
})

const LinkedInAdSchema = z.object({
  intro_text: z.string().max(150).describe('Introductory text, max 150 characters'),
  headline: z.string().max(70).describe('Ad headline, max 70 characters'),
  description: z.string().max(100).describe('Ad description, max 100 characters'),
})

const TikTokAdSchema = z.object({
  hook: z.string().describe('First 3 seconds — attention-grabbing text overlay'),
  body_script: z.string().describe('15-30 second body script with visual directions'),
  cta_overlay: z.string().max(40).describe('CTA text overlay, max 40 characters'),
  hashtags: z.array(z.string()).min(3).max(8).describe('3-8 relevant hashtags'),
})

// Wrapper schema for a single variant
const AdVariantSchema = z.object({
  variant_number: z.number(),
  angle: z.string().describe('The creative angle or hook for this variant'),
  google_search: GoogleSearchAdSchema.optional(),
  google_display: GoogleDisplayAdSchema.optional(),
  meta: MetaAdSchema.optional(),
  linkedin: LinkedInAdSchema.optional(),
  tiktok: TikTokAdSchema.optional(),
  compliance_notes: z
    .array(z.string())
    .optional()
    .describe('AHPRA/TGA compliance notes if applicable'),
  platform_policy_notes: z
    .array(z.string())
    .optional()
    .describe('Platform-specific ad policy warnings'),
})

const WriteAdsOutputSchema = z.object({
  platform: z.string(),
  objective: z.string(),
  variants: z.array(AdVariantSchema),
  general_tips: z.array(z.string()).describe('Platform-specific best practices'),
})

// --- Platform policy notes ---

const PLATFORM_POLICIES: Record<string, string> = {
  google_search: `Google Ads policies:
- No misleading claims or exaggerated promises
- Healthcare ads require Google verification in most regions
- Restricted categories: weight loss, pharmaceuticals, cosmetic procedures
- Landing page must match ad claims
- No click-bait or sensational language`,

  google_display: `Google Display policies:
- Same restrictions as Search plus image guidelines
- No misleading interactive elements in images
- Healthcare display ads face additional review
- Remarketing lists for health topics are restricted`,

  meta: `Meta (Facebook/Instagram) ad policies:
- Cannot target based on health conditions (Special Ad Category)
- No before/after images for health/fitness
- Cannot imply knowledge of personal health attributes
- Must use Special Ad Category for health-related services
- Landing page must have clear privacy policy`,

  linkedin: `LinkedIn ad policies:
- Professional tone expected — no sensational claims
- Health service ads must comply with local regulations
- Cannot target by health status or medical conditions
- Must be transparent about data usage`,

  tiktok: `TikTok ad policies:
- Healthcare ads restricted in many regions — check local rules
- No misleading weight loss or body image claims
- Must comply with TikTok's health & wellness policy
- Influencer/UGC style performs best but must be labelled as ad
- Branded content toggle required for paid partnerships`,
}

// --- Helper: build brand context string ---

function buildBrandContext(brand: Brand): string {
  const parts: string[] = []

  parts.push(`Brand: ${brand.name}`)
  if (brand.tagline) parts.push(`Tagline: ${brand.tagline}`)
  if (brand.description) parts.push(`Description: ${brand.description}`)
  if (brand.niche) parts.push(`Niche: ${brand.niche}`)
  if (brand.website_url) parts.push(`Website: ${brand.website_url}`)

  if (brand.products_services?.length) {
    const products = brand.products_services
      .map(p => {
        let line = `- ${p.name}: ${p.description}`
        if (p.price) line += ` (${p.price})`
        if (p.usps?.length) line += ` | USPs: ${p.usps.join(', ')}`
        return line
      })
      .join('\n')
    parts.push(`Products/Services:\n${products}`)
  }

  if (brand.target_audience) {
    const ta = brand.target_audience
    const taLines: string[] = []
    if (typeof ta === 'object') {
      if ('demographics' in ta && ta.demographics) taLines.push(`Demographics: ${ta.demographics}`)
      if ('pain_points' in ta && ta.pain_points) taLines.push(`Pain points: ${ta.pain_points}`)
      if ('goals' in ta && ta.goals) taLines.push(`Goals: ${ta.goals}`)
    }
    if (taLines.length) parts.push(`Target Audience:\n${taLines.join('\n')}`)
  }

  if (brand.competitors?.length) {
    const comps = brand.competitors
      .slice(0, 3)
      .map(c => `- ${c.name}${c.url ? ` (${c.url})` : ''}${c.why ? `: ${c.why}` : ''}`)
      .join('\n')
    parts.push(`Key Competitors:\n${comps}`)
  }

  if (brand.content_pillars?.length) {
    parts.push(`Content Pillars: ${brand.content_pillars.join(', ')}`)
  }

  if (brand.tone_of_voice) {
    const tov = brand.tone_of_voice
    if (typeof tov === 'object' && 'description' in tov && tov.description) {
      parts.push(`Tone of Voice: ${tov.description}`)
    }
  }

  return parts.join('\n\n')
}

// --- Helper: format ad preview for chat ---

function formatPreview(result: z.infer<typeof WriteAdsOutputSchema>): string {
  const lines: string[] = []
  lines.push(`## Ad Copy — ${result.platform.replace('_', ' ').toUpperCase()}`)
  lines.push(`**Objective:** ${result.objective}\n`)

  for (const v of result.variants) {
    lines.push(`---\n### Variant ${v.variant_number}: ${v.angle}\n`)

    if (v.google_search) {
      const gs = v.google_search
      lines.push('**Headlines:**')
      gs.headlines.forEach((h, i) => lines.push(`${i + 1}. ${h} _(${h.length}/30)_`))
      lines.push('\n**Descriptions:**')
      gs.descriptions.forEach((d, i) => lines.push(`${i + 1}. ${d} _(${d.length}/90)_`))
      lines.push(`\n**Display URL path:** /${gs.display_url_paths.join('/')}`)
      lines.push(`**Suggested landing page:** ${gs.final_url_suggestion}`)
    }

    if (v.google_display) {
      const gd = v.google_display
      lines.push(`**Headline:** ${gd.headline} _(${gd.headline.length}/25)_`)
      lines.push(`**Long headline:** ${gd.long_headline} _(${gd.long_headline.length}/90)_`)
      lines.push(`**Description:** ${gd.description} _(${gd.description.length}/90)_`)
    }

    if (v.meta) {
      const m = v.meta
      lines.push(`**Primary text:** ${m.primary_text} _(${m.primary_text.length}/125)_`)
      lines.push(`**Headline:** ${m.headline} _(${m.headline.length}/40)_`)
      lines.push(`**Description:** ${m.description} _(${m.description.length}/30)_`)
      lines.push(`**CTA button:** ${m.cta_button}`)
    }

    if (v.linkedin) {
      const li = v.linkedin
      lines.push(`**Intro text:** ${li.intro_text} _(${li.intro_text.length}/150)_`)
      lines.push(`**Headline:** ${li.headline} _(${li.headline.length}/70)_`)
      lines.push(`**Description:** ${li.description} _(${li.description.length}/100)_`)
    }

    if (v.tiktok) {
      const tt = v.tiktok
      lines.push(`**Hook (first 3s):** ${tt.hook}`)
      lines.push(`\n**Body script:**\n${tt.body_script}`)
      lines.push(`\n**CTA overlay:** ${tt.cta_overlay} _(${tt.cta_overlay.length}/40)_`)
      lines.push(`**Hashtags:** ${tt.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`)
    }

    if (v.compliance_notes?.length) {
      lines.push(`\n> **Compliance notes:** ${v.compliance_notes.join(' | ')}`)
    }

    if (v.platform_policy_notes?.length) {
      lines.push(`\n> **Platform policy:** ${v.platform_policy_notes.join(' | ')}`)
    }
  }

  if (result.general_tips.length) {
    lines.push('\n---\n### Tips')
    result.general_tips.forEach(t => lines.push(`- ${t}`))
  }

  return lines.join('\n')
}

// --- Main tool factory ---

export function createWriteAdsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Generate multi-variant ad copy for a specific platform. Produces platform-compliant ads with correct character limits, AHPRA/TGA compliance for health brands, and saves to the output library.',
    inputSchema: z.object({
      platform: z
        .enum(['google_search', 'google_display', 'meta', 'linkedin', 'tiktok'])
        .describe('Advertising platform'),
      objective: z
        .enum(['awareness', 'traffic', 'leads', 'conversions', 'app_installs'])
        .describe('Campaign objective'),
      offer: z.string().describe('What you are promoting'),
      target_audience: z.string().optional().describe('Who the ad targets'),
      budget_hint: z.string().optional().describe('Budget context, e.g. "$500/month"'),
      variants: z
        .number()
        .min(1)
        .max(5)
        .default(3)
        .describe('Number of ad variations to generate'),
    }),
    execute: async ({ platform, objective, offer, target_audience, budget_hint, variants }) => {
      // 1. Fetch brand context
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single()

      if (brandError || !brand) {
        return { success: false, error: 'Could not fetch brand details.' }
      }

      const brandContext = buildBrandContext(brand as Brand)
      const isHealthBrand = brand.compliance_flags?.ahpra || brand.compliance_flags?.tga
      const platformPolicy = PLATFORM_POLICIES[platform] ?? ''

      // 2. Build the platform-specific field instruction
      const platformFieldMap: Record<string, string> = {
        google_search: `Populate the "google_search" field for each variant. Generate exactly 15 headlines (max 30 chars EACH — this is STRICT) and 4 descriptions (max 90 chars EACH). Include display URL paths and a landing page suggestion.`,
        google_display: `Populate the "google_display" field for each variant. headline max 25 chars, long_headline max 90 chars, description max 90 chars. These limits are STRICT.`,
        meta: `Populate the "meta" field for each variant. primary_text max 125 chars, headline max 40 chars, description max 30 chars. Choose an appropriate CTA button. Character limits are STRICT.`,
        linkedin: `Populate the "linkedin" field for each variant. intro_text max 150 chars, headline max 70 chars, description max 100 chars. Character limits are STRICT.`,
        tiktok: `Populate the "tiktok" field for each variant. Write an attention-grabbing hook for the first 3 seconds, a 15-30 second body script with visual directions, a CTA overlay (max 40 chars), and 3-8 hashtags.`,
      }

      // 3. Build system prompt
      let systemPrompt = `You are an expert performance marketing copywriter working for an Australian marketing agency.
You write high-converting ad copy that strictly adheres to platform character limits.

CRITICAL RULES:
- Character limits are ABSOLUTE. Count every character. Never exceed them.
- Australian English spelling (colour, behaviour, organisation, etc.)
- Each variant must use a DIFFERENT creative angle (e.g. problem-aware, social proof, urgency, benefit-led, curiosity)
- Match the brand's tone of voice
- Write for the specified campaign objective: ${objective}
${budget_hint ? `- Budget context: ${budget_hint} — tailor copy aggressiveness accordingly` : ''}

${platformFieldMap[platform]}

Only populate the field for the requested platform. Leave other platform fields empty/undefined.`

      if (isHealthBrand) {
        systemPrompt += `

AHPRA/TGA COMPLIANCE (MANDATORY — FINES UP TO $120,000 PER OFFENCE):
- NO therapeutic claims (e.g. "cures", "treats", "heals", "fixes")
- NO before/after imagery references or implied guaranteed results
- NO testimonials claiming therapeutic outcomes
- NO misleading or deceptive claims
- Use words like "may help", "supports", "designed to assist"
- Include compliance_notes for each variant explaining how compliance was maintained
${brand.compliance_flags?.tga ? '- TGA: Do NOT promote prescription-only medicines to the public' : ''}`
      }

      systemPrompt += `

PLATFORM POLICY AWARENESS:
${platformPolicy}
Include any relevant platform_policy_notes for each variant.`

      const userPrompt = `Generate ${variants} ad variant(s) for the "${platform.replace('_', ' ')}" platform.

BRAND CONTEXT:
${brandContext}

OFFER: ${offer}
${target_audience ? `TARGET AUDIENCE: ${target_audience}` : ''}
OBJECTIVE: ${objective}

Generate the ad copy now. Remember: character limits are STRICT — count carefully.`

      // 4. Generate ad copy via LLM
      let result: z.infer<typeof WriteAdsOutputSchema>
      try {
        const { object } = await generateObject({
          model: gateway('anthropic/claude-sonnet-4'),
          system: systemPrompt,
          prompt: userPrompt,
          schema: WriteAdsOutputSchema,
        })
        result = object
      } catch (err) {
        console.error('write_ads generation error:', err)
        return {
          success: false,
          error: 'Failed to generate ad copy. Please try again.',
        }
      }

      // 5. Run compliance filter for health brands
      let complianceResult = null
      if (isHealthBrand) {
        try {
          const allCopy = result.variants
            .map(v => {
              const parts: string[] = [v.angle]
              if (v.google_search) {
                parts.push(...v.google_search.headlines, ...v.google_search.descriptions)
              }
              if (v.google_display) {
                parts.push(v.google_display.headline, v.google_display.long_headline, v.google_display.description)
              }
              if (v.meta) {
                parts.push(v.meta.primary_text, v.meta.headline, v.meta.description)
              }
              if (v.linkedin) {
                parts.push(v.linkedin.intro_text, v.linkedin.headline, v.linkedin.description)
              }
              if (v.tiktok) {
                parts.push(v.tiktok.hook, v.tiktok.body_script, v.tiktok.cta_overlay)
              }
              return parts.join('\n')
            })
            .join('\n---\n')

          complianceResult = await runComplianceFilter(allCopy, brand.compliance_flags, brand.brand_dna_constraints)
        } catch {
          // Non-blocking
        }
      }

      // 6. Save to output library
      const preview = formatPreview(result)
      const { data: output, error: saveError } = await supabase
        .from('outputs')
        .insert({
          user_id: userId,
          brand_id: brandId,
          conversation_id: conversationId,
          output_type: 'ad_copy',
          title: `${platform.replace('_', ' ')} ads — ${offer.slice(0, 60)}`,
          content: preview,
          metadata: {
            platform,
            objective,
            offer,
            target_audience: target_audience ?? null,
            budget_hint: budget_hint ?? null,
            variant_count: variants,
            structured_data: result,
            compliance: complianceResult,
          },
        })
        .select('id')
        .single()

      if (saveError) {
        console.error('write_ads save error:', saveError)
      }

      // 7. Return formatted result
      return {
        success: true,
        output_id: output?.id ?? null,
        preview,
        variant_count: result.variants.length,
        platform,
        objective,
        ...(complianceResult
          ? {
              ...(complianceResult.warnings.length ? { compliance_warnings: complianceResult.warnings } : {}),
              ...(complianceResult.flags.length ? { compliance_flags: complianceResult.flags } : {}),
              ...(complianceResult.regulatoryCitations.length ? { regulatory_citations: complianceResult.regulatoryCitations } : {}),
              ...(complianceResult.regulatoryCorpusVersion ? { regulatory_corpus_version: complianceResult.regulatoryCorpusVersion } : {}),
            }
          : {}),
      }
    },
  })
}
