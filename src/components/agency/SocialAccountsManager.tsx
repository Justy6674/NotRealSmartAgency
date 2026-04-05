'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────────── */

interface MixpostAccount {
  id: number
  name: string
  username: string | null
  provider: string
  media_url: string | null
}

interface AccountsResponse {
  confirmed: MixpostAccount[]
  suggested: MixpostAccount[]
  all: MixpostAccount[]
  error?: string
}

/* ─── Platform visuals ──────────────────────────────────────── */

const PLATFORM_STYLE: Record<string, { dot: string; label: string }> = {
  instagram:      { dot: 'oklch(0.65 0.2 350)',  label: 'Instagram' },
  facebook_page:  { dot: 'oklch(0.55 0.15 250)', label: 'Facebook' },
  facebook_group: { dot: 'oklch(0.55 0.15 250)', label: 'Facebook Group' },
  linkedin:       { dot: 'oklch(0.55 0.12 230)', label: 'LinkedIn' },
  linkedin_page:  { dot: 'oklch(0.55 0.12 230)', label: 'LinkedIn Page' },
  tiktok:         { dot: 'oklch(0.70 0.15 180)', label: 'TikTok' },
  youtube:        { dot: 'oklch(0.55 0.2 25)',   label: 'YouTube' },
  x:              { dot: 'oklch(0.55 0.02 240)', label: 'X' },
  twitter:        { dot: 'oklch(0.55 0.02 240)', label: 'X' },
}

function platformLabel(provider: string): string {
  return PLATFORM_STYLE[provider]?.label ?? provider.replace(/_/g, ' ')
}

function platformDot(provider: string): string {
  return PLATFORM_STYLE[provider]?.dot ?? 'oklch(0.5 0.05 240)'
}

/* ─── Component ─────────────────────────────────────────────── */

interface SocialAccountsManagerProps {
  brandId: string
  brandName: string
  /** Compact mode hides header and uses smaller spacing */
  compact?: boolean
  /** Called after a successful save so parent can refresh data */
  onSaved?: () => void
}

export function SocialAccountsManager({
  brandId,
  brandName,
  compact = false,
  onSaved,
}: SocialAccountsManagerProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [allAccounts, setAllAccounts] = useState<MixpostAccount[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [suggestedIds, setSuggestedIds] = useState<Set<number>>(new Set())
  const [originalIds, setOriginalIds] = useState<Set<number>>(new Set())

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/mixpost-accounts`)
      if (!res.ok) throw new Error('Failed to fetch accounts')
      const data: AccountsResponse = await res.json()

      if (data.error && data.all.length === 0) {
        setError(data.error)
        return
      }

      setAllAccounts(data.all)

      // Build initial selection: confirmed first, then suggested
      const confirmed = new Set(data.confirmed.map(a => a.id))
      const suggested = new Set(data.suggested.map(a => a.id))
      setSuggestedIds(suggested)

      if (confirmed.size > 0) {
        setSelectedIds(confirmed)
        setOriginalIds(new Set(confirmed))
      } else {
        // Pre-select suggested so user just confirms
        setSelectedIds(suggested)
        setOriginalIds(new Set())
      }
    } catch {
      setError('Could not load social accounts. Check your Mixpost connection.')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const toggle = (id: number) => {
    setSuccess(false)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasChanges = (() => {
    if (selectedIds.size !== originalIds.size) return true
    for (const id of selectedIds) {
      if (!originalIds.has(id)) return true
    }
    return false
  })()

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/brands/${brandId}/mixpost-accounts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_ids: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('Save failed')
      setOriginalIds(new Set(selectedIds))
      setSuggestedIds(new Set()) // Clear suggestions after confirming
      setSuccess(true)
      onSaved?.()
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'py-2' : 'py-6'} text-muted-foreground`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading social accounts...</span>
      </div>
    )
  }

  /* ── Error state ── */
  if (error && allAccounts.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'py-2' : 'py-4'} text-amber-400`}>
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="text-sm">{error}</span>
        <button
          onClick={fetchAccounts}
          className="ml-auto text-xs text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    )
  }

  /* ── Empty state ── */
  if (allAccounts.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${compact ? 'py-2' : 'py-4'}`}>
        No social accounts found in Mixpost. Connect your platforms at{' '}
        <a
          href="https://mixpost.notrealsmart.com.au/mixpost"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          mixpost.notrealsmart.com.au
        </a>{' '}
        first.
      </div>
    )
  }

  /* ── Partition accounts ── */
  const linked = allAccounts.filter(a => selectedIds.has(a.id))
  const available = allAccounts.filter(a => !selectedIds.has(a.id))

  return (
    <div className={`space-y-${compact ? '3' : '4'}`}>
      {!compact && (
        <h3 className="text-sm font-semibold text-foreground">
          Social Accounts for {brandName}
        </h3>
      )}

      {/* ── Linked accounts ── */}
      {linked.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Linked to this brand
          </span>
          {linked.map(account => (
            <AccountRow
              key={account.id}
              account={account}
              selected
              isSuggested={suggestedIds.has(account.id)}
              onToggle={() => toggle(account.id)}
            />
          ))}
        </div>
      )}

      {/* ── Available accounts ── */}
      {available.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Available accounts
          </span>
          {available.map(account => (
            <AccountRow
              key={account.id}
              account={account}
              selected={false}
              isSuggested={false}
              onToggle={() => toggle(account.id)}
            />
          ))}
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Success banner ── */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          <Check className="h-3.5 w-3.5 shrink-0" />
          Social accounts saved successfully.
        </div>
      )}

      {/* ── Save button ── */}
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      )}
    </div>
  )
}

/* ─── Account Row ───────────────────────────────────────────── */

function AccountRow({
  account,
  selected,
  isSuggested,
  onToggle,
}: {
  account: MixpostAccount
  selected: boolean
  isSuggested: boolean
  onToggle: () => void
}) {
  const displayName = account.username
    ? `@${account.username}`
    : account.name

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2.5 group">
      {/* Platform dot */}
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: platformDot(account.provider) }}
      />

      {/* Account info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {platformLabel(account.provider)}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {displayName}
          </span>
        </div>
        {isSuggested && (
          <span className="text-[10px] text-amber-400">
            Auto-matched -- please confirm or remove
          </span>
        )}
      </div>

      {/* Toggle button */}
      {selected ? (
        <button
          onClick={onToggle}
          className="shrink-0 flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <X className="h-3 w-3" />
          Remove
        </button>
      ) : (
        <button
          onClick={onToggle}
          className="shrink-0 flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <Check className="h-3 w-3" />
          Add to brand
        </button>
      )}
    </div>
  )
}
