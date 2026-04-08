'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Sparkles, Check, X, MessageCircle, Eye, Send, Calendar, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { PlatformMockupPreview } from './preview'
import type { ScheduledPost } from '@/types/database'

// ── Platform display config ─────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; colour: string }> = {
  instagram: { label: 'Instagram', colour: 'bg-pink-400' },
  facebook: { label: 'Facebook', colour: 'bg-blue-400' },
  linkedin: { label: 'LinkedIn', colour: 'bg-sky-400' },
  tiktok: { label: 'TikTok', colour: 'bg-cyan-400' },
  youtube: { label: 'YouTube', colour: 'bg-red-400' },
  twitter: { label: 'X', colour: 'bg-zinc-400' },
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-500/10 text-amber-400',
    scheduled: 'bg-blue-500/10 text-blue-400',
    published: 'bg-emerald-500/10 text-emerald-400',
    failed: 'bg-red-500/10 text-red-400',
    rejected: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-medium', styles[status] ?? styles.draft)}>
      {status}
    </span>
  )
}

// ── Review Room ─────────────────────────────────────────────────────────────

export function ReviewRoom() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const [drafts, setDrafts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const brandName = data.brand?.name ?? 'Brand'
  const complianceFlags = data.brand?.compliance_flags as unknown as Record<string, boolean> | null
  const isHealthBrand = !!complianceFlags?.ahpra || !!complianceFlags?.tga

  // Fetch drafts for this brand
  const fetchDrafts = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/scheduled-posts?brandId=${activeBrandId}&status=draft`)
      if (res.ok) {
        const posts = await res.json()
        setDrafts(Array.isArray(posts) ? posts : posts.posts ?? [])
      }
    } catch {
      setDrafts([])
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  // Patch a post
  const patchPost = useCallback(async (id: string, body: Record<string, unknown>) => {
    setSaving(id)
    try {
      await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      await fetchDrafts()
    } finally {
      setSaving(null)
    }
  }, [fetchDrafts])

  // Actions
  const handleApprove = (id: string) => patchPost(id, { status: 'scheduled' })
  const handleReject = (id: string) => patchPost(id, { status: 'cancelled' })
  const handleSaveCaption = (id: string) => {
    const newCaption = editingCaption[id]
    if (newCaption !== undefined) {
      patchPost(id, { caption: newCaption })
    }
  }

  const handleDirectorReview = (post: ScheduledPost) => {
    sendToDirector(
      `Review this draft post for ${brandName} before I approve it.\n\n` +
      `Platform: ${post.platform}\n` +
      `Caption: "${post.caption}"\n` +
      `Hashtags: ${post.hashtags?.map(h => `#${h}`).join(' ') || 'none'}\n\n` +
      `Check for:\n` +
      `- Brand voice consistency\n` +
      `- Platform optimisation\n` +
      (isHealthBrand ? `- AHPRA/TGA compliance (CRITICAL — $60K per offence)\n` : '') +
      `- Engagement potential\n\n` +
      `Give me your honest assessment and any changes needed.`
    )
  }

  // No brand
  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Select a brand to review drafts.</p>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // No drafts
  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <Check className="h-8 w-8 text-emerald-400/40" />
        <p className="text-sm text-muted-foreground">No drafts waiting for review.</p>
        <p className="text-xs text-muted-foreground/60">Create content in the Create tab, or ask the Director to draft something.</p>
        <button
          type="button"
          onClick={fetchDrafts}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors mt-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
    )
  }

  const selectedPost = selectedId ? drafts.find(d => d.id === selectedId) : null

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT: Draft list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Review Drafts</h2>
            <p className="text-xs text-muted-foreground">{drafts.length} draft{drafts.length !== 1 ? 's' : ''} waiting for {brandName}</p>
          </div>
          <button
            type="button"
            onClick={fetchDrafts}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {drafts.map(post => {
          const platform = PLATFORM_CONFIG[post.platform]
          const isSelected = selectedId === post.id
          const caption = editingCaption[post.id] ?? post.caption

          return (
            <div
              key={post.id}
              className={cn(
                'rounded-xl border p-4 space-y-3 transition-all cursor-pointer',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/30'
              )}
              onClick={() => setSelectedId(isSelected ? null : post.id)}
            >
              {/* Header: platform + status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', platform?.colour ?? 'bg-zinc-400')} />
                  <span className="text-sm font-medium text-foreground">{platform?.label ?? post.platform}</span>
                </div>
                <StatusBadge status={post.status} />
              </div>

              {/* Caption preview */}
              <p className="text-xs text-muted-foreground line-clamp-2">
                {post.caption || 'No caption'}
              </p>

              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {post.hashtags.slice(0, 5).map(h => (
                    <span key={h} className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
                      #{h}
                    </span>
                  ))}
                  {post.hashtags.length > 5 && (
                    <span className="text-[9px] text-muted-foreground">+{post.hashtags.length - 5} more</span>
                  )}
                </div>
              )}

              {/* Expanded: edit + actions */}
              {isSelected && (
                <div className="space-y-3 pt-2 border-t border-border" onClick={e => e.stopPropagation()}>
                  {/* Editable caption */}
                  <textarea
                    value={caption}
                    onChange={e => setEditingCaption(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onBlur={() => handleSaveCaption(post.id)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none min-h-[100px] focus:outline-none focus:border-primary"
                    rows={4}
                  />

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Director Review */}
                    <button
                      type="button"
                      onClick={() => handleDirectorReview(post)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Director Review
                    </button>

                    {/* Approve → Schedule */}
                    <button
                      type="button"
                      onClick={() => handleApprove(post.id)}
                      disabled={saving === post.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                    >
                      {saving === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </button>

                    {/* Reject */}
                    <button
                      type="button"
                      onClick={() => handleReject(post.id)}
                      disabled={saving === post.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>

                    {/* Preview */}
                    <button
                      type="button"
                      onClick={() => setSelectedId(post.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                  </div>

                  {/* Health brand compliance warning */}
                  {isHealthBrand && (
                    <div className="rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2 text-[11px] text-red-400">
                      Healthcare brand — Director compliance review recommended before approving. AHPRA/TGA violations: $60K per offence.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* RIGHT: Preview pane (desktop only) */}
      {selectedPost && (
        <div className="hidden lg:block w-[360px] shrink-0 border-l border-border overflow-y-auto p-4" style={{ background: 'oklch(0.06 0.005 240)' }}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview</h3>
          <PlatformMockupPreview
            platform={selectedPost.platform}
            caption={editingCaption[selectedPost.id] ?? selectedPost.caption}
            hashtags={(selectedPost.hashtags ?? []).map(h => `#${h}`)}
            brandName={brandName}
          />
        </div>
      )}
    </div>
  )
}
