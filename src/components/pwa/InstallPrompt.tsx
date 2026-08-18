'use client'

import { useCallback, useEffect, useState } from 'react'
import { Share, SquarePlus, X } from 'lucide-react'

/**
 * "Put this on your home screen." Once. Ever.
 *
 * ── The rule this component exists to obey ───────────────────────────────
 * It appears once, it can be dismissed, and it never asks again. Every install
 * banner that becomes hated does so by asking a second time, so the decision —
 * whichever way it went — is written down before the card leaves the screen,
 * and nothing here can un-write it. Accepted, dismissed, or already installed
 * all land on the same flag. There is no "ask me later", because "later" is how
 * a prompt becomes a nag.
 *
 * ── Two browsers, two completely different mechanics ─────────────────────
 * Chromium fires `beforeinstallprompt`, which can be held and replayed later
 * against a button of our own. Safari on iOS fires nothing and has no API at
 * all — installing is a manual trip through Share → Add to Home Screen. So iOS
 * gets a card that TELLS them the steps rather than a button that does it,
 * because a button that cannot work is worse than no button.
 *
 * The consequence worth knowing: on iOS this card cannot tell whether they
 * followed the instructions. It writes the flag when it is shown-and-dismissed
 * either way, which means an iOS owner who ignores it does not see it again.
 * That is the correct trade — a hint they did not want, twice, is the failure
 * mode being avoided.
 *
 * ── Why the delay ────────────────────────────────────────────────────────
 * Showing this over a screen that has not finished arriving reads as an
 * interruption rather than an offer. Twelve seconds in, they are using the
 * thing, and the offer makes sense.
 */

const DECIDED_KEY = 'nrs-install-decided'
const SHOW_AFTER_MS = 12_000

/** The slice of the Chromium-only event this component actually uses. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function alreadyDecided(): boolean {
  try {
    return window.localStorage.getItem(DECIDED_KEY) === '1'
  } catch {
    // Storage blocked (private mode, locked-down browser). Without somewhere to
    // remember the answer this card could only ever nag, so it says nothing.
    return true
  }
}

function remember() {
  try {
    window.localStorage.setItem(DECIDED_KEY, '1')
  } catch {
    /* Nothing to do. The card is closing regardless. */
  }
}

/** Running from the home screen already — there is nothing left to offer. */
function isInstalled(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS never adopted display-mode for this and uses its own flag instead.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)
  if (!iOS) return false
  // Chrome and Firefox on iOS are Safari underneath but cannot install at all,
  // so the Share-sheet instructions would send the owner somewhere that has no
  // such button.
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export function InstallPrompt() {
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios'>('hidden')
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    if (isInstalled() || alreadyDecided()) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const onBeforeInstall = (event: Event) => {
      // Without this the browser shows its own bar wherever it likes, and the
      // event is spent — there is no second chance to hold it.
      event.preventDefault()
      setDeferred(event as InstallPromptEvent)
      timer = setTimeout(() => setMode('prompt'), SHOW_AFTER_MS)
    }

    /* Installed from the browser's own menu rather than this card. Same answer:
       stop asking. */
    const onInstalled = () => {
      remember()
      setMode('hidden')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    if (isIosSafari()) {
      timer = setTimeout(() => setMode('ios'), SHOW_AFTER_MS)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const close = useCallback(() => {
    remember()
    setMode('hidden')
    setDeferred(null)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return close()
    // Written down BEFORE the browser's own sheet opens. If they close that
    // sheet by swiping it away, no outcome ever resolves — and an unresolved
    // promise here would mean the card comes back tomorrow.
    remember()
    setMode('hidden')
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch (err) {
      console.error('[pwa] the install sheet could not open', err)
    }
    setDeferred(null)
  }, [deferred, close])

  if (mode === 'hidden') return null

  return (
    <div
      role="dialog"
      aria-label="Add this to your home screen"
      className={[
        // z-30, under the Director's mobile sheet (z-40). An offer to install
        // must never sit on top of someone asking for help.
        'fixed z-30 rounded-xl border bg-[var(--panel)] p-4 shadow-[var(--nrs-shadow)]',
        // Above the Director's mobile pill (fixed right-6 bottom-6), never over
        // it — a card that covers the way to ask for help is a bad trade for an
        // offer nobody asked for.
        'right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-4',
        'md:right-auto md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:left-[calc(1.5rem+env(safe-area-inset-left))] md:max-w-sm',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={close}
        aria-label="No thanks"
        className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--ink-3)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="pr-10 text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
        Keep this on your home screen
      </p>

      {mode === 'ios' ? (
        <>
          <p className="mt-1.5 pr-8 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
            Opens full screen, no address bar, straight to your desk.
          </p>
          <ol className="mt-3 flex flex-col gap-2 text-[12.5px] text-[var(--ink-2)]">
            <li className="flex items-center gap-2">
              <Share className="h-4 w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
              Tap the share button at the bottom of the screen
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus className="h-4 w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
              Choose <b className="font-semibold text-[var(--ink)]">Add to Home Screen</b>
            </li>
          </ol>
          <button
            type="button"
            onClick={close}
            className="mt-4 min-h-11 w-full rounded-[10px] bg-[var(--brand-deep)] px-4 text-[13px] font-semibold tracking-[0.02em] text-[var(--brand-ink)]"
          >
            Got it
          </button>
        </>
      ) : (
        <>
          <p className="mt-1.5 pr-8 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
            Opens full screen, straight to your desk, and still works when the
            signal drops.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="min-h-11 flex-1 rounded-[10px] bg-[var(--brand-deep)] px-4 text-[13px] font-semibold tracking-[0.02em] text-[var(--brand-ink)]"
            >
              Add it
            </button>
            <button
              type="button"
              onClick={close}
              className="min-h-11 rounded-[10px] border px-4 text-[13px] font-semibold text-[var(--ink-2)]"
            >
              No thanks
            </button>
          </div>
        </>
      )}
    </div>
  )
}
