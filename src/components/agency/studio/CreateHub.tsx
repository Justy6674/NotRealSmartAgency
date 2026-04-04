'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { VideoCreator } from './VideoCreator'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'twitter', label: 'X' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
] as const

type PostStatus = 'draft' | 'scheduled'

export function CreateHub() {
  const router = useRouter()
  const { activeBrandId, setChatPanelOpen, setPendingReviewMessage } = useAgencyStore()

  // Quick Post state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [hashtagsInput, setHashtagsInput] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [postStatus, setPostStatus] = useState<PostStatus>('draft')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)

  // AI Generate state
  const [aiPrompt, setAiPrompt] = useState('')

  // Video creator visibility
  const [showVideoCreator, setShowVideoCreator] = useState(false)

  if (!activeBrandId) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-sm text-white/50">
            Select a brand from the sidebar to start creating content.
          </p>
        </div>
      </div>
    )
  }

  function togglePlatform(platformId: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    )
  }

  function parseHashtags(input: string): string[] {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
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
      // Reset form
      setSelectedPlatforms([])
      setCaption('')
      setHashtagsInput('')
      setScheduledAt('')
      setPostStatus('draft')
    } else {
      setSubmitResult({
        success: false,
        message: errors.join('; '),
      })
    }
  }

  function handleAiGenerate() {
    if (!aiPrompt.trim()) return
    setChatPanelOpen(true)
    setPendingReviewMessage(`Fill my content calendar with posts about: ${aiPrompt.trim()}`)
    setAiPrompt('')
  }

  function handleBrowseCanva() {
    setChatPanelOpen(true)
    setPendingReviewMessage('Search my Canva designs and show me what\'s available')
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Create New Content</h2>
        <p className="mt-1 text-sm text-white/50">
          Write a quick post, generate content with AI, create videos, or pull in designs from Canva.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Quick Post */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Quick Post</h3>
            <p className="mt-1 text-xs text-white/40">Write and schedule a post across your platforms.</p>
          </div>

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
                    ? 'bg-white/20 text-white ring-1 ring-white/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Caption */}
          <div>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your post..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
            <p className="mt-1 text-right text-xs text-white/30">{caption.length} characters</p>
          </div>

          {/* Hashtags */}
          <input
            type="text"
            value={hashtagsInput}
            onChange={(e) => setHashtagsInput(e.target.value)}
            placeholder="Hashtags (comma-separated)"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />

          {/* Schedule */}
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]"
          />

          {/* Status radio */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
              <input
                type="radio"
                name="post-status"
                value="draft"
                checked={postStatus === 'draft'}
                onChange={() => setPostStatus('draft')}
                className="accent-white"
              />
              Save as Draft
            </label>
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
              <input
                type="radio"
                name="post-status"
                value="scheduled"
                checked={postStatus === 'scheduled'}
                onChange={() => setPostStatus('scheduled')}
                className="accent-white"
              />
              Schedule Now
            </label>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleCreatePost}
            disabled={submitting}
            className={cn(
              'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              submitting
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/15 text-white hover:bg-white/20'
            )}
          >
            {submitting ? 'Creating...' : 'Create Post'}
          </button>

          {/* Result message */}
          {submitResult && (
            <p
              className={cn(
                'text-xs',
                submitResult.success ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {submitResult.message}
            </p>
          )}
        </div>

        {/* Card 2: AI Generate */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">AI Generate</h3>
            <p className="mt-1 text-xs text-white/40">
              Describe what you want to post about and the Director will create optimised content across your platforms.
            </p>
          </div>

          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAiGenerate()
            }}
            placeholder="e.g. Announce our new telehealth feature"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />

          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={!aiPrompt.trim()}
            className={cn(
              'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              !aiPrompt.trim()
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/15 text-white hover:bg-white/20'
            )}
          >
            Generate
          </button>
        </div>

        {/* Card 3: AI Video */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">AI Video</h3>
            <p className="mt-1 text-xs text-white/40">
              Write a script and generate a professional video with an AI presenter.
            </p>
          </div>

          {!showVideoCreator ? (
            <button
              type="button"
              onClick={() => setShowVideoCreator(true)}
              className="w-full rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Create Video
            </button>
          ) : (
            <VideoCreator brandId={activeBrandId} />
          )}
        </div>

        {/* Card 4: Canva Designs */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Canva Designs</h3>
            <p className="mt-1 text-xs text-white/40">
              Browse your Canva account to find and use existing designs.
            </p>
          </div>

          <button
            type="button"
            onClick={handleBrowseCanva}
            className="w-full rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Browse Canva
          </button>
        </div>
      </div>
    </div>
  )
}
