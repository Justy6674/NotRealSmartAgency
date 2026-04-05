'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, PenLine, FileText, Loader2, Send } from 'lucide-react'
import { PostEditor } from './PostEditor'
import { PlatformPreview } from './PlatformPreview'
import { PostScheduler } from './PostScheduler'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import type { PostPlatform, ScheduledPost } from '@/types/database'

type ComposerMode = 'ai' | 'write' | 'drafts'

interface DraftPost {
  id: string
  caption: string
  platform: PostPlatform
  hashtags: string[]
  scheduled_at: string
  created_at: string
}

export function PostComposerRoom() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  const [mode, setMode] = useState<ComposerMode>('ai')
  const [content, setContent] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PostPlatform[]>(['instagram'])
  const [aiPrompt, setAiPrompt] = useState('')
  const [drafts, setDrafts] = useState<DraftPost[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  // Fetch drafts when in drafts mode
  useEffect(() => {
    if (mode !== 'drafts' || !activeBrandId) return
    setLoadingDrafts(true)
    fetch(`/api/scheduled-posts?brandId=${activeBrandId}&status=draft`)
      .then(r => r.ok ? r.json() : [])
      .then((posts: ScheduledPost[]) => {
        setDrafts(posts.map(p => ({
          id: p.id,
          caption: p.caption,
          platform: p.platform,
          hashtags: p.hashtags,
          scheduled_at: p.scheduled_at,
          created_at: p.created_at,
        })))
      })
      .catch(() => setDrafts([]))
      .finally(() => setLoadingDrafts(false))
  }, [mode, activeBrandId])

  const handleAiGenerate = useCallback(() => {
    if (!aiPrompt.trim() && !strategyContext) return

    const platformNames = selectedPlatforms
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(', ')

    const message = [
      `Write a social media post for ${platformNames || 'my social channels'}.`,
      aiPrompt.trim() ? `Topic/instructions: ${aiPrompt.trim()}` : '',
      strategyContext?.agentContext ?? '',
      `Format: Return the post caption text only. Include suggested hashtags at the end.`,
    ].filter(Boolean).join('\n\n')

    sendToDirector(message)
  }, [aiPrompt, selectedPlatforms, strategyContext])

  const handleSave = useCallback(async (
    publishMode: 'draft' | 'schedule' | 'now',
    scheduledAt: string | null,
  ) => {
    if (!activeBrandId || !content.trim()) return

    if (publishMode === 'now') {
      // Send to Director for review and publishing
      const platformNames = selectedPlatforms
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(', ')

      const message = [
        `Review and publish this post to ${platformNames}:`,
        '',
        content,
        hashtags ? `\nHashtags: ${hashtags}` : '',
        '',
        `Please check compliance, brand voice, and publish when ready.`,
      ].join('\n')

      sendToDirector(message)
      return
    }

    // Save as draft or scheduled post via API
    for (const platform of selectedPlatforms) {
      await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          platform,
          caption: content,
          hashtags: hashtags.split(/\s+/).filter(h => h.startsWith('#')),
          status: publishMode === 'draft' ? 'draft' : 'scheduled',
          scheduledAt: scheduledAt ?? new Date().toISOString(),
          contentType: strategyContext?.suggestedContentType ?? null,
          contentPillar: strategyContext?.suggestedPillar ?? null,
        }),
      })
    }

    // Refresh studio data
    data.refetch()
  }, [activeBrandId, content, hashtags, selectedPlatforms, strategyContext, data])

  const handleLoadDraft = useCallback((draft: DraftPost) => {
    setContent(draft.caption)
    setHashtags(draft.hashtags.join(' '))
    setSelectedPlatforms([draft.platform])
    setMode('write')
  }, [])

  const tabs: { value: ComposerMode; label: string; icon: typeof Sparkles }[] = [
    { value: 'ai', label: 'AI Writes', icon: Sparkles },
    { value: 'write', label: 'I Write', icon: PenLine },
    { value: 'drafts', label: 'From Drafts', icon: FileText },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-[oklch(0.16_0.01_240)] p-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = mode === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setMode(tab.value)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                active
                  ? 'bg-[oklch(0.22_0.03_240)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* AI Writes mode */}
      {mode === 'ai' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left: prompt + platforms */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  What should the post be about?
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={
                    strategyContext?.suggestion
                      ? `Suggestion: ${strategyContext.suggestion}`
                      : 'Describe what you want the post to be about, or leave blank for AI to decide based on your strategy...'
                  }
                  rows={4}
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] resize-none font-[family-name:var(--font-ibm-plex-sans)]"
                />
              </div>

              {/* Platform selector (reuse PostEditor's layout) */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Platforms
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'] as PostPlatform[]).map(platform => {
                    const selected = selectedPlatforms.includes(platform)
                    const labels: Record<string, string> = {
                      instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
                      twitter: 'X', tiktok: 'TikTok', youtube: 'YouTube',
                    }
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() =>
                          selected
                            ? setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform))
                            : setSelectedPlatforms([...selectedPlatforms, platform])
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-[oklch(0.75_0.06_240)] text-[oklch(0.15_0.02_240)]'
                            : 'bg-[oklch(0.22_0.02_240)] text-muted-foreground hover:bg-[oklch(0.28_0.03_240)]'
                        }`}
                      >
                        {labels[platform]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={selectedPlatforms.length === 0}
                className="flex items-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
                Generate Post
              </button>

              <p className="text-[11px] text-muted-foreground/60">
                The Director will write your post in the chat panel, using your brand voice and strategy context. Copy the result back here to schedule it.
              </p>
            </div>

            {/* Right: preview (shows placeholder) */}
            <div className="flex-1 lg:max-w-sm">
              <PlatformPreview
                content={content}
                hashtags={hashtags}
                selectedPlatforms={selectedPlatforms}
                brandName={data.brand?.name ?? 'Brand'}
              />
            </div>
          </div>
        </div>
      )}

      {/* I Write mode */}
      {mode === 'write' && (
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left: editor */}
          <div className="flex-1 space-y-4">
            <PostEditor
              content={content}
              onContentChange={setContent}
              selectedPlatforms={selectedPlatforms}
              onPlatformsChange={setSelectedPlatforms}
              hashtags={hashtags}
              onHashtagsChange={setHashtags}
            />
          </div>

          {/* Right: preview */}
          <div className="flex-1 lg:max-w-sm">
            <PlatformPreview
              content={content}
              hashtags={hashtags}
              selectedPlatforms={selectedPlatforms}
              brandName={data.brand?.name ?? 'Brand'}
            />
          </div>
        </div>
      )}

      {/* From Drafts mode */}
      {mode === 'drafts' && (
        <div>
          {loadingDrafts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No drafts yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Save a post as draft first, or switch to &ldquo;AI Writes&rdquo; to generate one.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {drafts.map(draft => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => handleLoadDraft(draft)}
                  className="flex items-start gap-3 rounded-lg border border-border bg-[oklch(0.16_0.01_240)] p-4 text-left hover:bg-[oklch(0.19_0.01_240)] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 line-clamp-2 font-[family-name:var(--font-ibm-plex-sans)]">
                      {draft.caption || 'Empty draft'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] rounded-full bg-[oklch(0.22_0.02_240)] px-2 py-0.5 text-muted-foreground">
                        {draft.platform.charAt(0).toUpperCase() + draft.platform.slice(1)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(draft.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <PenLine className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduler (visible in AI and Write modes) */}
      {(mode === 'ai' || mode === 'write') && (
        <PostScheduler
          selectedPlatforms={selectedPlatforms}
          onSave={handleSave}
          disabled={!content.trim() && mode === 'write'}
        />
      )}
    </div>
  )
}
