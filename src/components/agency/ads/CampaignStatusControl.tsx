'use client'

import { Loader2, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui/focus'
import { TONE_CHIP } from '@/lib/ui/status-tone'
import type { AdDeliveryStatus, Campaign } from './campaign'

/**
 * Status chip and the pause/resume control.
 *
 * Every one of Zernio's seven delivery statuses is mapped, plus an `unknown`
 * fallback. TaskCard interpolates an unmapped status straight into className
 * and emits a literal `undefined` class; a lookup with no fallback is the same
 * bug waiting to happen, so there is one here.
 *
 * The colours are the shared tones, not this file's own — "Rejected" here and
 * "needs attention" on the integrations page are the same news and now the
 * same colour.
 */

type ChipStyle = { label: string; className: string }

const STATUS_STYLES: Record<AdDeliveryStatus | 'unknown', ChipStyle> = {
  active: { label: 'Running', className: TONE_CHIP.positive },
  paused: { label: 'Paused', className: TONE_CHIP.neutral },
  pending_review: { label: 'In review', className: TONE_CHIP.attention },
  rejected: { label: 'Rejected', className: TONE_CHIP.critical },
  error: { label: 'Error', className: TONE_CHIP.critical },
  completed: { label: 'Finished', className: TONE_CHIP.neutral },
  cancelled: { label: 'Cancelled', className: TONE_CHIP.neutral },
  // Not a shade of "off". Zernio did not say, and saying so is the point.
  unknown: { label: 'Status not reported', className: TONE_CHIP.unknown },
}

export function StatusChip({ status }: { status: Campaign['status'] }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unknown
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        style.className,
      )}
    >
      {style.label}
    </span>
  )
}

/** Only these two can be flipped from here. The rest are platform decisions. */
export function isTogglable(status: Campaign['status']): status is 'active' | 'paused' {
  return status === 'active' || status === 'paused'
}

export function StatusControl({
  status,
  sending,
  onToggle,
}: {
  status: 'active' | 'paused'
  sending: boolean
  onToggle: () => void
}) {
  const pausing = status === 'active'

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={sending}
      aria-label={pausing ? 'Pause this campaign' : 'Resume this campaign'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
        'transition-colors duration-200',
        FOCUS_RING,
        'disabled:cursor-not-allowed disabled:opacity-60',
        // A pressed state, not just a transition. On a touch device there is no
        // hover, so without this the button that stops real spending gives no
        // feedback at all between the tap and the spinner.
        pausing
          ? 'border-border text-foreground hover:bg-accent active:bg-accent/70'
          : 'border-transparent bg-[var(--brand-deep)] text-[var(--brand-ink)] hover:bg-[var(--brand)] active:opacity-90',
      )}
    >
      {sending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : pausing ? (
        <Pause className="h-3 w-3" />
      ) : (
        <Play className="h-3 w-3" />
      )}
      {sending ? (pausing ? 'Pausing' : 'Resuming') : pausing ? 'Pause' : 'Resume'}
    </button>
  )
}
