import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'

/**
 * The whole brand contract for one project, in a single read.
 *
 * A plugged-in AI could previously see only a project's name, description and
 * URL, so anything it built itself — a design, a caption drafted off-platform —
 * inherited whatever palette and tone happened to be lying around. Voice was
 * protected because copy goes through the Director; visual identity was not
 * protected at all.
 *
 * This closes that. It is deliberately read-only and returns constraints rather
 * than instructions: the colours to use, the logo to place, the words never to
 * write. An assistant that reads this has no excuse for going off-brand.
 */

interface ToneOfVoiceShape {
  formality?: string
  humour?: string
  keywords?: string[]
  avoid_words?: string[]
}

interface BrandDnaShape {
  voice_rules?: string[]
  banned_words?: string[]
  never_do?: string[]
  content_philosophy?: string
  narrative_world?: string
  typography?: { display?: string; body?: string; notes?: string }
  founder_voice?: {
    name?: string
    framing?: string
    platforms?: string[]
    perspective?: string
    signature_phrases?: string[]
  }
}

interface TargetAudienceShape {
  demographics?: string
  pain_points?: string[]
  desires?: string[]
}

function bullet(items: readonly string[] | undefined, empty: string): string {
  if (!items?.length) return `${empty}\n`
  return items.map((item) => `- ${item}\n`).join('')
}

export function createGetBrandKitTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Get the complete brand contract for a project — exact hex colours, logo URL, typography, voice rules, banned words, hard "never do" constraints, positioning, compliance flags and connected social accounts. Call this BEFORE writing any copy, building any design, or generating any image for a project, so the output matches the brand instead of guessing at it.',
    inputSchema: z.object({
      project_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          'Project to read. Defaults to the current project; pass an id from list_projects to read a different one.',
        ),
    }),
    execute: async ({ project_id }) => {
      const targetId = project_id ?? brandId

      const { data: brand, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', targetId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error || !brand) {
        return { error: 'Could not read that project. Call list_projects for the ids you can access.' }
      }

      const colours = (brand.brand_colours ?? {}) as Record<string, string>
      const dna = (brand.brand_dna_constraints ?? {}) as BrandDnaShape
      const tov = (brand.tone_of_voice ?? {}) as ToneOfVoiceShape
      const audience = (brand.target_audience ?? {}) as TargetAudienceShape
      const compliance = (brand.compliance_flags ?? {}) as Record<string, unknown>

      let md = `# Brand contract — ${brand.name}\n\n`
      md += `${brand.tagline ?? ''}\n\n`
      if (brand.description) md += `${brand.description}\n\n`

      md += `## Colours — use these exact values\n`
      if (Object.keys(colours).length) {
        md += `| Role | Hex |\n|------|-----|\n`
        for (const [role, hex] of Object.entries(colours)) {
          md += `| ${role} | ${hex} |\n`
        }
        md += `\nNever substitute an approximate colour. A near miss reads as a different brand.\n\n`
      } else {
        md += `Not set. Do not invent a palette — ask before designing.\n\n`
      }

      md += `## Logo\n`
      md += brand.logo_url
        ? `${brand.logo_url}\n\nPlace this file. Do not draw, recreate or substitute a logo, and do not rely on an AI layout generator to position it.\n\n`
        : `Not set. Do not invent one.\n\n`

      md += `## Typography\n`
      md += dna.typography?.display || dna.typography?.body
        ? `- Display: ${dna.typography.display ?? 'not set'}\n- Body: ${dna.typography.body ?? 'not set'}\n${dna.typography.notes ? `- ${dna.typography.notes}\n` : ''}\n`
        : `Not set. Match the live site rather than choosing a font.\n\n`

      md += `## Voice rules\n${bullet(dna.voice_rules, 'None recorded.')}\n`

      md += `## Never do — hard constraints\n${bullet(dna.never_do, 'None recorded.')}\n`

      const banned = [...new Set([...(dna.banned_words ?? []), ...(tov.avoid_words ?? [])])]
      md += `## Never use these words\n${bullet(banned, 'None recorded.')}\n`

      md += `## Tone\n`
      md += `- Formality: ${tov.formality ?? 'not set'}\n- Humour: ${tov.humour ?? 'not set'}\n`
      if (tov.keywords?.length) md += `- Keywords: ${tov.keywords.join(', ')}\n`
      if (dna.content_philosophy) md += `- Content philosophy: ${dna.content_philosophy}\n`
      md += `\n`

      if (dna.founder_voice?.name) {
        md += `## Founder voice\n`
        md += `${dna.founder_voice.name}`
        if (dna.founder_voice.framing) md += ` — ${dna.founder_voice.framing}`
        md += `\n`
        if (dna.founder_voice.perspective) md += `${dna.founder_voice.perspective}\n`
        md += `\n`
      }

      if (audience.demographics || audience.pain_points?.length) {
        md += `## Audience\n`
        if (audience.demographics) md += `${audience.demographics}\n`
        if (audience.pain_points?.length) md += `Pain points: ${audience.pain_points.join('; ')}\n`
        if (audience.desires?.length) md += `Wants: ${audience.desires.join('; ')}\n`
        md += `\n`
      }

      if (brand.content_pillars?.length) {
        md += `## Content pillars\n${bullet(brand.content_pillars as string[], '')}\n`
      }

      // Compliance is the most expensive thing to get wrong, so it is stated
      // even when both flags are false.
      md += `## Compliance\n`
      md += compliance.ahpra ? `- **AHPRA applies.** Advertising a regulated health service — no testimonials, no before/after imagery, no outcome guarantees.\n` : `- AHPRA: not flagged\n`
      md += compliance.tga ? `- **TGA applies.** No naming or promoting prescription-only medicines to the public.\n` : `- TGA: not flagged\n`
      md += `\n`

      if (brand.extra_context) md += `## Project context\n${brand.extra_context}\n\n`

      // Where this brand can actually publish. Drafting for a project with no
      // connected account is legitimate, but pretending it will go out is not.
      try {
        const profileId = zernioProfileIdFromSocialUrls(brand.social_urls)
        md += `## Connected accounts\n`
        if (profileId) {
          const zernioAccounts = await fetchZernioAccounts(profileId)
          md += zernioAccounts.length
            ? zernioAccounts
              .map((a) => `- ${ownerFacingPlatformLabel(a.platform)}: ${a.displayName || a.username || a.platform}\n`)
              .join('')
            : `None connected. A draft for this project has nowhere to publish yet — say so rather than implying it will go out.\n`
        } else {
          const accounts = (await fetchMixpostAccounts()) ?? []
          const mapping = mapMixpostAccountsToBrands(accounts, [
            { id: brand.id, name: brand.name, slug: brand.slug, social_urls: brand.social_urls ?? {} },
          ])
          const connected = mapping[brand.id] ?? []
          md += connected.length
            ? connected.map((a) => `- ${a.platform}: ${a.accountName}\n`).join('')
            : `None connected. A draft for this project has nowhere to publish yet — say so rather than implying it will go out.\n`
        }
        md += `\n`
      } catch {
        md += `## Connected accounts\nCould not reach the publisher; account list unavailable.\n\n`
      }

      return {
        summary: md,
        colours,
        logo_url: brand.logo_url,
        typography: dna.typography ?? null,
        voice_rules: dna.voice_rules ?? [],
        never_do: dna.never_do ?? [],
        banned_words: banned,
      }
    },
  })
}
