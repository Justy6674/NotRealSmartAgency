'use client'

import { Facebook, Instagram, Linkedin, Youtube, type LucideIcon } from 'lucide-react'

import { PLATFORM_BRAND_COLOURS, PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'

/**
 * The mark for one network.
 *
 * Mixpost puts a provider icon on every post card, every account avatar and
 * every calendar cell; NRS put a coloured dot, which is the same information
 * for someone who already knows the colours and none at all for anybody else.
 *
 * ── X is not here on purpose ───────────────────────────────────────────
 * The owner does not post to it. A network drawn in a picker, a filter or a
 * legend is a network the product is offering, and offering one that will never
 * publish is worse than leaving it out. `isPostablePlatform` is the single
 * place that decision is written down, so the filter list, the icon strip and
 * the calendar cannot drift apart on it.
 *
 * Four networks have a real mark in the icon set we already ship. The rest get
 * a lettered chip in their own brand colour rather than a wrong icon — a
 * generic globe on a TikTok post is a small lie repeated on every row.
 */

const EXCLUDED = new Set(['twitter', 'x'])

const MARKS: Partial<Record<PlatformKey, LucideIcon>> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

/** Initial for the networks with no mark of their own. */
const INITIALS: Record<string, string> = {
  tiktok: 'TT',
  threads: '@',
  pinterest: 'P',
  bluesky: 'B',
  mastodon: 'M',
}

export function isPostablePlatform(platform: string): boolean {
  return !EXCLUDED.has(platform.trim().toLowerCase())
}

/** Deduplicated, X removed, order preserved. */
export function postablePlatforms(platforms: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of platforms) {
    const platform = raw.trim().toLowerCase()
    if (!platform || seen.has(platform) || !isPostablePlatform(platform)) continue
    seen.add(platform)
    out.push(platform)
  }
  return out
}

export function platformColour(platform: string): string {
  return PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? 'oklch(0.615 0.011 240)'
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as PlatformKey] ?? platform
}

export function PlatformGlyph({
  platform,
  size = 13,
  /** Paint the mark in the network's own colour. Off inside a coloured chip. */
  tinted = true,
}: {
  platform: string
  size?: number
  tinted?: boolean
}) {
  const key = platform.trim().toLowerCase()
  if (!isPostablePlatform(key)) return null

  const label = platformLabel(key)
  const colour = tinted ? platformColour(key) : 'currentColor'
  const Mark = MARKS[key as PlatformKey]

  if (Mark) {
    // The `<title>` is the hover tooltip; `aria-label` is what is read out.
    // A mark with neither is a coloured smudge to anyone who cannot see it.
    return (
      <Mark
        role="img"
        aria-label={label}
        focusable="false"
        size={size}
        style={{ color: colour }}
      >
        <title>{label}</title>
      </Mark>
    )
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(7, Math.round(size * 0.55)),
        lineHeight: 1,
        background: tinted ? colour : 'transparent',
        color: tinted ? 'oklch(1 0 0)' : 'currentColor',
        border: tinted ? 'none' : '1px solid currentColor',
      }}
    >
      {INITIALS[key] ?? key.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** A row of marks, deduplicated the way Mixpost dedupes provider icons. */
export function PlatformGlyphRow({
  platforms,
  size = 13,
  max = 4,
}: {
  platforms: readonly string[]
  size?: number
  max?: number
}) {
  const shown = postablePlatforms(platforms)
  if (shown.length === 0) return null
  const visible = shown.slice(0, max)
  const extra = shown.length - visible.length

  return (
    <span className="inline-flex items-center gap-[3px]">
      {visible.map((platform) => (
        <PlatformGlyph key={platform} platform={platform} size={size} />
      ))}
      {extra > 0 && (
        <span
          className="text-[10px] font-semibold tabular-nums"
          style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
