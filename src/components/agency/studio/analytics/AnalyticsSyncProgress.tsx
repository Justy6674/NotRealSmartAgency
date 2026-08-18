'use client'

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { bringInExternalPost, type AnalyticsAccount, type AnalyticsSyncState } from './analytics-desk'

/**
 * How current these figures are — and how to bring in a post we did not send.
 *
 * ── The two silences this ends ─────────────────────────────────────────
 * First: figures arrive on a delay, and a screen that shows a number with no
 * date beside it is quietly claiming "as of now". Where the delay is known it
 * is printed; where it is not, the time of the last collection is.
 *
 * Second: a business that posted by hand for a year had every one of those
 * posts missing from this screen with nothing on the page to explain it or fix
 * it. The action below pulls one in by its public link. It was written months
 * ago and never given a way to be used.
 *
 * The progress line only appears while a first collection is genuinely still
 * landing. An always-spinning bar is a lie with an animation on it.
 */

const LINE = 'var(--line, oklch(0.915 0.007 240))'
const PANEL = 'var(--panel, oklch(1 0 0))'
const PANEL_2 = 'var(--panel-2, oklch(0.975 0.004 240))'
const INK_2 = 'var(--ink-2, oklch(0.46 0.012 240))'
const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND = 'var(--brand, oklch(0.545 0.03 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'
const WARN = 'oklch(0.63 0.13 75)'
const OK = 'oklch(0.55 0.13 155)'

export interface AnalyticsSyncProgressProps {
  brandId: string
  sync: AnalyticsSyncState
  accounts: AnalyticsAccount[]
}

function freshnessLine(sync: AnalyticsSyncState): string | null {
  if (sync.dataStaleness) return `These figures are ${sync.dataStaleness} old.`
  if (sync.lastSync) {
    return `Last collected ${new Date(sync.lastSync).toLocaleString('en-AU')}.`
  }
  return null
}

export function AnalyticsSyncProgress({ brandId, sync, accounts }: AnalyticsSyncProgressProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  // Chosen account, or the first one that exists. The accounts arrive a moment
  // after this renders, so holding the first id in state at mount would leave
  // the control permanently empty for anyone who opened the screen quickly.
  const [chosenId, setChosenId] = useState('')
  const accountId = accounts.some((account) => account.id === chosenId)
    ? chosenId
    : accounts[0]?.id ?? ''
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null)

  const freshness = freshnessLine(sync)

  const submit = async () => {
    if (!url.trim() || !accountId) return
    setBusy(true)
    setOutcome(null)
    const result = await bringInExternalPost({ brandId, accountId, url: url.trim() })
    setBusy(false)
    setOutcome({
      ok: result.ok,
      message: result.ok
        ? 'Brought in. Its figures will appear here once they have been collected.'
        : result.problem ?? 'That post could not be brought in.',
    })
    if (result.ok) {
      setUrl('')
      sync.refresh()
    }
  }

  return (
    <div
      className="rounded-[12px] p-[12px_14px]"
      style={{ border: `1px solid ${LINE}`, background: PANEL }}
    >
      <div className="flex flex-wrap items-center gap-[10px]">
        {sync.collecting ? (
          <span className="flex items-center gap-[7px] text-[12.5px]" style={{ color: BRAND_DEEP }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: BRAND }} />
            Still collecting your first set of figures — this can take a few hours.
          </span>
        ) : (
          <span className="text-[12.5px]" style={{ color: INK_2 }}>
            {freshness ?? 'No collection has run for this business yet.'}
          </span>
        )}

        {sync.collecting && freshness ? (
          <span className="text-[11.5px]" style={{ color: INK_3 }}>
            {freshness}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-[8px]">
          {accounts.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="rounded-[8px] px-[10px] py-[6px] text-[12px] font-[600]"
              style={{ border: `1px solid ${LINE}`, background: PANEL_2, color: INK_2 }}
            >
              {open ? 'Close' : 'Add a post from elsewhere'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={sync.refresh}
            disabled={sync.loading}
            className="flex items-center gap-[6px] rounded-[8px] px-[10px] py-[6px] text-[12px] font-[600]"
            style={{ border: `1px solid ${LINE}`, background: PANEL_2, color: INK_2 }}
          >
            <RefreshCw className={`h-3 w-3 ${sync.loading ? 'animate-spin' : ''}`} />
            Check again
          </button>
        </div>
      </div>

      {sync.collecting ? (
        // Indeterminate on purpose: nobody upstream tells us what fraction is
        // done, and inventing a percentage would be a number with nothing
        // behind it.
        <div
          className="mt-[10px] h-[4px] w-full overflow-hidden rounded-full"
          style={{ background: PANEL_2 }}
        >
          <div
            className="h-full w-1/3 animate-pulse rounded-full"
            style={{ background: BRAND }}
          />
        </div>
      ) : null}

      {sync.problem ? (
        <p className="mt-[8px] text-[11.5px]" style={{ color: WARN }}>
          {sync.problem}
        </p>
      ) : null}

      {open ? (
        <div className="mt-[12px] space-y-[8px]">
          <p className="text-[12px]" style={{ color: INK_3 }}>
            Paste the link to a post you published yourself. Its figures will be counted here
            alongside everything else.
          </p>
          <div className="flex flex-wrap gap-[8px]">
            <select
              value={accountId}
              onChange={(event) => setChosenId(event.target.value)}
              className="rounded-[8px] px-[10px] py-[7px] text-[13px]"
              style={{ border: `1px solid ${LINE}`, background: PANEL, color: INK_2 }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
            <input
              type="url"
              value={url}
              placeholder="https://…"
              onChange={(event) => setUrl(event.target.value)}
              className="min-w-[220px] flex-1 rounded-[8px] px-[10px] py-[7px] text-[13px]"
              style={{ border: `1px solid ${LINE}`, background: PANEL, color: INK_2 }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy || !url.trim() || !accountId}
              className="rounded-[8px] px-[12px] py-[7px] text-[12.5px] font-[600]"
              style={{
                background: BRAND_DEEP,
                color: 'var(--brand-ink, oklch(1 0 0))',
                opacity: busy || !url.trim() ? 0.6 : 1,
              }}
            >
              {busy ? 'Bringing it in…' : 'Bring it in'}
            </button>
          </div>
          {outcome ? (
            <p className="text-[12px]" style={{ color: outcome.ok ? OK : WARN }}>
              {outcome.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
