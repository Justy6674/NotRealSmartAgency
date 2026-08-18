import { parseInlineCards } from '@/components/agency/inline/parseInlineCards'
import type { PostPlatform } from '@/types/database'

export interface CaptionDraftExtract {
  caption: string
  hashtags: string[]
  platforms: PostPlatform[]
  /** True when hashtags came from Director prose, not hashtag groups or process_media */
  hashtagsAreSuggested: true
  source: 'post_preview_card' | 'message_sections' | 'prose_and_tags' | 'per_platform_blocks'
  /** Per-network copy. Empty when the Director only wrote one caption. */
  copies?: Array<{
    platform: PostPlatform
    caption: string
    hashtags: string[]
    title?: string
  }>
  youtubeTitle?: string
}

const PLATFORM_ALIASES: Record<string, PostPlatform> = {
  tiktok: 'tiktok',
  instagram: 'instagram',
  ig: 'instagram',
  facebook: 'facebook',
  fb: 'facebook',
  linkedin: 'linkedin',
  twitter: 'twitter',
  x: 'twitter',
  youtube: 'youtube',
  yt: 'youtube',
  bluesky: 'bluesky',
  mastodon: 'mastodon',
  pinterest: 'pinterest',
  threads: 'threads',
  'google business': 'google_business',
  google_business: 'google_business',
}

function normalisePlatform(raw: string): PostPlatform | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return PLATFORM_ALIASES[key] ?? null
}

function parseHashtagTokens(line: string): string[] {
  return line
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/^#+/, '').toLowerCase())
    .filter(Boolean)
}

function extractHashtagBlock(text: string): string[] {
  const section = text.match(/\*\*Hashtags?:\*\*\s*\n?([\s\S]*?)(?=\n\*\*|\n---|\nPlatform:|\n\*\*Platform|$)/i)
  if (section?.[1]) {
    const tags = parseHashtagTokens(section[1].replace(/\n/g, ' '))
    if (tags.length) return tags
  }

  const inline = text.match(/(?:^|\n)(#[\w\u00C0-\u024F]+(?:\s+#[\w\u00C0-\u024F]+)*)\s*(?:\n|$)/)
  if (inline?.[1]) {
    const tags = parseHashtagTokens(inline[1])
    if (tags.length >= 3) return tags
  }

  return []
}

function extractCaptionSection(text: string): string | null {
  const bold = text.match(/\*\*Caption:\*\*\s*\n([\s\S]*?)(?=\n\*\*Hashtags?:|\n\*\*Platform:|\n---|\nPlatform:|\n\*\*Format:|\n\*\*Notes:|\n\*\*Character count:|\n\*\*Media|$)/i)
  if (bold?.[1]?.trim()) return bold[1].trim()

  const plain = text.match(/(?:^|\n)Caption:\s*\n([\s\S]*?)(?=\n(?:Hashtags?:|Platform:|Format:|Notes:|Character count:|Media:|\*\*))/i)
  if (plain?.[1]?.trim()) return plain[1].trim()

  return null
}

function extractPlatforms(text: string): PostPlatform[] {
  const found = new Set<PostPlatform>()
  const platformLine = text.match(/\*\*Platform:\*\*\s*([^\n]+)/i) ?? text.match(/(?:^|\n)Platform:\s*([^\n]+)/i)
  if (platformLine?.[1]) {
    for (const part of platformLine[1].split(/[,/&]+/)) {
      const p = normalisePlatform(part)
      if (p) found.add(p)
    }
  }
  return [...found]
}

const PLATFORM_HEADING: Array<{ label: RegExp; platform: PostPlatform }> = [
  { label: /instagram|ig\b/i, platform: 'instagram' },
  { label: /tiktok/i, platform: 'tiktok' },
  { label: /youtube|yt\b/i, platform: 'youtube' },
  { label: /facebook|fb\b/i, platform: 'facebook' },
  { label: /linkedin/i, platform: 'linkedin' },
  { label: /\bx\b|twitter/i, platform: 'twitter' },
]

function headingPlatform(line: string): PostPlatform | null {
  const cleaned = line.replace(/[*#_]/g, '').trim()
  if (!cleaned || cleaned.length > 40) return null
  for (const row of PLATFORM_HEADING) {
    if (row.label.test(cleaned) && /^(instagram|tiktok|youtube|facebook|linkedin|twitter|x|ig|yt|fb)\b/i.test(cleaned)) {
      return row.platform
    }
  }
  return null
}

function extractYoutubeTitle(block: string): string | undefined {
  const match =
    block.match(/\*\*Title(?: suggestion)?:\*\*\s*([^\n]+)/i) ??
    block.match(/(?:^|\n)Title(?: suggestion)?:\s*([^\n]+)/i)
  const title = match?.[1]?.trim()
  return title || undefined
}

function extractBlockCaption(block: string, platform: PostPlatform): string {
  const description =
    block.match(/\*\*Description(?:\/caption)?:\*\*\s*\n?([\s\S]*?)(?=\n\*\*|\n(?:Suggested )?Hashtags?:|\n---|$)/i) ??
    block.match(/(?:^|\n)Description(?:\/caption)?:\s*\n?([\s\S]*?)(?=\n(?:Suggested )?Hashtags?:|\n\*\*|$)/i)
  if (description?.[1]?.trim()) return description[1].trim()

  const caption = extractCaptionSection(block)
  if (caption) return caption

  const quoted = extractQuotedCaption(block)
  if (quoted) return quoted

  let body = block
    .replace(/\*\*Title(?: suggestion)?:\*\*\s*[^\n]+/i, '')
    .replace(/(?:^|\n)Title(?: suggestion)?:\s*[^\n]+/i, '')
    .replace(/\*\*Hashtags?:\*\*[\s\S]*$/i, '')
    .replace(/(?:^|\n)(#[\w\u00C0-\u024F]+(?:\s+#[\w\u00C0-\u024F]+)*)\s*$/g, '')
    .replace(/^\s*\*?\*?[A-Za-z][A-Za-z /]*\*?\*?\s*\n/, '')
    .trim()

  if (platform === 'youtube') {
    body = body.replace(/^(Suggested )?Hashtags?:[\s\S]*/i, '').trim()
  }
  return body
}

/**
 * Director often writes Instagram, TikTok and YouTube as separate blocks.
 * One caption extractor would steal a fragment and leave the rest in chat.
 */
function extractPerPlatformBlocks(text: string): CaptionDraftExtract | null {
  const lines = text.split('\n')
  const starts: Array<{ index: number; platform: PostPlatform }> = []
  for (let i = 0; i < lines.length; i++) {
    const platform = headingPlatform(lines[i] ?? '')
    if (platform && !starts.some((row) => row.platform === platform)) {
      starts.push({ index: i, platform })
    }
  }
  if (starts.length < 2) return null

  const copies: NonNullable<CaptionDraftExtract['copies']> = []
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!
    const end = starts[i + 1]?.index ?? lines.length
    const block = lines.slice(start.index, end).join('\n')
    const caption = extractBlockCaption(block, start.platform)
    if (caption.length < 12) continue
    const copy: NonNullable<CaptionDraftExtract['copies']>[number] = {
      platform: start.platform,
      caption,
      hashtags: extractHashtagBlock(block),
    }
    if (start.platform === 'youtube') {
      const title = extractYoutubeTitle(block)
      if (title) copy.title = title
    }
    copies.push(copy)
  }
  if (copies.length < 2) return null

  const youtube = copies.find((copy) => copy.platform === 'youtube')
  const master = copies[0]!
  return {
    caption: master.caption,
    hashtags: master.hashtags.length ? master.hashtags : (youtube?.hashtags ?? []),
    platforms: copies.map((copy) => copy.platform),
    copies,
    youtubeTitle: youtube?.title,
    hashtagsAreSuggested: true,
    source: 'per_platform_blocks',
  }
}

function extractQuotedCaption(text: string): string | null {
  const match = text.match(/"([^"\n]{20,})"/) ?? text.match(/"([\s\S]{20,}?)"/)
  if (match?.[1]?.trim()) return match[1].trim()
  return null
}

/** Last prose block immediately before a hashtag line — skips Director preamble. */
function extractBlockBeforeHashtags(text: string): string | null {
  const lines = text.replace(/```[\s\S]*?```/g, '').split('\n')
  const hashtagIdx = lines.findIndex((line) => /(?:^|\s)#[\w\u00C0-\u024F]+/.test(line))
  if (hashtagIdx <= 0) return null

  const before = lines
    .slice(0, hashtagIdx)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((line) => !/^(Platform|Format|Notes|Character count|Media|\*\*)/i.test(line))

  if (!before.length) return null

  // Prefer the last paragraph — usually the caption, not the setup sentence.
  const caption = before[before.length - 1]
  if (caption.length < 20) return null
  return caption.replace(/^["']|["']$/g, '').trim()
}

function extractFromProse(text: string): { caption: string; hashtags: string[] } | null {
  const hashtags = extractHashtagBlock(text)
  if (!hashtags.length) return null

  const quoted = extractQuotedCaption(text)
  const blockBeforeTags = extractBlockBeforeHashtags(text)
  if (quoted) return { caption: quoted, hashtags }
  if (blockBeforeTags) return { caption: blockBeforeTags, hashtags }

  let body = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*Hashtags?:\*\*[\s\S]*?(?=\n\*\*|\n---|$)/i, '')
    .replace(/(?:^|\n)#[\w\u00C0-\u024F]+(?:\s+#[\w\u00C0-\u024F]+)*\s*/g, '\n')
    .replace(/\*\*(Platform|Format|Notes|Character count|Media)[^*]*\*\*[\s\S]*?(?=\n\*\*|$)/gi, '')
    .replace(/\*\*Caption:\*\*\s*/i, '')
    .trim()

  body = body
    .split('\n')
    .filter((line) => !/^(Platform|Format|Notes|Character count|Media):/i.test(line.trim()))
    .join('\n')
    .trim()

  if (body.length < 20) return null
  return { caption: body, hashtags }
}

/**
 * Pull a caption + hashtags (+ platform) from a Director message or json:card.
 * Returns null when nothing usable is found.
 */
export function extractCaptionDraftFromMessage(content: string): CaptionDraftExtract | null {
  if (!content?.trim()) return null

  const perPlatform = extractPerPlatformBlocks(content)
  if (perPlatform) return perPlatform

  for (const segment of parseInlineCards(content)) {
    if (segment.type === 'post_preview' && segment.data.caption?.trim()) {
      const platforms = normalisePlatform(segment.data.platform)
        ? [normalisePlatform(segment.data.platform)!]
        : []
      const hashtags = (segment.data.hashtags ?? []).map((h) =>
        h.replace(/^#+/, '').toLowerCase(),
      )
      return {
        caption: segment.data.caption.trim(),
        hashtags,
        platforms,
        hashtagsAreSuggested: true,
        source: 'post_preview_card',
      }
    }
  }

  const sectionCaption = extractCaptionSection(content)
  const hashtags = extractHashtagBlock(content)
  const platforms = extractPlatforms(content)

  if (sectionCaption) {
    return {
      caption: sectionCaption,
      hashtags,
      platforms,
      hashtagsAreSuggested: true,
      source: 'message_sections',
    }
  }

  const prose = extractFromProse(content)
  if (prose) {
    return {
      caption: prose.caption,
      hashtags: prose.hashtags,
      platforms,
      hashtagsAreSuggested: true,
      source: 'prose_and_tags',
    }
  }

  return null
}

/** User-facing honesty line — Director hashtags are not live platform science. */
export const DIRECTOR_HASHTAG_DISCLAIMER =
  'Hashtags suggested by the Director — not from your saved groups or this week\'s performance data.'
