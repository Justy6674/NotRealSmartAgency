'use client'

import Image from 'next/image'
import type { ScheduledPost } from '@/types/database'
import {
  PLATFORM_BRAND_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
  type PostStatusKey,
} from '@/lib/mixpost/ui-tokens'

interface CalendarPostPillProps {
  post: ScheduledPost
  /** Called when the user clicks the card (to open the composer in edit mode) */
  onClick?: (postId: string) => void
  /** Compact mode — strips caption snippet for very tight time slots */
  compact?: boolean
}

/**
 * Status-ring colours from dept-social.html.
 * The *border* uses the status colour (not the platform), so a glance at the
 * left stripe tells you what to do: grey = draft, blue = scheduled, amber =
 * sending, green = done, red = failed.
 */
const STATUS_BORDER: Record<PostStatusKey, string> = {
  draft:      'oklch(0.62 0.012 240)',
  scheduled:  'oklch(0.52 0.120 240)',
  publishing: 'oklch(0.72 0.150 70)',
  published:  'oklch(0.56 0.150 145)',
  failed:     'oklch(0.60 0.200 25)',
  cancelled:  'oklch(0.62 0.000 0)',
}

const STATUS_LABEL: Record<PostStatusKey, string> = {
  draft:      'draft',
  scheduled:  'scheduled',
  publishing: 'sending',
  published:  'published',
  failed:     'failed',
  cancelled:  'cancelled',
}

const STATUS_DOT: Record<PostStatusKey, string> = {
  draft:      'oklch(0.72 0.010 240)',
  scheduled:  'oklch(0.55 0.120 240)',
  publishing: 'oklch(0.72 0.150 70)',
  published:  'oklch(0.56 0.150 145)',
  failed:     'oklch(0.60 0.200 25)',
  cancelled:  'oklch(0.65 0.000 0)',
}

function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Post card rendered inside FullCalendar day/time slots.
 *
 * Visual spec: dept-social.html `.ev` class — 5 px border-radius, 3 px left
 * border in the status colour, white/panel background, IBM Plex Sans 12px
 * body text. Thumbnail pinned top-right (32×32). Platform dots row at top.
 * Time in bold before the status word. Caption snippet below.
 *
 * Clicking anywhere opens the post in the composer for editing.
 */
export function CalendarPostPill({ post, onClick, compact = false }: CalendarPostPillProps) {
  const statusKey = (post.status ?? 'draft') as PostStatusKey
  const borderColor = STATUS_BORDER[statusKey] ?? STATUS_BORDER.draft
  const dotColor    = STATUS_DOT[statusKey]    ?? STATUS_DOT.draft
  const statusLabel = STATUS_LABEL[statusKey]  ?? post.status

  const time    = formatTime(post.scheduled_at)
  const snippet = post.caption.length > 56
    ? `${post.caption.slice(0, 56)}…`
    : post.caption

  // Platform list — stored as a string on some rows, array on others
  const rawPlatform = post.platform as string | null | undefined
  const platforms: PlatformKey[] = rawPlatform
    ? rawPlatform.split(',').map((p) => p.trim()) as PlatformKey[]
    : []

  // Thumbnail URL — the media_item metadata is attached to the row when present
  const thumbUrl = (post as unknown as Record<string, unknown>).thumbnail_url as string | null | undefined

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(post.id)
      }}
      title={`${statusLabel} · ${post.caption}`}
      className="group w-full text-left overflow-hidden transition-shadow hover:shadow-sm"
      style={{
        borderRadius: '5px',
        borderLeft: `3px solid ${borderColor}`,
        background: 'var(--card, oklch(1 0 0))',
        padding: '6px 8px',
        fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
        fontSize: '12px',
        lineHeight: 1.4,
        color: 'var(--foreground)',
      }}
    >
      {/* ── Top row: platform dots · time · status ── */}
      <div className="flex items-center gap-[5px] flex-wrap">
        {/* Platform colour dots — identity, not status */}
        {platforms.length > 0 && (
          <span className="flex items-center gap-[3px]" aria-hidden>
            {platforms.map((p) => (
              <span
                key={p}
                className="h-[7px] w-[7px] rounded-full inline-block shrink-0"
                title={PLATFORM_LABELS[p as PlatformKey] ?? p}
                style={{
                  background:
                    PLATFORM_BRAND_COLOURS[p as keyof typeof PLATFORM_BRAND_COLOURS] ??
                    'oklch(0.7 0 0)',
                }}
              />
            ))}
          </span>
        )}

        {time && (
          <span
            className="font-[600] text-[11px] shrink-0"
            style={{ color: 'var(--foreground)' }}
          >
            {time}
          </span>
        )}

        {/* Status dot + label */}
        <span className="ml-auto flex shrink-0 items-center gap-[4px]">
          <span
            className="h-[6px] w-[6px] rounded-full inline-block"
            aria-hidden
            style={{ background: dotColor }}
          />
          <span
            className="text-[10px] font-[500]"
            style={{ color: 'oklch(0.615 0.011 240)' }}
          >
            {statusLabel}
          </span>
        </span>
      </div>

      {/* ── Caption + thumbnail ── */}
      {!compact && (
        <div className="mt-[4px] flex items-start gap-[6px]">
          <span
            className="flex-1 line-clamp-2 text-[11.5px]"
            style={{ color: 'oklch(0.46 0.012 240)' }}
          >
            {snippet || <em style={{ opacity: 0.5 }}>No caption</em>}
          </span>
          {thumbUrl && (
            <span className="shrink-0 h-[32px] w-[32px] rounded-[3px] overflow-hidden">
              <Image
                src={thumbUrl}
                alt="thumbnail"
                width={32}
                height={32}
                className="object-cover h-full w-full"
              />
            </span>
          )}
        </div>
      )}
    </button>
  )
}
