'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  CalendarDays,
  FileText,
  Copy,
  Check,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import type { StudioItem } from './StudioFeedCard'

// ─── Platform Icons ──────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: CalendarDays,
  youtube: Youtube,
}

// ─── Status Badge Colours ────────────────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-400',
  scheduled: 'bg-blue-500/15 text-blue-400',
  publishing: 'bg-amber-500/15 text-amber-400',
  published: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-zinc-500/15 text-zinc-500',
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PostDetailPanelProps {
  item: StudioItem
  onClose: () => void
  onUpdated: () => void
}

export function PostDetailPanel({ item, onClose, onUpdated }: PostDetailPanelProps) {
  const { setChatPanelOpen, setPendingReviewMessage } = useAgencyStore()

  // ── Local edit state ─────────────────────────────────────────────────────
  const [editedCaption, setEditedCaption] = useState(item.caption)
  const [editedHashtags, setEditedHashtags] = useState<string[]>(item.hashtags ?? [])
  const [editedSchedule, setEditedSchedule] = useState(
    item.scheduledAt ? toDatetimeLocalValue(item.scheduledAt) : '',
  )
  const [hashtagInput, setHashtagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset local state when item changes
  useEffect(() => {
    setEditedCaption(item.caption)
    setEditedHashtags(item.hashtags ?? [])
    setEditedSchedule(item.scheduledAt ? toDatetimeLocalValue(item.scheduledAt) : '')
    setHashtagInput('')
  }, [item.id, item.caption, item.hashtags, item.scheduledAt])

  // ── Dirty check ──────────────────────────────────────────────────────────
  const isDirty =
    editedCaption !== item.caption ||
    JSON.stringify(editedHashtags) !== JSON.stringify(item.hashtags ?? []) ||
    editedSchedule !== (item.scheduledAt ? toDatetimeLocalValue(item.scheduledAt) : '')

  // ── Save handler ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { id: item.id }
      if (editedCaption !== item.caption) body.caption = editedCaption
      if (JSON.stringify(editedHashtags) !== JSON.stringify(item.hashtags ?? [])) {
        body.hashtags = editedHashtags
      }
      if (editedSchedule && editedSchedule !== (item.scheduledAt ? toDatetimeLocalValue(item.scheduledAt) : '')) {
        body.scheduled_at = new Date(editedSchedule).toISOString()
      }

      const res = await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
      onUpdated()
    } catch (err) {
      console.error('PostDetailPanel save error:', err)
    } finally {
      setSaving(false)
    }
  }, [isDirty, saving, item, editedCaption, editedHashtags, editedSchedule, onUpdated])

  // ── Status action handler ────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setSaving(true)
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, status: newStatus }),
        })
        if (!res.ok) throw new Error('Failed to update status')
        onUpdated()
      } catch (err) {
        console.error('PostDetailPanel status error:', err)
      } finally {
        setSaving(false)
      }
    },
    [item.id, onUpdated],
  )

  // ── Ask Agent ────────────────────────────────────────────────────────────
  const handleAskAgent = useCallback(() => {
    const platform = item.platform ?? 'social media'
    const message =
      item.type === 'post'
        ? `Improve this post caption for ${platform}: ${editedCaption}`
        : `Improve this ${item.outputType ?? 'output'}: ${item.caption}`
    setPendingReviewMessage(message)
    setChatPanelOpen(true)
  }, [item, editedCaption, setPendingReviewMessage, setChatPanelOpen])

  // ── Copy ─────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(item.caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [item.caption])

  // ── Hashtag helpers ──────────────────────────────────────────────────────
  const addHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, '')
    if (tag && !editedHashtags.includes(tag)) {
      setEditedHashtags((prev) => [...prev, tag])
    }
    setHashtagInput('')
  }, [hashtagInput, editedHashtags])

  const removeHashtag = useCallback((tag: string) => {
    setEditedHashtags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const PlatformIcon = item.platform ? PLATFORM_ICONS[item.platform] ?? CalendarDays : FileText
  const statusClass = item.status ? STATUS_CLASSES[item.status] ?? STATUS_CLASSES.draft : null

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l bg-card">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <PlatformIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {item.type === 'post' ? item.platform ?? 'Post' : item.outputType ?? 'Output'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {item.type === 'post' ? (
          <>
            {/* Caption */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Caption</label>
              <textarea
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                rows={5}
                className={cn(
                  'w-full resize-none rounded-md border bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary',
                )}
                placeholder="Write your caption..."
              />
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Hashtags</label>
              <div className="flex flex-wrap gap-1">
                {editedHashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeHashtag(tag)}
                      className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addHashtag()
                    }
                  }}
                  placeholder="Add hashtag..."
                  className={cn(
                    'flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs',
                    'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary',
                  )}
                />
                <button
                  type="button"
                  onClick={addHashtag}
                  className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Schedule</label>
              <input
                type="datetime-local"
                value={editedSchedule}
                onChange={(e) => setEditedSchedule(e.target.value)}
                className={cn(
                  'w-full rounded-md border bg-background px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary',
                )}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2">
                {statusClass && item.status && (
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                      statusClass,
                    )}
                  >
                    {item.status}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.status === 'draft' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange('scheduled')}
                    className="rounded-md bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25"
                  >
                    Schedule
                  </button>
                )}
                {(item.status === 'draft' || item.status === 'scheduled') && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange('cancelled')}
                    className="rounded-md bg-zinc-500/15 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-500/25"
                  >
                    Cancel
                  </button>
                )}
                {item.status === 'failed' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleStatusChange('scheduled')}
                    className="rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/25"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>

            {/* Save button */}
            {isDirty && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className={cn(
                  'w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
                  'transition-colors hover:bg-primary/90 disabled:opacity-50',
                )}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}

            {/* Ask Agent */}
            <button
              type="button"
              onClick={handleAskAgent}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm',
                'font-medium text-foreground transition-colors hover:bg-muted/50',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Agent to Improve
            </button>
          </>
        ) : (
          /* ── Output read-only view ───────────────────────────────────── */
          <>
            {/* Output type badge */}
            {item.outputType && (
              <span className="inline-flex rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-400">
                {item.outputType}
              </span>
            )}

            {/* Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Content</label>
              <div className="max-h-80 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm text-foreground whitespace-pre-wrap">
                {item.caption}
              </div>
            </div>

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm',
                'font-medium text-foreground transition-colors hover:bg-muted/50',
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>

            {/* Ask Agent */}
            <button
              type="button"
              onClick={handleAskAgent}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm',
                'font-medium text-foreground transition-colors hover:bg-muted/50',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Agent to Improve
            </button>
          </>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="border-t px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Convert an ISO string to the value format for datetime-local inputs (YYYY-MM-DDTHH:MM) */
function toDatetimeLocalValue(isoString: string): string {
  const d = new Date(isoString)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
