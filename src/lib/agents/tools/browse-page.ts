import { tool } from 'ai'
import { z } from 'zod/v3'

export function createBrowsePageTool() {
  return tool({
    description:
      'Browse a web page and extract detailed content. More thorough than scan_website — fetches full page text, all headings, meta tags, links, and structured data. Use for competitor analysis, content research, or auditing landing pages.',
    inputSchema: z.object({
      url: z.string().url().describe('URL to browse'),
      extractLinks: z.boolean().default(false).describe('Also extract all links from the page'),
      extractImages: z.boolean().default(false).describe('Also extract image URLs and alt text'),
    }),
    execute: async ({ url, extractLinks, extractImages }) => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NRSAgencyBot/1.0; +https://notrealsmart.com.au)',
            'Accept': 'text/html',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) {
          return { success: false, error: `HTTP ${response.status}`, url }
        }

        const html = await response.text()

        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        const title = titleMatch?.[1]?.trim() ?? ''

        // Extract meta description
        const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
        const metaDescription = metaDescMatch?.[1]?.trim() ?? ''

        // Extract meta keywords
        const metaKeywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)
        const metaKeywords = metaKeywordsMatch?.[1]?.trim() ?? ''

        // Extract all headings
        const headings: string[] = []
        const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi
        let hMatch
        while ((hMatch = headingRegex.exec(html)) !== null) {
          const text = hMatch[2].replace(/<[^>]+>/g, '').trim()
          if (text) headings.push(`h${hMatch[1]}: ${text}`)
        }

        // Extract body text (strip HTML)
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
        const bodyHtml = bodyMatch?.[1] ?? html
        const bodyText = bodyHtml
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000)

        const result: Record<string, unknown> = {
          success: true,
          url,
          title,
          metaDescription,
          metaKeywords,
          headings: headings.slice(0, 30),
          bodyText,
          contentLength: bodyText.length,
        }

        // Extract links if requested
        if (extractLinks) {
          const links: string[] = []
          const linkRegex = /<a[^>]+href=["']([^"'#][^"']*)["']/gi
          let lMatch
          while ((lMatch = linkRegex.exec(html)) !== null && links.length < 50) {
            links.push(lMatch[1])
          }
          result.links = links
        }

        // Extract images if requested
        if (extractImages) {
          const images: { src: string; alt: string }[] = []
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/gi
          let iMatch
          while ((iMatch = imgRegex.exec(html)) !== null && images.length < 20) {
            images.push({ src: iMatch[1], alt: iMatch[2] })
          }
          result.images = images
        }

        return result
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Browse failed',
          url,
        }
      }
    },
  })
}
