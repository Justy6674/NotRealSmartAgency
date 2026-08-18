'use client'

import { PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'

interface PlatformCharacterCountProps {
  platform: PlatformKey
  used: number
  limit: number
  /** 'ok' | 'warning' | 'over' from usePostCharacterLimit */
  state: 'ok' | 'warning' | 'over'
  /** False when the ceiling is our local fallback rather than the publisher's. */
  fromPublisher?: boolean
}

/**
 * One platform's character count, as a number.
 *
 * ── Why this is not a ring any more ───────────────────────────────────────
 * It used to be a 40px SVG donut per platform. Two problems. A ring encodes a
 * proportion, and a proportion is the one thing nobody composing a post needs:
 * "72% of Instagram" is not actionable, "140 over" is. And DESIGN.md is
 * explicit — monospace, tabular numerals, right-aligned, for anything the owner
 * is meant to compare as a number. Six donuts in a row compared nothing and
 * took the width of the column to say it.
 *
 * The number shown is characters REMAINING, negative when over, which is the
 * number the owner acts on. The ceiling sits beside it in quiet ink so the
 * remaining count can never be read as a total.
 */
const TONE: Record<PlatformCharacterCountProps['state'], string> = {
  ok: 'var(--ink-2)',
  warning: 'oklch(0.55 0.15 75)',
  over: 'oklch(0.55 0.2 25)',
}

export function PlatformCharacterCount({
  platform,
  used,
  limit,
  state,
  fromPublisher = true,
}: PlatformCharacterCountProps) {
  const remaining = limit - used
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
        {PLATFORM_LABELS[platform] ?? platform}
        {!fromPublisher && (
          <span
            className="ml-[6px] text-[10px]"
            style={{ color: 'var(--ink-3)' }}
            title="This ceiling is our own conservative figure — the posting connection was not reachable to confirm it."
          >
            approx
          </span>
        )}
      </span>
      <span
        className="shrink-0 text-right font-mono text-[12px] tabular-nums"
        style={{ color: TONE[state], fontWeight: state === 'ok' ? 400 : 600 }}
      >
        {remaining.toLocaleString('en-AU')}
        <span className="ml-[5px] font-normal" style={{ color: 'var(--ink-3)' }}>
          / {limit.toLocaleString('en-AU')}
        </span>
      </span>
    </div>
  )
}
