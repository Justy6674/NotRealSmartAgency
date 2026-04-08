'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Send, Loader2, Save, Calendar, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { ContentTypeSection, type ContentType } from './ContentTypeSection'
import { PlatformSection } from './PlatformSection'
import { MediaSection } from './MediaSection'
import { PostEditor } from './PostEditor'
import { PlatformVersionEditor } from './PlatformVersionEditor'
import { HashtagSection } from './HashtagSection'
import { PostTemplatePicker } from '../templates/PostTemplatePicker'
import { ComplianceSection } from './ComplianceSection'
import { MultiPlatformPreview } from '../preview/MultiPlatformPreview'
import { createVersionsFromMaster, customisePlatform, updateMasterCaption, type PostVersions } from '@/lib/post-versions'
import type { PostPlatform, PostType } from '@/types/database'

// ─── Director Assist Button ────────────────────────────────────────────────────
// Sends a contextual prompt to the REAL Director agent in the chat panel.
// The Director may delegate to Content, Brand, Compliance, or call a meeting.
function DirectorAssist({ prompt, label }: { prompt: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => sendToDirector(prompt)}
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
    >
      <Sparkles className="h-3 w-3" />
      {label ?? 'Ask Director'}
    </button>
  )
}

// ─── Content type → Post type mapping ──────────────────────────────────────────
const CONTENT_TO_POST_TYPE: Record<ContentType, PostType> = {
  post: 'single',
  carousel: 'carousel',
  short_video: 'reel',
  long_video: 'video',
  story: 'single',
  ad: 'single',
}

// ─── Card wrapper (Scent Sell pattern) ─────────────────────────────────────────
function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
      {children}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function PostComposerRoom() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Form state
  const [contentType, setContentType] = useState<ContentType>('post')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PostPlatform[]>(['instagram'])
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [versions, setVersions] = useState<PostVersions>({})
  const [aiPrompt, setAiPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [compliancePassed, setCompliancePassed] = useState<boolean | null>(null)

  const brandName = data.brand?.name ?? 'Brand'
  const postType = CONTENT_TO_POST_TYPE[contentType]
  const complianceFlags = data.brand?.compliance_flags as unknown as Record<string, boolean> | null
  const isHealthBrand = !!complianceFlags?.ahpra || !!complianceFlags?.tga

  // ── AI Generation ──────────────────────────────────────────────────────────
  const handleAiGenerate = () => {
    const platformNames = selectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
    const message = [
      `Write a ${contentType.replace('_', ' ')} for ${platformNames || 'social media'} for ${brandName}.`,
      aiPrompt.trim() ? `Topic: ${aiPrompt.trim()}` : '',
      strategyContext?.agentContext ?? '',
      'Return the caption text with suggested hashtags. I will paste it into my post composer.',
    ].filter(Boolean).join('\n\n')
    sendToDirector(message)
  }

  const handleAiAction = (action: string) => {
    if (!caption.trim()) return
    sendToDirector(`${action} this caption for ${brandName}:\n\n"${caption}"\n\nReturn only the improved caption text.`)
  }

  // ── Caption + Hashtag Updates ──────────────────────────────────────────────
  const handleCaptionChange = (text: string) => {
    setCaption(text)
    if (selectedPlatforms.length > 1) {
      setVersions(updateMasterCaption(versions, text, hashtags))
    }
  }

  const handlePlatformsChange = (platforms: PostPlatform[]) => {
    setSelectedPlatforms(platforms)
    setVersions(createVersionsFromMaster(platforms, caption, hashtags))
  }

  const handleVersionsChange = (newVersions: PostVersions) => {
    setVersions(newVersions)
  }

  const handleTemplateApply = (templateCaption: string, templateHashtags: string[]) => {
    setCaption(templateCaption)
    setHashtags(prev => [...new Set([...prev, ...templateHashtags])])
  }

  // ── Save / Schedule / Publish ──────────────────────────────────────────────
  const handleSave = useCallback(async (mode: 'draft' | 'schedule' | 'now', scheduledAt?: string) => {
    if (!activeBrandId || !caption.trim()) return
    setSaving(true)

    try {
      if (mode === 'now') {
        const platformNames = selectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
        sendToDirector(`Review and publish this post to ${platformNames}:\n\n${caption}\n\n${hashtags.map(h => `#${h}`).join(' ')}\n\nCheck compliance and brand voice, then publish when ready.`)
        return
      }

      for (const platform of selectedPlatforms) {
        await fetch('/api/scheduled-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: activeBrandId,
            platform,
            caption,
            hashtags: hashtags.map(h => `#${h}`),
            status: mode === 'draft' ? 'draft' : 'scheduled',
            scheduled_at: scheduledAt ?? new Date().toISOString(),
            post_type: postType,
            media_item_ids: selectedMediaIds,
            content_type: strategyContext?.suggestedContentType ?? undefined,
            content_pillar: strategyContext?.suggestedPillar ?? undefined,
          }),
        })
      }
      data.refetch()
      // Reset form after successful save
      if (mode === 'schedule') {
        setCaption('')
        setHashtags([])
        setSelectedMediaIds([])
        setAiPrompt('')
      }
    } finally {
      setSaving(false)
    }
  }, [activeBrandId, caption, hashtags, selectedPlatforms, postType, selectedMediaIds, strategyContext, data])

  // ── Schedule state ─────────────────────────────────────────────────────────
  const [scheduleMode, setScheduleMode] = useState<'draft' | 'schedule' | 'now'>('draft')
  const [scheduledAt, setScheduledAt] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow.toISOString().slice(0, 16)
  })

  // ── No brand selected ──────────────────────────────────────────────────────
  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Select a brand from the sidebar to start creating content.</p>
      </div>
    )
  }

  // ── Media URL for preview ──────────────────────────────────────────────────
  // We don't have the URL from media IDs easily, pass undefined for now
  const mediaUrl: string | undefined = undefined

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* LEFT: Form sections */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Section 1: Content Type */}
        <Section>
          <div className="flex items-center justify-between mb-3">
            <div />
            <DirectorAssist
              prompt={`What type of content should ${brandName} create right now? Consider our strategy, what's performing well, and what we haven't posted recently. Suggest a content type and explain why.`}
              label="What should I create?"
            />
          </div>
          <ContentTypeSection value={contentType} onChange={setContentType} />
        </Section>

        {/* Section 2: Platforms */}
        <Section>
          <div className="flex items-center justify-between mb-1">
            <div />
            <DirectorAssist
              prompt={`Which platforms need content most for ${brandName} right now? Look at our posting frequency, engagement, and strategy. Tell me where to focus.`}
              label="Where should I post?"
            />
          </div>
          <PlatformSection
            contentType={contentType}
            selected={selectedPlatforms}
            onChange={handlePlatformsChange}
          />
        </Section>

        {/* Section 3: Media */}
        <Section>
          <div className="flex items-center justify-between mb-1">
            <div />
            <DirectorAssist
              prompt={`I'm building a ${contentType.replace('_', ' ')} for ${selectedPlatforms.join(', ') || 'social media'}. Review my media library for ${brandName} and suggest which images or videos would work best. Consider brand guidelines and platform requirements.`}
              label="Review my media"
            />
          </div>
          <MediaSection
            contentType={contentType}
            brandId={activeBrandId}
            selectedMediaIds={selectedMediaIds}
            onChange={setSelectedMediaIds}
          />
        </Section>

        {/* Section 4: Caption */}
        <Section>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Caption</h3>
              <DirectorAssist
                prompt={`Write a ${contentType.replace('_', ' ')} caption for ${brandName} on ${selectedPlatforms.join(', ') || 'social media'}.${aiPrompt ? ` Topic: ${aiPrompt}` : ''} Use our brand voice and content strategy. If you need the Content team or Brand team for this, bring them in.`}
                label="Write my caption"
              />
            </div>

            {/* AI Prompt */}
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAiGenerate() }}
                placeholder={strategyContext?.suggestion ?? 'What should this post be about?'}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={selectedPlatforms.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
            </div>

            {/* Editor */}
            <PostEditor
              content={caption}
              onContentChange={handleCaptionChange}
              selectedPlatforms={selectedPlatforms}
              onPlatformsChange={handlePlatformsChange}
              hashtags={hashtags.map(h => `#${h}`).join(' ')}
              onHashtagsChange={() => {}}
            />

            {/* AI action buttons */}
            <div className="flex flex-wrap gap-2">
              {['Make punchier', 'Add a hook', 'Shorten it', 'Make longer', 'More professional'].map(action => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleAiAction(action)}
                  disabled={!caption.trim()}
                  className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Template picker */}
            <div className="flex items-center gap-2">
              <PostTemplatePicker
                brandId={activeBrandId}
                brandName={brandName}
                onApply={handleTemplateApply}
              />
            </div>
          </div>
        </Section>

        {/* Section 5: Per-Platform Versions (only if 2+ platforms) */}
        {selectedPlatforms.length >= 2 && (
          <Section>
            <PlatformVersionEditor
              platforms={selectedPlatforms}
              masterCaption={caption}
              masterHashtags={hashtags}
              versions={versions}
              onMasterChange={(c, h) => { setCaption(c); setHashtags(h) }}
              onVersionsChange={handleVersionsChange}
            />
          </Section>
        )}

        {/* Section 6: Hashtags */}
        <Section>
          <div className="flex items-center justify-between mb-1">
            <div />
            <DirectorAssist
              prompt={`Suggest the best hashtags for this ${contentType.replace('_', ' ')} on ${selectedPlatforms.join(', ')} for ${brandName}.${caption ? ` The caption is: "${caption.slice(0, 200)}"` : ''} Get the SEO team involved if needed — I want hashtags that actually drive discovery, not just filler.`}
              label="Director picks hashtags"
            />
          </div>
          <HashtagSection
            brandId={activeBrandId}
            hashtags={hashtags}
            onChange={setHashtags}
            selectedPlatforms={selectedPlatforms}
            caption={caption}
          />
        </Section>

        {/* Section 7: Compliance */}
        <Section>
          <div className="flex items-center justify-between mb-1">
            <div />
            <DirectorAssist
              prompt={`Review this post for ${brandName} before I publish it. Check for AHPRA/TGA compliance, brand voice, and anything that could get us in trouble. The caption is:\n\n"${caption}"\n\nHashtags: ${hashtags.map(h => `#${h}`).join(' ')}\n\nPlatforms: ${selectedPlatforms.join(', ')}\n\nBring in the Compliance team if needed. This is a healthcare brand — $60K per offence.`}
              label="Full review"
            />
          </div>
          <ComplianceSection
            caption={caption}
            brandName={brandName}
            isHealthBrand={isHealthBrand}
            onResult={result => setCompliancePassed(result === null ? null : result.isValid)}
          />
        </Section>

        {/* Section 8: Schedule — Sticky Action Bar (Scent Sell pattern) */}
        <div className="sticky bottom-4 rounded-xl border border-border bg-background/95 backdrop-blur-sm p-4 shadow-lg space-y-3">
          {/* Schedule mode selector */}
          {scheduleMode === 'schedule' && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setScheduleMode('draft'); handleSave('draft') }}
              disabled={saving || !caption.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              {saving && scheduleMode === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => {
                setScheduleMode('schedule')
                if (scheduleMode === 'schedule') handleSave('schedule', scheduledAt)
              }}
              disabled={saving || !caption.trim() || selectedPlatforms.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
            >
              {saving && scheduleMode === 'schedule' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              {scheduleMode === 'schedule' ? 'Confirm Schedule' : 'Schedule'}
            </button>
            <button
              type="button"
              onClick={() => { setScheduleMode('now'); handleSave('now') }}
              disabled={saving || !caption.trim() || selectedPlatforms.length === 0 || compliancePassed === false}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {saving && scheduleMode === 'now' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Publish Now
            </button>
          </div>

          {/* Compliance indicator + help text */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Save Draft keeps it private. Schedule queues it. Publish sends immediately via Mixpost.
            </p>
            {compliancePassed === false && (
              <span className="text-[10px] text-red-400 font-medium">Compliance issues — fix before publishing</span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Live Preview (hidden on mobile) */}
      <div className="hidden lg:block w-[360px] shrink-0 border-l border-border overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Preview</h3>
        <MultiPlatformPreview
          platforms={selectedPlatforms}
          masterCaption={caption}
          masterHashtags={hashtags}
          versions={versions}
          mediaUrl={mediaUrl}
          brandName={brandName}
        />
        {selectedPlatforms.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Select platforms to see previews.</p>
        )}
      </div>
    </div>
  )
}
