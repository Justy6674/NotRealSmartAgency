'use client'

/**
 * WebhookDeliveriesLog
 *
 * Phase 8 — paginated history of every delivery attempt for a single
 * webhook. Each row shows the event, status badge, HTTP code, timestamp,
 * and an expandable JSON view of the full payload + response. The JSON
 * is rendered in a `<pre>` block so non-developers at least see structure;
 * developers can copy/paste it straight into their debugger.
 */

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  AlertCircle,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { WEBHOOK_EVENT_LABELS, type WebhookEvent } from '@/lib/webhooks/events'

interface Delivery {
  id: string
  webhook_id: string
  event: string
  status: 'success' | 'failed' | 'pending'
  http_status: number | null
  payload: unknown
  response: unknown
  error: string | null
  attempt: number
  created_at: string
}

interface DeliveriesPayload {
  deliveries: Delivery[]
  total: number
  limit: number
  offset: number
}

interface WebhookDeliveriesLogProps {
  webhookId: string
}

const PAGE_SIZE = 25

function statusVariant(status: Delivery['status']): 'default' | 'secondary' | 'destructive' {
  if (status === 'success') return 'default'
  if (status === 'failed') return 'destructive'
  return 'secondary'
}

function formatJson(value: unknown): string {
  if (value == null) return 'null'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function eventLabel(event: string): string {
  return WEBHOOK_EVENT_LABELS[event as WebhookEvent] ?? event
}

export function WebhookDeliveriesLog({ webhookId }: WebhookDeliveriesLogProps) {
  const [data, setData] = useState<DeliveriesPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const offset = page * PAGE_SIZE
      const res = await fetch(
        `/api/user-webhooks/${webhookId}/deliveries?limit=${PAGE_SIZE}&offset=${offset}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`Failed to load deliveries (${res.status})`)
      const json = (await res.json()) as DeliveriesPayload
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }, [webhookId, page])

  useEffect(() => {
    void load()
  }, [load])

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <Card id="deliveries">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            Delivery log
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Every attempted delivery for this webhook. Click a row to inspect
            the full payload and your endpoint&rsquo;s response.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        {!data && loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading deliveries…</div>
        )}

        {data && data.deliveries.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Activity className="size-8 text-muted-foreground" />
            <div className="text-sm font-medium">No deliveries yet</div>
            <p className="max-w-sm text-xs text-muted-foreground">
              When NRS fires an event you&rsquo;ve subscribed to, you&rsquo;ll
              see it here with the full request and response payloads.
            </p>
          </div>
        )}

        {data && data.deliveries.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2 text-left font-medium">Event</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">HTTP</th>
                  <th className="px-3 py-2 text-left font-medium">When</th>
                  <th className="px-3 py-2 text-left font-medium">Attempt</th>
                </tr>
              </thead>
              <tbody>
                {data.deliveries.map((delivery) => {
                  const isOpen = expanded.has(delivery.id)
                  return (
                    <Fragment key={delivery.id}>
                      <tr
                        className="cursor-pointer border-t border-border/40 transition-colors hover:bg-muted/30"
                        onClick={() => toggleExpanded(delivery.id)}
                      >
                        <td className="px-2 py-2 align-top">
                          {isOpen ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{eventLabel(delivery.event)}</span>
                            <code className="text-[10px] text-muted-foreground">{delivery.event}</code>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant={statusVariant(delivery.status)} className="text-[10px]">
                            {delivery.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          {delivery.http_status ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                          {new Date(delivery.created_at).toLocaleString('en-AU')}
                        </td>
                        <td className="px-3 py-2 align-top text-xs">{delivery.attempt}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-border/40 bg-muted/10">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <div className="flex flex-col gap-1.5">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Payload
                                </div>
                                <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-background p-2 font-mono text-[11px] leading-snug">
                                  {formatJson(delivery.payload)}
                                </pre>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Response
                                </div>
                                <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-background p-2 font-mono text-[11px] leading-snug">
                                  {formatJson(delivery.response)}
                                </pre>
                              </div>
                            </div>
                            {delivery.error && (
                              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                <strong>Error:</strong> {delivery.error}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {data.offset + 1}–{Math.min(data.offset + data.limit, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="xs"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
