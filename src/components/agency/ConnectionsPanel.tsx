'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

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
 */

interface ConnectionState {
  canva: { connected: boolean; detail: string } | null
  mixpost: { connected: boolean; detail: string } | null
  loading: boolean
}

export function ConnectionsPanel() {
  const [state, setState] = useState<ConnectionState>({ canva: null, mixpost: null, loading: true })

  const check = async () => {
    setState((s) => ({ ...s, loading: true }))

    const [canva, mixpost] = await Promise.all([
      fetch('/api/canva/brand-kits', { cache: 'no-store' })
        .then(async (r) => {
          if (r.ok) {
            const data = await r.json().catch(() => ({}))
            const count = Array.isArray(data.brand_kits) ? data.brand_kits.length : null
            return { connected: true, detail: count === null ? 'Connected' : `Connected — ${count} brand kit${count === 1 ? '' : 's'}` }
          }
          return { connected: false, detail: 'Not connected — designs and brand templates are unavailable' }
        })
        .catch(() => ({ connected: false, detail: 'Could not be checked just now' })),

      fetch('/api/mixpost/accounts', { cache: 'no-store' })
        .then(async (r) => {
          if (!r.ok) return { connected: false, detail: 'Not reachable — nothing can publish' }
          const data = await r.json().catch(() => ({}))
          const n = Array.isArray(data.accounts) ? data.accounts.length : null
          return { connected: true, detail: n === null ? 'Connected' : `Connected — ${n} social account${n === 1 ? '' : 's'}` }
        })
        .catch(() => ({ connected: false, detail: 'Could not be checked just now' })),
    ])

    setState({ canva, mixpost, loading: false })
  }

  useEffect(() => {
    void check()
     
  }, [])

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
          purpose="Designs, brand kits and brand templates"
          loading={state.loading}
          connected={state.canva?.connected ?? null}
          detail={state.canva?.detail ?? ''}
          action={{ label: state.canva?.connected ? 'Reconnect' : 'Connect Canva', href: '/api/canva/auth' }}
        />
        <Row
          name="Social publishing"
          purpose="Where approved posts actually go out"
          loading={state.loading}
          connected={state.mixpost?.connected ?? null}
          detail={state.mixpost?.detail ?? ''}
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
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
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
              ? 'border text-muted-foreground hover:bg-accent'
              : 'bg-foreground text-background',
          )}
        >
          {action.label}
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>
      )}
    </div>
  )
}
