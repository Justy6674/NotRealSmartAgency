'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, ImageIcon, Upload, Palette, Wand2, Eye, Film, Lightbulb, AlertTriangle } from 'lucide-react'
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
import { PLATFORM_CHAR_LIMITS, PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import { isCaptionWithinAllLimits } from '@/hooks/usePostCharacterLimit'
import { PlatformVersionEditor } from './PlatformVersionEditor'
import { HashtagSection } from './HashtagSection'
import { PostTemplatePicker } from '../templates/PostTemplatePicker'
import { ComplianceSection } from './ComplianceSection'
import { MultiPlatformPreview } from '../preview/MultiPlatformPreview'
import { MediaSelector } from './MediaSelector'

import { createVersionsFromMaster, resolvePublishCaption, updateMasterCaption, type PostVersions } from '@/lib/post-versions'
import { earliestNextSlot } from '@/lib/posting-queue/assign-to-slot'
import type { PostPlatform, PostType, PostingScheduleSlot } from '@/types/database'

// ── Content type → Post type mapping ──────────────────────────────────────────
const CONTENT_TO_POST_TYPE: Record<ContentType, PostType> = {
  post: 'single',
  carousel: 'carousel',
  short_video: 'reel',
  long_video: 'video',
  story: 'single',
  ad: 'single',
}

/**
 * The body a platform actually receives — deliberately keystroke-for-keystroke
 * the same assembly as buildCaption in src/lib/publishers/dispatcher.ts, down
 * to trimming blanks out and refusing to give a tag a second '#'. A composer
 * that measures a different string from the one the publisher sends is back to
 * telling the owner something that isn't true, just about length this time.
 *
 * The limit applies to this whole string, not to the caption on its own.
 * Measuring the caption alone waves through a 2,190-character Instagram post
 * carrying ten hashtags, and Instagram rejects it hours later while the owner
 * is asleep. The rings under the editor still count the caption alone, which
 * is why the Save warning says out loud that the hashtags are in the number —
 * a dead button beside a green ring is its own kind of lie.
 *
 * The brand sign-off the publisher appends after this is NOT counted: the
 * composer never loads brands.post_signature, and inventing a length for it
 * would be worse than admitting the count is the body without it.
 */
function composePublishBody(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .map((h) => h.trim())
    .filter((h) => h !== '')
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
  return tags.length === 0 ? caption : `${caption}\n\n${tags.join(' ')}`
}

const formatCount = (n: number) => n.toLocaleString('en-AU')

/**
 * PLATFORM_LABELS covers the ten platforms Mixpost draws chips for; the pills
 * in this composer offer google_business as well. Reaching into the record for
 * a platform it has never heard of returns undefined, and a sentence that says
 * "undefined did not save" is worse than the silence it replaced.
 */
const platformLabel = (platform: PostPlatform): string =>
  (PLATFORM_LABELS as Record<string, string>)[platform]
  ?? platform.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

/** "Instagram", "Instagram and Facebook", "Instagram, Facebook and LinkedIn". */
const listPlatforms = (platforms: readonly PostPlatform[]): string => {
  const names = platforms.map(platformLabel)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * A platform whose row was not created. `permanent` separates "press Save
 * again" from "pressing Save again will never work" — /api/scheduled-posts
 * accepts the six platforms the publishers support and answers 400 to the rest,
 * while the pills above offer eleven. Telling the owner to retry a platform the
 * server will refuse every time is the same class of lie as telling him it
 * saved.
 */
type SaveFailure = { platform: PostPlatform; permanent: boolean }

/**
 * Written to be read by someone who does not know what an HTTP status is, and
 * deliberately does NOT carry the server's own error text: that string is a
 * database message often enough to make it a coin toss, and the owner cannot
 * act on it either way. Name the platform, say what exists now, say what to do.
 */
function describeSaveOutcome(saved: readonly PostPlatform[], failed: readonly SaveFailure[]): string {
  const blocked = failed.filter((f) => f.permanent).map((f) => f.platform)
  const retryable = failed.filter((f) => !f.permanent).map((f) => f.platform)
  const parts: string[] = []

  if (saved.length > 0) {
    const one = saved.length === 1
    parts.push(
      `Saved for ${listPlatforms(saved)} — ${one ? 'it is' : 'they are'} waiting in Review, and ${one ? 'it has' : 'they have'} been unticked so saving again cannot create ${one ? 'it' : 'them'} twice.`,
    )
  }
  if (blocked.length > 0) {
    const one = blocked.length === 1
    parts.push(
      `${listPlatforms(blocked)} cannot be saved from here yet, so nothing was created for ${one ? 'it' : 'them'}. Untick ${one ? 'it' : 'them'} to save the rest.`,
    )
  }
  if (retryable.length > 0) {
    const one = retryable.length === 1
    parts.push(
      `${listPlatforms(retryable)} did not save, so there is nothing waiting in Review for ${one ? 'it' : 'them'}. Try Save again.`,
    )
  }
  parts.push('Your words are still here — nothing has been cleared.')
  return parts.join(' ')
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
  /** Restore exact NRS Desk media/platform context */
  deskConversationId?: string
  /** Restore one exact saved Desk proposal into the editor */
  deskOutputId?: string
}

export function PostCreator({ draftId, mediaId, onDone, initialScheduleDate, deskConversationId, deskOutputId }: PostCreatorProps = {}) {
  const { activeBrandId, setPendingDraftId, setPendingMediaId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Form state — no default platform seed. User picks explicitly. Previously
  // seeded to ['instagram'] which meant users unknowingly had Instagram stuck
  // in a multi-select even when they'd only clicked Facebook.
  const [contentType, setContentType] = useState<ContentType>('post')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PostPlatform[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [versions, setVersions] = useState<PostVersions>({})
  const [aiPrompt, setAiPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  // Both keyed by the exact words that were reviewed, not by platform. A verdict
  // belongs to a caption: two platforms publishing the same text share one
  // answer, and a platform the owner rewrote gets its own. Keying by platform
  // instead is how a tick earned by the master ended up sitting over a version
  // nobody had checked.
  const [complianceByCaption, setComplianceByCaption] = useState<Record<string, boolean | null>>({})
  // The review is recorded on the post, not just shown. The board treats a
  // regulated post with no recorded review as needing sign-off, and nothing
  // was stamping it, so everything scheduled read as unreviewed even after
  // it had been checked here.
  const [reviewStamps, setReviewStamps] = useState<Record<string, Record<string, unknown>>>({})
  // What the last Save actually did, when it did not do all of it.
  const [saveProblem, setSaveProblem] = useState<string | null>(null)
  const [creatorMode, setCreatorMode] = useState<CreatorMode>('fresh')
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [platformOptions, setPlatformOptions] = useState<Record<string, Record<string, unknown>>>({})
  const [nextSlotIso, setNextSlotIso] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

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

  useEffect(() => {
    if (!activeBrandId) {
      setNextSlotIso(null)
      return
    }
    let cancelled = false
    fetch(`/api/posting-schedule?brandId=${activeBrandId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((slots: PostingScheduleSlot[]) => {
        if (cancelled || !Array.isArray(slots)) return
        const when = earliestNextSlot(slots, new Date())
        setNextSlotIso(when ? when.toISOString() : null)
      })
      .catch(() => {
        if (!cancelled) setNextSlotIso(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

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

  // A Desk receipt must restore the exact work, never whichever media or
  // proposal happens to be newest. The server re-verifies conversation,
  // brand and owner access before returning these IDs.
  useEffect(() => {
    if (!deskConversationId || draftId) return
    fetch(`/api/desk/results?conversationId=${encodeURIComponent(deskConversationId)}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: {
        context?: { media_item_ids?: string[]; platforms?: string[] }
        outputs?: Array<{ id: string; content?: string | null; output_type?: string | null }>
      } | null) => {
        if (!data) return
        if (data.context?.media_item_ids?.length) setSelectedMediaIds(data.context.media_item_ids)
        if (data.context?.platforms?.length) {
          const validPlatforms = new Set<PostPlatform>(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube', 'bluesky', 'mastodon', 'pinterest', 'threads', 'google_business'])
          const restored = data.context.platforms
            .map((platform) => platform.toLowerCase() as PostPlatform)
            .filter((platform) => validPlatforms.has(platform))
          if (restored.length) setSelectedPlatforms(restored)
        }

        const output = deskOutputId
          ? data.outputs?.find((output) => output.id === deskOutputId)
          : undefined
        if (!output?.content) return

        let restoredCaption = output.content
        try {
          const parsed = JSON.parse(output.content) as Record<string, unknown>
          const candidate = parsed.caption ?? parsed.content ?? parsed.copy ?? parsed.text
          if (typeof candidate === 'string') restoredCaption = candidate
          if (Array.isArray(parsed.hashtags)) {
            setHashtags(parsed.hashtags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.replace(/^#/, '')))
          }
          const requestedType = parsed.post_type ?? parsed.content_type
          if (requestedType === 'carousel') setContentType('carousel')
          if (requestedType === 'reel' || requestedType === 'short_video') setContentType('short_video')
          if (requestedType === 'video' || requestedType === 'long_video') setContentType('long_video')
        } catch {
          // Plain saved copy is already the exact proposal text.
        }
        setCaption(restoredCaption)
        if (output.output_type === 'carousel') setContentType('carousel')
      })
      .catch(() => {})
  }, [deskConversationId, deskOutputId, draftId])

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

  /**
   * A hashtag is a whole-post decision in this composer: no surface here can
   * give one platform tags of its own. THE FAULT: they were snapshotted into
   * each version the moment a platform was ticked and never refreshed, so a tag
   * added after a platform had been customised was dropped at publish —
   * resolvePublishCaption trusts a customised version's hashtags verbatim
   * (post-versions.ts, rule 3) and the snapshot predated the tag. Fixing only
   * the editor's customise call covers the owner who adds tags first; this
   * covers the one who adds them second, which is most people.
   */
  const handleHashtagsChange = (next: string[]) => {
    setHashtags(next)
    setVersions((current) => {
      const synced: PostVersions = { ...current }
      for (const platform of Object.keys(synced) as PostPlatform[]) {
        const version = synced[platform]
        if (!version) continue
        synced[platform] = { ...version, hashtags: [...next] }
      }
      return synced
    })
  }

  const handlePlatformsChange = (platforms: PostPlatform[]) => {
    setSelectedPlatforms(platforms)
    setVersions(createVersionsFromMaster(platforms, caption, hashtags))
    // The last Save's report is about a platform list that no longer exists.
    setSaveProblem(null)
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

  // ── Can this actually be published? ───────────────────────────────────────
  // isCaptionWithinAllLimits describes itself as the "can I publish" gate and
  // until now had no callers at all — Save asked only whether a platform was
  // ticked and the box wasn't empty. A caption X would refuse outright went
  // into the Review queue looking healthy and only failed at the publisher,
  // hours later, with nobody watching.
  //
  // Measured per platform, not once for all of them, for two reasons. Each
  // platform may now be publishing different words. And google_business has no
  // entry in PLATFORM_CHAR_LIMITS: handed to isCaptionWithinAllLimits it
  // compares the length against `undefined`, which is false for every caption
  // ever written, so Save would have switched off permanently and the owner
  // would have had no idea why. Platforms with no published limit are left
  // alone rather than blocked on a number nobody has.
  const overLimitPlatforms = selectedPlatforms.flatMap((platform) => {
    if (!(platform in PLATFORM_CHAR_LIMITS)) return []
    const key = platform as PlatformKey
    const publish = resolvePublishCaption(versions, platform, caption, hashtags)
    const body = composePublishBody(publish.caption, publish.hashtags)
    if (isCaptionWithinAllLimits(body, [key])) return []
    const limit = PLATFORM_CHAR_LIMITS[key]
    // Same grapheme approximation usePostCharacterLimit counts with, so the
    // overage quoted here can never contradict the ring above it.
    return [{ label: PLATFORM_LABELS[key], limit, over: Array.from(body).length - limit }]
  })

  // Plain language, named platform, real number. "Validation failed" tells the
  // owner nothing he can act on; "Instagram takes 2,200 characters and this
  // post is 140 over" tells him exactly how much to cut.
  const overLimitMessage = overLimitPlatforms.length === 0 ? null : (() => {
    const each = overLimitPlatforms.map(
      (p) => `${p.label} takes ${formatCount(p.limit)} characters and this post is ${formatCount(p.over)} over`,
    )
    // Semicolons, not "and" — each clause already contains an "and", so
    // joining them with another one produced a sentence nobody could parse.
    const joined = each.join('; ')
    const hashtagNote = hashtags.length > 0
      ? ' That count includes your hashtags — they get added onto the end of the post when it goes out.'
      : ''
    return `Too long to publish. ${joined}. Shorten the caption, or untick ${overLimitPlatforms.length === 1 ? overLimitPlatforms[0].label : 'those platforms'}.${hashtagNote}`
  })()

  const hasOverLimit = overLimitPlatforms.length > 0

  // ── What compliance is actually being asked about ─────────────────────────
  // THE FAULT: the compliance card was handed the MASTER caption and nothing
  // else. An owner who rewrote the Instagram version watched a green tick
  // settle over words Instagram would never see. The publish-time gate does
  // read the real per-platform text (src/lib/agents/publish-gate.ts), so this
  // was a misleading tick rather than a way past the gate — but on an AHPRA
  // brand a tick is the thing people trust instead of reading it themselves,
  // and $60K per offence is not a good place to be sincerely wrong.
  //
  // Grouped by the words rather than listed per platform: the usual case is
  // several platforms publishing one caption, and six identical checks would be
  // six paid model calls for one answer, plus six chances to disagree.
  const complianceTargets: Array<{ caption: string; platforms: PostPlatform[] }> = (() => {
    const byCaption = new Map<string, { caption: string; platforms: PostPlatform[] }>()
    for (const platform of selectedPlatforms) {
      const publish = resolvePublishCaption(versions, platform, caption, hashtags)
      const existing = byCaption.get(publish.caption)
      if (existing) existing.platforms.push(platform)
      else byCaption.set(publish.caption, { caption: publish.caption, platforms: [platform] })
    }
    // Nothing ticked yet: still check what is on screen, the way this card
    // always has, rather than leaving the owner writing blind until he picks.
    if (byCaption.size === 0) return [{ caption, platforms: [] }]
    return [...byCaption.values()]
  })()

  // One red is red. Green only once every version that will publish has come
  // back clean — a summary that ignored the version the owner rewrote is the
  // tick this whole section exists to stop showing.
  const complianceVerdicts = complianceTargets.map((target) => complianceByCaption[target.caption] ?? null)
  const compliancePassed = complianceVerdicts.includes(false)
    ? false
    : complianceVerdicts.every((verdict) => verdict === true)
      ? true
      : null

  // React skips the re-render when a state updater returns the object it was
  // handed, and that bail-out is load-bearing here: ComplianceSection receives a
  // fresh inline callback on every render and restarts its 1.5s debounce from
  // it, so a handler that always built a new object would re-check for as long
  // as the tab stayed open — a paid compliance call every 1.5 seconds, forever.
  const handleComplianceResult = useCallback(
    (reviewedCaption: string, result: { isValid: boolean } | null) => {
      setComplianceByCaption((current) => {
        const verdict = result === null ? null : result.isValid
        if (current[reviewedCaption] === verdict) return current
        return { ...current, [reviewedCaption]: verdict }
      })
      setReviewStamps((current) => {
        // Only a review that ran AND passed is worth recording. `recordable` is
        // the API's own word for that; ComplianceSection's result type predates
        // it, hence the cast rather than a wider prop change in a file this
        // change does not own.
        const recordable = !!result && (result as { recordable?: boolean }).recordable === true
        if (!recordable) {
          if (!(reviewedCaption in current)) return current
          const without = { ...current }
          delete without[reviewedCaption]
          return without
        }
        // Keep the first approval time. Re-stamping on every re-check would
        // move the timestamp forward without anything having been re-read.
        if (current[reviewedCaption]) return current
        return {
          ...current,
          [reviewedCaption]: {
            compliance_reviewed: true,
            approved_at: new Date().toISOString(),
            reviewed_caption: reviewedCaption,
          },
        }
      })
    },
    [],
  )

  // ── Save / Schedule / Publish ──────────────────────────────────────────────
  const handleSave = useCallback(async (mode: 'draft' | 'schedule' | 'now', scheduledAt?: string) => {
    if (!activeBrandId || !caption.trim()) return
    // Belt and braces. The button is disabled below, but a save handler is the
    // last place that should trust its caller.
    if (hasOverLimit) return
    setSaving(true)
    setSaveProblem(null)

    const persistStatus = mode === 'schedule' ? 'scheduled' : 'draft'

    try {
      if (selectedPlatforms.length === 0) {
        setSaveProblem('Pick at least one account first.')
        return
      }

      if (editMode && editDraftId) {
        // Edit mode: PATCH existing draft. The row is one platform's row, so
        // it gets that platform's words — the same resolution the preview drew.
        const editPlatform = selectedPlatforms[0]
        const editPublish = editPlatform
          ? resolvePublishCaption(versions, editPlatform, caption, hashtags)
          : { caption, hashtags, isCustomised: false }
        let editResponse: Response | null = null
        try {
          editResponse = await fetch('/api/scheduled-posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: editDraftId,
              caption: editPublish.caption,
              hashtags: editPublish.hashtags.map(h => h.replace(/^#/, '')),
              status: persistStatus,
              scheduled_at: scheduledAt ?? initialScheduleDate ?? new Date().toISOString(),
              post_type: postType,
              media_item_ids: selectedMediaIds,
              content_type: strategyContext?.suggestedContentType ?? undefined,
              content_pillar: strategyContext?.suggestedPillar ?? undefined,
              // Looked up by the words this row is publishing, so the lookup IS
              // the check that the review was about them. A stamp keyed to the
              // master would sit on a platform the owner rewrote afterwards,
              // which is how unchecked AHPRA/TGA copy reaches a live account
              // carrying a tick.
              ...(reviewStamps[editPublish.caption]
                ? { metadata: reviewStamps[editPublish.caption] }
                : {}),
            }),
          })
        } catch {
          // Offline, or the tab lost the network mid-request. Nothing changed.
          editResponse = null
        }
        if (!editResponse?.ok) {
          // Same fault as the loop below: this navigated back to Review and
          // reported success without ever looking at the reply, so an update
          // that never landed read exactly like one that did — the old words
          // still in Review, the new ones gone from the screen they were typed
          // on. Stay put, keep the edit, say so.
          setSaveProblem('That update did not save, so the post in Review still has its old words. Your changes are still here — try Update again.')
          return
        }
        if (mode === 'now') {
          const published = await fetch('/api/scheduled-posts/publish-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postIds: [editDraftId] }),
          })
          if (!published.ok) {
            setSaveProblem('The update saved but did not go out. It is in Posts — try Post now from there.')
            return
          }
        }
        setEditMode(false)
        setEditDraftId(null)
        data.refetch()
        onDone?.()
        return
      }

      // New post mode: POST per platform
      const savedPlatforms: PostPlatform[] = []
      const failedPlatforms: SaveFailure[] = []
      const createdIds: string[] = []
      for (const platform of selectedPlatforms) {
        // scheduled_posts is already one row per platform, so the row's own
        // caption IS the variant — no migration, no new column, nothing
        // downstream needs to know versions exist. Sending the master here was
        // the whole fault: the editor wrote the LinkedIn version, the preview
        // drew the LinkedIn version, and LinkedIn received the master.
        const publish = resolvePublishCaption(versions, platform, caption, hashtags)
        let response: Response | null = null
        try {
          response = await fetch('/api/scheduled-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandId: activeBrandId,
              platform,
              caption: publish.caption,
              // Stored bare. publish-now/route.ts:132 puts a '#' on every tag
              // unconditionally, so a '#' added here reached the account as
              // '##weightloss' while the preview — which strips a leading '#'
              // before drawing — showed '#weightloss'. The preview was right and
              // the row was wrong. Bare is the shape the rest of the app already
              // writes (HashtagSection, fill-calendar) and the shape
              // dispatcher.ts:buildCaption is built to receive.
              hashtags: publish.hashtags.map(h => h.replace(/^#/, '')),
              status: persistStatus,
              scheduled_at: scheduledAt ?? initialScheduleDate ?? new Date().toISOString(),
              post_type: postType,
              media_item_ids: selectedMediaIds,
              content_type: strategyContext?.suggestedContentType ?? undefined,
              content_pillar: strategyContext?.suggestedPillar ?? undefined,
              metadata: {
                source: 'post_creator',
                created_by: 'You',
                ...(reviewStamps[publish.caption] ?? {}),
                ...(platformOptions[platform] && Object.keys(platformOptions[platform]).length > 0
                  ? { platform_options: platformOptions[platform] }
                  : {}),
                ...(selectedAccountIds.length > 0 ? { account_ids: selectedAccountIds } : {}),
              },
            }),
          })
        } catch {
          // Offline, or the tab lost the network mid-request. No row was made.
          response = null
        }
        if (response?.ok) {
          savedPlatforms.push(platform)
          const created = (await response.json().catch(() => null)) as { id?: string } | null
          if (created?.id) createdIds.push(created.id)
          continue
        }
        // 400 is the server refusing the shape outright — most often a platform
        // /api/scheduled-posts does not accept. Retrying that is pressing a
        // button that can only ever fail, so it gets different words.
        failedPlatforms.push({ platform, permanent: response?.status === 400 })
      }

      data.refetch()

      if (failedPlatforms.length > 0) {
        // THE FAULT: every reply was thrown away and the form was cleared
        // regardless, so a platform that received nothing looked exactly like
        // one that saved — the words gone from the screen, and nothing in
        // Review to find them in. A save that half-worked has to say so.
        //
        // The platforms that DID save are unticked rather than left selected,
        // so pressing Save again retries only what failed instead of creating
        // the successful ones a second time. Set straight through
        // setSelectedPlatforms on purpose: handlePlatformsChange rebuilds
        // versions from the master, which would throw away the per-platform
        // rewrites still sitting in the boxes above.
        setSaveProblem(describeSaveOutcome(savedPlatforms, failedPlatforms))
        setSelectedPlatforms(failedPlatforms.map((failure) => failure.platform))
        return
      }

      if (mode === 'now' && createdIds.length > 0) {
        const published = await fetch('/api/scheduled-posts/publish-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postIds: createdIds }),
        })
        if (!published.ok) {
          setSaveProblem('The post was saved but did not go out. It is in Posts — try Post now from there.')
          return
        }
      }

      // Clear draft from localStorage after successful save
      if (draftKey) try { localStorage.removeItem(draftKey) } catch {}
      // Record time of last successful save so the action bar can show it
      setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }))
      // Reset form after schedule/draft save
      setCaption('')
      setHashtags([])
      setSelectedMediaIds([])
      setAiPrompt('')
      setContentType('post')
      setSelectedPlatforms([])
      setSelectedAccountIds([])
      setPlatformOptions({})
    } finally {
      setSaving(false)
    }
  }, [activeBrandId, caption, hashtags, versions, hasOverLimit, reviewStamps, selectedPlatforms, selectedAccountIds, postType, selectedMediaIds, strategyContext, data, editMode, editDraftId, onDone, draftKey, platformOptions, initialScheduleDate])

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
          selectedAccountIds={selectedAccountIds}
          onAccountIdsChange={setSelectedAccountIds}
          brandName={brandName}
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
          onChange={handleHashtagsChange}
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
            // Every version, under its own heading. Handing the Director the
            // master alone asked it to review words that were not going out,
            // which is the same fault as the tick below and reads just as
            // convincingly when it comes back clean.
            prompt: [
              `Review this post for ${brandName} before I publish it. Check for AHPRA/TGA compliance, brand voice, and anything that could get us in trouble.`,
              ...complianceTargets.map((target) =>
                target.platforms.length > 0
                  ? `--- ${listPlatforms(target.platforms)} ---\n"${target.caption}"`
                  : `"${target.caption}"`,
              ),
              `Hashtags: ${hashtags.map(h => `#${h}`).join(' ')}`,
              'Bring in the Compliance team if needed.',
            ].join('\n\n'),
            label: 'Full review',
          }}
        >
          <div className="space-y-4">
            {complianceTargets.map((target) => (
              // Keyed by the platforms, not by the caption: keying by the text
              // would remount this on every keystroke, resetting the health-
              // claims tickbox inside it and restarting its debounce from
              // scratch each time. The grouping only changes when a version
              // genuinely starts or stops differing from the master.
              <div key={target.platforms.join('|') || 'master'} className="space-y-2">
                {complianceTargets.length > 1 && (
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {listPlatforms(target.platforms)}
                  </p>
                )}
                <ComplianceSection
                  caption={target.caption}
                  brandName={brandName}
                  isHealthBrand={isHealthBrand}
                  onResult={result => handleComplianceResult(target.caption, result)}
                />
              </div>
            ))}
          </div>
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

  // CreatorActionBar exposes exactly one lever for switching Save off
  // (`captionEmpty`), and this change does not own that file, so the
  // over-limit case rides on it. A warning on its own is what let a caption
  // the platform would refuse reach the Review queue looking approved, so the
  // button genuinely has to go dead. The reason sits directly above the bar,
  // next to the button it explains, where it can name the platform and the
  // number instead of leaving the owner to guess which one is the problem.
  const actionBar = (
    <div className="space-y-2">
      {overLimitMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-[oklch(0.55_0.2_25/0.3)] bg-[oklch(0.55_0.2_25/0.08)] px-3 py-2 text-[11px] text-[oklch(0.55_0.2_25)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{overLimitMessage}</span>
        </div>
      )}
      {/* What the last Save actually did. It sits beside the button that did it
          for the same reason the over-limit line does: a report the owner has
          to go looking for is a report he will not read. */}
      {saveProblem && (
        <div className="flex items-start gap-2 rounded-lg border border-[oklch(0.55_0.2_25/0.3)] bg-[oklch(0.55_0.2_25/0.08)] px-3 py-2 text-[11px] text-[oklch(0.55_0.2_25)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{saveProblem}</span>
        </div>
      )}
      <CreatorActionBar
        platforms={selectedPlatforms}
        captionEmpty={!caption.trim() || hasOverLimit}
        compliancePassed={compliancePassed}
        saving={saving}
        onSave={handleSave}
        editMode={editMode}
        nextSlotIso={nextSlotIso}
        savedAt={savedAt}
      />
    </div>
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
