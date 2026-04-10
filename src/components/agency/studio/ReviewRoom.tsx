'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Check, RefreshCw, ExternalLink, Film, Image as ImageIcon, X as XIcon } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { PlatformMockupPreview } from './preview'
import { ReviewFilters, type ReviewFilterState } from './review/ReviewFilters'
import { DraftCard } from './review/DraftCard'
import { BatchActions } from './review/BatchActions'
import { ComplianceBadge } from './review/ComplianceBadge'
import { recordReviewDecision } from '@/lib/media/review-memory'
import type { ScheduledPost, DraftSource, ComplianceResult, PostPlatform } from '@/types/database'

// Lightweight shape — only the fields the detail pane renders.
// Sourced from /api/media which returns top-level columns from the
// consolidated pipeline (file_url, thumbnail_url, file_type, etc.)
interface ReviewMediaItem {
  id: string
  file_url: string
  file_type: string
  file_name: string
  thumbnail_url: string | null
  duration_seconds: number | null
}

// ── Helper: extract source from metadata ──────────────────────────────────────

function getSource(post: ScheduledPost): DraftSource {
  const meta = (post.metadata ?? {}) as Record<string, unknown>
  return (meta.source as DraftSource) ?? 'unknown'
}

function getComplianceStatus(result: ComplianceResult | null | undefined): 'pass' | 'warn' | 'fail' | 'unchecked' {
  if (!result) return 'unchecked'
  if (!result.is_valid || result.flags.length > 0) return 'fail'
  if (result.warnings.length > 0 || result.brand_voice_issues.length > 0) return 'warn'
  return 'pass'
}

// ── Review Room ───────────────────────────────────────────────────────────────

export function ReviewRoom() {
  const { activeBrandId, setPendingDraftId } = useAgencyStore()
  const data = useStudioData(activeBrandId)

  const [drafts, setDrafts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [batchLoading, setBatchLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailPostId, setDetailPostId] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [complianceCache, setComplianceCache] = useState<Map<string, ComplianceResult>>(new Map())
  const [complianceLoading, setComplianceLoading] = useState<Set<string>>(new Set())
  // Cache of brand media keyed by media_item_id so the detail panel can
  // render real video/image content for the active draft. Loaded once per
  // brand from /api/media — same source the rest of Studio uses.
  const [mediaCache, setMediaCache] = useState<Map<string, ReviewMediaItem>>(new Map())
  // Modal flag — when true, show the actual Mixpost UI for the active draft
  // as a full-screen iframe. Mixpost's nginx now sends a frame-ancestors
  // CSP that allows embedding from notrealsmart.com.au (configured 2026-04-10).
  const [mixpostModalOpen, setMixpostModalOpen] = useState(false)

  const [filters, setFilters] = useState<ReviewFilterState>({
    source: 'all',
    platforms: [],
    compliance: 'all',
  })

  const brandName = data.brand?.name ?? 'Brand'
  const complianceFlags = data.brand?.compliance_flags as unknown as Record<string, boolean> | null
  const isHealthBrand = !!complianceFlags?.ahpra || !!complianceFlags?.tga

  // ── Fetch drafts ────────────────────────────────────────────────────────────

  const fetchDrafts = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/scheduled-posts?brandId=${activeBrandId}&status=draft`)
      if (res.ok) {
        const posts = await res.json()
        setDrafts(Array.isArray(posts) ? posts : [])
      }
    } catch {
      setDrafts([])
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  // ── Fetch media for the brand (so the detail pane can render the real
  // video / image content for whichever draft is active). Single fetch per
  // brand — keyed by media_item_id in a Map for O(1) lookup. ────────────────
  useEffect(() => {
    if (!activeBrandId) return
    fetch(`/api/media?brandId=${activeBrandId}&sort=newest`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const items: ReviewMediaItem[] = Array.isArray(d) ? d : (d.items ?? [])
        const next = new Map<string, ReviewMediaItem>()
        for (const m of items) next.set(m.id, m)
        setMediaCache(next)
      })
      .catch(() => setMediaCache(new Map()))
  }, [activeBrandId])

  // ── Compliance checks (auto-run for health brands) ──────────────────────────

  const checkCompliance = useCallback(async (postId: string, content: string) => {
    if (!activeBrandId) return
    setComplianceLoading(prev => new Set(prev).add(postId))
    try {
      const res = await fetch('/api/compliance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, brandId: activeBrandId }),
      })
      if (res.ok) {
        const result = await res.json() as ComplianceResult
        setComplianceCache(prev => new Map(prev).set(postId, result))
      }
    } catch {
      // Non-fatal
    } finally {
      setComplianceLoading(prev => { const next = new Set(prev); next.delete(postId); return next })
    }
  }, [activeBrandId])

  // Auto-check compliance for health brands on load
  useEffect(() => {
    if (!isHealthBrand || drafts.length === 0) return
    // Check first 20 drafts (batched, debounced)
    const unchecked = drafts.filter(d => !complianceCache.has(d.id)).slice(0, 20)
    for (const draft of unchecked) {
      checkCompliance(draft.id, draft.caption)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, isHealthBrand])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const patchPost = async (id: string, body: Record<string, unknown>) => {
    await fetch('/api/scheduled-posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
  }

  const brandSlug = data.brand?.slug ?? ''

  const handleApprove = async (id: string) => {
    const post = drafts.find(d => d.id === id)
    await patchPost(id, { status: 'scheduled' })
    if (post && brandSlug) recordReviewDecision({ action: 'approve', post, brandSlug })
    setDrafts(prev => prev.filter(d => d.id !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    if (detailPostId === id) setDetailPostId(null)
  }

  const handleReject = async (id: string, reason?: string) => {
    const post = drafts.find(d => d.id === id)
    await patchPost(id, {
      status: 'cancelled',
      metadata: reason ? { rejection_reason: reason } : undefined,
    })
    if (post && brandSlug) recordReviewDecision({ action: 'reject', post, brandSlug, reason })
    setDrafts(prev => prev.filter(d => d.id !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    if (detailPostId === id) setDetailPostId(null)
  }

  const handleAskDirector = (id: string) => {
    const post = drafts.find(d => d.id === id)
    if (!post) return
    const compliance = complianceCache.get(id)
    const complianceNote = compliance
      ? `Compliance: ${getComplianceStatus(compliance).toUpperCase()}${compliance.flags.length ? ` — ${compliance.flags.join(', ')}` : ''}`
      : 'Compliance: Not yet checked'

    sendToDirector(
      `Review this draft post for ${brandName}:\n\n` +
      `Platform: ${post.platform}\n` +
      `Caption: "${post.caption}"\n` +
      `Hashtags: ${post.hashtags?.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') || 'none'}\n` +
      `${complianceNote}\n\n` +
      `Check: brand voice, platform optimisation, ${isHealthBrand ? 'AHPRA/TGA compliance ($60K per offence), ' : ''}engagement potential.\n` +
      `Give me your honest assessment and any changes needed.`
    )
  }

  // ── Batch actions ───────────────────────────────────────────────────────────

  const handleBatchApprove = async () => {
    setBatchLoading(true)
    for (const id of selectedIds) {
      await patchPost(id, { status: 'scheduled' })
    }
    setDrafts(prev => prev.filter(d => !selectedIds.has(d.id)))
    setSelectedIds(new Set())
    setBatchLoading(false)
  }

  const handleBatchReject = async (reason: string) => {
    setBatchLoading(true)
    for (const id of selectedIds) {
      await patchPost(id, { status: 'cancelled', metadata: { rejection_reason: reason } })
    }
    setDrafts(prev => prev.filter(d => !selectedIds.has(d.id)))
    setSelectedIds(new Set())
    setBatchLoading(false)
  }

  const handleBatchSchedule = async (date: string) => {
    setBatchLoading(true)
    for (const id of selectedIds) {
      await patchPost(id, { status: 'scheduled', scheduled_at: new Date(date).toISOString() })
    }
    setDrafts(prev => prev.filter(d => !selectedIds.has(d.id)))
    setSelectedIds(new Set())
    setBatchLoading(false)
  }

  const handleBatchDirectorReview = () => {
    const selected = drafts.filter(d => selectedIds.has(d.id))
    const lines = selected.map((post, i) => {
      const compliance = complianceCache.get(post.id)
      const status = compliance ? getComplianceStatus(compliance).toUpperCase() : 'UNCHECKED'
      const source = getSource(post)
      return `${i + 1}. ${post.platform} — "${post.caption.slice(0, 80)}${post.caption.length > 80 ? '...' : ''}" (Source: ${source}, Compliance: ${status})`
    }).join('\n')

    sendToDirector(
      `Review these ${selected.length} drafts for ${brandName}:\n\n${lines}\n\n` +
      `Check each for: brand voice, platform optimisation, ${isHealthBrand ? 'AHPRA/TGA compliance, ' : ''}engagement potential.\n` +
      `Flag any that need changes.`
    )
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Filter drafts ───────────────────────────────────────────────────────────

  const availableSources = [...new Set(drafts.map(getSource))]

  const filteredDrafts = drafts.filter(post => {
    if (filters.source !== 'all' && getSource(post) !== filters.source) return false
    if (filters.platforms.length > 0 && !filters.platforms.includes(post.platform as PostPlatform)) return false
    if (filters.compliance !== 'all') {
      const status = getComplianceStatus(complianceCache.get(post.id))
      if (filters.compliance === 'pass' && status !== 'pass') return false
      if (filters.compliance === 'warn' && status !== 'warn') return false
      if (filters.compliance === 'fail' && status !== 'fail') return false
    }
    return true
  })

  const detailPost = detailPostId ? drafts.find(d => d.id === detailPostId) : null

  // Resolve the actual media items attached to the active draft so the
  // detail pane can render real video / image content (not just a caption).
  const detailMedia: ReviewMediaItem[] = useMemo(() => {
    if (!detailPost) return []
    const ids: string[] = [
      ...((detailPost.media_item_ids as string[] | null) ?? []),
      ...((detailPost as ScheduledPost & { media_item_id?: string | null }).media_item_id
        ? [(detailPost as ScheduledPost & { media_item_id?: string | null }).media_item_id as string]
        : []),
    ]
    const unique = [...new Set(ids)]
    return unique.map((id) => mediaCache.get(id)).filter((m): m is ReviewMediaItem => !!m)
  }, [detailPost, mediaCache])

  // Mixpost edit URL — only available once the background sync has completed.
  // Reads metadata.mixpost set by syncDraftToMixpost.
  const mixpostEditUrl = useMemo(() => {
    if (!detailPost) return null
    const meta = (detailPost.metadata as Record<string, unknown> | null) ?? {}
    const mixpost = meta.mixpost as
      | { post_uuid?: string; workspace_uuid?: string }
      | undefined
    if (!mixpost?.post_uuid || !mixpost.workspace_uuid) return null
    // Mixpost web URL — bare host, no /api prefix.
    const webBase = process.env.NEXT_PUBLIC_MIXPOST_WEB_URL ?? 'https://mixpost.notrealsmart.com.au/mixpost'
    return `${webBase}/${mixpost.workspace_uuid}/posts/${mixpost.post_uuid}/edit`
  }, [detailPost])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Select a brand to review drafts.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

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

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT: Draft list + filters */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <ReviewFilters
          filters={filters}
          onChange={setFilters}
          availableSources={availableSources}
          draftCount={drafts.length}
        />

        {/* Batch actions bar */}
        <BatchActions
          selectedCount={selectedIds.size}
          totalCount={filteredDrafts.length}
          onSelectAll={() => setSelectedIds(new Set(filteredDrafts.map(d => d.id)))}
          onClearSelection={() => setSelectedIds(new Set())}
          onApproveAll={handleBatchApprove}
          onRejectAll={handleBatchReject}
          onScheduleAll={handleBatchSchedule}
          onAskDirectorAll={handleBatchDirectorReview}
          loading={batchLoading}
        />

        {/* Draft cards grid */}
        <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
          {filteredDrafts.map(post => (
            <DraftCard
              key={post.id}
              post={post}
              selected={selectedIds.has(post.id)}
              active={detailPostId === post.id}
              complianceResult={complianceCache.get(post.id)}
              complianceLoading={complianceLoading.has(post.id)}
              onSelect={toggleSelect}
              onClick={setDetailPostId}
              onApprove={handleApprove}
              onReject={(id) => handleReject(id)}
              onAlter={(id) => setPendingDraftId(id)}
              onAskDirector={handleAskDirector}
              onPreviewMixpost={(id) => {
                // One-click entry into the Mixpost iframe — set the active
                // draft (so detailPost resolves) AND open the modal in a
                // single tick. The detail pane still renders under the
                // modal so Approve/Reject in the modal header can reuse
                // its handlers.
                setDetailPostId(id)
                setMixpostModalOpen(true)
              }}
            />
          ))}
        </div>

        {filteredDrafts.length === 0 && drafts.length > 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">
            No drafts match your filters.
          </p>
        )}
      </div>

      {/* RIGHT: Detail panel + phone mockup */}
      {detailPost && (
        <div className="hidden lg:flex lg:w-[460px] shrink-0 flex-col border-l border-border overflow-y-auto bg-muted/30">
          <div className="p-4 space-y-4">
            {/* Source info */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {((detailPost.metadata as Record<string, unknown>)?.created_by as string) ?? 'Unknown'} &middot; {detailPost.platform}
              </span>
              <div className="ml-auto">
                <ComplianceBadge
                  result={complianceCache.get(detailPost.id)}
                  loading={complianceLoading.has(detailPost.id)}
                  onRecheck={() => checkCompliance(detailPost.id, detailPost.caption)}
                  expanded
                />
              </div>
            </div>

            {/* ── Real media — playable video, full-res image ────────────────
               This is the bit Justin couldn't see before. Native HTML5
               <video controls> IS the actual player Facebook uses on the
               desktop web feed — same codec decoder, same scrubber. The
               source URL points at Supabase Storage; the browser plays the
               actual MP4. For images, we render full file_url (not the
               compressed thumbnail). Always shown above the phone mockup
               so you can press play and see what you're approving. */}
            {detailMedia.length > 0 ? (
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Media ({detailMedia.length})
                </label>
                <div className="space-y-2">
                  {detailMedia.map((m) => {
                    const isVideo = m.file_type?.startsWith('video')
                    const isImage = m.file_type?.startsWith('image')
                    return (
                      <div key={m.id} className="rounded-lg overflow-hidden border border-border bg-black">
                        {isVideo ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video
                            src={m.file_url}
                            poster={m.thumbnail_url ?? undefined}
                            controls
                            preload="metadata"
                            className="w-full max-h-[420px] bg-black"
                          />
                        ) : isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.file_url}
                            alt={m.file_name}
                            className="w-full max-h-[420px] object-contain bg-black"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground gap-1.5">
                            <Film className="h-4 w-4" />
                            Unsupported file type: {m.file_type}
                          </div>
                        )}
                        <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/30 truncate">
                          {m.file_name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (detailPost.media_item_ids?.length ?? 0) > 0 ? (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-500/90 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Media attached but not yet loaded — refresh in a sec.
              </div>
            ) : null}

            {/* Phone mockup preview */}
            <div className="flex justify-center">
              <div className="transform scale-[0.8] origin-top">
                <PlatformMockupPreview
                  platform={detailPost.platform}
                  caption={editingCaption ?? detailPost.caption}
                  hashtags={(detailPost.hashtags ?? []).map(h => h.startsWith('#') ? h : `#${h}`)}
                  brandName={brandName}
                />
              </div>
            </div>

            {/* Caption editor */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Caption
              </label>
              <textarea
                value={editingCaption ?? detailPost.caption}
                onChange={(e) => setEditingCaption(e.target.value)}
                onBlur={async () => {
                  if (editingCaption !== null && editingCaption !== detailPost.caption) {
                    await patchPost(detailPost.id, { caption: editingCaption })
                    setDrafts(prev => prev.map(d => d.id === detailPost.id ? { ...d, caption: editingCaption } : d))
                  }
                  setEditingCaption(null)
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={5}
              />
              <span className="text-[10px] text-muted-foreground">
                {(editingCaption ?? detailPost.caption).length} characters
              </span>
            </div>

            {/* Hashtags */}
            {detailPost.hashtags?.length > 0 && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                  Hashtags
                </label>
                <div className="flex flex-wrap gap-1">
                  {detailPost.hashtags.map((h, i) => (
                    <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {h.startsWith('#') ? h : `#${h}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Health brand warning */}
            {isHealthBrand && (
              <div className="rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2 text-[11px] text-red-400">
                Healthcare brand — Director compliance review recommended. AHPRA/TGA violations: $60K per offence.
              </div>
            )}

            {/* View in Mixpost — opens the actual Mixpost edit screen for
                this draft as a full-screen iframe modal. Mixpost's nginx
                now sends a frame-ancestors CSP that allows embedding from
                notrealsmart.com.au (configured 2026-04-10), so the iframe
                inherits Justin's logged-in Mixpost session via the
                same-site (registrable domain) cookie.

                Disabled state shows the sync is still running. Secondary
                "open in new tab" link is available inside the modal as a
                fallback. */}
            <div className="flex items-center gap-2">
              {mixpostEditUrl ? (
                <button
                  type="button"
                  onClick={() => setMixpostModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/50 bg-violet-400/10 px-3 py-1.5 text-[11px] font-medium text-violet-500 hover:bg-violet-400/15 transition-colors"
                  title="Open this draft in the actual Mixpost UI inside NRS"
                >
                  <ExternalLink className="h-3 w-3" />
                  Preview in Mixpost
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60"
                  title="Mixpost sync still running — usually takes 5-10s for images, up to ~6 minutes for videos (one-time per video, then cached)"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing to Mixpost…
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleAskDirector(detailPost.id)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                Ask Director
              </button>
              <button
                onClick={() => handleApprove(detailPost.id)}
                className="flex-1 rounded-lg bg-[oklch(0.72_0.15_145)] px-3 py-2 text-xs font-medium text-white hover:bg-[oklch(0.65_0.15_145)] transition-colors"
                title="Mark as scheduled — Mixpost queues it to the next free slot in your posting schedule"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(detailPost.id)}
                className="rounded-lg border border-[oklch(0.65_0.2_25/0.3)] px-3 py-2 text-xs font-medium text-[oklch(0.65_0.2_25)] hover:bg-[oklch(0.65_0.2_25/0.1)] transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mixpost iframe modal ─────────────────────────────────────────
          Full-screen overlay that embeds the actual Mixpost edit screen
          for the active draft. Made possible by the nginx config change
          on 2026-04-10 that strips X-Frame-Options and adds a
          frame-ancestors CSP scoped to NRS hosts.

          The iframe shares Mixpost's session cookie with Justin's
          existing Mixpost browser session because notrealsmart.com.au
          and mixpost.notrealsmart.com.au are same-site (registrable
          domain match), so SameSite=Lax cookies still flow.

          Header has Approve / Reject buttons so the user can act on the
          draft without leaving the modal, plus an "open in new tab"
          fallback in case the iframe ever fails to load. */}
      {mixpostModalOpen && detailPost && mixpostEditUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-[95vw] h-[92vh] flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold text-foreground">Mixpost preview</span>
              <span className="text-[10px] text-muted-foreground truncate flex-1">
                {detailPost.platform} · {detailPost.caption?.slice(0, 80) ?? ''}
              </span>
              <a
                href={mixpostEditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                title="Open in a new browser tab instead"
              >
                <ExternalLink className="h-3 w-3" />
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => {
                  handleApprove(detailPost.id)
                  setMixpostModalOpen(false)
                }}
                className="rounded-md bg-[oklch(0.72_0.15_145)] px-3 py-1 text-[11px] font-medium text-white hover:bg-[oklch(0.65_0.15_145)] transition-colors"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => {
                  handleReject(detailPost.id)
                  setMixpostModalOpen(false)
                }}
                className="rounded-md border border-[oklch(0.65_0.2_25/0.3)] px-3 py-1 text-[11px] font-medium text-[oklch(0.65_0.2_25)] hover:bg-[oklch(0.65_0.2_25/0.1)] transition-colors"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => setMixpostModalOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Iframe — fills remaining space */}
            <iframe
              src={mixpostEditUrl}
              title="Mixpost — actual post editor"
              className="flex-1 w-full bg-white"
              // Permissive sandbox so Mixpost's Vue frontend can run scripts,
              // forms, popups, and access cookies (it's same-site).
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-write; clipboard-read; fullscreen"
            />
          </div>
        </div>
      )}
    </div>
  )
}
