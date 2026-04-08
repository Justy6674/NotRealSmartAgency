'use client'

import { useState, useCallback } from 'react'
import { X, Check, Copy, Download, Calendar, Send, Loader2, Rocket } from 'lucide-react'
import type { ScheduledPost, Brand } from '@/types/database'

const PLATFORM_CONFIG: Record<string, { label: string; maxChars: number; colour: string }> = {
  instagram: { label: 'Instagram', maxChars: 2200, colour: 'oklch(0.65_0.15_350)' },
  facebook: { label: 'Facebook', maxChars: 63206, colour: 'oklch(0.55_0.15_250)' },
  linkedin: { label: 'LinkedIn', maxChars: 3000, colour: 'oklch(0.55_0.12_230)' },
  tiktok: { label: 'TikTok', maxChars: 2200, colour: 'oklch(0.70_0.15_180)' },
  youtube: { label: 'YouTube', maxChars: 5000, colour: 'oklch(0.55_0.2_25)' },
  twitter: { label: 'X', maxChars: 280, colour: 'oklch(0.55_0.02_240)' },
}

interface PostReviewPanelProps {
  posts: ScheduledPost[]
  brand: Brand
  connectedPlatforms: string[]
  onClose: () => void
  onUpdate: () => void
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-500/10 text-amber-400',
    scheduled: 'bg-blue-500/10 text-blue-400',
    publishing: 'bg-blue-500/10 text-blue-400',
    published: 'bg-emerald-500/10 text-emerald-400',
    failed: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-zinc-500/10 text-zinc-400',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  )
}

export function PostReviewPanel({ posts, brand, connectedPlatforms, onClose, onUpdate }: PostReviewPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [addingHashtagId, setAddingHashtagId] = useState<string | null>(null)
  const [newHashtag, setNewHashtag] = useState('')
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({})
  const [publishingAll, setPublishingAll] = useState(false)
  const [publishProgress, setPublishProgress] = useState<string | null>(null)

  const patchPost = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch('/api/scheduled-posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    if (res.ok) onUpdate()
  }, [onUpdate])

  const handleCaptionSave = useCallback((id: string, newCaption: string) => {
    const post = posts.find(p => p.id === id)
    if (post && newCaption !== post.caption) {
      patchPost(id, { caption: newCaption })
    }
  }, [posts, patchPost])

  const handleScheduleChange = useCallback((id: string, datetime: string) => {
    setScheduleTimes(prev => ({ ...prev, [id]: datetime }))
    if (datetime) {
      patchPost(id, { scheduled_at: new Date(datetime).toISOString() })
    }
  }, [patchPost])

  const handleSchedule = useCallback((id: string) => {
    patchPost(id, { status: 'scheduled' })
  }, [patchPost])

  const handlePublishNow = useCallback(async (id: string) => {
    const res = await fetch('/api/scheduled-posts/publish-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: id }),
    })
    if (res.ok) onUpdate()
  }, [onUpdate])

  const handleScheduleAll = useCallback(() => {
    const connectedDrafts = posts.filter(
      p => p.status === 'draft' && connectedPlatforms.includes(p.platform)
    )
    connectedDrafts.forEach(p => patchPost(p.id, { status: 'scheduled' }))
  }, [posts, connectedPlatforms, patchPost])

  // Publishable posts: connected platforms, not yet published
  const publishablePosts = posts.filter(
    p => connectedPlatforms.includes(p.platform) && p.status !== 'published' && p.status !== 'publishing'
  )

  const handlePublishAllConnected = useCallback(async () => {
    if (publishablePosts.length === 0) return
    setPublishingAll(true)
    setPublishProgress(`Publishing ${publishablePosts.length} post${publishablePosts.length !== 1 ? 's' : ''}...`)

    try {
      const res = await fetch('/api/scheduled-posts/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: publishablePosts.map(p => p.id) }),
      })

      if (!res.ok) {
        setPublishProgress('Publishing failed. Please try again.')
        return
      }

      const data = await res.json()
      const { published, failed } = data as { published: number; failed: number }

      if (failed === 0) {
        setPublishProgress(`All ${published} post${published !== 1 ? 's' : ''} published successfully!`)
      } else {
        setPublishProgress(`${published} published, ${failed} failed. Check individual posts.`)
      }

      onUpdate()
    } catch {
      setPublishProgress('Something went wrong. Please try again.')
    } finally {
      setPublishingAll(false)
      setTimeout(() => setPublishProgress(null), 5000)
    }
  }, [publishablePosts, onUpdate])

  const handleCopyCaption = useCallback(async (post: ScheduledPost) => {
    const hashtags = post.hashtags?.length ? '\n\n' + post.hashtags.map(h => `#${h}`).join(' ') : ''
    await navigator.clipboard.writeText(post.caption + hashtags)
    setCopiedId(post.id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleDownload = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/scheduled-posts/download?postId=${id}`)
      if (!res.ok) return
      const data = await res.json()
      const content = [
        data.caption ?? '',
        data.hashtags?.length ? '\n\nHashtags: ' + data.hashtags.map((h: string) => `#${h}`).join(' ') : '',
        data.mediaUrl ? '\n\nMedia: ' + data.mediaUrl : '',
      ].join('')
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `post-${id.slice(0, 8)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Download failed silently
    }
  }, [])

  const handleRemoveHashtag = useCallback((id: string, tag: string) => {
    const post = posts.find(p => p.id === id)
    if (!post) return
    const updated = (post.hashtags ?? []).filter(h => h !== tag)
    patchPost(id, { hashtags: updated })
  }, [posts, patchPost])

  const handleAddHashtag = useCallback((id: string) => {
    if (!newHashtag.trim()) return
    const post = posts.find(p => p.id === id)
    if (!post) return
    const cleaned = newHashtag.trim().replace(/^#/, '')
    if (!cleaned) return
    const updated = [...(post.hashtags ?? []), cleaned]
    patchPost(id, { hashtags: updated })
    setNewHashtag('')
    setAddingHashtagId(null)
  }, [newHashtag, posts, patchPost])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Review {posts.length} Post{posts.length !== 1 ? 's' : ''} for {brand.name}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScheduleAll}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            Schedule All
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Publish All Connected — primary action */}
      {publishablePosts.length > 0 && (
        <button
          onClick={handlePublishAllConnected}
          disabled={publishingAll}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
        >
          {publishingAll ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {publishProgress}
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Publish All Connected ({publishablePosts.length} post{publishablePosts.length !== 1 ? 's' : ''})
            </>
          )}
        </button>
      )}

      {/* Progress / result message */}
      {publishProgress && !publishingAll && (
        <div className={`rounded-lg px-3 py-2 text-xs font-medium text-center ${
          publishProgress.includes('failed') || publishProgress.includes('wrong')
            ? 'bg-red-500/10 text-red-400'
            : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {publishProgress}
        </div>
      )}

      {/* Per-platform cards */}
      {posts.map(post => {
        const config = PLATFORM_CONFIG[post.platform] ?? { label: post.platform, maxChars: 5000, colour: 'oklch(0.5_0.05_240)' }
        const isConnected = connectedPlatforms.includes(post.platform)

        return (
          <div
            key={post.id}
            className={`rounded-xl border p-4 space-y-3 ${
              post.status === 'published'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border bg-card/50'
            }`}
          >
            {/* Platform header + connection status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: config.colour }}
                />
                <span className="text-sm font-medium text-foreground">{config.label}</span>
                {isConnected ? (
                  <span className="text-[10px] text-emerald-400">Connected</span>
                ) : (
                  <span className="text-[10px] text-amber-400">Not connected</span>
                )}
              </div>
              <StatusBadge status={post.status} />
            </div>

            {/* Editable caption */}
            <textarea
              defaultValue={post.caption}
              onBlur={e => handleCaptionSave(post.id, e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />

            {/* Char count */}
            <div className="text-[10px] text-muted-foreground text-right">
              {post.caption.length} / {config.maxChars}
            </div>

            {/* Hashtags */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {post.hashtags?.map(h => (
                <span
                  key={h}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground flex items-center gap-1"
                >
                  #{h}
                  <button
                    onClick={() => handleRemoveHashtag(post.id, h)}
                    className="hover:text-foreground transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              {addingHashtagId === post.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newHashtag}
                    onChange={e => setNewHashtag(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddHashtag(post.id)
                      if (e.key === 'Escape') { setAddingHashtagId(null); setNewHashtag('') }
                    }}
                    placeholder="hashtag"
                    className="w-20 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-foreground focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleAddHashtag(post.id)}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingHashtagId(post.id); setNewHashtag('') }}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  + tag
                </button>
              )}
            </div>

            {/* Actions based on connection status */}
            {isConnected ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="datetime-local"
                  defaultValue={post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : ''}
                  onChange={e => handleScheduleChange(post.id, e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                />
                <button
                  onClick={() => handleSchedule(post.id)}
                  disabled={post.status === 'scheduled' || post.status === 'published'}
                  className="rounded-lg bg-[oklch(0.55_0.1_240)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-[oklch(0.60_0.1_240)] transition-colors flex items-center gap-1.5"
                >
                  <Calendar className="h-3 w-3" />
                  Schedule
                </button>
                <button
                  onClick={() => handlePublishNow(post.id)}
                  disabled={post.status === 'published'}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-emerald-500 transition-colors flex items-center gap-1.5"
                >
                  <Send className="h-3 w-3" />
                  Publish Now
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCaption(post)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  {copiedId === post.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Caption
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownload(post.id)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3 w-3" />
                  Download Caption + Media
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
