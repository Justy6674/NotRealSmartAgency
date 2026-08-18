'use client'

import type { DeskPostStatus } from '@/hooks/usePostsList'

/**
 * The status dot, and the word beside it.
 *
 * Never colour alone — a dot on its own is unreadable to about one man in
 * twelve, and this column is the first thing anybody looks at.
 *
 * Colours come from the `--st-*` tokens in globals.css, which are already
 * defined for both themes. The one gap they had was `partial`: the publisher
 * reports it when a post reached some of its accounts and not others, and
 * nothing in NRS mapped it, so a genuinely half-sent post rendered as a blank
 * cell. It gets the amber "still going" token, because that is what it is —
 * unfinished, not failed and definitely not done.
 */

interface StatusFace {
  label: string
  /** CSS colour with an inline fallback, so an unloaded token cannot blank it. */
  colour: string
  /** Second line under the word, when the row can say something more useful. */
  hint?: string
}

const FACES: Record<DeskPostStatus, StatusFace> = {
  draft: {
    label: 'Draft',
    colour: 'var(--st-draft, oklch(0.62 0.012 240))',
  },
  needs_approval: {
    label: 'Waiting on you',
    colour: 'var(--st-sending, oklch(0.72 0.15 70))',
  },
  scheduled: {
    label: 'Waiting to go out',
    colour: 'var(--st-sched, oklch(0.62 0.10 220))',
  },
  publishing: {
    label: 'Sending',
    colour: 'var(--st-sending, oklch(0.72 0.15 70))',
  },
  published: {
    label: 'Gone out',
    colour: 'var(--st-pub, oklch(0.58 0.14 152))',
  },
  partial: {
    label: 'Partly sent',
    colour: 'var(--st-sending, oklch(0.72 0.15 70))',
    hint: 'It reached some accounts but not all of them',
  },
  failed: {
    label: 'Did not go out',
    colour: 'var(--st-fail, oklch(0.58 0.17 27))',
  },
  cancelled: {
    label: 'Deleted',
    colour: 'var(--st-draft, oklch(0.62 0.012 240))',
  },
}

export function statusFace(status: DeskPostStatus): StatusFace {
  return FACES[status] ?? FACES.draft
}

export function PostStatusDot({
  status,
  size = 10,
}: {
  status: DeskPostStatus
  size?: number
}) {
  const face = statusFace(status)
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ backgroundColor: face.colour, height: size, width: size }}
    />
  )
}

export function PostStatusChip({
  status,
  when,
}: {
  status: DeskPostStatus
  /** Already-formatted date line, e.g. "Gone out 12 Aug 2026, 09:14". */
  when?: string | null
}) {
  const face = statusFace(status)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2">
        <PostStatusDot status={status} />
        <span className="text-[13px] leading-tight text-foreground">{face.label}</span>
      </span>
      {face.hint && (
        <span className="pl-[18px] text-[11.5px] leading-tight text-muted-foreground">
          {face.hint}
        </span>
      )}
      {when && (
        <span className="pl-[18px] text-[11.5px] leading-tight text-muted-foreground tabular-nums">
          {when}
        </span>
      )}
    </div>
  )
}
