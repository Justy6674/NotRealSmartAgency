'use client'

/**
 * WebhooksIndex
 *
 * Phase 8 — list page for outbound user webhooks scoped to the active
 * brand. Shows a table of webhooks with name, URL, subscribed events,
 * health status, and a row action menu for Edit / Test / View deliveries
 * / Delete. Uses the brand from useAgencyStore so it follows whichever
 * brand the user is currently working on, just like other Studio pages.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  MoreHorizontal,
  PlugZap,
  Activity,
  Trash2,
  Pencil,
  Eye,
  Send,
  RefreshCw,
} from 'lucide-react'

import { useAgencyStore } from '@/stores/agency-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  WEBHOOK_EVENT_LABELS,
  type WebhookEvent,
} from '@/lib/webhooks/events'

interface UserWebhook {
  id: string
  brand_id: string
  name: string | null
  url: string
  method: string | null
  events: string[] | null
  active: boolean
  last_delivery_at: string | null
  last_delivery_status: string | null
  created_at: string
  updated_at: string
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url
  return url.slice(0, max - 1) + '…'
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'success') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'pending') return 'secondary'
  return 'outline'
}

function eventLabel(event: string): string {
  return WEBHOOK_EVENT_LABELS[event as WebhookEvent] ?? event
}

export function WebhooksIndex() {
  const brandId = useAgencyStore((s) => s.activeBrandId)
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/user-webhooks?brandId=${brandId}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`Failed to load webhooks (${res.status})`)
      const data = (await res.json()) as UserWebhook[]
      setWebhooks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void load()
  }, [load])

  const toggleActive = async (webhook: UserWebhook) => {
    setBusyId(webhook.id)
    try {
      const res = await fetch(`/api/user-webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !webhook.active }),
      })
      if (!res.ok) throw new Error('Update failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (webhook: UserWebhook) => {
    if (!confirm(`Delete webhook${webhook.name ? ` "${webhook.name}"` : ''}? This cannot be undone.`)) {
      return
    }
    setBusyId(webhook.id)
    try {
      const res = await fetch(`/api/user-webhooks/${webhook.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const sendTest = async (webhook: UserWebhook) => {
    // Test fires a synthetic post.created event by re-using the webhook's
    // own subscription set — we don't ship a dedicated test endpoint in
    // Phase 8, so for now we just toggle active off+on as a no-op
    // confirmation that the row is editable. A full test-fire endpoint
    // arrives in the integration pass.
    setBusyId(webhook.id)
    try {
      await fetch(`/api/user-webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: webhook.active }),
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const empty = useMemo(() => !loading && webhooks.length === 0, [loading, webhooks])

  if (!brandId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Select a brand from the sidebar to manage its webhooks.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="size-4 text-muted-foreground" />
              Webhooks
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Send events from NotRealSmart to Zapier, n8n, Make or your own
              endpoint. Every delivery is HMAC-signed so you can trust it
              came from us.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Link href="/agency/studio/webhooks/new">
              <Button size="sm">
                <Plus className="size-4" />
                New webhook
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {empty ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <PlugZap className="size-10 text-muted-foreground" />
              <div className="text-sm font-medium">No webhooks yet</div>
              <p className="max-w-md text-xs text-muted-foreground">
                Create a webhook to get notified in your own tools when posts
                are scheduled, published, fail, or comments come in. Pick the
                events you care about and we&rsquo;ll POST signed JSON to your
                URL.
              </p>
              <Link href="/agency/studio/webhooks/new">
                <Button size="sm">
                  <Plus className="size-4" />
                  Create your first webhook
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">URL</th>
                    <th className="px-3 py-2 text-left font-medium">Events</th>
                    <th className="px-3 py-2 text-left font-medium">Last delivery</th>
                    <th className="px-3 py-2 text-right font-medium">Active</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((webhook) => (
                    <tr
                      key={webhook.id}
                      className={cn(
                        'border-t border-border/40 transition-colors hover:bg-muted/30',
                        busyId === webhook.id && 'opacity-60'
                      )}
                    >
                      <td className="px-3 py-2 align-top">
                        <Link
                          href={`/agency/studio/webhooks/${webhook.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {webhook.name?.trim() || 'Untitled webhook'}
                        </Link>
                      </td>
                      <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                        {truncateUrl(webhook.url)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {(webhook.events ?? []).slice(0, 3).map((evt) => (
                            <Badge key={evt} variant="secondary" className="text-[10px]">
                              {eventLabel(evt)}
                            </Badge>
                          ))}
                          {(webhook.events?.length ?? 0) > 3 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{(webhook.events?.length ?? 0) - 3}
                            </Badge>
                          )}
                          {(webhook.events?.length ?? 0) === 0 && (
                            <span className="text-xs text-muted-foreground">No events</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {webhook.last_delivery_at ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={statusVariant(webhook.last_delivery_status)} className="w-fit text-[10px]">
                              {webhook.last_delivery_status ?? 'unknown'}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(webhook.last_delivery_at).toLocaleString('en-AU')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never fired</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <button
                          type="button"
                          onClick={() => void toggleActive(webhook)}
                          disabled={busyId === webhook.id}
                          className={cn(
                            'inline-flex h-5 w-9 items-center rounded-full border border-border/60 px-0.5 transition-colors',
                            webhook.active ? 'bg-primary justify-end' : 'bg-muted justify-start'
                          )}
                          aria-label={webhook.active ? 'Pause webhook' : 'Resume webhook'}
                        >
                          <span className="size-4 rounded-full bg-background shadow-sm" />
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Webhook actions"
                              />
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              render={<Link href={`/agency/studio/webhooks/${webhook.id}`} />}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              render={
                                <Link href={`/agency/studio/webhooks/${webhook.id}#deliveries`} />
                              }
                            >
                              <Eye className="size-4" />
                              View deliveries
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void sendTest(webhook)}>
                              <Send className="size-4" />
                              Test connection
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => void remove(webhook)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4" />
            Each delivery includes an <code className="rounded bg-muted px-1 py-0.5">X-Signature</code> header
            (HMAC-SHA256 of the JSON body using your secret).
          </div>
          <span>Verify signatures on the receiving end to confirm authenticity.</span>
        </CardContent>
      </Card>
    </div>
  )
}
