'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Link2, Loader2, Plus, Share2, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface IntakeLink {
  id: string
  brand_id: string
  label: string
  token_prefix: string
  status: 'active' | 'revoked'
  created_at: string
  last_used_at: string | null
  brands?: { name?: string; slug?: string } | Array<{ name?: string; slug?: string }> | null
}

interface MediaIntakeLinksProps {
  brandId: string
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not used yet'
  return `Used ${new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
}

export function MediaIntakeLinks({ brandId }: MediaIntakeLinksProps) {
  const [links, setLinks] = useState<IntakeLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('My iPhone')
  const [newUrl, setNewUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeLinks = useMemo(() => links.filter((link) => link.status === 'active'), [links])

  const refresh = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`/api/media/intake-links?brandId=${encodeURIComponent(brandId)}`)
    const data = await response.json().catch(() => []) as IntakeLink[] | { error?: string }
    if (response.ok && Array.isArray(data)) {
      setLinks(data)
      setError(null)
    } else {
      setError(typeof data === 'object' && !Array.isArray(data) ? data.error ?? 'Could not load quick-add links.' : 'Could not load quick-add links.')
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => { void refresh() }, [refresh])

  const create = async () => {
    setCreating(true)
    setError(null)
    setNewUrl(null)
    try {
      const response = await fetch('/api/media/intake-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, label }),
      })
      const data = await response.json().catch(() => ({})) as { drop_url?: string; error?: string }
      if (!response.ok || !data.drop_url) throw new Error(data.error ?? 'Could not create the quick-add link.')
      setNewUrl(data.drop_url)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the quick-add link.')
    } finally {
      setCreating(false)
    }
  }

  const copy = async () => {
    if (!newUrl) return
    try {
      await navigator.clipboard.writeText(newUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the link. Select and copy it from the box below.')
    }
  }

  const share = async () => {
    if (!newUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ title: 'NRS quick add', text: 'Save this secure media inbox to your phone.', url: newUrl })
      } else {
        await copy()
      }
    } catch {
      // Cancelling the native share sheet is not an error worth showing.
    }
  }

  const revoke = async (id: string) => {
    if (!window.confirm('Turn off this quick-add link? It will stop working immediately, but uploaded media stays in NRS.')) return
    setError(null)
    const response = await fetch('/api/media/intake-links', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action: 'revoke' }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string }
      setError(data.error ?? 'Could not revoke the quick-add link.')
      return
    }
    await refresh()
  }

  return (
    <Card className="border-lime-500/20 bg-lime-500/[0.035] p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-lg bg-lime-500/15 p-2 text-lime-600 dark:text-lime-300"><Link2 className="h-4 w-4" /></div>
          <div>
            <h2 className="font-semibold">Quick add from phone</h2>
            <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
              Create a private link for an iPhone or desktop. It uploads only into this brand’s NRS media library — it cannot see files, make posts, or publish.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-lime-600 dark:text-lime-300" /> Revocable</div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="quick-add-label">Who is this link for?</label>
        <input
          id="quick-add-label"
          value={label}
          maxLength={80}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="e.g. Bec’s iPhone"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={create} disabled={creating || !label.trim()}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create quick-add link
        </Button>
      </div>

      {newUrl && (
        <div className="mt-4 rounded-xl border border-lime-500/30 bg-background p-3">
          <p className="text-sm font-medium">Save this on the intended phone now</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">This is the only time NRS can show the complete secret link. Open it in Safari, then use Share → Add to Home Screen.</p>
          <input readOnly value={newUrl} aria-label="New quick-add link" className="mt-3 h-9 w-full rounded-md border bg-muted px-2 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={copy}><Copy className="mr-1.5 h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}</Button>
            <Button size="sm" variant="outline" onClick={share}><Share2 className="mr-1.5 h-3.5 w-3.5" /> Share to iPhone</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading quick-add links…</div>
      ) : activeLinks.length > 0 ? (
        <div className="mt-4 space-y-2">
          {activeLinks.map((link) => (
            <div key={link.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{link.label}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{link.token_prefix}… · {dateLabel(link.last_used_at)}</p>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => void revoke(link.id)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revoke
              </Button>
            </div>
          ))}
        </div>
      ) : !error ? (
        <p className="mt-4 text-sm text-muted-foreground">No phone links yet. Create one for Justin’s phone and one for Bec’s if you both upload media.</p>
      ) : null}
    </Card>
  )
}
