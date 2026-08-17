/**
 * Where a blog article sits in the handover, in the owner's language.
 *
 * NRS never publishes the post to their website. The Director writes the
 * draft into `outputs` (`blog_article`); she copies it across, then tells us
 * it is up. Failed AHPRA/TGA copy is not stored — save-gate refuses it — so
 * "Needs a change" is an explicit hold, not a library of violations.
 */

export const BLOG_TABS = [
  'everything',
  'ready',
  'needs_change',
  'writing',
  'idea',
  'on_site',
] as const

export type BlogTab = (typeof BLOG_TABS)[number]
export type BlogHandoverStatus = BlogTab | 'dismissed'

export interface BlogArticleRow {
  id: string
  title: string
  content: string
  is_approved: boolean
  created_at: string
  metadata: Record<string, unknown>
}

export interface BlogImage {
  url: string
  alt: string
}

const IDEA_WORD_LIMIT = 200

function wordCount(row: BlogArticleRow): number {
  const meta = row.metadata.word_count
  if (typeof meta === 'number' && Number.isFinite(meta) && meta > 0) return meta
  return row.content.split(/\s+/).filter(Boolean).length
}

function handoverMarker(row: BlogArticleRow): string | null {
  const value = row.metadata.blog_handover
  return typeof value === 'string' ? value : null
}

export function blogHandoverStatus(row: BlogArticleRow): BlogHandoverStatus {
  const marker = handoverMarker(row)
  if (marker === 'dismissed') return 'dismissed'
  if (marker === 'on_site' || typeof row.metadata.published_on_site_at === 'string') {
    return 'on_site'
  }
  if (marker === 'needs_change') return 'needs_change'
  if (marker === 'idea' || wordCount(row) < IDEA_WORD_LIMIT) return 'idea'
  if (marker === 'writing') return 'writing'
  return 'ready'
}

export type BlogTabCounts = Record<Exclude<BlogTab, never>, number> & {
  everything: number
  ready: number
  needs_change: number
  writing: number
  idea: number
  on_site: number
}

export function countByStatus(rows: BlogArticleRow[]): BlogTabCounts {
  const counts: BlogTabCounts = {
    everything: 0,
    ready: 0,
    needs_change: 0,
    writing: 0,
    idea: 0,
    on_site: 0,
  }
  for (const row of rows) {
    const status = blogHandoverStatus(row)
    if (status === 'dismissed') continue
    counts.everything += 1
    counts[status] += 1
  }
  return counts
}

const SMALL = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
]

function spoken(n: number): string {
  return SMALL[n] ?? String(n)
}

export function summariseQueue(counts: BlogTabCounts): string {
  const waiting = counts.ready + counts.needs_change
  const head = `${spoken(counts.everything)} posts`.replace(/^./, (c) => c.toUpperCase())
  if (counts.everything === 0) {
    return 'No posts yet. The Director will write the first draft from the plan.'
  }
  const bits: string[] = []
  if (counts.ready > 0) bits.push(`${spoken(counts.ready)} ready to copy across`)
  if (counts.needs_change > 0) {
    bits.push(`${spoken(counts.needs_change)} need${counts.needs_change === 1 ? 's' : ''} a change`)
  }
  if (waiting === 0) return `${head}.`
  return `${head}. ${spoken(waiting)} ${waiting === 1 ? 'is' : 'are'} waiting on you — ${bits.join(', ')}.`
}

export function hostFromWebsite(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host || null
  } catch {
    return null
  }
}

export function extractBlogImages(row: BlogArticleRow): BlogImage[] {
  const meta = row.metadata
  const fromObjects = Array.isArray(meta.images)
    ? meta.images.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const rec = item as Record<string, unknown>
        if (typeof rec.url !== 'string' || !rec.url) return []
        return [{ url: rec.url, alt: typeof rec.alt === 'string' ? rec.alt : '' }]
      })
    : []
  if (fromObjects.length > 0) return fromObjects

  const urls = Array.isArray(meta.image_urls)
    ? meta.image_urls.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
  return urls.map((url) => ({ url, alt: '' }))
}
