'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useSocialAccounts, type SocialAccount } from '@/hooks/useSocialAccounts'
import { ConnectAccountDialog } from '@/components/agency/social/connect/ConnectAccountDialog'
import type { ConnectedAccountSummary } from '@/components/agency/social/connect/PlatformGrid'
import { AccountCard } from './AccountCard'
import { AccountsEmptyState } from './AccountsEmptyState'
import { AccountEntitiesEditor } from './AccountEntitiesEditor'
import { CONNECTABLE_PLATFORMS, presentationFor } from './PlatformMark'

/**
 * Where the owner sees which accounts can post, and fixes the ones that cannot.
 *
 * The shape is Mixpost's accounts page: a card grid, the add tile leading it,
 * a real avatar with the platform badged on its corner, when it was added, and
 * a menu on each card. What Mixpost's page does not do is tell you an account
 * is about to stop working, and that is the reason this screen exists at all.
 *
 * ── Three things this rewrite is answering for ─────────────────────────
 *
 * 1. **Health was a constant.** The grid drew a green tick on every account
 *    because the hook stamped `status: 'active'` on all of them. Measured live
 *    on 2026-08-18: ten accounts, eight healthy, two in warning, and the desk
 *    said everything was fine. Health is now measured per account, the summary
 *    counts the same rows the cards are drawn from, and the ones needing
 *    something are sorted to the FRONT of the grid — a warning discovered by
 *    scrolling is a warning found the day after a post failed.
 *
 * 2. **The empty screen was an apology.** Twelve of fourteen businesses have
 *    nothing connected, so for most of them this is the first screen of the
 *    product they properly read. One line of grey text under an empty grid
 *    reads as broken. It is an invitation now — see `AccountsEmptyState`.
 *
 * 3. **The subtitle promised something the code does not do.** It used to say
 *    per-account hashtags and mentions "get injected into every post". They
 *    are injected into no post: `account_entities` is written and read by its
 *    own editor and by nothing else — no publisher, no scheduler, no cron has
 *    ever read that table. The sentence is gone rather than reworded around,
 *    because a promise the code does not honour is the one thing that must not
 *    ship. The editor stays, under a name that claims nothing.
 *
 * The connect chooser is imported, not built here: one list of what can be
 * connected, in one place, or the day X is dropped from one of them is the day
 * the two disagree.
 */

const REMOVE_WARNING = (name: string) =>
  `Disconnect ${name} from this business?\n\n` +
  'Nothing on the platform itself is touched and no published post disappears. ' +
  'It simply stops being somewhere this business can post to, and anything ' +
  'scheduled to it will not go out.'

/**
 * Reconnect first, then about-to-lapse, then unmeasured, then the working
 * ones. Insertion order is preserved inside each group, so the grid does not
 * reshuffle itself between refreshes for no reason the owner can see.
 */
const HEALTH_ORDER: Record<SocialAccount['health'], number> = {
  reconnect: 0,
  attention: 1,
  unknown: 2,
  connected: 3,
}

interface AccountsPageProps {
  /**
   * false when a department shell has already supplied the padded pane. The
   * Social chrome pads 26px and scrolls; padding again here puts the grid 52px
   * off the edge with two scrollbars.
   */
  padded?: boolean
}

export function AccountsPage({ padded = true }: AccountsPageProps = {}) {
  const { activeBrandId } = useAgencyStore()
  const { accounts, summary, loading, error, refetch } = useSocialAccounts(activeBrandId)
  const [managingAccount, setManagingAccount] = useState<SocialAccount | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [reconnecting, setReconnecting] = useState<{ platform: string; name: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [controls, setControls] = useState<{
    canControl: boolean
    transport?: 'zernio' | 'mixpost'
    linked?: boolean
  } | null>(null)

  useEffect(() => {
    if (!activeBrandId) return
    void fetch(`/api/brands/${activeBrandId}/publisher-controls`)
      .then((r) => (r.ok ? r.json() : { canControl: false }))
      .then(setControls)
      .catch(() => setControls({ canControl: false }))
  }, [activeBrandId])

  /**
   * The platform hands the owner back to THIS url after a sign-in, and the
   * chooser is the only thing that knows how to finish the handover — pick a
   * Page, swap the token, say what happened. If nothing mounts it on the way
   * back, the owner lands on a grid that quietly did not gain the account and
   * has no idea whether it worked.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('platform') || params.get('connected') || params.get('error')) {
      setConnectOpen(true)
    }
  }, [])

  const ordered = useMemo(
    () => [...accounts].sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]),
    [accounts],
  )

  /**
   * What the connect chooser needs to know about what is already here, so a
   * tile can say "connected" rather than offering a second copy of an account
   * this business already has.
   *
   * It takes its own narrow summary rather than our full row, so it cannot come
   * to depend on fields this page happens to carry today. Both sides read the
   * SAME four health words, so this is a projection and never a translation — a
   * mapping table here would be a place for the two vocabularies to drift.
   */
  const connectedSummaries: ConnectedAccountSummary[] = useMemo(
    () => accounts.map((a) => ({ platform: a.platform, health: a.health, name: a.name })),
    [accounts],
  )

  /** The accounts the banner is actually about, named rather than counted. */
  const failing = useMemo(
    () => ordered.filter((a) => a.health === 'reconnect' || a.health === 'attention'),
    [ordered],
  )

  const handleRename = useCallback(async (account: SocialAccount) => {
    if (!activeBrandId) return
    const next = window.prompt('What should this account be called on your desk?', account.name)
    if (next === null) return
    const displayName = next.trim()
    if (!displayName || displayName === account.name) return

    setBusy(account.id)
    setNotice(null)
    try {
      const res = await fetch('/api/zernio/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: activeBrandId, accountId: account.id, displayName }),
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setNotice(body?.error ?? 'That account could not be renamed just now. Nothing has been changed.')
        return
      }
      await refetch()
    } finally {
      setBusy(null)
    }
  }, [activeBrandId, refetch])

  const handleRemove = useCallback(async (account: SocialAccount) => {
    if (!activeBrandId) return
    if (!window.confirm(REMOVE_WARNING(account.name))) return

    setBusy(account.id)
    setNotice(null)
    try {
      const res = await fetch(
        `/api/zernio/accounts?brandId=${activeBrandId}&accountId=${encodeURIComponent(account.id)}`,
        { method: 'DELETE' },
      )
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setNotice(body?.error ?? 'That account could not be disconnected just now. Nothing has been changed.')
        return
      }
      await refetch()
    } finally {
      setBusy(null)
    }
  }, [activeBrandId, refetch])

  const handleReconnect = useCallback((account: SocialAccount) => {
    setReconnecting({ platform: account.platform, name: account.name })
    setConnectOpen(true)
  }, [])

  const openConnect = useCallback(() => {
    setReconnecting(null)
    setConnectOpen(true)
  }, [])

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-[13px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
          Choose a business first to see the accounts it can post to.
        </p>
      </div>
    )
  }

  const nothingConnected = !loading && !error && accounts.length === 0

  return (
    <div
      className={padded ? 'space-y-5 px-[26px] py-[18px]' : 'space-y-5'}
      style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Social accounts</h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
            This business only. Where it can post, and whether each one still works.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refetch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-[7px] text-[12.5px] font-semibold transition-colors disabled:opacity-50"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-2, oklch(0.46 0.012 240))',
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Check again
          </button>
          {accounts.length > 0 ? (
            <button
              type="button"
              onClick={openConnect}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-[12.5px] font-semibold"
              style={{
                background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                color: 'var(--brand-ink, oklch(1 0 0))',
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Connect an account
            </button>
          ) : null}
        </div>
      </div>

      {/* The whole point of this screen, in one strip: what will stop posting,
          and which accounts it is. Rendered only when there is something to act
          on — a permanent "all fine" banner is a banner nobody reads on the day
          it changes. */}
      {failing.length > 0 ? (
        <div
          className="rounded-xl border px-4 py-3"
          style={{
            borderColor:
              summary.needsReconnect > 0
                ? 'oklch(0.55 0.17 27 / 0.35)'
                : 'oklch(0.63 0.13 75 / 0.45)',
            background:
              summary.needsReconnect > 0
                ? 'oklch(0.55 0.17 27 / 0.07)'
                : 'var(--warn-wash, oklch(0.964 0.052 80))',
          }}
        >
          <p className="text-[13px] font-semibold">
            {summary.needsReconnect > 0
              ? `${summary.needsReconnect} account${summary.needsReconnect === 1 ? '' : 's'} ${summary.needsReconnect === 1 ? 'has' : 'have'} stopped posting`
              : `${summary.needsAttention} account${summary.needsAttention === 1 ? '' : 's'} will stop posting soon`}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}>
            {failing
              .slice(0, 4)
              .map((a) => `${presentationFor(a.platform).label} · ${a.name}`)
              .join(', ')}
            {failing.length > 4 ? ` and ${failing.length - 4} more` : ''}. Reconnect{' '}
            {failing.length === 1 ? 'it' : 'them'} below and anything already scheduled keeps its place.
          </p>
        </div>
      ) : null}

      {summary.unmeasured > 0 && !loading ? (
        <p className="text-[12px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          {summary.unmeasured} account{summary.unmeasured === 1 ? '' : 's'} could not be checked just
          now, so nothing is being claimed about {summary.unmeasured === 1 ? 'it' : 'them'}.
        </p>
      ) : null}

      {(error || notice) && (
        <div
          className="rounded-lg border px-4 py-3 text-[12.5px]"
          style={{
            borderColor: 'oklch(0.55 0.17 27 / 0.3)',
            background: 'oklch(0.55 0.17 27 / 0.07)',
          }}
        >
          {notice ?? error}
        </div>
      )}

      {loading && accounts.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--ink-3)' }} />
        </div>
      ) : nothingConnected ? (
        <AccountsEmptyState onConnect={openConnect} />
      ) : (
        // Mixpost's own breakpoints: 1 / 2 / 4 / 5.
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {/* The add tile LEADS the grid, exactly as it does in Mixpost. */}
          <button
            type="button"
            onClick={openConnect}
            className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors hover:border-[var(--brand,oklch(0.545_0.115_240))]"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel-2, oklch(0.975 0.004 240))',
              color: 'var(--ink-2, oklch(0.46 0.012 240))',
            }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                color: 'var(--brand-ink, oklch(1 0 0))',
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
              Connect an account
            </span>
            <span className="text-[11.5px]">
              Instagram, Facebook, TikTok and {CONNECTABLE_PLATFORMS.length - 3} more
            </span>
          </button>

          {ordered.map((account) => (
            <div key={account.id} className={busy === account.id ? 'pointer-events-none opacity-60' : ''}>
              <AccountCard
                account={account}
                onManage={setManagingAccount}
                onRename={handleRename}
                onReconnect={handleReconnect}
                onRemove={handleRemove}
              />
            </div>
          ))}
        </div>
      )}

      {/* Below the grid on purpose: it is a setting about how this business
          posts, not one of the accounts, and it is only ever shown to someone
          who may change it. */}
      {controls?.canControl && (
        <div
          className="space-y-2 rounded-xl border px-4 py-3"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel-2, oklch(0.975 0.004 240))',
          }}
        >
          <p className="text-[12.5px] font-semibold">How this business posts</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void fetch(`/api/brands/${activeBrandId}/publisher-controls`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ publisher_transport: 'zernio' }),
                }).then(() => setControls((c) => (c ? { ...c, transport: 'zernio' } : c)))
              }}
              className="rounded-lg px-3 py-[7px] text-[12px] font-semibold"
              style={
                controls.transport !== 'mixpost'
                  ? {
                      background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                      color: 'var(--brand-ink, oklch(1 0 0))',
                    }
                  : {
                      border: '1px solid var(--line, oklch(0.915 0.007 240))',
                      background: 'var(--panel, oklch(1 0 0))',
                      color: 'var(--ink, oklch(0.20 0.014 240))',
                    }
              }
            >
              Post through the usual accounts
            </button>
            <button
              type="button"
              onClick={() => {
                void fetch(`/api/brands/${activeBrandId}/publisher-controls`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ publisher_transport: 'mixpost' }),
                }).then(() => setControls((c) => (c ? { ...c, transport: 'mixpost' } : c)))
              }}
              className="rounded-lg px-3 py-[7px] text-[12px] font-semibold"
              style={
                controls.transport === 'mixpost'
                  ? {
                      background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                      color: 'var(--brand-ink, oklch(1 0 0))',
                    }
                  : {
                      border: '1px solid var(--line, oklch(0.915 0.007 240))',
                      background: 'var(--panel, oklch(1 0 0))',
                      color: 'var(--ink, oklch(0.20 0.014 240))',
                    }
              }
            >
              Post through the backup
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Resume posting? Confirm billing is live first.')) return
                void fetch(`/api/brands/${activeBrandId}/publisher-controls`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ resume: true }),
                })
              }}
              className="rounded-lg border px-3 py-[7px] text-[12px] font-semibold"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
                color: 'var(--ink, oklch(0.20 0.014 240))',
              }}
            >
              Resume posting
            </button>
          </div>
        </div>
      )}

      {managingAccount && (
        <AccountEntitiesEditor
          brandId={activeBrandId}
          account={managingAccount}
          onClose={() => setManagingAccount(null)}
        />
      )}

      {connectOpen && (
        <ConnectAccountDialog
          brandId={activeBrandId}
          accounts={connectedSummaries}
          reconnect={reconnecting}
          onClose={() => { setConnectOpen(false); setReconnecting(null) }}
          onConnected={() => { void refetch() }}
        />
      )}
    </div>
  )
}
