'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, ImageIcon, Upload, Palette, Wand2, Eye, Film, Lightbulb, Image as ImageGenIcon } from 'lucide-react'
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
import { RichCaptionEditor } from './RichCaptionEditor'
import { PostContentValidator } from './PostContentValidator'
import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
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

// ── Media item shape (from /api/media) ────────────────────────────────────────
// Imported from MediaSelector so the picker, the slot card, and the Creator
// all share ONE shape. Defined as a Pick<> of MediaItemWithUsage so any DB
// column rename fails the typecheck instead of silently producing wrong UI.
// (Class of bug: the imaginary `status` column on media_items that cost us a
// session on 2026-04-10.)
import type { MediaSelectorItem as MediaItem } from './MediaSelector'

/**
 * PostCreator — the main single-screen post creation experience.
 * Uses ComposerLayout for split-pane (editor left, preview right, action bar bottom).
 * Each section wrapped in StudioCard with DirectorAssist pills.
 * Scent Sell visual quality throughout.
 */
interface PostCreatorProps {
  /** Load existing draft for editing */
  draftId?: string
  /** Pre-load media item into slots */
  mediaId?: string
  /** Called after save in edit mode — navigates back to Review */
  onDone?: () => void
  /** Pre-fill schedule date/time from calendar click (format: YYYY-MM-DDTHH:mm) */
  initialScheduleDate?: string
}

export function PostCreator({ draftId, mediaId, onDone, initialScheduleDate }: PostCreatorProps = {}) {
  const { activeBrandId, setPendingDraftId, setPendingMediaId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Form state — no default platform seed. User picks explicitly. Previously
  // seeded to ['instagram'] which meant users unknowingly had Instagram stuck
  // in a multi-select even when they'd only clicked Facebook.
  const [contentType, setContentType] = useState<ContentType>('post')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PostPlatform[]>([])
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
  const [platformOptions, setPlatformOptions] = useState<Record<string, Record<string, unknown>>>({})

  const brandName = data.brand?.name ?? 'Brand'
  const postType = CONTENT_TO_POST_TYPE[contentType]
  const complianceFlags = data.brand?.compliance_flags as unknown as Record<string, boolean> | null
  const isHealthBrand = !!complianceFlags?.ahpra || !!complianceFlags?.tga

  // ── Auto-save / restore draft from localStorage ────────────────────────
  // Storage key bumped to v2 on 2026-04-10 to invalidate any drafts saved
  // by the old code that included selectedPlatforms in the persisted shape.
  // Old key (`nrs-draft-${brandId}`) was carrying ['instagram'] from the
  // pre-fix default seed across sessions, re-introducing the multi-select
  // bug after every page load. Bumping the key strands those old entries.
  //
  // Persisted fields are deliberately limited to "in-progress writing":
  // contentType, caption, hashtags, aiPrompt, creatorMode. Per-post
  // decisions (selectedPlatforms, selectedMediaIds) are NOT persisted —
  // they reset every session because the user picks them fresh per post.
  const draftKey = activeBrandId ? `nrs-draft-v2-${activeBrandId}` : null
  const isRestored = useRef(false)

  // One-time cleanup: remove the legacy key for this brand if it exists
  // so localStorage doesn't accumulate dead drafts.
  useEffect(() => {
    if (!activeBrandId) return
    try { localStorage.removeItem(`nrs-draft-${activeBrandId}`) } catch { /* ignore */ }
  }, [activeBrandId])

  // Restore draft on mount (skip if we're loading a server draft via draftId).
  // selectedPlatforms and selectedMediaIds are NOT restored — see comment
  // above the draftKey for rationale.
  useEffect(() => {
    if (!draftKey || isRestored.current || draftId) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.contentType) setContentType(draft.contentType)
        if (draft.caption) setCaption(draft.caption)
        if (draft.hashtags?.length) setHashtags(draft.hashtags)
        if (draft.aiPrompt) setAiPrompt(draft.aiPrompt)
        if (draft.creatorMode) setCreatorMode(draft.creatorMode)
      }
    } catch { /* ignore parse errors */ }
    isRestored.current = true
  }, [draftKey, draftId])

  // Auto-save draft on every change. Persist only writing-in-progress fields,
  // not platform/media selections (those are per-post and reset).
  useEffect(() => {
    if (!draftKey || !isRestored.current) return
    const draft = { contentType, caption, hashtags, aiPrompt, creatorMode }
    try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* storage full */ }
  }, [draftKey, contentType, caption, hashtags, aiPrompt, creatorMode])

  // ── Load existing draft for editing ──────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [editDraftId, setEditDraftId] = useState<string | null>(null)

  useEffect(() => {
    if (!draftId || !activeBrandId) return
    setEditMode(true)
    setEditDraftId(draftId)

    // Fetch all posts for brand (not just drafts — draft might have been generated with different status)
    fetch(`/api/scheduled-posts?brandId=${activeBrandId}`)
      .then(r => r.ok ? r.json() : [])
      .then((posts: Array<Record<string, unknown>>) => {
        const draft = posts.find((p: Record<string, unknown>) => p.id === draftId)
        if (!draft) { setEditMode(false); return }
        if (draft.caption) setCaption(draft.caption as string)
        if (draft.platform) setSelectedPlatforms([draft.platform as PostPlatform])
        if (draft.hashtags) setHashtags((draft.hashtags as string[]).map(h => (h as string).replace(/^#/, '')))
        if (draft.media_item_ids) setSelectedMediaIds(draft.media_item_ids as string[])
        if (draft.content_type) {
          const typeMap: Record<string, ContentType> = {
            entertainment: 'post', education: 'post', inspiration: 'post', promotional: 'ad',
          }
          setContentType(typeMap[draft.content_type as string] ?? 'post')
        }
        if (draft.post_type) {
          const ptMap: Record<string, ContentType> = {
            single: 'post', carousel: 'carousel', reel: 'short_video', video: 'long_video',
          }
          setContentType(ptMap[draft.post_type as string] ?? 'post')
        }
        // Clear pending state
        setPendingDraftId(null)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId])

  // ── Pre-load media from Media Library entry ──────────────────────────────
  useEffect(() => {
    if (!mediaId) return
    setSelectedMediaIds([mediaId])
    setPendingMediaId(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId])

  // Fetch media items to populate slots + drive the embedded MediaSelector.
  // The Creator owns the fetch — MediaSelector receives items via prop. This
  // way the MediaSlots card and the picker are guaranteed to see the same
  // data, eliminating the race where a freshly-picked item wasn't found in
  // the parent's local cache.
  const fetchMedia = useCallback(() => {
    if (!activeBrandId) return
    fetch(`/api/media?brandId=${activeBrandId}&sort=newest`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const items: MediaItem[] = Array.isArray(d) ? d : (d.items ?? [])
        setMediaItems(items)
      })
      .catch(() => setMediaItems([]))
  }, [activeBrandId])

  useEffect(() => { fetchMedia() }, [fetchMedia])

  // Refetch whenever the user opens the library — catches files uploaded
  // in another tab between the initial fetch and the user clicking Library.
  useEffect(() => {
    if (showMediaLibrary) fetchMedia()
  }, [showMediaLibrary, fetchMedia])

  // Build selected media with full data for slots
  const selectedMedia = selectedMediaIds
    .map(id => mediaItems.find(m => m.id === id))
    .filter((m): m is MediaItem => !!m)

  // ── AI Generation — CAPTION ONLY ──────────────────────────────────────────
  // This button lives in the Caption card and writes the caption TEXT for
  // the post the user is composing. It must NEVER trigger content generation
  // (videos, images) — the user already picked the media slot above. The
  // earlier version of this prompt said "Write a long video for Facebook"
  // which the Director correctly interpreted as a request to produce media,
  // spawning unnecessary work. This wasted
  // tokens and produced the wrong output. The prompt is now explicit about
  // wanting text only and forbids the media generation tools.
  const handleAiGenerate = () => {
    const platformNames = selectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
    const hasMedia = selectedMedia.length > 0
    const message = [
      `Write a CAPTION (text only) for a ${contentType.replace('_', ' ')} post on ${platformNames || 'social media'} for ${brandName}.`,
      hasMedia
        ? `IMPORTANT: I have already selected ${selectedMedia.length} media item${selectedMedia.length === 1 ? '' : 's'} for this post. DO NOT generate any new media. Just write the caption that pairs with what I have selected.`
        : 'IMPORTANT: I am writing the caption first; I will pick media after. Text only — do not generate media.',
      aiPrompt.trim() ? `Topic / brief: ${aiPrompt.trim()}` : '',
      strategyContext?.agentContext ?? '',
      'Use Content & Copy. Return ONLY the caption text + 5-8 lowercase hashtags. I will paste it into the composer.',
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

      if (editMode && editDraftId) {
        // Edit mode: PATCH existing draft
        await fetch('/api/scheduled-posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editDraftId,
            caption,
            hashtags: hashtags.map(h => `#${h}`),
            status: mode === 'draft' ? 'draft' : 'scheduled',
            scheduled_at: scheduledAt ?? initialScheduleDate ?? new Date().toISOString(),
            post_type: postType,
            media_item_ids: selectedMediaIds,
            content_type: strategyContext?.suggestedContentType ?? undefined,
            content_pillar: strategyContext?.suggestedPillar ?? undefined,
          }),
        })
        // Return to Review tab
        setEditMode(false)
        setEditDraftId(null)
        data.refetch()
        onDone?.()
        return
      }

      // New post mode: POST per platform
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
            scheduled_at: scheduledAt ?? initialScheduleDate ?? new Date().toISOString(),
            post_type: postType,
            media_item_ids: selectedMediaIds,
            content_type: strategyContext?.suggestedContentType ?? undefined,
            content_pillar: strategyContext?.suggestedPillar ?? undefined,
            metadata: {
              source: 'post_creator',
              created_by: 'You',
              ...(platformOptions[platform] && Object.keys(platformOptions[platform]).length > 0
                ? { platform_options: platformOptions[platform] }
                : {}),
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
      setSelectedPlatforms([])
      setPlatformOptions({})
    } finally {
      setSaving(false)
    }
  }, [activeBrandId, caption, hashtags, selectedPlatforms, postType, selectedMediaIds, strategyContext, data, editMode, editDraftId, onDone, draftKey, platformOptions, initialScheduleDate])

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
  // Platform mockups render mediaUrl as a CSS background-image — that works
  // for any image URL but silently fails on a video file_url (.mp4). For
  // videos, use the thumbnail_url generated by the server-side ffmpeg
  // pipeline so the preview shows a real frame instead of an empty box.
  const previewMediaUrls = selectedMedia
    .map(m => (m.file_type?.startsWith('video') ? m.thumbnail_url : m.file_url))
    .filter((u): u is string => !!u)
  const mediaUrl = previewMediaUrls[0]
  const mediaUrls = previewMediaUrls

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
          prompt: `I'm building a ${contentType.replace('_', ' ')} for ${selectedPlatforms.join(', ') || 'social media'} for ${brandName}.

Call query_media with mode="analysis" and limit=20 to load my full media library with transcriptions and AI descriptions. Then do a STRATEGIC content review:

1. For each item, look at what's ACTUALLY in it — the AI description, the transcript text, the tags. Don't guess from the filename.
2. Map each item to our content pillars and target audience. Which items align with which pillar?
3. Recommend the best combination for this ${contentType.replace('_', ' ')} on ${selectedPlatforms.join(', ') || 'social media'}, with reasoning based on the actual content (not the filename).
4. Suggest the story angle and hook each item supports.
5. Reference items by their UUIDs so I can pick them.

If any items have no AI description or transcription yet, name them and offer to run /api/media/process so we can do a proper review next time. Never recommend an item based on its filename alone.`,
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
          {/* Image generation — hidden for video-only content types */}
          {contentType !== 'short_video' && contentType !== 'long_video' && (
            <button
              type="button"
              onClick={() => sendToDirector(`Generate an image for my next ${contentType.replace('_', ' ')} on ${selectedPlatforms.join(', ') || 'social media'} for ${brandName}. Make it eye-catching and on-brand.`)}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary/50 transition-all"
            >
              <Wand2 className="h-3.5 w-3.5" />
              AI Generate
            </button>
          )}
          {/* Video planning — shown for any content type that accepts video */}
          {['short_video', 'long_video', 'story', 'ad'].includes(contentType) && (
            <button
              type="button"
              onClick={() => {
                const aspectHint = contentType === 'short_video' ? '9:16 for Reels/TikTok/Shorts' : contentType === 'long_video' ? '16:9 long-form' : '9:16'
                sendToDirector(
                  `Prepare a ${contentType.replace('_', ' ')} production brief for ${brandName}. Format: ${aspectHint}. Use Video & Scripting to write the script, timed shot list, captions, asset checklist, and compliance review. Use NRS-owned video tooling only where it is configured; otherwise return the brief ready for recording or editing.`,
                )
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-all"
            >
              <Film className="h-3.5 w-3.5" />
              Build Video Plan
            </button>
          )}
          {/* Blotato visual generation — alternative AI image source.
              Blotato has 8 MCP tools (see src/lib/agents/tools/blotato.ts);
              this pill triggers create_visual via the Director, which picks
              the right Blotato endpoint based on the user's request. Shown
              for content types that accept images. */}
          {!['short_video', 'long_video'].includes(contentType) && (
            <button
              type="button"
              onClick={() => sendToDirector(
                `Generate a visual for my next ${contentType.replace('_', ' ')} on ${selectedPlatforms.join(', ') || 'social media'} for ${brandName} using Blotato. Use the Brand or Content team to pick the right Blotato template, then call blotato_create_visual. When it's ready, save it to my media library so I can pick it from the slot above.`,
              )}
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-violet-400/40 bg-violet-400/5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-400/10 transition-all"
            >
              <ImageGenIcon className="h-3.5 w-3.5" />
              Generate Visual (Blotato)
            </button>
          )}
        </div>

        {/* Expandable media library grid — uses the Creator's own fetched
            mediaItems as the source of truth so the slot card and the picker
            never go out of sync. */}
        {showMediaLibrary && (
          <div className="mt-3 rounded-lg border border-border bg-background p-3">
            <MediaSelector
              brandId={activeBrandId}
              selectedIds={selectedMediaIds}
              onChange={handleMediaSelect}
              maxCount={maxMedia}
              acceptTypes={acceptTypes}
              items={mediaItems}
            />
          </div>
        )}

        {/* ── Ask Director for an idea ─────────────────────────────────────
            When the user has picked media, they can ask Content & Copy
            (via the Director) for a full creative proposal: hook, caption,
            hashtags, post type. The prompt sends the selected media_ids
            verbatim so Director calls propose_post_from_media with real
            visual context, not hallucinated descriptions. */}
        {selectedMediaIds.length > 0 && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <button
              type="button"
              onClick={() => {
                const mediaCount = selectedMediaIds.length
                const platformList = selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : 'instagram'
                const platformForTool = selectedPlatforms[0] ?? 'instagram'
                const mediaIdList = selectedMediaIds.join(', ')
                sendToDirector(
                  `I've selected ${mediaCount} media item${mediaCount === 1 ? '' : 's'} for a ${contentType.replace('_', ' ')} on ${platformList} for ${brandName}.\n\nMedia IDs: ${mediaIdList}\n\nUse propose_post_from_media (platform="${platformForTool}", media_ids=[${selectedMediaIds.map((id) => `"${id}"`).join(', ')}]) to give me a proposal — hook, caption, hashtags, post type, rationale. Don't write anything yourself — that's Content & Copy's job. Read the visual_analysis already stored on each media item; don't re-analyse. When I respond with feedback, iterate by calling propose_post_from_media again with the previous JSON + my feedback.`,
                )
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
            >
              <Lightbulb className="h-4 w-4" />
              Ask Director for an idea ({selectedMediaIds.length} {selectedMediaIds.length === 1 ? 'item' : 'items'})
            </button>
          </div>
        )}
      </StudioCard>

      {/* ─── Section 4: Caption + AI ──────────────────────────────────────── */}
      <StudioCard
        title="Caption"
        directorAssist={{
          prompt: `Write a CAPTION (text only) for a ${contentType.replace('_', ' ')} post for ${brandName} on ${selectedPlatforms.join(', ') || 'social media'}.${aiPrompt ? ` Topic: ${aiPrompt}` : ''}${selectedMedia.length > 0 ? ` I already have ${selectedMedia.length} media item${selectedMedia.length === 1 ? '' : 's'} selected — write the caption that pairs with them. Do not generate new media.` : ' Text only — do not generate media.'} Use Content & Copy and Brand if needed. Return only the caption + 5-8 lowercase hashtags.`,
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
              title="Director writes the caption text only — never generates new media"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colours"
            >
              <Sparkles className="h-4 w-4" />
              Write caption
            </button>
          </div>

          {/* Phase 3 Mixpost UI port — RichCaptionEditor replaces PostEditor
              with TipTap formatting toolbar + emoji picker.
              PostContentValidator shows per-platform character rings
              below the editor, replacing the old inline char counter. */}
          <RichCaptionEditor
            value={caption}
            onChange={(text) => handleCaptionChange(text)}
            placeholder="Write your post here…"
            brandName={brandName}
            platforms={selectedPlatforms}
          />
          <PostContentValidator
            caption={caption}
            platforms={selectedPlatforms as PlatformKey[]}
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
            platformOptions={platformOptions}
            onPlatformOptionsChange={setPlatformOptions}
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
      editMode={editMode}
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
