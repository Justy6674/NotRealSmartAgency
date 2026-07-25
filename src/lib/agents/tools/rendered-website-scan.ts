import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'

export const RENDERED_WEBSITE_SCAN_SCHEMA = 'nrs.rendered_website_scan.v1'

const MAX_CRAWL_PAGES = 5
const NAVIGATION_TIMEOUT_MS = 15_000
const POST_LOAD_SETTLE_MS = 1_000
const MAX_BODY_TEXT = 6_000
const MAX_LINKS = 80
const MAX_SCREENSHOT_BYTES = 1_500_000

export interface WebsiteHeading {
  level: string
  text: string
}

export interface WebsiteForm {
  label: string
  action: string | null
  method: string | null
}

export interface RenderedWebsitePageEvidence {
  requestedUrl: string
  finalUrl: string
  title: string | null
  description: string | null
  canonicalUrl: string | null
  robots: string | null
  headings: WebsiteHeading[]
  bodyText: string
  ctas: string[]
  forms: WebsiteForm[]
  links: string[]
  structuredDataTypes: string[]
  screenshotBase64: string | null
  loadMs: number
  warnings?: string[]
}

export interface RenderedWebsitePage extends Omit<RenderedWebsitePageEvidence, 'screenshotBase64'> {
  screenshotBytes: Uint8Array | null
}

export interface RenderedWebsiteScanResult {
  schema_version: typeof RENDERED_WEBSITE_SCAN_SCHEMA
  evidence_source: 'rendered_browser'
  status: 'completed' | 'partial'
  trace_id: string
  url: string
  title: string | null
  description: string | null
  headings: WebsiteHeading[]
  bodyText: string
  pages: Array<Omit<RenderedWebsitePage, 'screenshotBytes'>>
  ctas: string[]
  forms: WebsiteForm[]
  structured_data_types: string[]
  screenshot_base64: string | null
  summary: string
  warnings: string[]
  unknowns: string[]
}

export type SafeWebsiteUrlResult =
  | { ok: true; url: URL }
  | { ok: false; error: string }

function trimText(value: string | null | undefined, limit: number): string | null {
  const text = value?.replace(/\s+/g, ' ').trim() ?? ''
  return text ? text.slice(0, limit) : null
}

function isPrivateIpAddress(address: string): boolean {
  const literal = address.replace(/^\[|\]$/g, '')
  const version = isIP(literal)
  if (version === 4) {
    const [a, b] = literal.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
  }

  if (version === 6) {
    const value = literal.toLowerCase()
    return value === '::1' || value === '::' || value.startsWith('fc') ||
      value.startsWith('fd') || /^fe[89ab]/.test(value) || value.startsWith('ff') ||
      value.startsWith('::ffff:')
  }

  return false
}

/** Rejects inputs that can never be safely fetched by the renderer. */
export function getSafeWebsiteUrl(rawUrl: string): SafeWebsiteUrlResult {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: 'The website address is not a valid URL.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Only public HTTP and HTTPS websites can be rendered.' }
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Website addresses with credentials are not allowed.' }
  }

  const hostname = url.hostname.toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateIpAddress(hostname)) {
    return { ok: false, error: 'Private, local, and metadata-network addresses cannot be rendered.' }
  }

  return { ok: true, url }
}

async function resolvePublicWebsiteUrl(url: URL): Promise<SafeWebsiteUrlResult> {
  const inputSafety = getSafeWebsiteUrl(url.toString())
  if (!inputSafety.ok) return inputSafety

  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true })
    if (!addresses.length || addresses.some((entry) => isPrivateIpAddress(entry.address))) {
      return { ok: false, error: 'The website address resolves to a private or unsafe network.' }
    }
  } catch {
    return { ok: false, error: 'The website host could not be resolved safely.' }
  }

  return { ok: true, url }
}

function shouldSkipCrawlUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase()
  return /\/(logout|signout|log-out|delete|checkout|cart|account)(?:\/|$)/.test(path) ||
    /\.(?:pdf|zip|jpg|jpeg|png|gif|webp|svg|mp4|mov|mp3|wav)$/i.test(path)
}

/** Select a small, deterministic set of public pages for a single audit. */
export function selectSameOriginCrawlUrls(rootUrl: string, links: string[]): string[] {
  const root = getSafeWebsiteUrl(rootUrl)
  if (!root.ok) return []

  const selected = [root.url.toString()]
  const seen = new Set(selected.map((value) => new URL(value).toString()))
  for (const candidate of links) {
    if (selected.length >= MAX_CRAWL_PAGES) break
    const parsed = getSafeWebsiteUrl(candidate)
    if (!parsed.ok || parsed.url.origin !== root.url.origin || shouldSkipCrawlUrl(parsed.url)) continue
    const normalised = parsed.url.toString()
    if (seen.has(normalised)) continue
    seen.add(normalised)
    selected.push(normalised)
  }

  return selected
}

function buildSummary(page: RenderedWebsitePageEvidence): string {
  const parts = [
    `Rendered ${page.finalUrl}.`,
    page.title ? `Title: ${page.title}.` : 'No title was exposed.',
    `${page.headings.length} visible heading${page.headings.length === 1 ? '' : 's'}.`,
    `${page.ctas.length} call-to-action${page.ctas.length === 1 ? '' : 's'} observed.`,
  ]
  return parts.join(' ')
}

/** Converts direct browser observations into a model-safe, evidence-only payload. */
export function buildRenderedWebsiteScanResult(
  page: RenderedWebsitePageEvidence,
  options: { traceId?: string; additionalPages?: RenderedWebsitePage[] } = {},
): RenderedWebsiteScanResult {
  const warnings = [...(page.warnings ?? [])]
  const incomplete = Boolean(warnings.length || (!page.title && !page.bodyText && page.headings.length === 0))
  const allPages = [
    {
      ...page,
      screenshotBytes: page.screenshotBase64 ? Buffer.from(page.screenshotBase64, 'base64') : null,
    },
    ...(options.additionalPages ?? []),
  ].map(({ screenshotBytes, ...evidence }) => evidence)

  return {
    schema_version: RENDERED_WEBSITE_SCAN_SCHEMA,
    evidence_source: 'rendered_browser',
    status: incomplete ? 'partial' : 'completed',
    trace_id: options.traceId ?? randomUUID(),
    url: page.finalUrl,
    title: page.title,
    description: page.description,
    headings: page.headings,
    bodyText: page.bodyText,
    pages: allPages,
    ctas: page.ctas,
    forms: page.forms,
    structured_data_types: page.structuredDataTypes,
    screenshot_base64: page.screenshotBase64,
    summary: buildSummary(page),
    warnings,
    unknowns: [
      'Search-engine indexing, rankings, traffic, and visitor behaviour require separate first-party evidence.',
    ],
  }
}

async function inspectCurrentPage(page: import('playwright-core').Page, requestedUrl: string, includeScreenshot: boolean): Promise<RenderedWebsitePage> {
  const startedAt = Date.now()
  const finalUrl = page.url()
  const data = await page.evaluate(({ maxBodyText, maxLinks }) => {
    const text = (value: string | null | undefined, max: number) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
    const unique = (values: string[], max: number) => [...new Set(values.filter(Boolean))].slice(0, max)
    const absolute = (value: string | null | undefined) => {
      if (!value) return null
      try { return new URL(value, window.location.href).toString() } catch { return null }
    }
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .map((element) => ({ level: element.tagName.toLowerCase(), text: text(element.textContent, 280) }))
      .filter((heading) => heading.text)
      .slice(0, 30)
    const ctas = unique(Array.from(document.querySelectorAll('a,button,input[type="submit"]'))
      .map((element) => text(element.getAttribute('aria-label') || element.textContent || (element as HTMLInputElement).value, 180))
      .filter((label) => /(?:start|join|sign|book|shop|buy|sell|swap|explore|learn|view|get|try|contact|list|subscribe)/i.test(label)), 20)
    const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
      label: text(form.getAttribute('aria-label') || form.querySelector('legend,h1,h2,h3,label')?.textContent || 'Unlabelled form', 180),
      action: absolute(form.getAttribute('action')),
      method: form.getAttribute('method')?.toLowerCase() ?? 'get',
    })).slice(0, 10)
    const links = unique(Array.from(document.querySelectorAll('a[href]'))
      .map((element) => absolute(element.getAttribute('href')))
      .filter((value): value is string => Boolean(value)), maxLinks)
    const structuredDataTypes = unique(Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .flatMap((script) => {
        try {
          const parsed = JSON.parse(script.textContent ?? '')
          const values = Array.isArray(parsed) ? parsed : [parsed]
          return values.flatMap((value) => {
            if (!value || typeof value !== 'object') return []
            const type = (value as { '@type'?: unknown })['@type']
            return Array.isArray(type) ? type.filter((item): item is string => typeof item === 'string') : typeof type === 'string' ? [type] : []
          })
        } catch { return [] }
      }), 20)

    return {
      title: text(document.title, 300) || null,
      description: text(document.querySelector('meta[name="description"]')?.getAttribute('content'), 500) || null,
      canonicalUrl: absolute(document.querySelector('link[rel="canonical"]')?.getAttribute('href')),
      robots: text(document.querySelector('meta[name="robots"]')?.getAttribute('content'), 300) || null,
      headings,
      bodyText: text(document.body?.innerText, maxBodyText),
      ctas,
      forms,
      links,
      structuredDataTypes,
    }
  }, { maxBodyText: MAX_BODY_TEXT, maxLinks: MAX_LINKS })

  let screenshotBytes: Uint8Array | null = null
  if (includeScreenshot) {
    try {
      const screenshot = await page.screenshot({ type: 'png', fullPage: false })
      screenshotBytes = screenshot.byteLength <= MAX_SCREENSHOT_BYTES ? screenshot : null
    } catch {
      // Evidence extraction remains useful even when a visual artifact is unavailable.
    }
  }

  return {
    requestedUrl,
    finalUrl,
    ...data,
    screenshotBytes,
    loadMs: Date.now() - startedAt,
  }
}

/**
 * Render a public website in Chromium. It never carries user cookies, submits
 * a form, or permits a request to a private network address.
 */
export async function renderWebsiteEvidence(url: string): Promise<RenderedWebsiteScanResult | { error: string; suggestion: string }> {
  const parsed = getSafeWebsiteUrl(url)
  if (!parsed.ok) return { error: parsed.error, suggestion: 'Use the public homepage address, including https://.' }
  const resolved = await resolvePublicWebsiteUrl(parsed.url)
  if (!resolved.ok) return { error: resolved.error, suggestion: 'Use a public website address that can be safely reached from NRS.' }

  const traceId = randomUUID()
  const checkedOrigins = new Map<string, Promise<boolean>>()
  const isPublicRequest = async (requestUrl: string): Promise<boolean> => {
    const candidate = getSafeWebsiteUrl(requestUrl)
    if (!candidate.ok) return false
    const key = candidate.url.origin
    const cached = checkedOrigins.get(key)
    if (cached) return cached
    const check = resolvePublicWebsiteUrl(candidate.url).then((result) => result.ok)
    checkedOrigins.set(key, check)
    return check
  }

  let browser: import('playwright-core').Browser | null = null
  try {
    chromium.setGraphicsMode = false
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      userAgent: 'Mozilla/5.0 (compatible; NRSAgencyAudit/1.0; +https://notrealsmart.com.au)',
      javaScriptEnabled: true,
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
    page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS)
    await page.route('**/*', async (route) => {
      const request = route.request()
      const resourceType = request.resourceType()
      if (['image', 'media', 'font'].includes(resourceType)) return route.abort('blockedbyclient')
      if (!await isPublicRequest(request.url())) return route.abort('blockedbyclient')
      return route.continue()
    })

    await page.goto(resolved.url.toString(), { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(POST_LOAD_SETTLE_MS)
    const home = await inspectCurrentPage(page, resolved.url.toString(), true)
    const finalSafety = await resolvePublicWebsiteUrl(new URL(home.finalUrl))
    if (!finalSafety.ok) return { error: finalSafety.error, suggestion: 'The website redirected to an address NRS cannot safely inspect.' }

    const extraPages: RenderedWebsitePage[] = []
    for (const pageUrl of selectSameOriginCrawlUrls(home.finalUrl, home.links).slice(1)) {
      const safePage = await resolvePublicWebsiteUrl(new URL(pageUrl))
      if (!safePage.ok) continue
      try {
        await page.goto(safePage.url.toString(), { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(POST_LOAD_SETTLE_MS)
        const inspected = await inspectCurrentPage(page, safePage.url.toString(), false)
        const safeFinal = await resolvePublicWebsiteUrl(new URL(inspected.finalUrl))
        if (safeFinal.ok) extraPages.push(inspected)
      } catch {
        // One secondary-page failure must not discard a completed homepage audit.
      }
    }

    return buildRenderedWebsiteScanResult({
      ...home,
      screenshotBase64: home.screenshotBytes ? Buffer.from(home.screenshotBytes).toString('base64') : null,
    }, { traceId, additionalPages: extraPages })
  } catch (error) {
    return {
      error: 'NRS could not complete the rendered website audit.',
      suggestion: error instanceof Error && /timeout/i.test(error.message)
        ? 'The site took too long to render. Try again shortly or send the key page URL directly.'
        : 'Try again shortly or send the key page URL directly.',
    }
  } finally {
    await browser?.close().catch(() => undefined)
  }
}
