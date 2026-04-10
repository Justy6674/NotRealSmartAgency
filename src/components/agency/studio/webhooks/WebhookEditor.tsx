'use client'

/**
 * WebhookEditor
 *
 * Phase 8 — create / edit form for a single user webhook. Used by both
 * the "new webhook" and "edit webhook" routes. When `webhookId` is
 * undefined the form is in create mode and POSTs on save; otherwise it
 * GETs the row, prefills, and PATCHes.
 *
 * Spec requirements:
 *  - name, URL, method (POST/PUT), secret with auto-generate, events
 *    multi-select checkboxes, active toggle
 *  - Save button calls POST/PATCH
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCcw,
  Save,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAgencyStore } from '@/stores/agency-store'
import {
  WEBHOOK_EVENT_GROUPS,
  WEBHOOK_EVENT_LABELS,
  type WebhookEvent,
} from '@/lib/webhooks/events'
import { cn } from '@/lib/utils'

interface WebhookEditorProps {
  webhookId?: string
}

interface WebhookForm {
  name: string
  url: string
  method: 'POST' | 'PUT'
  secret: string
  events: WebhookEvent[]
  active: boolean
}

const EMPTY_FORM: WebhookForm = {
  name: '',
  url: '',
  method: 'POST',
  secret: '',
  events: [],
  active: true,
}

function generateSecret(): string {
  // Browser-side secret generation — uses crypto.randomUUID() twice
  // and strips dashes for a 64-char hex-ish opaque token. Server can
  // also auto-generate one if left blank.
  const a = crypto.randomUUID().replace(/-/g, '')
  const b = crypto.randomUUID().replace(/-/g, '')
  return `${a}${b}`.slice(0, 64)
}

export function WebhookEditor({ webhookId }: WebhookEditorProps) {
  const router = useRouter()
  const brandId = useAgencyStore((s) => s.activeBrandId)
  const isEdit = !!webhookId

  const [form, setForm] = useState<WebhookForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!webhookId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/user-webhooks/${webhookId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load webhook (${res.status})`)
      const data = await res.json()
      setForm({
        name: data.name ?? '',
        url: data.url ?? '',
        method: (data.method ?? 'POST').toUpperCase() === 'PUT' ? 'PUT' : 'POST',
        secret: data.secret ?? '',
        events: Array.isArray(data.events) ? data.events : [],
        active: !!data.active,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhook')
    } finally {
      setLoading(false)
    }
  }, [webhookId])

  useEffect(() => {
    if (isEdit) {
      void load()
    } else {
      // New webhook — pre-generate a secret so the user has one to copy.
      setForm((prev) => ({ ...prev, secret: generateSecret() }))
    }
  }, [isEdit, load])

  const toggleEvent = (event: WebhookEvent) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }))
  }

  const allChecked = useMemo(() => {
    const allEvents = Object.values(WEBHOOK_EVENT_GROUPS).flat()
    return allEvents.every((e) => form.events.includes(e))
  }, [form.events])

  const toggleAll = () => {
    if (allChecked) {
      setForm((prev) => ({ ...prev, events: [] }))
    } else {
      setForm((prev) => ({
        ...prev,
        events: Object.values(WEBHOOK_EVENT_GROUPS).flat() as WebhookEvent[],
      }))
    }
  }

  const handleCopySecret = async () => {
    if (!form.secret) return
    try {
      await navigator.clipboard.writeText(form.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Could not copy secret to clipboard')
    }
  }

  const validate = (): string | null => {
    if (!form.url.trim()) return 'URL is required'
    try {
      const u = new URL(form.url)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return 'URL must start with http:// or https://'
      }
    } catch {
      return 'URL is not valid'
    }
    if (form.events.length === 0) return 'Pick at least one event'
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    if (!isEdit && !brandId) {
      setError('Pick a brand first')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const url = isEdit ? `/api/user-webhooks/${webhookId}` : '/api/user-webhooks'
      const method = isEdit ? 'PATCH' : 'POST'
      const body = isEdit
        ? {
            name: form.name,
            url: form.url,
            method: form.method,
            secret: form.secret,
            events: form.events,
            active: form.active,
          }
        : {
            brandId,
            name: form.name,
            url: form.url,
            method: form.method,
            secret: form.secret,
            events: form.events,
            active: form.active,
          }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Save failed (${res.status})`)
      }
      const saved = await res.json()
      if (!isEdit) {
        router.push(`/agency/studio/webhooks/${saved.id}`)
      } else {
        // Stay on the page but refresh local state
        await load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!brandId && !isEdit) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Pick a brand from the sidebar before creating a webhook.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/agency/studio/webhooks">
            <Button variant="ghost" size="icon-sm" aria-label="Back to webhooks">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <CardTitle>{isEdit ? 'Edit webhook' : 'New webhook'}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              className="size-3.5"
            />
            Active
          </label>
          <Button onClick={() => void handleSave()} disabled={saving || loading} size="sm">
            <Save className="size-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="webhook-name">Name (optional)</Label>
          <Input
            id="webhook-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="My Zapier listener"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://hooks.zapier.com/..."
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-method">Method</Label>
            <select
              id="webhook-method"
              value={form.method}
              onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value as 'POST' | 'PUT' }))}
              disabled={loading}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="webhook-secret">Signing secret</Label>
          <div className="flex items-center gap-2">
            <Input
              id="webhook-secret"
              value={form.secret}
              onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
              type={showSecret ? 'text' : 'password'}
              placeholder="Auto-generated when blank"
              disabled={loading}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setShowSecret((s) => !s)}
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => void handleCopySecret()}
              aria-label="Copy secret"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm((prev) => ({ ...prev, secret: generateSecret() }))}
            >
              <RefreshCcw className="size-4" />
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            We sign every request with HMAC-SHA256 using this secret. Store it
            on the receiving side and verify the <code className="rounded bg-muted px-1">X-Signature</code> header.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>Events</Label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {allChecked ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Object.entries(WEBHOOK_EVENT_GROUPS).map(([groupName, events]) => (
              <div
                key={groupName}
                className="rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupName}
                </div>
                <div className="flex flex-col gap-1.5">
                  {events.map((event) => {
                    const checked = form.events.includes(event)
                    return (
                      <label
                        key={event}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors',
                          checked ? 'bg-primary/10 text-foreground' : 'hover:bg-background'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEvent(event)}
                          className="size-3.5"
                        />
                        <span className="flex flex-col">
                          <span>{WEBHOOK_EVENT_LABELS[event]}</span>
                          <code className="text-[10px] text-muted-foreground">{event}</code>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
