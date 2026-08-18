'use client'

import Image from 'next/image'
import { PlatformGlyphRow } from '@/components/agency/studio/posts/PlatformGlyph'
import { statusFace } from '@/components/agency/studio/posts/PostStatusDot'
import type { SocialPostRow } from '@/hooks/usePostsList'

interface CalendarPostPillProps {
  post: SocialPostRow
  onClick?: (postId: string) => void
  /** Compact mode — drops the caption snippet for very tight month cells. */
  compact?: boolean
}

/**
 * A post as it appears in a calendar cell.
 *
 * Two things carry meaning down the left edge and they are not the same thing:
 *
 *   the **status** border — grey draft, blue waiting, amber sending or partly
 *   sent, green gone out, red did not go out;
 *   the **label stripes** beside it, one per label in the label's own colour,
 *   which is Mixpost's `tag.hex_color` column of full-height stripes.
 *
 * Status answers "do I need to do something"; labels answer "what kind of post
 * is this". Collapsing them into one stripe loses one of the two questions.
 */
export function CalendarPostPill({ post, onClick, compact = false }: CalendarPostPillProps) {
  const face = statusFace(post.status)

  const when = post.scheduled_at ?? post.published_at
  const time = when
    ? new Date(when).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    : null

  const snippet = post.caption.length > 56 ? `${post.caption.slice(0, 56)}…` : post.caption


  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(post.id)
      }}
      title={`${face.label} · ${post.caption}`}
      className="group flex w-full overflow-hidden text-left transition-shadow hover:shadow-sm"
      style={{
        borderRadius: '5px',
        borderLeft: `3px solid ${face.colour}`,
        background: 'var(--card, oklch(1 0 0))',
        fontFamily: 'var(--font-sans), "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
        fontSize: '12px',
        lineHeight: 1.4,
        color: 'var(--foreground)',
      }}
    >
      {/* Label stripes — one narrow full-height bar per label. */}
      {post.labels.length > 0 && (
        <span className="flex shrink-0" aria-hidden>
          {post.labels.slice(0, 4).map((label) => (
            <span
              key={label.id}
              className="block w-[3px]"
              style={{ background: label.colour }}
              title={label.name}
            />
          ))}
        </span>
      )}

      <span className="min-w-0 flex-1" style={{ padding: '6px 8px' }}>
        <span className="flex flex-wrap items-center gap-[5px]">
          {/* The network's own mark, not a coloured dot. Deduplicated the way
              Mixpost dedupes provider icons — two Instagram accounts on one
              post is one Instagram mark — and X is left out because this
              business does not post to it. */}
          <PlatformGlyphRow platforms={post.platforms} size={12} max={4} />

          {time && (
            <span
              className="shrink-0 text-[11px] font-[600] tabular-nums"
              style={{ color: 'var(--foreground)' }}
            >
              {time}
            </span>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-[4px]">
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              aria-hidden
              style={{ background: face.colour }}
            />
            <span className="text-[10px] font-[500]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
              {face.label}
            </span>
          </span>
        </span>

        {!compact && (
          <span className="mt-[4px] flex items-start gap-[6px]">
            <span
              className="line-clamp-2 flex-1 text-[11.5px]"
              style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
            >
              {snippet || <em style={{ opacity: 0.5 }}>Nothing written yet</em>}
            </span>
            {post.thumbnail_url && (
              <span className="h-[32px] w-[32px] shrink-0 overflow-hidden rounded-[3px]">
                <Image
                  src={post.thumbnail_url}
                  alt=""
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  )
}
