import { tool, generateObject } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'
import { FRAMEWORK_DEFAULT_COLOURS } from './framework-palettes'

/**
 * Colours are deliberately absent — they are derived from the site's CSS by
 * `assignPaletteRoles`, not chosen by the model. Asking for them here only
 * created an opportunity to invent them.
 */
const brandKitSchema = z.object({
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

const MAX_STYLESHEETS = 3
const MAX_STYLESHEET_BYTES = 500_000
const STYLESHEET_TIMEOUT_MS = 8_000

/** Colours a browser paints but a brand never chooses. */
const IGNORED_COLOURS = new Set([
  '#fff', '#ffffff', '#000', '#000000', '#transparent',
])

/**
 * Utility-CSS builds emit thousands of runtime colour expressions — Tailwind
 * opacity placeholders, shadow overlays, neutral borders. They outnumber the
 * brand's own colours and would otherwise dominate a frequency ranking.
 */
function isBrandCandidate(value: string): boolean {
  if (value.includes('var(--')) return false

  // A framework's own palette is compiled into the bundle regardless of use, so
  // it competes with — and often outranks — the colours the brand chose.
  if (FRAMEWORK_DEFAULT_COLOURS.has(value)) return false

  if (value.startsWith('#')) {
    // Generic neutrals carry no brand signal; deliberate near-blacks and
    // off-whites do, so only the well-known placeholder greys are dropped.
    return !['#ccc', '#cccccc', '#ddd', '#dddddd', '#eee', '#eeeeee', '#f5f5f5', '#808080'].includes(value)
  }

  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? []
  if (numbers.length < 3) return false

  const [r, g, b, alpha] = numbers
  // Overlays and shadows are translucent by design — never a brand colour.
  if (alpha !== undefined && alpha < 0.9) return false
  // Greyscale in functional notation is almost always a utility neutral.
  if (r === g && g === b) return false

  return true
}

function normaliseHex(value: string): string {
  const lower = value.toLowerCase()
  // #abc -> #aabbcc so the same colour counts once, not twice.
  if (lower.length === 4) {
    return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`
  }
  // Drop an 8-digit alpha channel; the brand colour is the RGB part.
  if (lower.length === 9) return lower.slice(0, 7)
  return lower
}

function tallyColours(css: string, counts: Map<string, number>): void {
  const patterns = [
    /#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g,
    /#[0-9a-fA-F]{6}\b(?![0-9a-fA-F])/g,
    /#[0-9a-fA-F]{8}\b(?![0-9a-fA-F])/g,
    /oklch\(\s*[^)]+\)/gi,
    /rgba?\(\s*\d+[^)]*\)/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(css)) !== null) {
      const raw = match[0]
      const value = raw.startsWith('#') ? normaliseHex(raw) : raw.toLowerCase().replace(/\s+/g, ' ')
      if (IGNORED_COLOURS.has(value)) continue
      if (!isBrandCandidate(value)) continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
}

interface ColourFacts {
  value: string
  /** 0-1, perceived lightness. */
  luminance: number
  /** 0-1, distance from grey. */
  saturation: number
}

function describeColour(value: string): ColourFacts | null {
  let r: number, g: number, b: number
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    r = parseInt(value.slice(1, 3), 16)
    g = parseInt(value.slice(3, 5), 16)
    b = parseInt(value.slice(5, 7), 16)
  } else {
    const numbers = value.match(/[\d.]+/g)?.map(Number)
    if (!numbers || numbers.length < 3 || !value.startsWith('rgb')) return null
    ;[r, g, b] = numbers
  }
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return {
    value,
    luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
    saturation: max === 0 ? 0 : (max - min) / max,
  }
}

/**
 * Assign palette roles from how often each colour is actually painted, rather
 * than asking a model to choose. The ranking already answers it: a colour used
 * 120 times is the primary and one used twice is not, and a model handed twenty
 * candidates will sometimes pick the twice-used one. Deterministic assignment
 * is also reproducible and explainable, which a guess is not.
 *
 * `candidates` must be ordered most-used first.
 */
export function assignPaletteRoles(candidates: readonly string[]): Record<string, string> | null {
  const facts = candidates.map(describeColour).filter((f): f is ColourFacts => f !== null)
  if (!facts.length) return null

  const chromatic = facts.filter((f) => f.saturation >= 0.15)
  // The most-painted colour that is not a near-neutral is the brand's primary;
  // fall back to sheer frequency for deliberately monochrome brands.
  const primary = chromatic[0] ?? facts[0]

  const lightest = [...facts].sort((a, b) => b.luminance - a.luminance)[0]
  const darkest = [...facts].sort((a, b) => a.luminance - b.luminance)[0]

  const accent =
    chromatic.find((f) => f.value !== primary.value && f.saturation > primary.saturation) ??
    chromatic.find((f) => f.value !== primary.value) ??
    primary

  const taken = new Set([primary.value, accent.value, lightest.value, darkest.value])
  const secondary = facts.find((f) => !taken.has(f.value)) ?? accent

  return {
    primary: primary.value,
    secondary: secondary.value,
    accent: accent.value,
    background: lightest.value,
    text: darkest.value,
  }
}

/**
 * Gather brand colour candidates from inline `<style>` blocks and the linked
 * stylesheets, ranked by how often each appears. Frequency is the useful
 * signal: a brand's primary is painted far more often than a one-off border.
 *
 * Network failures are non-fatal — a partial palette still beats none, and an
 * empty result is handled honestly by the caller rather than guessed at.
 */
async function fetchSiteCss(html: string, pageUrl: string): Promise<string> {
  const inline = (html.match(/<style[\s\S]*?<\/style>/gi) ?? []).join('\n')

  const hrefs: string[] = []
  const linkRegex = /<link\b[^>]*>/gi
  let linkMatch
  while ((linkMatch = linkRegex.exec(html)) !== null && hrefs.length < MAX_STYLESHEETS) {
    const tag = linkMatch[0]
    if (!/rel=["']?[^"'>]*stylesheet/i.test(tag)) continue
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    if (!href) continue
    try {
      hrefs.push(new URL(href, pageUrl).toString())
    } catch {
      // A malformed href is not worth failing the whole extraction over.
    }
  }

  const sheets = await Promise.all(hrefs.map(async (href) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), STYLESHEET_TIMEOUT_MS)
    try {
      const response = await fetch(href, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NRSAgencyBot/1.0; +https://notrealsmart.com.au)' },
      })
      if (!response.ok) return ''
      return (await response.text()).slice(0, MAX_STYLESHEET_BYTES)
    } catch {
      return ''
    } finally {
      clearTimeout(timeout)
    }
  }))

  return [inline, ...sheets.filter(Boolean)].join('\n')
}

function collectCssColours(css: string): string[] {
  const counts = new Map<string, number>()
  tallyColours(css, counts)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([colour]) => colour)
}

/**
 * Generic stacks and OS fallbacks say nothing about a brand. A face is only
 * interesting here if someone chose to load it.
 */
const GENERIC_FONTS = new Set([
  'inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'helvetica', 'arial',
  'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji', 'noto sans',
  'liberation sans', 'sfmono-regular', 'menlo', 'monaco', 'consolas', 'courier new', 'courier',
  'cambria', 'times new roman', 'times', 'georgia', 'verdana', 'tahoma',
])

/**
 * Read the brand's typefaces off the site's own CSS, ranked by how often each
 * is declared. Framework builds hash the family name (`__Inter_f367f3`), so the
 * hash is stripped back to the real family.
 *
 * Returns null when nothing but generic stacks was found — a site whose only
 * declared family is a monospace fallback has told us about a code block, not
 * about its brand, and guessing from that is how a wrong font gets locked in.
 */
export function extractBrandFonts(css: string): { display?: string; body?: string } | null {
  const counts = new Map<string, number>()

  for (const declaration of css.match(/font-family:\s*([^;}"']+)/gi) ?? []) {
    const families = declaration.replace(/font-family:\s*/i, '').split(',')
    for (const raw of families) {
      let name = raw.trim().replace(/^["']|["']$/g, '')
      if (!name || name.startsWith('var(')) continue
      // Next.js and similar emit `__Fraunces_1a2b3c` / `Fraunces Fallback`.
      name = name.replace(/^__/, '').replace(/_[0-9a-f]{6}$/i, '').replace(/\s+Fallback$/i, '').trim()
      if (!name || GENERIC_FONTS.has(name.toLowerCase())) continue
      if (!/^[A-Za-z][A-Za-z0-9 .'-]{1,40}$/.test(name)) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  if (!ranked.length) return null

  // Most-declared family carries the body; the next distinct one is usually the
  // display face. With only one family, the brand simply uses one.
  const body = ranked[0]
  const display = ranked.find((name) => name !== body)
  return display ? { display, body } : { body }
}

/**
 * Extraction logic, callable outside the agent tool loop — the same
 * `*Core` split used by `scanWebsiteCore` and `scanSocialCore` so admin
 * scripts and batch onboarding can reuse it without going through an LLM.
 */
export async function extractBrandKitCore(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  url?: string,
) {
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

      // Extract CSS colour values for hints. Modern framework builds (Next.js,
      // Vite) emit almost nothing inline — the palette lives in a linked
      // stylesheet — so inline-only scanning returns nothing and the model is
      // left to invent a palette. Read the linked stylesheets too.
      const siteCss = await fetchSiteCss(html, targetUrl)
      const cssColours = collectCssColours(siteCss)
      const cssFonts = extractBrandFonts(siteCss)

      // 3. Send to Claude for analysis
      const systemPrompt = `You are a brand identity analyst. Given a website's content and metadata, extract the brand's voice and messaging.

Colours are handled separately and are not your concern.
Use Australian English throughout.
For voice analysis, focus on the actual writing style found on the page, not assumptions.
For content_philosophy, only set it if there's clear evidence.`

      const userPrompt = `Analyse this website and extract the brand voice and messaging.

**URL:** ${targetUrl}
**Page Title:** ${title}
**Meta Description:** ${description}

**Headings:**
${headings.slice(0, 15).map((h) => `- ${h}`).join('\n')}

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

        // Merge rather than replace. An existing avoid list often encodes
        // AHPRA/TGA guardrails ("guaranteed", "miracle", "cure") that a fresh
        // read of the marketing site has no reason to rediscover. Dropping one
        // silently widens what agents are allowed to write, so this list only
        // ever grows here; removals are a deliberate edit in Brand Settings.
        const mergedAvoidWords = [
          ...new Set([...(existingTov.avoid_words ?? []), ...kit.voice.avoid_words]),
        ]

        const updatedTov = {
          ...existingTov,
          formality: kit.voice.formality,
          humour: kit.voice.humour,
          keywords: mergedKeywords,
          avoid_words: mergedAvoidWords,
        }

        const updatePayload: Record<string, unknown> = {
          tone_of_voice: updatedTov,
        }

        // Only persist colours actually read off the site's CSS, and derive the
        // roles from usage rather than from the model. With nothing to ground
        // them a palette would be inferred from the industry — plausible, wrong,
        // and then silently driving every design brief and generated asset. An
        // empty palette is honest and visibly needs filling.
        const palette = assignPaletteRoles(cssColours)
        const coloursAreGrounded = palette !== null
        if (palette) {
          updatePayload.brand_colours = { ...existingColours, ...palette }
        }

        // Typography read off the site's own CSS. Like colours, it is only
        // written when the site actually told us — a brand whose stylesheet
        // yielded nothing but generic stacks keeps an empty field rather than a
        // guessed typeface.
        if (cssFonts) {
          const existingTypography = (existingDna as { typography?: unknown }).typography
          updatePayload.brand_dna_constraints = {
            ...(updatePayload.brand_dna_constraints as Record<string, unknown> ?? existingDna),
            typography: { ...(existingTypography as Record<string, unknown> ?? {}), ...cssFonts },
          }
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
        if (palette) {
          summary += `Read from the site's stylesheets, ranked by how often each is painted.\n\n`
          summary += `| Role | Hex |\n|------|-----|\n`
          for (const [role, hex] of Object.entries(palette)) {
            summary += `| ${role[0].toUpperCase()}${role.slice(1)} | ${hex} |\n`
          }
          summary += `\n`
        } else {
          summary += `No colours could be read from the site's CSS, so none were saved. `
          summary += `Guessing a palette here would be wrong in a way that quietly spreads to every design brief. `
          summary += `Add the brand colours manually in Brand Settings.\n\n`
        }

        summary += `### Typography\n`
        summary += cssFonts
          ? `- Display: ${cssFonts.display ?? cssFonts.body}\n- Body: ${cssFonts.body}\n\n`
          : `No brand typeface could be read from the site's CSS, so none was saved.\n\n`

        summary += `### Voice\n`
        summary += `- **Formality:** ${kit.voice.formality}\n`
        summary += `- **Humour:** ${kit.voice.humour}\n`
        summary += `- **Keywords:** ${mergedKeywords.join(', ')}\n`
        summary += `- **Avoid:** ${mergedAvoidWords.join(', ')}\n\n`

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

        summary += coloursAreGrounded
          ? `*Brand colours, voice settings, and keywords have been updated.*`
          : `*Voice settings and keywords have been updated. Colours were left untouched.*`

        return { summary, kit, palette, coloursGrounded: coloursAreGrounded }
      } catch (err) {
        console.error('Brand kit extraction error:', err)
        return { error: 'Brand kit extraction failed. Please try again.' }
      }
}

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
    execute: async ({ url }) => extractBrandKitCore(supabase, userId, brandId, url),
  })
}
