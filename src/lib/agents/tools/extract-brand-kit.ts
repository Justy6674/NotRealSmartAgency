import { tool, generateObject } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'

const brandKitSchema = z.object({
  colours: z.object({
    primary: z.string().describe('Primary brand hex colour'),
    secondary: z.string().describe('Secondary brand hex colour'),
    accent: z.string().describe('Accent/highlight hex colour'),
    background: z.string().describe('Background hex colour'),
    text: z.string().describe('Text hex colour'),
  }),
  voice: z.object({
    formality: z.enum(['casual', 'conversational', 'professional', 'formal']),
    humour: z.enum(['none', 'light', 'moderate', 'heavy']),
    keywords: z.array(z.string()).describe('Brand voice keywords (5-10)'),
    avoid_words: z.array(z.string()).describe('Words to avoid (3-5)'),
  }),
  tagline: z.string().optional().describe('Brand tagline if found on the site'),
  key_messaging: z.array(z.string()).describe('Key marketing messages found'),
  content_philosophy: z
    .enum(['storytelling_first', 'product_first', 'educational_first', 'community_first'])
    .optional()
    .describe('Inferred content philosophy'),
  industry: z.string().describe('Industry or sector the brand operates in'),
  target_audience_summary: z.string().describe('Summary of who the brand targets'),
})

export function createExtractBrandKitTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Extract brand identity (colours, voice, tagline, messaging, audience) from a website URL. Scans the site, analyses the content with AI, and updates the brand profile. Use when onboarding a new brand or refreshing brand settings from their website.',
    inputSchema: z.object({
      url: z
        .string()
        .optional()
        .describe(
          'Website URL to extract brand kit from. Defaults to the brand\'s saved website_url if not provided.'
        ),
    }),
    execute: async ({ url }) => {
      // 1. Resolve URL — use provided or fall back to brand's website_url
      let targetUrl = url

      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('name, website_url, tone_of_voice, brand_colours, brand_dna_constraints')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single()

      if (brandError || !brand) {
        return { error: 'Could not fetch brand. Please ensure the brand exists.' }
      }

      if (!targetUrl) {
        targetUrl = brand.website_url as string | undefined
      }

      if (!targetUrl) {
        return {
          error:
            'No URL provided and the brand has no website_url saved. Please provide a URL or set the brand\'s website first.',
        }
      }

      // Ensure URL has a protocol
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`
      }

      // 2. Scan the website (inline, same logic as scanWebsiteCore)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)

      let html: string
      try {
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; NRSAgencyBot/1.0; +https://notrealsmart.com.au)',
          },
        })
        html = await response.text()
      } catch {
        return {
          error: `Could not reach ${targetUrl}. Check the URL is correct and the site is online.`,
        }
      } finally {
        clearTimeout(timeout)
      }

      // Extract page content
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : ''

      const metaMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
      const description = metaMatch ? metaMatch[1].trim() : ''

      const headingRegex = /<h([123])[^>]*>([\s\S]*?)<\/h\1>/gi
      const headings: string[] = []
      let headingMatch
      while ((headingMatch = headingRegex.exec(html)) !== null) {
        const text = headingMatch[2].replace(/<[^>]+>/g, '').trim()
        if (text) headings.push(text)
      }

      const bodyText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000)

      // Extract inline CSS colour values for hints
      const cssColours: string[] = []
      const colourRegex = /#[0-9a-fA-F]{3,8}\b/g
      const styleBlocks = html.match(/<style[\s\S]*?<\/style>/gi) ?? []
      for (const block of styleBlocks) {
        let colourMatch
        while ((colourMatch = colourRegex.exec(block)) !== null) {
          if (!cssColours.includes(colourMatch[0]) && cssColours.length < 20) {
            cssColours.push(colourMatch[0])
          }
        }
      }

      // 3. Send to Claude for analysis
      const systemPrompt = `You are a brand identity analyst. Given a website's content and metadata, extract the brand's visual identity, voice, and messaging.

Be precise with hex colours — if CSS colours are provided, use them as strong signals. If not, infer from the brand's industry and tone.
Use Australian English throughout.
For voice analysis, focus on the actual writing style found on the page, not assumptions.
For content_philosophy, only set it if there's clear evidence.`

      const userPrompt = `Analyse this website and extract the brand identity kit.

**URL:** ${targetUrl}
**Page Title:** ${title}
**Meta Description:** ${description}

**Headings:**
${headings.slice(0, 15).map((h) => `- ${h}`).join('\n')}

**CSS Colours Found:**
${cssColours.length > 0 ? cssColours.join(', ') : 'None extracted'}

**Body Copy (first 4000 chars):**
${bodyText}`

      try {
        const { object: kit } = await generateObject({
          model: gateway(getGatewayModel('fast')),
          providerOptions: getGatewayProviderOptions('fast'),
          system: systemPrompt,
          prompt: userPrompt,
          schema: brandKitSchema,
        })

        // 4. Update brand in Supabase
        const existingTov = (brand.tone_of_voice ?? {}) as {
          formality?: string
          humour?: string
          keywords?: string[]
          avoid_words?: string[]
        }
        const existingColours = (brand.brand_colours ?? {}) as Record<string, string>
        const existingDna = (brand.brand_dna_constraints ?? {}) as {
          content_philosophy?: string
          [key: string]: unknown
        }

        // Merge keywords — keep existing, add new unique ones
        const existingKeywords = existingTov.keywords ?? []
        const mergedKeywords = [
          ...new Set([...existingKeywords, ...kit.voice.keywords]),
        ]

        const updatedTov = {
          ...existingTov,
          formality: kit.voice.formality,
          humour: kit.voice.humour,
          keywords: mergedKeywords,
          avoid_words: kit.voice.avoid_words,
        }

        const updatedColours = {
          ...existingColours,
          primary: kit.colours.primary,
          secondary: kit.colours.secondary,
          accent: kit.colours.accent,
          background: kit.colours.background,
          text: kit.colours.text,
        }

        const updatePayload: Record<string, unknown> = {
          tone_of_voice: updatedTov,
          brand_colours: updatedColours,
        }

        // Only suggest content_philosophy if brand doesn't already have one
        let philosophySuggestion: string | null = null
        if (kit.content_philosophy && !existingDna.content_philosophy) {
          updatePayload.brand_dna_constraints = {
            ...existingDna,
            content_philosophy: kit.content_philosophy,
          }
        } else if (kit.content_philosophy && existingDna.content_philosophy) {
          philosophySuggestion = kit.content_philosophy
        }

        const { error: updateError } = await supabase
          .from('brands')
          .update(updatePayload)
          .eq('id', brandId)
          .eq('user_id', userId)

        if (updateError) {
          console.error('Brand kit update error:', updateError)
          return {
            error: 'Extracted the brand kit but failed to save it. Please try again.',
            kit,
          }
        }

        // 5. Build markdown summary
        let summary = `## Brand Kit Extracted — ${brand.name}\n\n`
        summary += `**Source:** ${targetUrl}\n\n`

        summary += `### Colours\n`
        summary += `| Role | Hex |\n|------|-----|\n`
        summary += `| Primary | ${kit.colours.primary} |\n`
        summary += `| Secondary | ${kit.colours.secondary} |\n`
        summary += `| Accent | ${kit.colours.accent} |\n`
        summary += `| Background | ${kit.colours.background} |\n`
        summary += `| Text | ${kit.colours.text} |\n\n`

        summary += `### Voice\n`
        summary += `- **Formality:** ${kit.voice.formality}\n`
        summary += `- **Humour:** ${kit.voice.humour}\n`
        summary += `- **Keywords:** ${mergedKeywords.join(', ')}\n`
        summary += `- **Avoid:** ${kit.voice.avoid_words.join(', ')}\n\n`

        if (kit.tagline) {
          summary += `### Tagline\n${kit.tagline}\n\n`
        }

        summary += `### Key Messaging\n`
        kit.key_messaging.forEach((msg) => {
          summary += `- ${msg}\n`
        })
        summary += '\n'

        summary += `### Industry & Audience\n`
        summary += `- **Industry:** ${kit.industry}\n`
        summary += `- **Target audience:** ${kit.target_audience_summary}\n\n`

        if (kit.content_philosophy) {
          if (philosophySuggestion) {
            summary += `### Content Philosophy\n`
            summary += `Detected **${philosophySuggestion}** but the brand already has **${existingDna.content_philosophy}** set. No change made — update manually if needed.\n\n`
          } else {
            summary += `### Content Philosophy\nSet to **${kit.content_philosophy}**\n\n`
          }
        }

        summary += `*Brand colours, voice settings, and keywords have been updated.*`

        return { summary, kit }
      } catch (err) {
        console.error('Brand kit extraction error:', err)
        return { error: 'Brand kit extraction failed. Please try again.' }
      }
    },
  })
}
