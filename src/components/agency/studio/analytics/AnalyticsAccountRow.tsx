'use client'

import { BarChart3, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { AnalyticsAccount } from './analytics-desk'

/**
 * The row of things you can look at: everything together, then one account.
 *
 * ── What this replaces ─────────────────────────────────────────────────
 * A strip of ten fixed channel tabs, written out by hand, every one of them
 * always present. A business with one connected page saw nine dead tabs, and a
 * business with none saw ten. The row is now made of the accounts that are
 * actually connected, so an empty row is itself the answer and comes with the
 * way to fix it.
 *
 * X is not part of this product, so it is filtered out upstream and never
 * reaches this row.
 *
 * ── Three states, kept apart on purpose ────────────────────────────────
 * An account that reports figures, an account that cannot (a lapsed
 * connection, a personal profile the platform gives no numbers for), and an
 * account nobody could check. The third is drawn as unmeasured rather than
 * flattered into working — that flattery is how an expiring connection stays
 * invisible until a post fails.
 */

const LINE = 'var(--line, oklch(0.915 0.007 240))'
const PANEL = 'var(--panel, oklch(1 0 0))'
const INK = 'var(--ink, oklch(0.20 0.014 240))'
const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND = 'var(--brand, oklch(0.545 0.03 240))'
const BRAND_WASH = 'var(--brand-wash, oklch(0.966 0.0068 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'
const OK = 'oklch(0.55 0.13 155)'
const WARN = 'oklch(0.63 0.13 75)'
const FAIL = 'oklch(0.58 0.17 27)'

export type AnalyticsSelection = { kind: 'summary' } | { kind: 'account'; accountId: string }

export interface AnalyticsAccountRowProps {
  accounts: AnalyticsAccount[]
  selection: AnalyticsSelection
  onSelect: (selection: AnalyticsSelection) => void
  loading?: boolean
  /** Set when the row itself could not be built, or was built incompletely. */
  problem?: string | null
  /** False when this business has never had its accounts connected. */
  linked?: boolean
}

function healthColour(account: AnalyticsAccount): string {
  if (account.health === 'error') return FAIL
  if (account.health === 'warning') return WARN
  if (account.health === 'healthy') return OK
  return INK_3
}

function healthWords(account: AnalyticsAccount): string {
  if (account.health === 'error') return 'Needs reconnecting — it is not reporting anything.'
  if (account.health === 'warning') return 'Working, but something needs attention.'
  if (account.canFetchAnalytics === false) return 'Connected, but this one sends no figures back.'
  if (account.canFetchAnalytics === null) return 'We could not check this one just now.'
  return 'Reporting normally.'
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

export function AnalyticsAccountRow({
  accounts,
  selection,
  onSelect,
  loading = false,
  problem,
  linked = true,
}: AnalyticsAccountRowProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} />
        <span className="text-[12.5px]" style={{ color: INK_3 }}>
          Finding your accounts…
        </span>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div
        className="flex flex-col items-start gap-[8px] rounded-[12px] p-[14px]"
        style={{ border: `1px solid ${LINE}`, background: PANEL }}
      >
        <p className="text-[13px] font-[600]" style={{ color: BRAND_DEEP }}>
          No connected accounts yet
        </p>
        <p className="text-[12.5px]" style={{ color: INK_3 }}>
          {linked
            ? 'Nothing is connected for this business, so there is nothing to measure. Connect an account and the figures start arriving on their own.'
            : 'This business has not been set up for posting yet, so there are no results to show. Connect an account to begin.'}
        </p>
        <Link
          href="/agency/social/accounts"
          className="rounded-[8px] px-[12px] py-[7px] text-[12.5px] font-[600]"
          style={{ background: BRAND_DEEP, color: 'var(--brand-ink, oklch(1 0 0))' }}
        >
          Connect an account
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-[6px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <button
          type="button"
          onClick={() => onSelect({ kind: 'summary' })}
          aria-pressed={selection.kind === 'summary'}
          title="Everything together"
          className="flex h-12 w-12 items-center justify-center rounded-[12px] transition-colors"
          style={{
            border: `1px solid ${selection.kind === 'summary' ? BRAND : LINE}`,
            background: selection.kind === 'summary' ? BRAND_WASH : PANEL,
            color: selection.kind === 'summary' ? BRAND_DEEP : INK,
          }}
        >
          <BarChart3 className="h-5 w-5" />
        </button>

        {accounts.map((account) => {
          const active = selection.kind === 'account' && selection.accountId === account.id
          const quiet = account.canFetchAnalytics === false
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onSelect({ kind: 'account', accountId: account.id })}
              aria-pressed={active}
              title={`${account.label} — ${healthWords(account)}`}
              className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[12px] transition-colors"
              style={{
                border: `1px solid ${active ? BRAND : LINE}`,
                background: active ? BRAND_WASH : PANEL,
                opacity: quiet ? 0.55 : 1,
              }}
            >
              {account.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="text-[13px] font-[600]"
                  style={{ color: active ? BRAND_DEEP : INK }}
                >
                  {initials(account.label)}
                </span>
              )}
              <span
                aria-hidden
                className="absolute bottom-[3px] right-[3px] h-[8px] w-[8px] rounded-full"
                style={{
                  background: healthColour(account),
                  boxShadow: `0 0 0 1.5px ${PANEL}`,
                }}
              />
            </button>
          )
        })}
      </div>

      <p className="text-[11.5px]" style={{ color: INK_3 }}>
        {selection.kind === 'summary'
          ? 'Everything together. Choose an account to see it on its own.'
          : (accounts.find((a) => selection.kind === 'account' && a.id === selection.accountId)
              ?.label ?? 'One account')}
      </p>

      {problem ? (
        <p className="text-[11.5px]" style={{ color: WARN }}>
          {problem}
        </p>
      ) : null}
    </div>
  )
}
