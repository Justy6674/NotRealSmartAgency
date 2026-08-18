'use client'

import { Plus } from 'lucide-react'
import { CONNECTABLE_PLATFORMS, PlatformMark } from './PlatformMark'

interface AccountsEmptyStateProps {
  onConnect: () => void
  /** The business's own name, so the invitation is about them, not about us. */
  businessName?: string
}

/**
 * What a business with nothing connected sees — which today is twelve of the
 * fourteen businesses on this desk.
 *
 * ── Why this is a whole screen and not a line of grey text ─────────────
 * It used to be one sentence under an empty grid: "Nothing is connected to
 * this business yet." True, and useless. For most businesses this is the FIRST
 * screen of the product they ever look at properly, so it is the whole first
 * impression, and an empty grid with an apology under it reads as something
 * broken rather than something not started.
 *
 * So it says what connecting gets them, what it costs them (a sign-in on the
 * platform, nothing else), and what it does not do (publish anything). The
 * platforms are shown as marks rather than named in a sentence, because
 * recognising your own Instagram is instant and reading a list of thirteen
 * words is not. The list is the chooser's own `CONNECTABLE_PLATFORMS`, so this
 * screen cannot promise a platform the next screen does not offer — X is
 * absent from both for the same one reason.
 *
 * It is not an error state. No red, no warning triangle, no "0 accounts".
 */
export function AccountsEmptyState({ onConnect, businessName }: AccountsEmptyStateProps) {
  return (
    <div
      className="rounded-xl border px-6 py-7"
      style={{
        borderColor: 'var(--brand, oklch(0.545 0.115 240))',
        background: 'var(--brand-wash, oklch(0.966 0.026 240))',
      }}
    >
      <div className="max-w-[52ch]">
        <h3
          className="text-[15px] font-semibold tracking-[-0.01em]"
          style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
        >
          {businessName
            ? `Connect the accounts ${businessName} posts from`
            : 'Connect the accounts this business posts from'}
        </h3>
        <p
          className="mt-1.5 text-[12.5px] leading-relaxed"
          style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
        >
          Once one account is connected, this business can write, schedule and send from here —
          and see how each post did afterwards. You sign in on the platform itself, so we never
          see your password, and nothing is published until you approve it.
        </p>

        <button
          type="button"
          onClick={onConnect}
          className="mt-4 inline-flex items-center gap-2 rounded-[10px] px-4 py-[10px] text-[13px] font-semibold tracking-[0.02em] transition-colors"
          style={{
            background: 'var(--brand-deep, oklch(0.33 0.08 240))',
            color: 'var(--brand-ink, oklch(1 0 0))',
          }}
        >
          <Plus className="h-[15px] w-[15px]" strokeWidth={2.5} />
          Connect an account
        </button>

        <p
          className="mt-5 text-[11px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
        >
          You can connect
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {CONNECTABLE_PLATFORMS.map((platform) => (
            <li key={platform.slug} className="flex items-center gap-1.5">
              <PlatformMark platform={platform.slug} size={18} />
              <span className="text-[11.5px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
                {platform.label}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[11.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          Add as many as you like — two Instagram accounts are two separate connections, and you
          can disconnect any of them later without touching the account itself.
        </p>
      </div>
    </div>
  )
}
