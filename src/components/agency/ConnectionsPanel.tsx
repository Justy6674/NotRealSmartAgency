'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'

/**
 * Where the owner connects the services the agency uses.
 *
 * The Canva sign-in route has existed the whole time and nothing linked to it,
 * so there was no way to reach it from the interface — the only mention was in
 * an error message telling him to visit a URL by hand. A connection that can
 * only be made by typing an API path is not a connection anyone will make.
 *
 * Each row says plainly whether the thing works, and the button does the one
 * action that fixes it.
 *
 * ── THE LEAK THIS CLOSES ───────────────────────────────────────────────
 * The publishing row fetched `/api/mixpost/accounts` with no brand id at all.
 * That route answers the unscoped call with the ENTIRE fallback workspace, so
 * this panel counted every account belonging to every business and reported the
 * total back as "Connected — 14 social accounts" no matter which business was
 * open. For a business linked to its own publisher it was worse than a wrong
 * number: the row described a completely different publisher's accounts, and
 * said they were his.
 *
 * It now asks about the business that is actually selected, linked publisher
 * first, and says so when nothing is selected rather than quietly counting
 * everything.
 */

interface RowState {
  connected: boolean
  detail: string
}

interface ConnectionState {
  canva: RowState | null
  publishing: RowState | null
  loading: boolean
}

const COULD_NOT_CHECK = 'Could not be checked just now'

export function ConnectionsPanel() {
  const { activeBrandId } = useAgencyStore()
  const [state, setState] = useState<ConnectionState>({ canva: null, publishing: null, loading: true })

  const check = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))

    const canvaCheck = fetch('/api/canva/brand-kits', { cache: 'no-store' })
      .then(async (r) => {
        // Read the BODY, not just whether the request succeeded. The route
        // answers 200 with a state, so `r.ok` only ever meant "the server
        // replied" — and a Canva connection that was rejecting every call
        // rendered as "Connected — 0 brand kits" for weeks.
        const data = await r.json().catch(() => ({}))
        if (!r.ok || data.connected !== true) {
          return {
            connected: false,
            detail:
              typeof data.message === 'string'
                ? data.message
                : 'Not connected — designs and brand templates are unavailable',
          }
        }
        const count = Array.isArray(data.brand_kits) ? data.brand_kits.length : null
        return {
          connected: true,
          detail:
            count === null ? 'Connected' : `Connected — ${count} brand template${count === 1 ? '' : 's'}`,
        }
      })
      .catch(() => ({ connected: false, detail: COULD_NOT_CHECK }))

    const publishingCheck: Promise<RowState> = (async () => {
      if (!activeBrandId) {
        return {
          connected: false,
          detail: 'Choose a business first — accounts are connected to one business at a time',
        }
      }
      try {
        const linkedRes = await fetch(`/api/zernio/accounts?brandId=${activeBrandId}`, { cache: 'no-store' })
        const linked = (await linkedRes.json().catch(() => null)) as {
          linked?: boolean
          accounts?: unknown[]
          summary?: { total?: number; needsReconnect?: number; warning?: number }
          error?: string
        } | null

        if (linkedRes.ok && linked?.linked) {
          const total = linked.summary?.total ?? (linked.accounts?.length ?? 0)
          const stopped = linked.summary?.needsReconnect ?? 0
          const wobbly = linked.summary?.warning ?? 0
          if (total === 0) {
            return { connected: false, detail: 'No accounts connected to this business yet' }
          }
          if (stopped > 0) {
            return {
              connected: false,
              detail: `${stopped} of ${total} account${total === 1 ? '' : 's'} ${stopped === 1 ? 'has' : 'have'} stopped posting — reconnect ${stopped === 1 ? 'it' : 'them'} on the Accounts screen`,
            }
          }
          return {
            connected: true,
            detail:
              wobbly > 0
                ? `Connected — ${total} account${total === 1 ? '' : 's'}, ${wobbly} needing attention soon`
                : `Connected — ${total} account${total === 1 ? '' : 's'}`,
          }
        }

        if (!linkedRes.ok) return { connected: false, detail: linked?.error ?? COULD_NOT_CHECK }

        // Not linked to its own publisher: ask the backup, WITH the brand id so
        // the answer is about this business and nothing else.
        const res = await fetch(`/api/mixpost/accounts?brandId=${activeBrandId}`, { cache: 'no-store' })
        if (!res.ok) return { connected: false, detail: 'Not reachable — nothing can publish' }
        const data = await res.json().catch(() => ({}))
        const n = Array.isArray(data.accounts) ? data.accounts.length : null
        if (n === 0) return { connected: false, detail: 'No accounts connected to this business yet' }
        return {
          connected: true,
          detail: n === null ? 'Connected' : `Connected — ${n} account${n === 1 ? '' : 's'}`,
        }
      } catch {
        return { connected: false, detail: COULD_NOT_CHECK }
      }
    })()

    const [canva, publishing] = await Promise.all([canvaCheck, publishingCheck])
    setState({ canva, publishing, loading: false })
  }, [activeBrandId])

  useEffect(() => {
    void check()
  }, [check])

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Connections</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The services your agency uses. If one is not connected, the work that needs it quietly does not happen.
          </p>
        </div>
        <button
          onClick={() => void check()}
          className="shrink-0 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
        >
          <RefreshCw className="mr-1 inline h-3 w-3" /> Check
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <Row
          name="Canva"
          purpose="Designs, brand templates and folders"
          loading={state.loading}
          connected={state.canva?.connected ?? null}
          detail={state.canva?.detail ?? ''}
          action={{ label: state.canva?.connected ? 'Reconnect' : 'Connect Canva', href: '/api/canva/auth' }}
        />
        <Row
          name="Social publishing"
          purpose="Where approved posts actually go out"
          loading={state.loading}
          connected={state.publishing?.connected ?? null}
          detail={state.publishing?.detail ?? ''}
          action={
            activeBrandId
              ? { label: 'Open accounts', href: '/agency/social/accounts' }
              : undefined
          }
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Reconnecting Canva also refreshes what it is allowed to do. If brand templates are not working, reconnect —
        permissions are granted when you sign in and cannot be added afterwards.
      </p>
    </section>
  )
}

function Row({
  name,
  purpose,
  loading,
  connected,
  detail,
  action,
}: {
  name: string
  purpose: string
  loading: boolean
  connected: boolean | null
  detail: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background p-3">
      <span className="shrink-0">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : connected ? (
          <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--ok, oklch(0.55 0.13 155))' }} />
        ) : (
          <AlertCircle className="h-4 w-4" style={{ color: 'var(--warn, oklch(0.63 0.13 75))' }} />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{name}</span>
        <span className="block text-xs text-muted-foreground">
          {loading ? purpose : detail || purpose}
        </span>
      </span>

      {action && (
        <a
          href={action.href}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium',
            connected
              ? 'border border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)]'
              : 'bg-[var(--brand-deep)] text-[var(--brand-ink)]',
          )}
        >
          {action.label}
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>
      )}
    </div>
  )
}
