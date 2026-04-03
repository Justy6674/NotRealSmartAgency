'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  X,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import type { ScheduledPost, PostPlatform } from '@/types/database'

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<PostPlatform, { label: string; icon: typeof Instagram; chipClass: string }> = {
  instagram: { label: 'Instagram', icon: Instagram, chipClass: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  facebook: { label: 'Facebook', icon: Facebook, chipClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, chipClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  twitter: { label: 'X', icon: Twitter, chipClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  tiktok: { label: 'TikTok', icon: CalendarDays, chipClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  youtube: { label: 'YouTube', icon: Youtube, chipClass: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  // Returns 0=Mon, 1=Tue, ..., 6=Sun (ISO week)
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Component ────────────────────────────────────────────────────────────────

export function ContentCalendar() {
  const { activeBrandId, setAgent, setPendingReviewMessage } = useAgencyStore()
  const router = useRouter()
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  // ── Fetch posts ──────────────────────────────────────────────────────────

  const fetchPosts = useCallback(async () => {
    if (!activeBrandId) {
      setPosts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const from = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`
    const to = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}T23:59:59.999Z`

    try {
      const params = new URLSearchParams({ brandId: activeBrandId, from, to })
      const res = await fetch(`/api/scheduled-posts?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setPosts(data)
    } catch (err) {
      console.error('[calendar] Failed to fetch posts:', err)
    } finally {
      setLoading(false)
    }
  }, [activeBrandId, viewYear, viewMonth])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // ── Navigation ───────────────────────────────────────────────────────────

  const goToPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
    setSelectedPost(null)
  }

  const goToNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
    setSelectedPost(null)
  }

  const goToToday = () => {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    setSelectedPost(null)
  }

  // ── Group posts by day ───────────────────────────────────────────────────

  const postsByDay: Record<string, ScheduledPost[]> = {}
  for (const post of posts) {
    const d = new Date(post.scheduled_at)
    const key = formatDate(d.getFullYear(), d.getMonth(), d.getDate())
    if (!postsByDay[key]) postsByDay[key] = []
    postsByDay[key].push(post)
  }

  // ── Calendar grid ────────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)
  const todayStr = formatDate(now.getFullYear(), now.getMonth(), now.getDate())

  const cells: { day: number | null; dateStr: string }[] = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: '' })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dateStr: formatDate(viewYear, viewMonth, d) })
  // Pad to complete the last week
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: '' })

  // ── No brand selected ────────────────────────────────────────────────────

  if (!activeBrandId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Select a brand to view the content calendar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* ── Calendar Grid ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-semibold min-w-[160px] text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <button
              onClick={goToNext}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Today
            </button>
            {activeBrandId && (
              <button
                onClick={() => {
                  setAgent('overall')
                  setPendingReviewMessage('Fill my calendar for the next 2 weeks with 5 posts per week across all my social platforms')
                  router.push('/agency/chat')
                }}
                className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Fill My Calendar
              </button>
            )}
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">Loading calendar...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px rounded-lg border border-border overflow-hidden bg-border">
            {cells.map((cell, i) => {
              const dayPosts = cell.dateStr ? postsByDay[cell.dateStr] ?? [] : []
              const isToday = cell.dateStr === todayStr

              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[100px] bg-card p-1.5 transition-colors',
                    cell.day === null && 'bg-muted/30',
                  )}
                >
                  {cell.day !== null && (
                    <>
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          isToday
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {cell.day}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayPosts.slice(0, 3).map((post) => (
                          <PostChip
                            key={post.id}
                            post={post}
                            isSelected={selectedPost?.id === post.id}
                            onClick={() => setSelectedPost(post)}
                          />
                        ))}
                        {dayPosts.length > 3 && (
                          <p className="px-1 text-[10px] text-muted-foreground">
                            +{dayPosts.length - 3} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No posts scheduled this month. Upload a video or ask the Director to fill your calendar.
            </p>
          </div>
        )}
      </div>

      {/* ── Detail Panel ──────────────────────────────────────────────────── */}
      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdate={(updated) => {
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            setSelectedPost(updated)
          }}
        />
      )}
    </div>
  )
}

// ─── Post Chip ────────────────────────────────────────────────────────────────

function PostChip({
  post,
  isSelected,
  onClick,
}: {
  post: ScheduledPost
  isSelected: boolean
  onClick: () => void
}) {
  const config = PLATFORM_CONFIG[post.platform]
  const Icon = config.icon
  const isDraft = post.status === 'draft'
  const isPublished = post.status === 'published'
  const isFailed = post.status === 'failed'

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] leading-tight border transition-colors',
        config.chipClass,
        isDraft && 'border-dashed',
        !isDraft && 'border-solid',
        isSelected && 'ring-1 ring-primary',
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate flex-1">{post.caption.slice(0, 30)}</span>
      {isPublished && <Check className="h-2.5 w-2.5 shrink-0 text-green-400" />}
      {isFailed && <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-400" />}
    </button>
  )
}

// ─── Post Detail Panel ────────────────────────────────────────────────────────

function PostDetail({
  post,
  onClose,
  onUpdate,
}: {
  post: ScheduledPost
  onClose: () => void
  onUpdate: (post: ScheduledPost) => void
}) {
  const [caption, setCaption] = useState(post.caption)
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '',
  )
  const [saving, setSaving] = useState(false)

  // Reset form when post changes
  useEffect(() => {
    setCaption(post.caption)
    setScheduledAt(post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '')
  }, [post.id, post.caption, post.scheduled_at])

  const config = PLATFORM_CONFIG[post.platform]
  const Icon = config.icon

  const hasChanges = caption !== post.caption || scheduledAt !== new Date(post.scheduled_at).toISOString().slice(0, 16)

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { id: post.id }
      if (caption !== post.caption) body.caption = caption
      if (scheduledAt !== new Date(post.scheduled_at).toISOString().slice(0, 16)) {
        body.scheduled_at = new Date(scheduledAt).toISOString()
      }

      const res = await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) onUpdate(data)
    } catch (err) {
      console.error('[calendar] Failed to save post:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, status }),
      })
      const data = await res.json()
      if (res.ok) onUpdate(data)
    } catch (err) {
      console.error('[calendar] Failed to update status:', err)
    } finally {
      setSaving(false)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-zinc-500/15 text-zinc-400',
      scheduled: 'bg-blue-500/15 text-blue-400',
      publishing: 'bg-amber-500/15 text-amber-400',
      published: 'bg-green-500/15 text-green-400',
      failed: 'bg-red-500/15 text-red-400',
      cancelled: 'bg-zinc-500/15 text-zinc-500',
    }
    return map[status] ?? 'bg-muted text-muted-foreground'
  }

  return (
    <div className="w-80 shrink-0 rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.chipClass.split(' ')[1])} />
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            statusBadge(post.status),
          )}
        >
          {post.status}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(post.scheduled_at)}
        </span>
      </div>

      {/* Caption */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Caption</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      {/* Hashtags */}
      {post.hashtags && post.hashtags.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Hashtags</label>
          <div className="flex flex-wrap gap-1">
            {post.hashtags.map((tag, i) => (
              <span
                key={i}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Schedule time */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Scheduled for</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}

        {post.status === 'draft' && (
          <button
            onClick={() => handleStatusChange('scheduled')}
            disabled={saving}
            className="w-full rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
          >
            Schedule
          </button>
        )}

        {(post.status === 'draft' || post.status === 'scheduled') && (
          <button
            onClick={() => handleStatusChange('cancelled')}
            disabled={saving}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel Post
          </button>
        )}
      </div>
    </div>
  )
}
