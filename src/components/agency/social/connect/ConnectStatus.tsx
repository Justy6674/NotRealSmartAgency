'use client'

import { AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react'

/**
 * The one place a connection's state is turned into something on screen.
 *
 * ── The fault this closes ──────────────────────────────────────────────
 * Measured live on 2026-08-18: ten connected accounts, eight healthy, **two in
 * warning** — and every one of them was drawn with the same green tick, because
 * the grid stamped "active" on whatever it was handed. The first the owner
 * would have learnt about an expiring connection was a post failing to go out,
 * which is the one moment he can no longer do anything about it.
 *
 * So the tick is built to be unreachable for anything but a measured, healthy,
 * postable connection. `showsTick()` below is the only thing that decides, it
 * takes the health word and nothing else, and every caller in this folder draws
 * its state through `<HealthBadge>` rather than choosing an icon itself. A new
 * screen cannot accidentally flatter a warning into a tick without deleting
 * this function first.
 *
 * "Absent" is a fourth answer, not a fifth flavour of fine. A connection we
 * could not measure reads as unmeasured, in grey, saying so.
 *
 * ── Vocabulary ─────────────────────────────────────────────────────────
 * The four words match `useSocialAccounts` exactly (`src/hooks/useSocialAccounts.ts`),
 * so a caller can hand this folder that hook's rows untranslated. Do not add a
 * fifth word here without adding it there; two vocabularies that nearly agree
 * is how the green tick survived as long as it did.
 */

/* ── The four states a connection can be in ──────────────────────────────── */

export type ConnectionHealth =
  /** Answered, and it will post. The only state that earns a tick. */
  | 'connected'
  /** Answered, and something is wrong or about to be. Amber, never a tick. */
  | 'attention'
  /** It will not post until the owner signs in again. */
  | 'reconnect'
  /** Nothing came back. Not the same as fine. */
  | 'unknown'

/** Only a measured, healthy, postable connection is ever ticked. */
export function showsTick(health: ConnectionHealth): boolean {
  return health === 'connected'
}

/** What the owner reads. No platform jargon, no vendor words, no status codes. */
export function healthWording(health: ConnectionHealth): string {
  switch (health) {
    case 'connected':
      return 'Connected'
    case 'attention':
      return 'Needs a look'
    case 'reconnect':
      return 'Needs reconnecting'
    case 'unknown':
      return 'Not checked yet'
  }
}

/** Semantic colour per state — DESIGN.md "a plain circle, never a pill". */
function healthColour(health: ConnectionHealth): string {
  switch (health) {
    case 'connected':
      return 'var(--ok, oklch(0.55 0.13 155))'
    case 'attention':
      return 'var(--warn, oklch(0.63 0.13 75))'
    case 'reconnect':
      return 'var(--st-fail, oklch(0.58 0.17 27))'
    case 'unknown':
      return 'var(--st-draft, oklch(0.62 0.012 240))'
  }
}

/**
 * A connection's state, drawn honestly.
 *
 * The icon is chosen from the health word alone. There is no `variant` prop and
 * no way to pass an icon in, because the moment a caller can choose the icon,
 * one of them chooses the tick.
 */
export function HealthBadge({
  health,
  detail,
}: {
  health: ConnectionHealth
  /** One plain sentence about *this* connection, when the publisher gave one. */
  detail?: string
}) {
  const colour = healthColour(health)
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {showsTick(health) ? (
        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: colour }} aria-hidden />
      ) : health === 'reconnect' ? (
        <RefreshCw className="h-3.5 w-3.5 shrink-0" style={{ color: colour }} aria-hidden />
      ) : health === 'attention' ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: colour }} aria-hidden />
      ) : (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: colour }}
          aria-hidden
        />
      )}
      <span className="truncate text-[11.5px] font-semibold" style={{ color: colour }}>
        {healthWording(health)}
      </span>
      {detail ? (
        <span
          className="truncate text-[11.5px]"
          style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
        >
          · {detail}
        </span>
      ) : null}
    </span>
  )
}

/* ── The state of the connecting *flow*, as opposed to an account ────────── */

/**
 * Every state the connect flow can be in, spelled out.
 *
 * A union rather than a set of booleans so "connecting AND failed" cannot be
 * held at once — the dialog used to keep `connecting` and `error` as separate
 * pieces of state and could show a spinner beside a failure sentence.
 */
export type ConnectPhase =
  | { kind: 'idle' }
  /** Asking our own site to start the sign-in. Nothing has left the browser yet. */
  | { kind: 'starting'; platformLabel: string }
  /** Handing the browser to the platform's sign-in page. */
  | { kind: 'redirecting'; platformLabel: string }
  /** Back from the platform, and the owner has a choice to make. */
  | { kind: 'choosing'; platformLabel: string }
  /** Their choice, or their sign-in details, are being saved. */
  | { kind: 'submitting'; platformLabel: string }
  /** Waiting on something the owner is doing elsewhere (Telegram's code). */
  | { kind: 'waiting'; platformLabel: string; detail?: string }
  | { kind: 'connected'; platformLabel: string; accountName?: string }
  /** Plain reason, written for the owner. Never a status code, never raw upstream text. */
  | { kind: 'failed'; platformLabel?: string; reason: string }

/** One sentence per phase. The owner should never have to infer what is happening. */
export function phaseWording(phase: ConnectPhase): string | null {
  switch (phase.kind) {
    case 'idle':
      return null
    case 'starting':
      return `Getting ${phase.platformLabel} ready…`
    case 'redirecting':
      return `Taking you to ${phase.platformLabel} to sign in…`
    case 'choosing':
      return `You are signed in to ${phase.platformLabel}. One more choice and it is done.`
    case 'submitting':
      return `Finishing your ${phase.platformLabel} connection…`
    case 'waiting':
      return phase.detail ?? `Waiting for ${phase.platformLabel}…`
    case 'connected':
      return phase.accountName
        ? `${phase.accountName} is connected. You can post to it now.`
        : `${phase.platformLabel} is connected. You can post to it now.`
    case 'failed':
      return phase.reason
  }
}

/**
 * The flow's own state, on screen.
 *
 * A failure keeps the words the server chose. Those sentences are written for
 * the owner and say what was and was not changed; swallowing them behind a
 * house line is what made every failure here look like the same random one.
 */
export function ConnectStatus({ phase }: { phase: ConnectPhase }) {
  const words = phaseWording(phase)
  if (!words) return null

  const busy =
    phase.kind === 'starting' ||
    phase.kind === 'redirecting' ||
    phase.kind === 'submitting' ||
    phase.kind === 'waiting'

  const failed = phase.kind === 'failed'
  const done = phase.kind === 'connected'

  const border = failed
    ? 'var(--st-fail, oklch(0.58 0.17 27))'
    : done
      ? 'var(--ok, oklch(0.55 0.13 155))'
      : 'var(--line, oklch(0.915 0.007 240))'

  const fill = failed
    ? 'var(--warn-wash, oklch(0.964 0.052 80))'
    : done
      ? 'var(--ok-wash, oklch(0.962 0.032 155))'
      : 'var(--panel-2, oklch(0.975 0.004 240))'

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed"
      style={{ borderColor: border, background: fill, color: 'var(--ink, oklch(0.20 0.014 240))' }}
    >
      {busy ? (
        <Loader2
          className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin"
          style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          aria-hidden
        />
      ) : failed ? (
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          style={{ color: 'var(--st-fail, oklch(0.58 0.17 27))' }}
          aria-hidden
        />
      ) : done ? (
        <Check
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          style={{ color: 'var(--ok, oklch(0.55 0.13 155))' }}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0">{words}</span>
    </p>
  )
}
