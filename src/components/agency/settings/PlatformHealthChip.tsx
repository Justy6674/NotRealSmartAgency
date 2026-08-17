import { AlertTriangle, CheckCircle2, CircleDashed, CircleHelp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_CHIP, type StatusTone } from '@/lib/ui/status-tone'
import type { HealthState } from './integrations-data'

/**
 * The one place connection state is drawn — now drawing from the one place the
 * whole app keeps its state colours (src/lib/ui/status-tone.ts), so "needs
 * attention" here and "Needs you" in the inbox are the same amber rather than
 * two ambers a click apart.
 *
 * 'unknown' is deliberately a state of its own rather than a shade of "off".
 * It means the publisher did not answer, and the whole point of this page is
 * that not knowing must never render as a hopeful green.
 */

const STATE_STYLES: Record<
  HealthState,
  { tone: StatusTone; Icon: typeof CheckCircle2; sr: string }
> = {
  connected: { tone: 'positive', Icon: CheckCircle2, sr: 'posting normally' },
  attention: { tone: 'attention', Icon: AlertTriangle, sr: 'needs attention' },
  unknown: { tone: 'unknown', Icon: CircleHelp, sr: 'could not be checked' },
  absent: { tone: 'neutral', Icon: CircleDashed, sr: 'not connected' },
}

export function PlatformHealthChip({
  label,
  state,
  className,
}: {
  label: string
  state: HealthState
  className?: string
}) {
  const style = STATE_STYLES[state]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        TONE_CHIP[style.tone],
        className,
      )}
    >
      <style.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
      <span className="sr-only"> — {style.sr}</span>
    </span>
  )
}
