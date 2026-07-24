const MAX_SITEMAP_CANDIDATES = 5
const MAX_SITEMAP_DOCUMENT_CHARS = 500_000

function canonicalOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function sameOriginUrl(candidate: string, origin: string): string | null {
  try {
    const url = new URL(candidate, origin)
    return url.origin === origin ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Discovers a limited, same-origin sitemap surface. The caller is responsible
 * for fetching no more than this bounded list and never follows foreign hosts.
 */
export function sitemapCandidatesForWebsite(
  websiteUrl: string,
  robotsText = '',
): string[] {
  const origin = canonicalOrigin(websiteUrl)
  if (!origin) return []

  const candidates = robotsText
    .split(/\r?\n/)
    .map((line) => /^\s*sitemap\s*:\s*(\S+)\s*$/i.exec(line)?.[1] ?? null)
    .filter((value): value is string => Boolean(value))

  candidates.push('/sitemap.xml', '/sitemap_index.xml')

  return [...new Set(candidates
    .map((candidate) => sameOriginUrl(candidate, origin))
    .filter((value): value is string => Boolean(value)))]
    .slice(0, MAX_SITEMAP_CANDIDATES)
}

/** Extract a capped set of same-origin page locations from a sitemap document. */
export function parseSitemapLocations(
  sitemapXml: string,
  websiteUrl: string,
  limit = 50,
): string[] {
  const origin = canonicalOrigin(websiteUrl)
  if (!origin || limit <= 0) return []

  const locations = sitemapXml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)
  const valid = new Set<string>()

  for (const match of locations) {
    const location = sameOriginUrl(match[1].trim(), origin)
    if (!location) continue
    valid.add(location)
    if (valid.size >= limit) break
  }

  return [...valid]
}

async function fetchBoundedText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NRSAgencyBot/1.0 (+https://notrealsmart.com.au)' },
      cache: 'no-store',
    })
    return response.ok ? (await response.text()).slice(0, MAX_SITEMAP_DOCUMENT_CHARS) : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * This deliberately does not crawl pages. It reads robots.txt then a small,
 * same-origin sitemap set so the Director can see the site's public shape.
 */
export async function discoverWebsiteSitemap(websiteUrl: string): Promise<{
  robotsFound: boolean
  sitemapUrls: string[]
  pageUrls: string[]
}> {
  const origin = canonicalOrigin(websiteUrl)
  if (!origin) return { robotsFound: false, sitemapUrls: [], pageUrls: [] }

  const robotsText = await fetchBoundedText(`${origin}/robots.txt`, 6_000)
  const sitemapUrls = sitemapCandidatesForWebsite(websiteUrl, robotsText ?? '')
  const responses = await Promise.all(sitemapUrls.map(async (url) => ({
    url,
    text: await fetchBoundedText(url, 8_000),
  })))
  const pageUrls = [...new Set(responses.flatMap(({ text }) => text
    ? parseSitemapLocations(text, websiteUrl, 50)
    : []))].slice(0, 50)

  return { robotsFound: Boolean(robotsText), sitemapUrls, pageUrls }
}
