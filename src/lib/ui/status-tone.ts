/**
 * One colour system for "is this thing all right?", across every surface.
 *
 * There were five. The integrations page drew connection health in explicit
 * oklch pairs; the inbox and the ads ledger drew the same three semantic states
 * in `emerald-500` / `amber-500` / `red-500`. So "needs attention" on
 * /agency/settings/integrations and "Needs you" on /agency/inbox were different
 * colours, different chip geometry and different icon conventions — on two
 * pages reached from the same row of pills.
 *
 * The oklch pairs won because they are explicit and theme-paired: each tone
 * names its light value and its dark value, rather than relying on a palette
 * step that happens to work in one theme.
 *
 * Contrast, computed against oklch(1 0 0) light and oklch(0.145 0 0) dark
 * (relative luminance is L³ for these):
 *
 *   positive   5.51:1 light   10.63:1 dark
 *   attention  5.51:1 light   11.35:1 dark
 *   critical   5.51:1 light    9.90:1 dark
 *   unknown    7.13:1 light    8.04:1 dark
 *   neutral    4.73:1 light    7.63:1 dark   (--muted-foreground)
 *
 * `unknown` is deliberately its own tone rather than a shade of `neutral`.
 * Neutral is a fact — this is off, this is finished, nobody is waiting.
 * Unknown is the absence of one: the publisher did not answer. Rendering the
 * second as either a hopeful green or a settled grey is the failure the
 * integrations page was built to stop, so the dashed border stays.
 */

export type StatusTone = 'positive' | 'attention' | 'critical' | 'unknown' | 'neutral'

/** Border, tinted surface and text. For a chip, a pill, or a panel. */
export const TONE_CHIP: Record<StatusTone, string> = {
  positive:
    'border-[oklch(0.52_0.13_155/0.3)] bg-[oklch(0.52_0.13_155/0.08)] text-[oklch(0.52_0.13_155)] dark:border-[oklch(0.8_0.15_155/0.3)] dark:bg-[oklch(0.8_0.15_155/0.1)] dark:text-[oklch(0.8_0.15_155)]',
  attention:
    'border-[oklch(0.52_0.11_65/0.35)] bg-[oklch(0.52_0.11_65/0.08)] text-[oklch(0.52_0.11_65)] dark:border-[oklch(0.82_0.15_75/0.3)] dark:bg-[oklch(0.82_0.15_75/0.1)] dark:text-[oklch(0.82_0.15_75)]',
  critical:
    'border-[oklch(0.52_0.19_25/0.32)] bg-[oklch(0.52_0.19_25/0.08)] text-[oklch(0.52_0.19_25)] dark:border-[oklch(0.78_0.16_25/0.3)] dark:bg-[oklch(0.78_0.16_25/0.1)] dark:text-[oklch(0.78_0.16_25)]',
  unknown:
    'border-dashed border-[oklch(0.46_0.035_240/0.45)] bg-transparent text-[oklch(0.46_0.035_240)] dark:border-[oklch(0.72_0.045_240/0.45)] dark:text-[oklch(0.72_0.045_240)]',
  neutral: 'border-border bg-muted text-muted-foreground',
}

/**
 * Border and interaction states for a control sitting inside a toned panel —
 * the "Try again" button in an error box, for instance. Pair with `TONE_CHIP`
 * on the panel, which supplies the text colour this inherits.
 */
export const TONE_BUTTON: Record<StatusTone, string> = {
  positive:
    'border-[oklch(0.52_0.13_155/0.32)] hover:bg-[oklch(0.52_0.13_155/0.12)] active:bg-[oklch(0.52_0.13_155/0.2)] dark:border-[oklch(0.8_0.15_155/0.32)] dark:hover:bg-[oklch(0.8_0.15_155/0.14)] dark:active:bg-[oklch(0.8_0.15_155/0.22)]',
  attention:
    'border-[oklch(0.52_0.11_65/0.35)] hover:bg-[oklch(0.52_0.11_65/0.12)] active:bg-[oklch(0.52_0.11_65/0.2)] dark:border-[oklch(0.82_0.15_75/0.32)] dark:hover:bg-[oklch(0.82_0.15_75/0.14)] dark:active:bg-[oklch(0.82_0.15_75/0.22)]',
  critical:
    'border-[oklch(0.52_0.19_25/0.32)] hover:bg-[oklch(0.52_0.19_25/0.12)] active:bg-[oklch(0.52_0.19_25/0.2)] dark:border-[oklch(0.78_0.16_25/0.32)] dark:hover:bg-[oklch(0.78_0.16_25/0.14)] dark:active:bg-[oklch(0.78_0.16_25/0.22)]',
  unknown:
    'border-[oklch(0.46_0.035_240/0.45)] hover:bg-[oklch(0.46_0.035_240/0.1)] active:bg-[oklch(0.46_0.035_240/0.18)] dark:border-[oklch(0.72_0.045_240/0.45)] dark:hover:bg-[oklch(0.72_0.045_240/0.12)] dark:active:bg-[oklch(0.72_0.045_240/0.2)]',
  neutral: 'border-border hover:bg-accent active:bg-accent/70',
}

/** Text only, for a sentence or a count that carries the state itself. */
export const TONE_TEXT: Record<StatusTone, string> = {
  positive: 'text-[oklch(0.52_0.13_155)] dark:text-[oklch(0.8_0.15_155)]',
  attention: 'text-[oklch(0.52_0.11_65)] dark:text-[oklch(0.82_0.15_75)]',
  critical: 'text-[oklch(0.52_0.19_25)] dark:text-[oklch(0.78_0.16_25)]',
  unknown: 'text-[oklch(0.46_0.035_240)] dark:text-[oklch(0.72_0.045_240)]',
  neutral: 'text-muted-foreground',
}
