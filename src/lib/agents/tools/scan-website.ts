import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createScanWebsiteTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Scan a website URL to extract its title, meta description, headings, and body copy. Use this when the user wants to analyse their website content, improve their messaging, check for SEO issues, or audit compliance. Always scan the website before making recommendations about it.',
    inputSchema: z.object({
      url: z.string().url().describe('The full URL of the website to scan (e.g. https://example.com.au)'),
      focus: z
        .enum(['general', 'seo', 'compliance', 'messaging'])
        .optional()
        .describe('Optional scan focus to guide the analysis: general, seo, compliance, or messaging'),
    }),
    execute: async ({ url, focus }) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      let html: string
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; NRSAgencyBot/1.0; +https://notrealsmart.com.au)',
          },
        })
        html = await response.text()
      } catch {
        return {
          error: 'Could not scan website',
          suggestion:
            'Try pasting your website copy directly into the chat so I can analyse it for you.',
        }
      } finally {
        clearTimeout(timeout)
      }

      // Extract <title>
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : null

      // Extract meta description
      const metaMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
      ) ?? html.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
      )
      const description = metaMatch ? metaMatch[1].trim() : null

      // Extract headings h1–h3
      const headingRegex = /<h([123])[^>]*>([\s\S]*?)<\/h\1>/gi
      const headings: { level: string; text: string }[] = []
      let headingMatch
      while ((headingMatch = headingRegex.exec(html)) !== null) {
        const text = headingMatch[2].replace(/<[^>]+>/g, '').trim()
        if (text) headings.push({ level: `h${headingMatch[1]}`, text })
      }

      // Strip all HTML tags for body text
      const bodyText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000)

      const results = { url, focus: focus ?? 'general', title, description, headings, bodyText }

      await supabase.from('project_scans').insert({
        brand_id: brandId,
        user_id: userId,
        scan_type: 'website',
        status: 'completed',
        results,
        error: null,
      })

      return results
    },
  })
}
