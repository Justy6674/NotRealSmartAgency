'use client'

import { useState, type FormEvent } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'

/**
 * Bluesky, which has no sign-in page for other apps.
 *
 * Every other platform here hands the browser to a sign-in screen and hands it
 * back. Bluesky does not: the owner generates an app password in their own
 * settings and pastes it in. That is unusual enough that a bare pair of fields
 * labelled "identifier" and "app password" reads as a demand for a password the
 * owner has been told all his life never to type into another site — so the
 * form leads with why it is not that, and where the real one comes from.
 *
 * The steps are written as the owner sees them in the Bluesky app, in his
 * words. "Generate an app-specific credential" is the same sentence written for
 * somebody who already knew.
 *
 * The password is never held anywhere but this form's own state and the request
 * that carries it away. It is not put in the URL, not logged, and not kept once
 * the connection is made.
 */

interface BlueskyCredentialsFormProps {
  submitting?: boolean
  onSubmit: (credentials: { identifier: string; appPassword: string }) => void
  onCancel: () => void
}

/** Where the owner actually goes. Deep-linked so it is one click, not a hunt. */
const APP_PASSWORD_SETTINGS = 'https://bsky.app/settings/app-passwords'

export function BlueskyCredentialsForm({ submitting, onSubmit, onCancel }: BlueskyCredentialsFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [appPassword, setAppPassword] = useState('')

  // A leading @ is what a person types out of habit, and Bluesky rejects it.
  // Fixing it silently is kinder than a validation message about a character.
  const cleanedIdentifier = identifier.trim().replace(/^@/, '')
  const cleanedPassword = appPassword.trim()
  const ready = cleanedIdentifier.length > 0 && cleanedPassword.length > 0

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready || submitting) return
    onSubmit({ identifier: cleanedIdentifier, appPassword: cleanedPassword })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
          Connect your Bluesky
        </h4>
        <p
          className="mt-1 text-[12.5px] leading-relaxed"
          style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
        >
          Bluesky does not have a sign-in page for other apps. Instead you make an <b>app password</b>
          {' '}— a separate password just for this, which you can cancel any time without touching your
          own. Do not use your everyday Bluesky password here; it will not work, and you should not be
          typing it into anything but Bluesky.
        </p>
      </div>

      <ol
        className="space-y-1.5 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed"
        style={{
          borderColor: 'var(--line, oklch(0.915 0.007 240))',
          background: 'var(--panel-2, oklch(0.975 0.004 240))',
          color: 'var(--ink-2, oklch(0.46 0.012 240))',
        }}
      >
        <li>
          1. In Bluesky, open <b>Settings → Privacy and security → App passwords</b>.
        </li>
        <li>
          2. Tap <b>Add App Password</b> and give it a name you will recognise later, like
          {' '}<b>NotRealSmart</b>.
        </li>
        <li>
          3. Copy the password it shows you — four short blocks with dashes. Bluesky only shows it once.
        </li>
      </ol>

      <a
        href={APP_PASSWORD_SETTINGS}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
        style={{ color: 'var(--brand-deep, oklch(0.33 0.0209 240))' }}
      >
        Open that page in Bluesky
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>

      <label className="block">
        <span
          className="mb-1 block text-[12px] font-semibold"
          style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
        >
          Your Bluesky handle
        </span>
        <input
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          disabled={submitting}
          autoComplete="username"
          spellCheck={false}
          autoCapitalize="none"
          placeholder="yourbusiness.bsky.social"
          className="w-full rounded-lg border px-[11px] py-2 text-[13px] outline-none disabled:opacity-60"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink, oklch(0.20 0.014 240))',
          }}
        />
        <span className="mt-1 block text-[11.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          The name under your posts. Your email address works too.
        </span>
      </label>

      <label className="block">
        <span
          className="mb-1 block text-[12px] font-semibold"
          style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
        >
          The app password you just made
        </span>
        <input
          type="password"
          value={appPassword}
          onChange={(event) => setAppPassword(event.target.value)}
          disabled={submitting}
          autoComplete="off"
          spellCheck={false}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          className="w-full rounded-lg border px-[11px] py-2 font-mono text-[13px] outline-none disabled:opacity-60"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink, oklch(0.20 0.014 240))',
          }}
        />
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!ready || submitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          style={{
            background: 'var(--brand-deep, oklch(0.33 0.0209 240))',
            color: 'var(--brand-ink, oklch(1 0 0))',
          }}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Connect Bluesky
        </button>
      </div>
    </form>
  )
}
