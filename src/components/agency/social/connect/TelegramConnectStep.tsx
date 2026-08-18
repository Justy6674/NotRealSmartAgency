'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'

/**
 * Telegram, which is connected the other way round.
 *
 * Every other platform sends the owner out and brings him back. Telegram does
 * not: we show a short code, he sends it to a bot from the channel he wants
 * posts to appear in, and the connection completes on Telegram's side. There is
 * nothing for him to come back to — which is exactly why this screen has to
 * keep saying what it is waiting for. An earlier version of this idea showed a
 * code and a spinner with no words, and there was no way to tell "we are
 * waiting for you" from "this has hung".
 *
 * So three things are always on screen while it waits: the code, what to do
 * with it, and how long it lasts. The countdown is not decoration — the code
 * really does expire, and an owner who wanders off and comes back to a dead
 * code deserves to be told that rather than left pasting it into a bot that
 * says nothing useful back.
 *
 * The polling lives in `ConnectAccountDialog`, not here. This component is the
 * screen; the dialog owns every request in this folder so there is one place
 * that knows whether a connection was made.
 */

interface TelegramConnectStepProps {
  /** The code the owner sends. Shown big, in mono, selectable. */
  code: string
  /** The bot they send it to, without the @. */
  botUsername?: string
  /** Steps from the platform, if it gave any. Ours are shown when it did not. */
  instructions?: string[]
  /** ISO time the code dies. Absent means we were not told — no countdown then. */
  expiresAt?: string
  /** True while we are still checking whether the code has been used. */
  waiting: boolean
  onCancel: () => void
  /** Start again with a fresh code. */
  onRestart: () => void
}

/** Our own words, used when the platform sends none. */
const FALLBACK_STEPS = [
  'Open Telegram and find the bot below.',
  'Send it the code — you can paste it straight in.',
  'Come back here. This screen updates itself the moment it lands.',
]

function secondsLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.round(ms / 1000))
}

function countdownWords(seconds: number): string {
  if (seconds <= 0) return 'This code has expired'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins <= 0) return `This code lasts another ${secs} second${secs === 1 ? '' : 's'}`
  return `This code lasts another ${mins} minute${mins === 1 ? '' : 's'} ${secs
    .toString()
    .padStart(2, '0')}s`
}

export function TelegramConnectStep({
  code,
  botUsername,
  instructions,
  expiresAt,
  waiting,
  onCancel,
  onRestart,
}: TelegramConnectStepProps) {
  const [remaining, setRemaining] = useState<number | null>(() => secondsLeft(expiresAt))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null)
      return
    }
    setRemaining(secondsLeft(expiresAt))
    const timer = setInterval(() => setRemaining(secondsLeft(expiresAt)), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const expired = remaining !== null && remaining <= 0
  const steps = instructions && instructions.length > 0 ? instructions : FALLBACK_STEPS

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard access can be refused by the browser. The code is on screen
      // and selectable, so this is a missing convenience, not a failure worth
      // a red box.
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
          Connect your Telegram
        </h4>
        <p
          className="mt-1 text-[12.5px] leading-relaxed"
          style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
        >
          Telegram works the other way round to the rest: instead of signing in here, you send this
          code from the channel you want posts to go to.
        </p>
      </div>

      <div
        className="flex items-center gap-3 rounded-[10px] border px-3 py-3"
        style={{
          borderColor: expired
            ? 'var(--st-fail, oklch(0.58 0.17 27))'
            : 'var(--brand, oklch(0.545 0.03 240))',
          background: expired
            ? 'var(--panel-2, oklch(0.975 0.004 240))'
            : 'var(--brand-wash, oklch(0.966 0.0068 240))',
        }}
      >
        <code
          className="flex-1 select-all font-mono text-[19px] font-semibold tracking-[0.08em] [font-variant-numeric:tabular-nums]"
          style={{
            color: expired
              ? 'var(--ink-3, oklch(0.615 0.011 240))'
              : 'var(--brand-deep, oklch(0.33 0.0209 240))',
          }}
        >
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          disabled={expired}
          className="inline-flex items-center gap-1.5 rounded-lg border px-[9px] py-[5px] text-[11.5px] font-semibold disabled:opacity-50"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {remaining !== null ? (
        <p
          className="text-[11.5px] font-semibold"
          style={{
            color: expired
              ? 'var(--st-fail, oklch(0.58 0.17 27))'
              : 'var(--ink-3, oklch(0.615 0.011 240))',
          }}
        >
          {countdownWords(remaining)}
          {expired ? ' — get a new one below and start again. Nothing has been connected.' : '.'}
        </p>
      ) : null}

      <ol
        className="space-y-1.5 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed"
        style={{
          borderColor: 'var(--line, oklch(0.915 0.007 240))',
          background: 'var(--panel-2, oklch(0.975 0.004 240))',
          color: 'var(--ink-2, oklch(0.46 0.012 240))',
        }}
      >
        {steps.map((step, index) => (
          <li key={step}>
            {index + 1}. {step}
          </li>
        ))}
      </ol>

      {botUsername ? (
        <a
          href={`https://t.me/${botUsername.replace(/^@/, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
          style={{ color: 'var(--brand-deep, oklch(0.33 0.0209 240))' }}
        >
          Open @{botUsername.replace(/^@/, '')} in Telegram
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}

      {waiting && !expired ? (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-[12.5px]"
          style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Waiting for your code to arrive. You can leave this open — it will say so the moment it does.
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-3 py-2 text-[12.5px] font-semibold"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
          style={
            expired
              ? {
                  background: 'var(--brand-deep, oklch(0.33 0.0209 240))',
                  color: 'var(--brand-ink, oklch(1 0 0))',
                }
              : {
                  border: '1px solid var(--line, oklch(0.915 0.007 240))',
                  background: 'var(--panel, oklch(1 0 0))',
                  color: 'var(--ink-2, oklch(0.46 0.012 240))',
                }
          }
        >
          Give me a new code
        </button>
      </div>
    </div>
  )
}
