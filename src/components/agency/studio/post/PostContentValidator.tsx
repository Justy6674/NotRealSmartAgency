'use client'

import { AlertTriangle } from 'lucide-react'
import { usePostCharacterLimit } from '@/hooks/usePostCharacterLimit'
import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
import { PlatformCharacterCount } from './PlatformCharacterRing'

export interface ValidationIssue {
  platform: string
  message: string
}

interface PostContentValidatorProps {
  caption: string
  platforms: PlatformKey[]
  /** Ceilings the publisher reported, keyed by platform. Empty until pre-flight answers. */
  publisherLimits?: Partial<Record<PlatformKey, number>>
  /** Refusals the publisher itself returned for this exact post. */
  errors?: ValidationIssue[]
  /** Things the publisher will accept but warns about. */
  warnings?: ValidationIssue[]
  /** True while the pre-flight request is in the air. */
  checking?: boolean
  /**
   * False when the pre-flight could not run at all — so this panel says the
   * numbers are our own estimate rather than showing a confident all-clear.
   */
  checked?: boolean
}

/**
 * What the publisher will refuse, said before anyone presses a button.
 *
 * ── Two sources, deliberately not merged ──────────────────────────────────
 * The band at the top carries the publisher's OWN refusals for this exact post
 * — its words, not a paraphrase, because a paraphrase is a second copy of a
 * rule and copies drift. The list below is the local character count, which
 * updates on every keystroke where a network call cannot.
 *
 * When the pre-flight has not run — the backup connection, or an unreachable
 * check — this says so out loud. A green screen that was never checked is the
 * failure mode this whole panel exists to prevent.
 */
export function PostContentValidator({
  caption,
  platforms,
  publisherLimits,
  errors = [],
  warnings = [],
  checking = false,
  checked = true,
}: PostContentValidatorProps) {
  const limits = usePostCharacterLimit(caption, platforms, publisherLimits)

  if (platforms.length === 0) {
    return (
      <div
        className="rounded-[10px] border border-dashed px-3 py-2 text-[11.5px]"
        style={{
          borderColor: 'var(--line)',
          background: 'var(--panel-2)',
          color: 'var(--ink-3)',
        }}
      >
        Tick an account above to see how long this post may be.
      </div>
    )
  }

  const overLimit = limits.filter((l) => l.state === 'over')

  return (
    <div className="space-y-2">
      {/* Publisher's own refusals — full-width band, above everything. */}
      {errors.length > 0 && (
        <div className="rounded-[10px] border border-[oklch(0.55_0.2_25/0.3)] bg-[oklch(0.55_0.2_25/0.08)] px-3 py-2 text-[11.5px] text-[oklch(0.55_0.2_25)]">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            This cannot go out as written.
          </p>
          <ul className="ml-[22px] list-disc space-y-[2px]">
            {errors.map((issue, index) => (
              <li key={`${issue.platform}-${index}`}>
                {issue.platform ? `${issue.platform}: ` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length === 0 && warnings.length > 0 && (
        <div className="rounded-[10px] border border-[oklch(0.65_0.15_75/0.3)] bg-[oklch(0.65_0.15_75/0.08)] px-3 py-2 text-[11.5px] text-[oklch(0.55_0.15_75)]">
          <ul className="ml-[16px] list-disc space-y-[2px]">
            {warnings.map((issue, index) => (
              <li key={`${issue.platform}-${index}`}>
                {issue.platform ? `${issue.platform}: ` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="rounded-[10px] border px-[13px] py-[9px]"
        style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}
      >
        <div className="mb-[5px] flex items-baseline justify-between gap-3">
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--ink-3)' }}
          >
            Characters left
          </span>
          <span className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
            {checking ? 'Checking…' : checked ? '' : 'Our own estimate'}
          </span>
        </div>
        {limits.map((l) => (
          <PlatformCharacterCount
            key={l.platform}
            platform={l.platform}
            used={l.used}
            limit={l.limit}
            state={l.state}
            fromPublisher={l.fromPublisher}
          />
        ))}
      </div>

      {errors.length === 0 && overLimit.length > 0 && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[oklch(0.55_0.2_25/0.3)] bg-[oklch(0.55_0.2_25/0.08)] px-3 py-2 text-[11.5px] text-[oklch(0.55_0.2_25)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-[2px]" />
          <span>
            Too long for {overLimit.map((l) => l.platform).join(', ')}. Shorten the caption, or
            untick {overLimit.length === 1 ? 'that account' : 'those accounts'}.
          </span>
        </div>
      )}
    </div>
  )
}
