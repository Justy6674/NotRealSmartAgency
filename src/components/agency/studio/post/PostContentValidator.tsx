'use client'

import { usePostCharacterLimit } from '@/hooks/usePostCharacterLimit'
import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
import { PlatformCharacterRing } from './PlatformCharacterRing'
import { AlertTriangle } from 'lucide-react'

interface PostContentValidatorProps {
  caption: string
  platforms: PlatformKey[]
}

/**
 * Real-time per-platform caption validator — shows one character ring
 * per selected platform plus aggregated warnings.
 *
 * Phase 3 of the Mixpost UI port. Matches the intent of Mixpost's
 * PostContentValidator.vue (560 LOC) but scopes to character counts
 * for the initial port. Platform-specific rules (URL weighting,
 * hashtag counts, media constraints) are layered on in follow-up
 * tasks as we confirm which rules each platform actually enforces.
 */
export function PostContentValidator({ caption, platforms }: PostContentValidatorProps) {
  const limits = usePostCharacterLimit(caption, platforms)

  if (platforms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        Select at least one platform to see character limits.
      </div>
    )
  }

  const overLimit = limits.filter((l) => l.state === 'over')
  const atWarning = limits.filter((l) => l.state === 'warning')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 flex-wrap">
        {limits.map((l) => (
          <PlatformCharacterRing
            key={l.platform}
            platform={l.platform}
            used={l.used}
            limit={l.limit}
            state={l.state}
            size={40}
          />
        ))}
      </div>

      {overLimit.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-[oklch(0.55_0.2_25/0.3)] bg-[oklch(0.55_0.2_25/0.08)] px-3 py-2 text-[11px] text-[oklch(0.55_0.2_25)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Over the limit on {overLimit.length} platform{overLimit.length === 1 ? '' : 's'}:{' '}
            {overLimit
              .map((l) => `${l.platform} (${l.remaining})`)
              .join(', ')}
            . Trim the caption or deselect {overLimit.length === 1 ? 'that platform' : 'those platforms'} before scheduling.
          </span>
        </div>
      )}

      {overLimit.length === 0 && atWarning.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-[oklch(0.65_0.15_75/0.3)] bg-[oklch(0.65_0.15_75/0.08)] px-3 py-2 text-[11px] text-[oklch(0.55_0.15_75)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Approaching the limit on {atWarning.length} platform{atWarning.length === 1 ? '' : 's'}.
          </span>
        </div>
      )}
    </div>
  )
}
