'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui/focus'
import { TONE_BUTTON, TONE_CHIP } from '@/lib/ui/status-tone'
import { useAgencyStore } from '@/stores/agency-store'
import { normaliseCampaign, summarise, type Campaign } from './campaign'
import { formatMoney } from './format'
import { CampaignLedger, CampaignLedgerSkeleton } from './CampaignLedger'
import { AdStrategyPrompt } from './AdStrategyPrompt'

/**
 * Paid advertising, on its own page.
 *
 * `/api/zernio/ads` distinguishes three answers and so does this page: the
 * brand is linked to no ad profile; Zernio could not be read at all; or Zernio
 * answered and this is what it said. The third is the only one allowed to
 * produce a factual sentence about how many campaigns are running.
 *
 * That separation is the whole design. Until it existed, a rotated API key, a
 * 5xx and a timeout all arrived as an empty array and the page told the owner
 * his brand had no campaigns running — calmly, in a heading, while the money
 * kept going out.
 */

type LoadState =
  | { kind: 'loading' }
  /** Our own server could not be reached, or refused the request. */
  | { kind: 'error' }
  /** The brand is linked, but Zernio did not answer. NOT an empty ledger. */
  | { kind: 'unavailable'; problem: string }
  /** No zernio_profile_id on this brand, so there is nothing to read. */
  | { kind: 'unlinked' }
  | { kind: 'ready'; campaigns: Campaign[] }

const COULD_NOT_READ =
  'Campaign figures could not be read just now, so nothing on this page is current. No campaign was changed.'

interface BrandSummary {
  id: string
  name: string
}

export function AdsCommandCentre() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)

  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [brandName, setBrandName] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!activeBrandId) return
    try {
      const res = await fetch(`/api/zernio/ads?brandId=${encodeURIComponent(activeBrandId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('unavailable')
      const json = await res.json()

      if (json?.configured !== true) {
        setState({ kind: 'unlinked' })
        return
      }
      // Linked, but the read failed. The route says so explicitly rather than
      // handing back an empty list and letting this page guess.
      if (json?.reachable !== true) {
        setState({
          kind: 'unavailable',
          problem: typeof json?.problem === 'string' && json.problem.trim() !== ''
            ? json.problem
            : COULD_NOT_READ,
        })
        return
      }
      const raw: unknown[] = Array.isArray(json.campaigns) ? json.campaigns : []
      setState({ kind: 'ready', campaigns: raw.map(normaliseCampaign) })
    } catch {
      setState({ kind: 'error' })
    }
  }, [activeBrandId])

  useEffect(() => {
    setState({ kind: 'loading' })
    void load()
  }, [load])

  // The brand's own name, so the Director gets a question about a brand rather
  // than about an id.
  useEffect(() => {
    let cancelled = false
    fetch('/api/brands')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BrandSummary[] | null) => {
        if (cancelled || !Array.isArray(data)) return
        setBrandName(data.find((b) => b.id === activeBrandId)?.name ?? null)
      })
      .catch(() => {
        /* The name is a nicety; its absence must not take the page down. */
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (!activeBrandId) {
    return (
      <Shell>
        <Heading
          title="Paid advertising"
          detail="Ad spend is kept per brand, so this page needs to know which brand you mean."
        />
        <Panel
          title="Choose a brand first"
          body="Pick a brand in the sidebar. This page then shows every campaign running against that brand's ad accounts, what each one has spent, and what it returned."
        />
      </Shell>
    )
  }

  const name = brandName ?? 'this brand'

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <Heading title="Paid advertising" detail={situation(state, name)} />
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || state.kind === 'loading'}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground',
            'transition-colors duration-200',
            'hover:bg-accent hover:text-foreground active:bg-accent/70',
            FOCUS_RING,
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="space-y-6">
        {state.kind === 'loading' && <CampaignLedgerSkeleton />}

        {state.kind === 'error' && <Problem body={COULD_NOT_READ} onRetry={() => void refresh()} />}

        {state.kind === 'unavailable' && (
          <Problem body={state.problem} onRetry={() => void refresh()} />
        )}

        {state.kind === 'unlinked' && (
          <Panel
            title="No ad profile is linked to this brand"
            body="Campaigns are read from Zernio against an ad profile recorded on the brand, and this brand has none — so there is nothing to read yet, even if its social accounts are already connected. Connecting an account from the accounts page is what records the link."
            action={{ label: 'Open connected accounts', href: '/agency/studio/accounts' }}
          />
        )}

        {state.kind === 'ready' && state.campaigns.length === 0 && (
          <Panel
            title="This brand has no campaigns running"
            body="Zernio answered for this brand and reported none — so this is an empty ledger, not a failed reading. Campaigns are built in Meta, TikTok or Google Ads Manager rather than here; once one is live, its spend and results appear in this ledger and you can pause it from this page."
          />
        )}

        {state.kind === 'ready' && state.campaigns.length > 0 && (
          <CampaignLedger
            campaigns={state.campaigns}
            brandId={activeBrandId}
            onStatusChanged={load}
          />
        )}

        {/* Only offered where the figures behind it are known. In every failed
            state the suggestions would quote a ledger nobody could read. */}
        {(state.kind === 'ready' || state.kind === 'unlinked') && (
          <AdStrategyPrompt
            brandId={activeBrandId}
            brandName={name}
            campaigns={state.kind === 'ready' ? state.campaigns : []}
            linked={state.kind === 'ready'}
          />
        )}
      </div>
    </Shell>
  )
}

/** One plain sentence about what is actually true right now. */
function situation(state: LoadState, name: string): string {
  switch (state.kind) {
    case 'loading':
      return `Reading campaign figures for ${name}.`
    case 'error':
      return 'The figures below could not be read.'
    case 'unavailable':
      // Never "has no campaigns running". Nothing verified that.
      return `Campaign figures for ${name} could not be read, so what is running is unknown.`
    case 'unlinked':
      return `${name} is not linked to an ad profile, so no spend can be read for it.`
    case 'ready': {
      if (state.campaigns.length === 0) return `${name} has no campaigns running.`
      const totals = summarise(state.campaigns)
      const spend =
        totals.spend === null
          ? null
          : formatMoney(totals.spend, totals.currency)
      const runs = `${totals.runningCount} of ${totals.campaignCount} ${totals.campaignCount === 1 ? 'campaign is' : 'campaigns are'} running`
      return spend ? `${runs}, ${spend} spent so far.` : `${runs}.`
    }
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-6 py-6">{children}</div>
}

function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

/**
 * The one panel for "this could not be read".
 *
 * Both failures land here — our own server and Zernio's — because from where
 * the owner sits they are the same fact and need the same next action. What
 * they must never share is a heading with the success case.
 */
function Problem({ body, onRetry }: { body: string; onRetry: () => void }) {
  return (
    <div className={cn('rounded-lg border p-5', TONE_CHIP.critical)} role="status">
      <p className="text-sm">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium',
          'transition-colors duration-200',
          TONE_BUTTON.critical,
          FOCUS_RING,
        )}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  )
}

/** Empty states that say what is missing and what makes it appear. */
function Panel({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-8 py-10">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
        {action && (
          <Link
            href={action.href}
            className={cn(
              'mt-4 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5',
              'text-xs font-medium text-background',
              'transition-colors duration-200 hover:bg-foreground/90 active:bg-foreground/80',
              FOCUS_RING,
            )}
          >
            {action.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  )
}
