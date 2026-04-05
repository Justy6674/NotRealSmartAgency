'use client'

import { useState, useCallback } from 'react'
import { Sparkles, CalendarPlus, Loader2 } from 'lucide-react'
import { SourceSelector } from './SourceSelector'
import { TransformCard, PLATFORM_META } from './TransformCard'
import type { TransformPlatform, TransformStatus } from './TransformCard'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'

const ALL_TRANSFORM_PLATFORMS: TransformPlatform[] = [
  'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube', 'email', 'blog',
]

interface SourceData {
  type: 'output' | 'text' | 'url'
  title: string
  content: string
  outputId?: string
}

interface TransformResult {
  platform: TransformPlatform
  content: string
  status: TransformStatus
}

export function RepurposeRoom() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  const [source, setSource] = useState<SourceData | null>(null)
  const [transforms, setTransforms] = useState<TransformResult[]>(
    ALL_TRANSFORM_PLATFORMS.map(p => ({ platform: p, content: '', status: 'pending' as TransformStatus })),
  )
  const [addingAll, setAddingAll] = useState(false)

  const handleSourceSelect = useCallback((src: SourceData) => {
    setSource(src)
    // Reset all transforms when source changes
    setTransforms(ALL_TRANSFORM_PLATFORMS.map(p => ({ platform: p, content: '', status: 'pending' })))
  }, [])

  const handleGenerateAll = useCallback(() => {
    if (!source) return

    // Mark all as generating
    setTransforms(prev => prev.map(t => ({ ...t, status: 'generating' as TransformStatus })))

    const platformList = ALL_TRANSFORM_PLATFORMS
      .map(p => PLATFORM_META[p].label)
      .join(', ')

    const message = [
      `Repurpose the following content into ${ALL_TRANSFORM_PLATFORMS.length} platform variants:`,
      `Platforms: ${platformList}`,
      '',
      `Source (${source.type}): "${source.title}"`,
      '---',
      source.content.slice(0, 3000),
      source.content.length > 3000 ? '\n[Content truncated]' : '',
      '---',
      '',
      strategyContext?.agentContext ?? '',
      '',
      `For each platform, write the full adapted content respecting character limits and platform conventions.`,
      `Format each as: **[Platform Name]**\n[Content]\n\n`,
      `Maintain brand voice. Add platform-appropriate hashtags. Check compliance.`,
    ].filter(Boolean).join('\n')

    sendToDirector(message)
  }, [source, strategyContext])

  const handleEdit = useCallback((platform: TransformPlatform, newContent: string) => {
    setTransforms(prev =>
      prev.map(t => t.platform === platform ? { ...t, content: newContent } : t),
    )
  }, [])

  const handleSchedule = useCallback(async (platform: TransformPlatform, content: string) => {
    if (!activeBrandId) return

    // Map repurpose platforms to PostPlatform (email and blog save as outputs, not scheduled posts)
    if (platform === 'email' || platform === 'blog') {
      await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          outputType: platform === 'email' ? 'email_campaign' : 'blog_post',
          title: `Repurposed: ${source?.title ?? 'Untitled'} (${PLATFORM_META[platform].label})`,
          content,
          contentType: strategyContext?.suggestedContentType ?? null,
          contentPillar: strategyContext?.suggestedPillar ?? null,
        }),
      })
    } else {
      // Determine the nearest PostPlatform value
      const postPlatform = platform as 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube'

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)

      await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          platform: postPlatform,
          caption: content,
          hashtags: [],
          status: 'draft',
          scheduledAt: tomorrow.toISOString(),
          contentType: strategyContext?.suggestedContentType ?? null,
          contentPillar: strategyContext?.suggestedPillar ?? null,
        }),
      })
    }

    data.refetch()
  }, [activeBrandId, source, strategyContext, data])

  const handleAddAllToCalendar = useCallback(async () => {
    const doneTransforms = transforms.filter(t => t.status === 'done' && t.content.trim())
    if (doneTransforms.length === 0) return

    setAddingAll(true)
    try {
      await Promise.all(
        doneTransforms.map(t => handleSchedule(t.platform, t.content)),
      )
    } finally {
      setAddingAll(false)
    }
  }, [transforms, handleSchedule])

  const hasDoneTransforms = transforms.some(t => t.status === 'done' && t.content.trim())

  return (
    <div className="flex flex-col gap-5">
      {/* Source selector */}
      <SourceSelector
        brandId={activeBrandId}
        onSourceSelect={handleSourceSelect}
        selectedSourceId={source?.outputId ?? null}
      />

      {/* Selected source preview */}
      {source && (
        <div className="rounded-lg border border-[oklch(0.75_0.06_240)/0.3] bg-[oklch(0.75_0.06_240)/0.05] px-4 py-3">
          <p className="text-[10px] font-medium text-[oklch(0.75_0.06_240)] uppercase tracking-wider mb-1">
            Selected Source
          </p>
          <p className="text-xs font-semibold text-foreground">{source.title}</p>
          <p className="text-[11px] text-foreground/60 line-clamp-3 mt-1 font-[family-name:var(--font-ibm-plex-sans)]">
            {source.content.slice(0, 200)}{source.content.length > 200 ? '...' : ''}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {source && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGenerateAll}
            className="flex items-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Generate All Variants
          </button>

          {hasDoneTransforms && (
            <button
              type="button"
              onClick={handleAddAllToCalendar}
              disabled={addingAll}
              className="flex items-center gap-2 rounded-lg bg-[oklch(0.22_0.03_240)] px-5 py-2.5 text-sm font-medium text-foreground hover:bg-[oklch(0.28_0.03_240)] disabled:opacity-40 transition-colors"
            >
              {addingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              Add All to Calendar
            </button>
          )}
        </div>
      )}

      {/* Transform cards grid */}
      {source && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {transforms.map(t => (
            <TransformCard
              key={t.platform}
              platform={t.platform}
              content={t.content}
              status={t.status}
              onSchedule={handleSchedule}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!source && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <p className="text-sm text-muted-foreground">Select content to repurpose</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
            Choose from your past outputs or paste any content. The AI will transform it into {ALL_TRANSFORM_PLATFORMS.length} platform-specific variants.
          </p>
        </div>
      )}
    </div>
  )
}
