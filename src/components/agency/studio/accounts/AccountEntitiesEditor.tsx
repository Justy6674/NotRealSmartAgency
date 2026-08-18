'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import { PlatformMark, presentationFor } from './PlatformMark'
import type { SocialAccount } from '@/hooks/useSocialAccounts'

interface AccountEntity {
  id: string
  brand_id: string
  account_id: string
  account_name?: string | null
  platform?: string | null
  entity_type: 'hashtag' | 'mention' | 'variable'
  name?: string | null
  value: string
  position: number
  created_at: string
}

interface AccountEntitiesEditorProps {
  brandId: string
  account: SocialAccount
  onClose: () => void
}

/**
 * Modal editor for per-account hashtags, mentions, and variables.
 *
 * Phase 9 of the Mixpost UI port — the native replacement for
 * Mixpost's AccountEntities.vue. Reads/writes through the
 * /api/account-entities REST endpoint which in turn writes to the
 * account_entities table (migration 038).
 */
export function AccountEntitiesEditor({ brandId, account, onClose }: AccountEntitiesEditorProps) {
  const [entities, setEntities] = useState<AccountEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [newType, setNewType] = useState<'hashtag' | 'mention' | 'variable'>('hashtag')
  const [newValue, setNewValue] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const platform = presentationFor(account.platform)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/account-entities?brandId=${brandId}&accountId=${account.id}`)
      if (res.ok) setEntities((await res.json()) as AccountEntity[])
    } finally {
      setLoading(false)
    }
  }, [brandId, account.id])

  useEffect(() => { refetch() }, [refetch])

  const handleCreate = async () => {
    if (!newValue.trim()) return
    if (newType === 'variable' && !newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/account-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          account_id: account.id,
          account_name: account.name,
          platform: account.platform,
          entity_type: newType,
          name: newType === 'variable' ? newName.trim() : undefined,
          value: newValue.trim(),
          position: entities.length,
        }),
      })
      if (res.ok) {
        setNewValue('')
        setNewName('')
        await refetch()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/account-entities?id=${id}`, { method: 'DELETE' })
    if (res.ok) setEntities((prev) => prev.filter((e) => e.id !== id))
  }

  const hashtags = entities.filter((e) => e.entity_type === 'hashtag')
  const mentions = entities.filter((e) => e.entity_type === 'mention')
  const variables = entities.filter((e) => e.entity_type === 'variable')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[85vh] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          {/* The same mark the grid draws, so the panel is plainly about the
              card that opened it. `color-mix()` in oklch used to tint this
              circle — DESIGN.md forbids it, because it interpolates through
              pink. */}
          <PlatformMark platform={account.platform} size={32} />
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
            >
              {platform.label}
            </div>
            <div className="text-sm font-medium text-foreground truncate">{account.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/*
            WHAT THIS SENTENCE USED TO SAY, and why it is gone:
            "automatically injected into every post published from this
            account". It was not true and had never been true. `account_entities`
            is written here and read back here, and by nothing else — no
            publisher, no scheduled-posts route, no cron reads the table. The
            owner was told his hashtags went out on every post and they went out
            on none of them, which is the worst shape a feature can take:
            silently absent while the interface confirms it is working.

            Injection at compose time is the right fix and it belongs in the
            composer, which is not this slice's file. Until that lands, the copy
            says what the list actually is — a shortlist he keeps here and drops
            in himself. A promise the code does not honour does not ship.
          */}
          <p className="text-xs text-muted-foreground">
            A shortlist for this account — the hashtags, handles and stock phrases you reuse on it.
            Keep them here so they are to hand while writing. They are not added to posts on their own.
          </p>

          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              <Section title={`Hashtags (${hashtags.length})`} entities={hashtags} onDelete={handleDelete} prefix="#" />
              <Section title={`Mentions (${mentions.length})`} entities={mentions} onDelete={handleDelete} prefix="" />
              <Section title={`Variables (${variables.length})`} entities={variables} onDelete={handleDelete} prefix="" showName />
            </>
          )}

          <div className="rounded-lg border border-dashed border-border bg-background p-3 space-y-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Add new</div>
            <div className="flex gap-1.5 flex-wrap">
              {(['hashtag', 'mention', 'variable'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                    newType === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {newType === 'variable' && (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="variable name (e.g. product)"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
                placeholder={newType === 'hashtag' ? 'tag (without #)' : newType === 'mention' ? '@handle' : 'default value'}
                className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !newValue.trim() || (newType === 'variable' && !newName.trim())}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  entities,
  onDelete,
  prefix,
  showName,
}: {
  title: string
  entities: AccountEntity[]
  onDelete: (id: string) => void
  prefix: string
  showName?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</div>
      {entities.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/70 italic">None yet</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entities.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {showName && e.name ? (
                <span>
                  <span className="font-semibold">{`{{${e.name}}}`}</span>
                  <span className="ml-1 text-muted-foreground/60">= {e.value}</span>
                </span>
              ) : (
                <span>{prefix}{e.value}</span>
              )}
              <button
                type="button"
                onClick={() => onDelete(e.id)}
                className="rounded-full p-0.5 text-muted-foreground/60 hover:text-[oklch(0.55_0.2_25)]"
                title="Remove"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
