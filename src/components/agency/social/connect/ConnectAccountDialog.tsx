'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'

import { BlueskyCredentialsForm } from './BlueskyCredentialsForm'
import { ConnectStatus, type ConnectPhase } from './ConnectStatus'
import {
  PlatformGrid,
  platformBySlug,
  type ConnectablePlatform,
  type ConnectedAccountSummary,
} from './PlatformGrid'
import { SecondarySelectionStep, type ConnectChoice } from './SecondarySelectionStep'
import { TelegramConnectStep } from './TelegramConnectStep'

/**
 * Connecting a social account, start to finish, without leaving our product
 * for anybody else's.
 *
 * ── What this replaces ─────────────────────────────────────────────────
 * The publisher will host the whole flow: its picker, its account-selection
 * screen, its wording, its name at the top of the page. Handing the owner to it
 * costs three things we cannot afford. He lands on a company he has never heard
 * of and has no reason to trust with his Facebook. The screen cannot name the
 * business he is connecting, because it does not know our businesses exist. And
 * the words on it are written for a developer integrating a platform, not for a
 * clinic owner who wants Wednesday's post to reach his Page.
 *
 * So every step is ours. The only thing that happens on somebody else's screen
 * is the platform's own sign-in, which is the one screen that genuinely must be
 * theirs.
 *
 * ── One place makes the requests ───────────────────────────────────────
 * Every fetch in this folder is in this file. The step components are screens:
 * they take what they need and hand back what the owner did. That is deliberate
 * — when several components each knew how to finish a connection, "did this
 * work" had several answers, and the desk showed the most flattering one.
 *
 * ── The states are honest ──────────────────────────────────────────────
 * `ConnectPhase` is a union, not a bag of booleans, so "connecting" and
 * "failed" cannot both be true at once. A failure keeps the server's own
 * sentence, which is written for the owner and says what was and was not
 * changed. Nothing here invents a green tick: an account's state comes from
 * what was measured, through `HealthBadge`, and the grid shows a warning as a
 * warning even when the platform is technically connected.
 */

/* ── Our own routes. The owner never sees any of these words ─────────────── */

export const CONNECT_API = {
  /** POST { brandId, platform } → { authUrl }. The handover starts here. */
  start: '/api/zernio/connect/start',
  /**
   * GET ?brandId&platform → { choices, hasMore } · POST the chosen row back.
   *
   * No credential travels through the browser on either call. The platform
   * token from the sign-in is held server-side in a signed, httpOnly
   * continuation; this screen only ever sees page names and page ids, and hands
   * back the row the owner picked. That is why there is no token in any URL
   * here, and why nothing in this file reads one.
   */
  select: '/api/zernio/connect/select',
  /** POST { brandId, identifier, appPassword } → { connected, account } */
  bluesky: '/api/zernio/connect/bluesky',
  /** POST { brandId } → { code, botUsername, expiresAt } · GET ?code to check. */
  telegram: '/api/zernio/connect/telegram',
} as const

/* ── Sentences for the owner. Never a status code, never upstream's words ── */

const COULD_NOT_START =
  'That connection could not be started just now. Nothing has been changed. Try again in a moment.'

const COULD_NOT_FINISH =
  'That connection could not be finished just now. Nothing has been connected and nothing has been changed.'

const NO_BUSINESS =
  'Choose a business first — accounts are connected to one business at a time.'

/** How often we ask whether a Telegram code has been used, and for how long. */
const TELEGRAM_POLL_MS = 3000
const TELEGRAM_GIVE_UP_MS = 10 * 60 * 1000

/* ── Which step of the flow is on screen ────────────────────────────────── */

type Step =
  | { name: 'pick' }
  | { name: 'choose'; platform: ConnectablePlatform; choices: ConnectChoice[]; hasMore: boolean }
  | { name: 'bluesky'; platform: ConnectablePlatform }
  | { name: 'telegram'; platform: ConnectablePlatform; code: string; botUsername?: string; instructions?: string[]; expiresAt?: string }

interface ConnectAccountDialogProps {
  /** The business this connection belongs to. Never more than one at a time. */
  brandId: string | null
  /** What this business already has, so the grid can be honest about it. */
  accounts: ConnectedAccountSummary[]
  onClose: () => void
  /** Re-read the accounts list. Called whenever something actually changed. */
  onConnected: () => void
  /** Set when the owner arrived from "Reconnect" on an account that has lapsed. */
  reconnect?: { platform: string; name: string } | null
}

/**
 * Every step value the handover uses to mean "ask the person".
 *
 * Six platforms, six different words for the same moment. They are matched by
 * name here only to know a choice is coming; WHICH list to fetch is decided
 * server-side from the platform, because a renamed step must degrade to a
 * visible failure rather than quietly fetching the wrong list.
 */
const SELECTION_STEPS = new Set([
  'select_page',
  'select_account',
  'select_organization',
  'select_location',
  'select_board',
  'select_profile',
])

/**
 * What the address bar says happened while the owner was away.
 *
 * Exported because the dialog can only act on it while it is mounted, and the
 * owner comes back from the platform to a fresh page load with nothing open. A
 * screen that hosts this dialog should call this on load and open the dialog
 * when it answers anything but null — otherwise a person who has just signed in
 * to Facebook lands on a quiet accounts page with a half-finished connection
 * and no sign that anything is waiting on them. It only reads; the dialog is
 * what spends the parameters.
 */
export function readConnectReturn():
  | { kind: 'choose'; platform: string }
  | { kind: 'connected'; platform: string }
  | { kind: 'failed'; error: string }
  | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)

  const error = params.get('error')
  if (error) return { kind: 'failed', error }

  // A choice is still to be made. `connect=select` is what our own callback
  // says; the step names are the platform's own words for the same moment, and
  // are accepted so a handover that arrives with one and not the other is not
  // silently dropped on the floor.
  const step = params.get('step') ?? ''
  const choosing = params.get('connect') === 'select' || SELECTION_STEPS.has(step)
  const platform = params.get('platform') ?? params.get('connected')
  if (choosing && platform) return { kind: 'choose', platform }

  // Finished on the way through: the account already exists.
  const connected = params.get('connected')
  if (connected) return { kind: 'connected', platform: connected }

  if (platform && (params.get('accountId') || params.get('success') === 'true')) {
    return { kind: 'connected', platform }
  }

  return null
}

/** Take the handover words out of the address bar so a refresh cannot replay them. */
function clearReturn() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  // `brandId` is deliberately left where it is: the callback puts it there so
  // the page opens on the business the connection was made for, and stripping
  // it would send the owner back to whichever business happened to be selected.
  for (const key of [
    'platform', 'connected', 'connect', 'step', 'accountId', 'profileId',
    'username', 'success', 'error', 'zernio_account',
  ]) {
    url.searchParams.delete(key)
  }
  window.history.replaceState({}, '', url.toString())
}

export function ConnectAccountDialog({
  brandId,
  accounts,
  onClose,
  onConnected,
  reconnect,
}: ConnectAccountDialogProps) {
  const [step, setStep] = useState<Step>({ name: 'pick' })
  const [phase, setPhase] = useState<ConnectPhase>({ kind: 'idle' })
  /** Which tile is mid-start, so the grid can show it and only it as busy. */
  const [startingSlug, setStartingSlug] = useState<string | null>(null)

  /** Set on unmount so a poll or a slow fetch cannot set state afterwards. */
  const gone = useRef(false)
  useEffect(() => {
    gone.current = false
    return () => { gone.current = true }
  }, [])

  /*
   * The parent's "re-read the accounts" callback, held in a ref.
   *
   * It is almost always written inline (`onConnected={() => void refetch()}`),
   * so it is a new function on every parent render. Listing it in the Telegram
   * poll's dependencies would tear that timer down and start it again on each
   * of those renders — which also restarts the ten-minute give-up clock, so a
   * dead code would be polled forever on a screen that re-renders. Kept in a
   * ref, the poll depends on nothing that changes for cosmetic reasons.
   */
  const onConnectedRef = useRef(onConnected)
  useEffect(() => { onConnectedRef.current = onConnected }, [onConnected])

  const fail = useCallback((reason: string, platformLabel?: string) => {
    if (gone.current) return
    setStartingSlug(null)
    setPhase(platformLabel ? { kind: 'failed', platformLabel, reason } : { kind: 'failed', reason })
  }, [])

  /* ── Step 1: hand the browser to the platform's own sign-in ───────────── */

  const start = useCallback(async (platform: ConnectablePlatform) => {
    if (!brandId) {
      fail(NO_BUSINESS)
      return
    }

    // Two platforms never leave the product at all.
    if (platform.flow === 'app-password') {
      setStartingSlug(null)
      setPhase({ kind: 'idle' })
      setStep({ name: 'bluesky', platform })
      return
    }
    if (platform.flow === 'access-code') {
      await startTelegram(platform)
      return
    }

    setStartingSlug(platform.slug)
    setPhase({ kind: 'starting', platformLabel: platform.label })
    try {
      const res = await fetch(CONNECT_API.start, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, platform: platform.slug }),
      })
      const data = (await res.json().catch(() => null)) as { authUrl?: string; error?: string } | null

      if (!res.ok || !data?.authUrl) {
        // The route writes its own sentence for the owner — "this business is
        // not set up to connect accounts yet" is a real answer, and burying it
        // under a house line is what made every failure here look alike.
        fail(data?.error ?? COULD_NOT_START, platform.label)
        return
      }

      setPhase({ kind: 'redirecting', platformLabel: platform.label })
      window.location.assign(data.authUrl)
    } catch {
      fail(COULD_NOT_START, platform.label)
    }
    // startTelegram is defined below and stable for the life of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, fail])

  /* ── Step 2: back from the platform, with a choice to make ────────────── */

  const loadChoices = useCallback(async (platform: ConnectablePlatform) => {
    if (!brandId) {
      fail(NO_BUSINESS)
      return
    }
    setPhase({ kind: 'choosing', platformLabel: platform.label })
    try {
      const query = new URLSearchParams({ brandId, platform: platform.slug })
      const res = await fetch(`${CONNECT_API.select}?${query.toString()}`)
      const data = (await res.json().catch(() => null)) as
        | { choices?: ConnectChoice[]; hasMore?: boolean; error?: string }
        | null

      if (!res.ok) {
        fail(data?.error ?? COULD_NOT_FINISH, platform.label)
        return
      }
      if (gone.current) return

      setStep({
        name: 'choose',
        platform,
        choices: Array.isArray(data?.choices) ? data.choices : [],
        hasMore: data?.hasMore === true,
      })
    } catch {
      fail(COULD_NOT_FINISH, platform.label)
    }
  }, [brandId, fail])

  const confirmChoice = useCallback(async (choice: ConnectChoice) => {
    if (step.name !== 'choose') return
    const { platform } = step
    if (!brandId) {
      fail(NO_BUSINESS)
      return
    }

    setPhase({ kind: 'submitting', platformLabel: platform.label })
    try {
      const res = await fetch(CONNECT_API.select, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The row goes back whole. LinkedIn needs the organisation's urn and
        // Google Business needs the account that owns the location, and neither
        // can be recovered from an id alone.
        body: JSON.stringify({ brandId, platform: platform.slug, choice }),
      })
      const data = (await res.json().catch(() => null)) as
        | { connected?: boolean; error?: string }
        | null

      if (!res.ok || data?.connected === false) {
        fail(data?.error ?? COULD_NOT_FINISH, platform.label)
        return
      }
      if (gone.current) return

      setStep({ name: 'pick' })
      setPhase({ kind: 'connected', platformLabel: platform.label, accountName: choice.name })
      onConnected()
    } catch {
      fail(COULD_NOT_FINISH, platform.label)
    }
  }, [brandId, fail, onConnected, step])

  /* ── Bluesky: no sign-in page, an app password instead ────────────────── */

  const submitBluesky = useCallback(async (credentials: { identifier: string; appPassword: string }) => {
    const platform = platformBySlug('bluesky')
    if (!brandId || !platform) {
      fail(NO_BUSINESS)
      return
    }
    setPhase({ kind: 'submitting', platformLabel: platform.label })
    try {
      const res = await fetch(CONNECT_API.bluesky, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, ...credentials }),
      })
      const data = (await res.json().catch(() => null)) as
        | { connected?: boolean; account?: { name?: string }; error?: string }
        | null

      if (!res.ok || data?.connected === false) {
        // Wrong handle or a password that has been cancelled is the common
        // case, and the route says which. Anything else keeps its own sentence.
        fail(data?.error ?? COULD_NOT_FINISH, platform.label)
        return
      }
      if (gone.current) return

      setStep({ name: 'pick' })
      setPhase({
        kind: 'connected',
        platformLabel: platform.label,
        ...(data?.account?.name ? { accountName: data.account.name } : {}),
      })
      onConnected()
    } catch {
      fail(COULD_NOT_FINISH, platform.label)
    }
  }, [brandId, fail, onConnected])

  /* ── Telegram: a code, and then waiting ───────────────────────────────── */

  async function startTelegram(platform: ConnectablePlatform) {
    if (!brandId) {
      fail(NO_BUSINESS)
      return
    }
    setStartingSlug(platform.slug)
    setPhase({ kind: 'starting', platformLabel: platform.label })
    try {
      const res = await fetch(CONNECT_API.telegram, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      })
      const data = (await res.json().catch(() => null)) as
        | { code?: string; botUsername?: string; instructions?: string[]; expiresAt?: string; error?: string }
        | null

      if (!res.ok || !data?.code) {
        fail(data?.error ?? COULD_NOT_START, platform.label)
        return
      }
      if (gone.current) return

      setStep({
        name: 'telegram',
        platform,
        code: data.code,
        ...(data.botUsername ? { botUsername: data.botUsername } : {}),
        ...(data.instructions ? { instructions: data.instructions } : {}),
        ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
      })
      setStartingSlug(null)
      setPhase({
        kind: 'waiting',
        platformLabel: platform.label,
        detail: 'Send the code from Telegram. This screen is watching for it.',
      })
    } catch {
      fail(COULD_NOT_START, platform.label)
    }
  }

  /**
   * Ask, on a timer, whether the code has been used.
   *
   * It gives up after ten minutes rather than polling a dead code forever, and
   * says so — a spinner that never resolves is the state this whole file exists
   * to avoid.
   */
  useEffect(() => {
    if (step.name !== 'telegram' || !brandId) return

    const code = step.code
    const platformLabel = step.platform.label
    const startedAt = Date.now()
    let stopped = false

    const check = async () => {
      if (stopped || gone.current) return
      try {
        const query = new URLSearchParams({ brandId, code })
        const res = await fetch(`${CONNECT_API.telegram}?${query.toString()}`)
        const data = (await res.json().catch(() => null)) as
          | { connected?: boolean; account?: { name?: string }; error?: string }
          | null

        if (stopped || gone.current) return

        if (res.ok && data?.connected) {
          stopped = true
          setStep({ name: 'pick' })
          setPhase({
            kind: 'connected',
            platformLabel,
            ...(data.account?.name ? { accountName: data.account.name } : {}),
          })
          onConnectedRef.current()
          return
        }

        /*
         * Anything but ok stops it.
         *
         * The route answers 200 with `connected: false` for "not yet", so a
         * failure status here is never impatience — it is an expired code, a
         * screen left open past its window, or a code that has been replaced.
         * Each of those carries its own sentence saying what to do, and each is
         * shown rather than being polled through.
         */
        if (!res.ok) {
          stopped = true
          fail(data?.error ?? COULD_NOT_FINISH, platformLabel)
          return
        }

        if (Date.now() - startedAt > TELEGRAM_GIVE_UP_MS) {
          stopped = true
          fail(
            'Nothing arrived from Telegram, so this has stopped watching. Nothing has been connected. Ask for a new code and try again.',
            platformLabel,
          )
        }
      } catch {
        // A single failed check is not a failed connection — the owner may be
        // mid-send. The give-up clock above is what ends it.
      }
    }

    const timer = setInterval(check, TELEGRAM_POLL_MS)
    void check()
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [brandId, fail, step])

  /* ── Coming back from the platform ────────────────────────────────────── */

  useEffect(() => {
    const back = readConnectReturn()
    if (!back) return
    clearReturn()

    if (back.kind === 'failed') {
      // The callback wrote this sentence for the owner. It is kept word for word.
      setPhase({ kind: 'failed', reason: back.error })
      return
    }

    const platform = platformBySlug(back.platform)
    if (!platform) return

    if (back.kind === 'choose') {
      void loadChoices(platform)
      return
    }

    setPhase({ kind: 'connected', platformLabel: platform.label })
    onConnected()
    // Runs once, on the mount that follows the handover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── If they arrived from "Reconnect", start that platform straight away ─ */

  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || !reconnect) return
    const platform = platformBySlug(reconnect.platform)
    if (!platform) return
    autoStarted.current = true
    void start(platform)
  }, [reconnect, start])

  /* ── Chrome ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const busy =
    phase.kind === 'starting' || phase.kind === 'redirecting' || phase.kind === 'submitting'

  const heading =
    reconnect
      ? `Reconnect ${reconnect.name}`
      : step.name === 'pick'
        ? 'Connect an account'
        : `Connect your ${step.platform.label}`

  const backToGrid = () => {
    setStartingSlug(null)
    setStep({ name: 'pick' })
    setPhase({ kind: 'idle' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'oklch(0.2 0.014 240 / 0.45)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border"
        style={{
          borderColor: 'var(--line, oklch(0.915 0.007 240))',
          background: 'var(--panel, oklch(1 0 0))',
          color: 'var(--ink, oklch(0.20 0.014 240))',
          boxShadow: 'var(--shadow, 0 1px 2px oklch(0.2 0.02 240 / .05), 0 8px 24px -16px oklch(0.2 0.02 240 / .28))',
        }}
      >
        <div
          className="flex shrink-0 items-center gap-2 border-b px-[15px] py-[11px]"
          style={{ borderColor: 'var(--line-soft, oklch(0.950 0.005 240))' }}
        >
          {step.name !== 'pick' ? (
            <button
              type="button"
              onClick={backToGrid}
              aria-label="Back to the list of accounts"
              className="rounded-md p-1"
              style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <h3 className="flex-1 text-[12.5px] font-semibold">{heading}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-[15px] py-3">
          <ConnectStatus phase={phase} />

          {step.name === 'pick' ? (
            <>
              <p
                className="text-[12.5px] leading-relaxed"
                style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
              >
                {reconnect
                  ? `${reconnect.name} has stopped accepting posts. Sign in to it again and it picks up where it left off — nothing already written or scheduled is lost.`
                  : 'Pick where you post. You sign in on the platform itself, then come straight back here. Nothing goes out until you approve it.'}
              </p>
              <PlatformGrid
                accounts={accounts}
                onSelect={start}
                busySlug={
                  // Derived rather than trusted: a slug left over from an
                  // earlier attempt cannot leave a tile spinning once the flow
                  // has moved on.
                  phase.kind === 'starting' || phase.kind === 'redirecting' ? startingSlug : null
                }
                disabled={busy}
              />
              <p className="text-[11.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
                Not sure which one to pick? Ask the Director.
              </p>
            </>
          ) : null}

          {step.name === 'choose' ? (
            <SecondarySelectionStep
              platform={step.platform}
              choices={step.choices}
              hasMore={step.hasMore}
              submitting={phase.kind === 'submitting'}
              onConfirm={confirmChoice}
              onCancel={backToGrid}
            />
          ) : null}

          {step.name === 'bluesky' ? (
            <BlueskyCredentialsForm
              submitting={phase.kind === 'submitting'}
              onSubmit={submitBluesky}
              onCancel={backToGrid}
            />
          ) : null}

          {step.name === 'telegram' ? (
            <TelegramConnectStep
              code={step.code}
              {...(step.botUsername ? { botUsername: step.botUsername } : {})}
              {...(step.instructions ? { instructions: step.instructions } : {})}
              {...(step.expiresAt ? { expiresAt: step.expiresAt } : {})}
              waiting={phase.kind === 'waiting'}
              onCancel={backToGrid}
              onRestart={() => void startTelegram(step.platform)}
            />
          ) : null}
        </div>

        <div
          className="flex shrink-0 gap-2 border-t px-[15px] py-3"
          style={{ borderColor: 'var(--line-soft, oklch(0.950 0.005 240))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-2, oklch(0.46 0.012 240))',
            }}
          >
            {phase.kind === 'connected' ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
