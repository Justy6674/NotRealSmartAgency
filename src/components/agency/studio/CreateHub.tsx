'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  PenLine,
  CalendarDays,
  Video,
  Palette,
  Target,
  Repeat,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { VideoCreator } from './VideoCreator'

// ─── Intent Cards ────────────────────────────────────────────────────────────

const INTENT_CARDS = [
  {
    icon: PenLine,
    colour: 'bg-blue-500/15 text-blue-400',
    title: 'Write a Post',
    description: 'The Director will write platform-optimised content for your channels.',
    message: (brand: string) => `Write a social media post for ${brand}`,
  },
  {
    icon: CalendarDays,
    colour: 'bg-orange-500/15 text-orange-400',
    title: 'Fill My Calendar',
    description: 'Generate a week of scheduled posts across all your platforms.',
    message: (brand: string) => `Fill my content calendar for the next 7 days for ${brand}`,
  },
  {
    icon: Video,
    colour: 'bg-red-500/15 text-red-400',
    title: 'Create a Video',
    description: 'Write a script and generate a professional AI presenter video.',
    message: (brand: string) => `Create a video for ${brand}`,
  },
  {
    icon: Palette,
    colour: 'bg-purple-500/15 text-purple-400',
    title: 'Design in Canva',
    description: 'Create graphics, social posts, and brand assets with Canva.',
    message: (brand: string) => `Design a graphic for ${brand}`,
  },
  {
    icon: Target,
    colour: 'bg-amber-500/15 text-amber-400',
    title: 'Run a Campaign',
    description: 'Plan and launch a full multi-channel marketing campaign.',
    message: (brand: string) => `Plan a full marketing campaign for ${brand}`,
  },
  {
    icon: Repeat,
    colour: 'bg-emerald-500/15 text-emerald-400',
    title: 'Repurpose Content',
    description: 'Turn existing content into posts, clips, blogs, and newsletters.',
    message: (brand: string) => `Repurpose my latest content across all platforms for ${brand}`,
  },
]

// ─── Quick Post (Power User) ─────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'X' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
] as const

type PostStatus = 'draft' | 'scheduled'

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateHub() {
  const router = useRouter()
  const { activeBrandId, setChatPanelOpen, setPendingReviewMessage } = useAgencyStore()

  // Quick Post state
  const [quickPostOpen, setQuickPostOpen] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [hashtagsInput, setHashtagsInput] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [postStatus, setPostStatus] = useState<PostStatus>('draft')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)

  // Brand name for messages
  const [brandName, setBrandName] = useState('my brand')
  useEffect(() => {
    if (activeBrandId) {
      fetch('/api/brands')
        .then(r => r.ok ? r.json() : [])
        .then(brands => {
          const match = (brands as Array<{ id: string; name: string }>).find(b => b.id === activeBrandId)
          if (match) setBrandName(match.name)
        })
        .catch(() => {})
    }
  }, [activeBrandId])

  if (!activeBrandId) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Select a brand from the sidebar to start creating content.
          </p>
        </div>
      </div>
    )
  }

  const handleIntent = (message: string) => {
    setPendingReviewMessage(message)
    router.push('/agency/chat')
  }

  function togglePlatform(platformId: string) {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  function parseHashtags(input: string): string[] {
    return input.split(',').map(tag => tag.trim()).filter(Boolean)
  }

  async function handleCreatePost() {
    if (!activeBrandId) return
    if (selectedPlatforms.length === 0) {
      setSubmitResult({ success: false, message: 'Select at least one platform.' })
      return
    }
    if (!caption.trim()) {
      setSubmitResult({ success: false, message: 'Write a caption first.' })
      return
    }

    setSubmitting(true)
    setSubmitResult(null)

    const hashtags = parseHashtags(hashtagsInput)
    const errors: string[] = []
    let successCount = 0

    for (const platform of selectedPlatforms) {
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: activeBrandId,
            platform,
            caption: caption.trim(),
            hashtags,
            scheduled_at: scheduledAt || new Date().toISOString(),
            status: postStatus,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          errors.push(`${platform}: ${data.error || 'Failed'}`)
        } else {
          successCount++
        }
      } catch {
        errors.push(`${platform}: Network error`)
      }
    }

    setSubmitting(false)

    if (errors.length === 0) {
      setSubmitResult({
        success: true,
        message: `Created ${successCount} post${successCount > 1 ? 's' : ''} successfully.`,
      })
      setSelectedPlatforms([])
      setCaption('')
      setHashtagsInput('')
      setScheduledAt('')
      setPostStatus('draft')
    } else {
      setSubmitResult({ success: false, message: errors.join('; ') })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Create Content</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell the Director what you need — they&apos;ll handle the rest.
        </p>
      </div>

      {/* Intent Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTENT_CARDS.map(card => {
          const Icon = card.icon
          return (
            <button
              key={card.title}
              onClick={() => handleIntent(card.message(brandName))}
              className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 space-y-3"
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.colour)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Quick Post — Collapsible Power User Section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setQuickPostOpen(!quickPostOpen)}
          className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors"
        >
          <span className="text-sm font-medium text-muted-foreground">Quick Post (manual)</span>
          {quickPostOpen
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </button>

        {quickPostOpen && (
          <div className="border-t border-border px-5 py-4 space-y-4">
            {/* Platform pills */}
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePlatform(id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selectedPlatforms.includes(id)
                      ? 'bg-primary/15 text-foreground ring-1 ring-primary/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Caption */}
            <div>
              <textarea
                rows={3}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write your post..."
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground/60">{caption.length} characters</p>
            </div>

            {/* Hashtags + Schedule */}
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={hashtagsInput}
                onChange={e => setHashtagsInput(e.target.value)}
                placeholder="Hashtags (comma-separated)"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30 [color-scheme:dark]"
              />
            </div>

            {/* Status + Submit */}
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="post-status"
                    value="draft"
                    checked={postStatus === 'draft'}
                    onChange={() => setPostStatus('draft')}
                    className="accent-primary"
                  />
                  Draft
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="post-status"
                    value="scheduled"
                    checked={postStatus === 'scheduled'}
                    onChange={() => setPostStatus('scheduled')}
                    className="accent-primary"
                  />
                  Schedule
                </label>
              </div>

              <button
                type="button"
                onClick={handleCreatePost}
                disabled={submitting}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                  submitting
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary/15 text-foreground hover:bg-primary/25'
                )}
              >
                {submitting ? 'Creating...' : 'Create Post'}
              </button>
            </div>

            {/* Result message */}
            {submitResult && (
              <p className={cn('text-xs', submitResult.success ? 'text-emerald-400' : 'text-red-400')}>
                {submitResult.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
