'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, ImageIcon, Upload, Palette, Wand2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'

// Layout
import { ComposerLayout } from './ComposerLayout'

// New components (Scent Sell patterns)
import { StudioCard } from './StudioCard'
import { CreatorModeBar, type CreatorMode } from './CreatorModeBar'
import { CreatorActionBar } from './CreatorActionBar'
import { MediaSlots } from './MediaSlots'
import { StrategyContextBar } from './StrategyContextBar'

// Existing components (reused as-is)
import { ContentTypeSection, type ContentType } from './ContentTypeSection'
import { PlatformSection } from './PlatformSection'
import { PostEditor } from './PostEditor'
import { PlatformVersionEditor } from './PlatformVersionEditor'
import { HashtagSection } from './HashtagSection'
import { PostTemplatePicker } from '../templates/PostTemplatePicker'
import { ComplianceSection } from './ComplianceSection'
import { MultiPlatformPreview } from '../preview/MultiPlatformPreview'
import { MediaSelector } from './MediaSelector'

import { createVersionsFromMaster, customisePlatform, updateMasterCaption, type PostVersions } from '@/lib/post-versions'
import type { PostPlatform, PostType } from '@/types/database'

// ── Content type → Post type mapping ──────────────────────────────────────────
const CONTENT_TO_POST_TYPE: Record<ContentType, PostType> = {
  post: 'single',
  carousel: 'carousel',
  short_video: 'reel',
  long_video: 'video',
  story: 'single',
  ad: 'single',
}

// ── Media item shape (from API) ───────────────────────────────────────────────
interface MediaItem {
  id: string
  file_url: string
  file_type: string
  original_filename: string
}

/**
 * PostCreator — the main single-screen post creation experience.
 * Uses ComposerLayout for split-pane (editor left, preview right, action bar bottom).
 * Each section wrapped in StudioCard with DirectorAssist pills.
 * Scent Sell visual quality throughout.
 */
export function PostCreator() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Form state
  const [contentType, setContentType] = useState<ContentType>('post')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PostPlatform[]>(['instagram'])
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [versions, setVersions] = useState<PostVersions>({})
  const [aiPrompt, setAiPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [compliancePassed, setCompliancePassed] = useState<boolean | null>(null)
  const [creatorMode, setCreatorMode] = useState<CreatorMode>('fresh')
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)

  const brandName = data.brand?.name ?? 'Brand'
  const postType = CONTENT_TO_POST_TYPE[contentType]
  const complianceFlags = data.brand?.compliance_flags as unknown as Record<string, boolean> | null
  const isHealthBrand = !!complianceFlags?.ahpra || !!complianceFlags?.tga

  // ── Auto-save / restore draft from localStorage ────────────────────────
  const draftKey = activeBrandId ? `nrs-draft-${activeBrandId}` : null
  const isRestored = useRef(false)

  // Restore draft on mount
  useEffect(() => {
    if (!draftKey || isRestored.current) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.contentType) setContentType(draft.contentType)
        if (draft.selectedPlatforms?.length) setSelectedPlatforms(draft.selectedPlatforms)
        if (draft.selectedMediaIds?.length) setSelectedMediaIds(draft.selectedMediaIds)
        if (draft.caption) setCaption(draft.caption)
        if (draft.hashtags?.length) setHashtags(draft.hashtags)
        if (draft.aiPrompt) setAiPrompt(draft.aiPrompt)
        if (draft.creatorMode) setCreatorMode(draft.creatorMode)
      }
    } catch { /* ignore parse errors */ }
    isRestored.current = true
  }, [draftKey])

  // Auto-save draft on every change (debounced via effect)
  useEffect(() => {
    if (!draftKey || !isRestored.current) return
    const draft = { contentType, selectedPlatforms, selectedMediaIds, caption, hashtags, aiPrompt, creatorMode }
    try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* storage full */ }
  }, [draftKey, contentType, selectedPlatforms, selectedMediaIds, caption, hashtags, aiPrompt, creatorMode])

  // Fetch media items to populate slots
  useEffect(() => {
    if (!activeBrandId) return
    fetch(`/api/media?brandId=${activeBrandId}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setMediaItems(d.items ?? d ?? []))
      .catch(() => setMediaItems([]))
  }, [activeBrandId])

  // Build selected media with full data for slots
  const selectedMedia = selectedMediaIds
    .map(id => mediaItems.find(m => m.id === id))
    .filter((m): m is MediaItem => !!m)

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

  const handleTemplateApply = (templateCaption: string, templateHashtags: string[]) => {
    setCaption(templateCaption)
    setHashtags(prev => [...new Set([...prev, ...templateHashtags])])
    setCreatorMode('fresh') // Switch back after applying
  }

  // ── Media management ──────────────────────────────────────────────────────
  const handleMediaSelect = (ids: string[]) => {
    setSelectedMediaIds(ids)
    // Keep library open so user can continue adding (especially for carousels)
  }

  const handleMediaRemove = (id: string) => {
    setSelectedMediaIds(prev => prev.filter(i => i !== id))
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
            metadata: {
              source: 'post_creator',
              created_by: 'You',
            },
          }),
        })
      }
      data.refetch()
      // Clear draft from localStorage after successful save
      if (draftKey) try { localStorage.removeItem(draftKey) } catch {}
      // Reset form after schedule/draft save
      setCaption('')
      setHashtags([])
      setSelectedMediaIds([])
      setAiPrompt('')
      setContentType('post')
      setSelectedPlatforms(['instagram'])
    } finally {
      setSaving(false)
    }
  }, [activeBrandId, caption, hashtags, selectedPlatforms, postType, selectedMediaIds, strategyContext, data])

  // ── No brand selected ──────────────────────────────────────────────────────
  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Select a brand from the sidebar to start creating content.</p>
      </div>
    )
  }

  // ── Slot config for media ─────────────────────────────────────────────────
  const maxMedia = contentType === 'carousel' ? 10 : 1
  const acceptTypes = ['short_video', 'long_video'].includes(contentType) ? ['video'] : ['image']

  // ── Media URLs for preview ────────────────────────────────────────────────
  const mediaUrl = selectedMedia[0]?.file_url
  const mediaUrls = selectedMedia.map(m => m.file_url)

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — using ComposerLayout (split pane)
  // ══════════════════════════════════════════════════════════════════════════

  const editorPane = (
    <div className="space-y-4">
      {/* ─── Strategy Context (Director's intelligence) ───────────────────── */}
      {strategyContext && (
        <StrategyContextBar
          brandName={brandName}
          postsThisWeek={strategyContext.postsThisWeek ?? 0}
          postsTarget={strategyContext.postsTarget ?? 3}
          suggestedPlatform={strategyContext.suggestedPlatform ?? null}
          suggestedPillar={strategyContext.suggestedPillar ?? null}
          suggestedContentType={strategyContext.suggestedContentType ?? null}
          suggestion={strategyContext.suggestion ?? ''}
          isHealthBrand={isHealthBrand}
        />
      )}

      {/* ─── Section 1: Content Type ──────────────────────────────────────── */}
      <StudioCard
        directorAssist={{
          prompt: `What type of content should ${brandName} create right now? Consider our strategy, what's performing well, and what we haven't posted recently. Suggest a content type and explain why.`,
          label: 'What should I create?',
        }}
      >
        <ContentTypeSection value={contentType} onChange={setContentType} />
      </StudioCard>

      {/* ─── Section 2: Platforms (pills) ─────────────────────────────────── */}
      <StudioCard
        title="Where to publish?"
        subtitle="Select one or more platforms. Greyed-out platforms don't support this content type."
        directorAssist={{
          prompt: `Which platforms need content most for ${brandName} right now? Look at our posting frequency, engagement, and strategy. Tell me where to focus.`,
          label: 'Where should I post?',
        }}
      >
        <PlatformSection
          contentType={contentType}
          selected={selectedPlatforms}
          onChange={handlePlatformsChange}
        />
      </StudioCard>

      {/* ─── Section 3: Media (Scent Sell slots) ──────────────────────────── */}
      <StudioCard
        title="Media"
        required={['carousel', 'short_video', 'long_video', 'ad'].includes(contentType)}
        directorAssist={{
          prompt: `I'm building a ${contentType.replace('_', ' ')} for ${selectedPlatforms.join(', ') || 'social media'}. Review my media library for ${brandName} and suggest which images or videos would work best.`,
          label: 'Review my media',
        }}
      >
        {/* Scent Sell-style media slots */}
        <MediaSlots
          contentType={contentType}
          selectedMedia={selectedMedia}
          onRemove={handleMediaRemove}
          onAddClick={() => setShowMediaLibrary(!showMediaLibrary)}
        />

        {/* Source buttons (Scent Sell "Search Database / Enter Manually" pattern) */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => setShowMediaLibrary(!showMediaLibrary)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-all',
              showMediaLibrary
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-foreground/80 hover:border-primary/50'
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Library
          </button>
          <button
            type="button"
            onClick={() => sendToDirector(`I need to upload media for a ${contentType.replace('_', ' ')}. Open the Media tab so I can drag and drop files.`)}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary/50 transition-all"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => sendToDirector(`Import designs from Canva for ${brandName}. Show me my recent Canva designs so I can pick ones for this ${contentType.replace('_', ' ')}.`)}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary/50 transition-all"
          >
            <Palette className="h-3.5 w-3.5" />
            Canva
          </button>
          <button
            type="button"
            onClick={() => sendToDirector(`Generate an image for my next ${contentType.replace('_', ' ')} on ${selectedPlatforms.join(', ') || 'social media'} for ${brandName}. Make it eye-catching and on-brand.`)}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary/50 transition-all"
          >
            <Wand2 className="h-3.5 w-3.5" />
            AI Generate
          </button>
        </div>

        {/* Expandable media library grid */}
        {showMediaLibrary && (
          <div className="mt-3 rounded-lg border border-border bg-background p-3">
            <MediaSelector
              brandId={activeBrandId}
              selectedIds={selectedMediaIds}
              onChange={handleMediaSelect}
              maxCount={maxMedia}
              acceptTypes={acceptTypes}
            />
          </div>
        )}
      </StudioCard>

      {/* ─── Section 4: Caption + AI ──────────────────────────────────────── */}
      <StudioCard
        title="Caption"
        directorAssist={{
          prompt: `Write a ${contentType.replace('_', ' ')} caption for ${brandName} on ${selectedPlatforms.join(', ') || 'social media'}.${aiPrompt ? ` Topic: ${aiPrompt}` : ''} Use our brand voice and content strategy. If you need the Content team or Brand team for this, bring them in.`,
          label: 'Write my caption',
        }}
      >
        <div className="space-y-3">
          {/* Template / Fresh toggle */}
          <CreatorModeBar mode={creatorMode} onModeChange={setCreatorMode} />

          {/* Template picker (shows when template mode) */}
          {creatorMode === 'template' && (
            <div className="rounded-lg border border-border bg-background p-3">
              <PostTemplatePicker
                brandId={activeBrandId}
                brandName={brandName}
                onApply={handleTemplateApply}
              />
            </div>
          )}

          {/* AI Prompt */}
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAiGenerate() }}
              placeholder={strategyContext?.suggestion ?? 'What should this post be about?'}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colours"
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={selectedPlatforms.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colours"
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

          {/* AI action pills */}
          <div className="flex flex-wrap gap-2">
            {['Make punchier', 'Add a hook', 'Shorten it', 'Make longer', 'More professional'].map(action => (
              <button
                key={action}
                type="button"
                onClick={() => handleAiAction(action)}
                disabled={!caption.trim()}
                className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 transition-colours"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </StudioCard>

      {/* ─── Section 5: Per-Platform Versions ─────────────────────────────── */}
      {selectedPlatforms.length >= 2 && (
        <StudioCard title="Platform Versions" subtitle="Customise captions per platform, or keep the master version.">
          <PlatformVersionEditor
            platforms={selectedPlatforms}
            masterCaption={caption}
            masterHashtags={hashtags}
            versions={versions}
            onMasterChange={(c, h) => { setCaption(c); setHashtags(h) }}
            onVersionsChange={setVersions}
          />
        </StudioCard>
      )}

      {/* ─── Section 6: Hashtags ──────────────────────────────────────────── */}
      <StudioCard
        title="Hashtags"
        directorAssist={{
          prompt: `Suggest the best hashtags for this ${contentType.replace('_', ' ')} on ${selectedPlatforms.join(', ')} for ${brandName}.${caption ? ` The caption is: "${caption.slice(0, 200)}"` : ''} Get the SEO team involved if needed.`,
          label: 'Director picks hashtags',
        }}
      >
        <HashtagSection
          brandId={activeBrandId}
          hashtags={hashtags}
          onChange={setHashtags}
          selectedPlatforms={selectedPlatforms}
          caption={caption}
        />
      </StudioCard>

      {/* ─── Section 7: Compliance (health brands only) ───────────────────── */}
      {isHealthBrand && (
        <StudioCard
          title="Compliance Check"
          subtitle="AHPRA/TGA auto-check — $60K per offence"
          required={true}
          directorAssist={{
            prompt: `Review this post for ${brandName} before I publish it. Check for AHPRA/TGA compliance, brand voice, and anything that could get us in trouble. The caption is:\n\n"${caption}"\n\nHashtags: ${hashtags.map(h => `#${h}`).join(' ')}\n\nPlatforms: ${selectedPlatforms.join(', ')}\n\nBring in the Compliance team if needed.`,
            label: 'Full review',
          }}
        >
          <ComplianceSection
            caption={caption}
            brandName={brandName}
            isHealthBrand={isHealthBrand}
            onResult={result => setCompliancePassed(result === null ? null : result.isValid)}
          />
        </StudioCard>
      )}
    </div>
  )

  const previewPane = (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Preview</h3>
      <MultiPlatformPreview
        platforms={selectedPlatforms}
        masterCaption={caption}
        masterHashtags={hashtags}
        versions={versions}
        mediaUrl={mediaUrl}
        mediaUrls={mediaUrls}
        brandName={brandName}
      />
      {selectedPlatforms.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">Select platforms to see previews.</p>
      )}
    </div>
  )

  const actionBar = (
    <CreatorActionBar
      platforms={selectedPlatforms}
      captionEmpty={!caption.trim()}
      compliancePassed={compliancePassed}
      saving={saving}
      onSave={handleSave}
    />
  )

  return (
    <>
      <ComposerLayout
        editor={editorPane}
        preview={previewPane}
        actionBar={actionBar}
      />

      {/* Mobile preview floating button */}
      <button
        type="button"
        onClick={() => setShowMobilePreview(!showMobilePreview)}
        className="fixed bottom-20 right-4 lg:hidden z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
      >
        <Eye className="h-5 w-5" />
      </button>

      {/* Mobile preview sheet */}
      {showMobilePreview && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobilePreview(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-card border-t border-border p-4">
            <div className="flex justify-center mb-3">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            {previewPane}
          </div>
        </div>
      )}
    </>
  )
}
