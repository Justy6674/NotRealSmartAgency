'use client'

import type { ScheduledPost } from '@/types/database'
import {
  PLATFORM_BRAND_COLOURS,
  POST_STATUS_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
  type PostStatusKey,
} from '@/lib/mixpost/ui-tokens'

interface CalendarPostPillProps {
  post: ScheduledPost
  /** Called when the user clicks the pill (for opening the detail pane) */
  onClick?: (postId: string) => void
  /** Compact mode strips the caption snippet — used inside tight slots */
  compact?: boolean
}

/**
 * Draggable post card rendered inside calendar day/time slots.
 *
 * Phase 1 of the Mixpost UI port — matches the density of Mixpost's
 * CalendarPostItem.vue (136 LOC) but uses NRS's oklch tokens from
 * src/lib/mixpost/ui-tokens.ts and base-ui aesthetic instead of Mixpost's
 * stone-grey palette.
 *
 * The left border accent uses the platform brand colour; the pill
 * background uses the status-specific oklch tone. Platform label and
 * status label live on the top row; caption snippet fills the rest.
 *
 * Rendered via FullCalendar's eventContent prop in EnhancedCalendar so
 * each event on the grid is a React node rather than an inline string.
 */
export function CalendarPostPill({ post, onClick, compact = false }: CalendarPostPillProps) {
  const platformKey = post.platform as PlatformKey
  const platformColour = PLATFORM_BRAND_COLOURS[platformKey] ?? '#6366f1'
  const platformLabel = PLATFORM_LABELS[platformKey] ?? post.platform
  const statusKey = post.status as PostStatusKey
  const statusColour = POST_STATUS_COLOURS[statusKey] ?? POST_STATUS_COLOURS.draft
  const snippet = post.caption.length > 48 ? `${post.caption.slice(0, 48)}…` : post.caption

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(post.id)
      }}
      className="group w-full text-left rounded-md border px-1.5 py-1 text-[11px] transition-colors hover:shadow-sm overflow-hidden"
      style={{
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: platformColour,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        backgroundColor: statusColour.bg,
        color: statusColour.fg,
      }}
      title={`${platformLabel} · ${post.status}\n\n${post.caption}`}
    >
      <div className="flex items-center gap-1.5 leading-tight">
        <span
          className="font-semibold uppercase tracking-wide text-[9px] truncate"
          style={{ color: platformColour }}
        >
          {platformLabel}
        </span>
        <span className="ml-auto uppercase tracking-wide text-[8px] opacity-70 shrink-0">
          {post.status}
        </span>
      </div>
      {!compact && (
        <div className="mt-0.5 line-clamp-2 leading-tight break-words">{snippet}</div>
      )}
    </button>
  )
}
