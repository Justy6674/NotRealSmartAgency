'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useComposeDeskStore } from '@/stores/compose-desk-store'
import { DIRECTOR_HASHTAG_DISCLAIMER } from '@/lib/desk/extract-caption-draft'
import { applyDeskActionsToCompose } from '@/lib/social/apply-desk-actions'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { useSocialAccounts, type SocialAccount } from '@/hooks/useSocialAccounts'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import { isComposerPlatform } from '@/lib/social/capabilities'
import { accountIdsForPlatform } from '@/lib/social/account-targets'

// Layout
import { ComposerLayout } from './ComposerLayout'
import { ComposeDeskCard } from './ComposeDeskCard'
import { ComposeMediaStrip } from './ComposeMediaStrip'
import { ContentTypeCompact } from './ContentTypeCompact'
import { CreatorModeBar, type CreatorMode } from './CreatorModeBar'
import { CreatorActionBar } from './CreatorActionBar'

// Existing components (reused as-is)
import { type ContentType } from './ContentTypeSection'
import { PlatformSection } from './PlatformSection'
import { RichCaptionEditor } from './RichCaptionEditor'
import { PostContentValidator } from './PostContentValidator'
import { PLATFORM_CHAR_LIMITS, PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import { isCaptionWithinAllLimits, limitFor, limitsFromPublisher } from '@/hooks/usePostCharacterLimit'
import { PlatformVersionEditor } from './PlatformVersionEditor'
import { HashtagSection } from './HashtagSection'
import { PostTemplatePicker } from '../templates/PostTemplatePicker'
import { ComplianceSection } from './ComplianceSection'
import { ComposerPreviewPane } from '../preview/ComposerPreviewPane'
import { ComposerActivityPane } from './activity/ComposerActivityPane'
import { MediaSelector } from './MediaSelector'
import { ComposeMediaUpload } from './ComposeMediaUpload'
import { CanvaImportModal } from '../CanvaImportModal'

import { createVersionsFromMaster, resolvePublishCaption, updateMasterCaption, type PostVersions } from '@/lib/post-versions'
import { earliestNextSlot } from '@/lib/posting-queue/assign-to-slot'
import type { PostPlatform, PostType, PostingScheduleSlot } from '@/types/database'
import type { ZernioTikTokCreatorInfo } from '@/lib/zernio/accounts'

/** One of the four places a picture or video can come from. */
function MediaSourceButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-[8px] border px-[12px] py-[7px] text-[12.5px] font-medium transition-colors duration-150"
      style={{
        borderColor: active ? 'var(--brand)' : 'var(--line)',
        background: active ? 'var(--brand-wash)' : 'var(--panel-2)',
        color: active ? 'var(--brand-deep)' : 'var(--ink-2)',
      }}
    >
      {label}
    </button>
  )
}

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
 * PostCreator — the whole compose experience, in one scrolling column.
 *
 * It IS a split pane, as of 19 August 2026. The single-column rule in DESIGN.md
 * held here for months and the owner overrode it for this screen specifically —
 * Mixpost's shape, a form on the left and a fixed 750px Preview/Activity pane on
 * the right. The reasoning, and the fact that it is deliberate, is recorded in
 * `ComposerLayout`; do not restore the column without reading it.
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
  /**
   * `department` inside the Social shell (it owns the scroller and the pinned
   * action bar), `standalone` on `/agency/studio/create`, which has neither.
   * See `ComposerLayout`.
   */
  chrome?: 'department' | 'standalone'
}

export function PostCreator({ draftId, mediaId, onDone, initialScheduleDate, deskConversationId, deskOutputId, chrome = 'standalone' }: PostCreatorProps = {}) {
  const { activeBrandId, setPendingDraftId, setPendingMediaId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Form state — no default platform seed. User picks explicitly. Previously
  // seeded to ['instagram'] which meant users unknowingly had Instagram stuck
  // in a multi-select even when they'd only clicked Facebook.
  const [contentType, setContentType] = useState<ContentType>('post')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PostPlatform[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
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
  const [showComposeUpload, setShowComposeUpload] = useState(false)
  const [showDirectorHashtagNote, setShowDirectorHashtagNote] = useState(false)
  const [showPerPlatformVersions, setShowPerPlatformVersions] = useState(false)
  const [captionEditorKey, setCaptionEditorKey] = useState(0)
  const captionEditorRef = useRef<HTMLDivElement>(null)
  const [platformOptions, setPlatformOptions] = useState<Record<string, Record<string, unknown>>>({})
  // Words belonging to ONE account. This is the state that makes two Instagram
  // accounts on one post possible: it travels as metadata.captions_by_account_id
  // and the publisher reads it back per account (publish-ticked.ts), so each
  // account is sent its own words rather than a flattened per-platform copy.
  const [captionsByAccountId, setCaptionsByAccountId] = useState<Record<string, string>>({})
  const [showCanvaImport, setShowCanvaImport] = useState(false)
  const [nextSlotIso, setNextSlotIso] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [scheduledWhen, setScheduledWhen] = useState<string>(() => {
    if (!initialScheduleDate) return ''
    return initialScheduleDate.length === 16 ? initialScheduleDate : initialScheduleDate.slice(0, 16)
  })
  const composeStateRef = useRef({
    selectedPlatforms,
    versions,
    caption,
    hashtags,
    selectedMediaIds,
    selectedAccountIds,
    platformOptions,
  })
  composeStateRef.current = {
    selectedPlatforms,
    versions,
    caption,
    hashtags,
    selectedMediaIds,
    selectedAccountIds,
    platformOptions,
  }
  const pendingDeskActions = useComposeDeskStore((s) => s.pendingDeskActions)
  const undoActions = useComposeDeskStore((s) => s.undoActions)

  const brandName = data.brand?.name ?? 'Brand'
  const postType = CONTENT_TO_POST_TYPE[contentType]
  const complianceFlags = data.brand?.compliance_flags as unknown as Record<string, boolean> | null
  const isHealthBrand = !!complianceFlags?.ahpra || !!complianceFlags?.tga
  const { accounts: connectedAccounts } = useSocialAccounts(activeBrandId)

  // ── Pre-flight: the publisher's own answers, not ours ────────────────────
  //
  // THE HONESTY GAP THIS CLOSES. The composer used to decide deliverability
  // with `brandIsPublisherLinked(social_urls)` — true whenever a publisher
  // profile exists — while the publisher decides with `publisherTransportOf`,
  // which FIRST honours the explicit `social_urls.publisher_transport` override
  // that the accounts page exposes as "Post through the self-hosted backup".
  // A business with a profile whose owner had clicked that was shown every
  // main-connection-only field as a live input, filled them in, and watched
  // them dropped in silence at send time. That is exactly the failure the
  // option panels were written to prevent, reached by a different door.
  //
  // `publisherTransportOf` now answers for both. It runs server-side, in
  // /api/social/validate, because the module it lives in reaches for the
  // publishing SDKs and those must never be built into a page bundle.
  //
  // Character ceilings and refusals come back on the same call, so the number
  // the composer shows and the rule the send enforces cannot drift apart.
  const [publisherTransport, setPublisherTransport] = useState<'zernio' | 'mixpost'>('mixpost')
  const [publisherLimits, setPublisherLimits] = useState<Partial<Record<PlatformKey, number>>>({})
  const [preflightErrors, setPreflightErrors] = useState<Array<{ platform: string; message: string }>>([])
  const [preflightWarnings, setPreflightWarnings] = useState<Array<{ platform: string; message: string }>>([])
  const [preflightChecking, setPreflightChecking] = useState(false)
  const [preflightChecked, setPreflightChecked] = useState(false)
  const [tiktokCreatorInfo, setTiktokCreatorInfo] = useState<ZernioTikTokCreatorInfo | null>(null)

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

  /**
   * Ticked accounts, with the words each one is actually publishing.
   *
   * The pre-flight, the version tabs, the preview and the save all read this
   * one list. Two Instagram accounts appear as two entries with two captions —
   * which is the whole point, and is why nothing here collapses to a platform.
   */
  /**
   * The account list the per-row partition is decided against.
   *
   * Two components fetch it — this one, and the picker, which lifts its copy up
   * through `onAccountsChange`. They are the same hook on the same business, so
   * they agree; the fallback exists because an EMPTY list here would silently
   * strip every `account_ids` off the save rather than fail loudly, and a
   * targeting rule that quietly stops targeting is worse than no rule.
   */
  const targetAccounts = connectedAccounts.length > 0 ? connectedAccounts : socialAccounts

  const selectedAccounts = connectedAccounts
    .filter((account) => selectedAccountIds.includes(account.id))
    .map((account) => ({
      id: account.id,
      name: account.name,
      platform: canonicalSocialPlatform(account.platform),
    }))

  /** An account's own words, else its network's version, else the master. */
  const captionForAccountId = useCallback(
    (accountId: string, platform: string): { caption: string; hashtags: string[] } => {
      const own = captionsByAccountId[accountId]
      if (typeof own === 'string') return { caption: own, hashtags }
      const publish = resolvePublishCaption(versions, platform as PostPlatform, caption, hashtags)
      return { caption: publish.caption, hashtags: publish.hashtags }
    },
    [captionsByAccountId, versions, caption, hashtags],
  )

  // Debounced pre-flight. Read-only, free, and the exact rules the send
  // applies. 300ms so a fast typist makes one call, not thirty.
  const preflightKey = JSON.stringify({
    activeBrandId,
    caption,
    hashtags,
    accounts: selectedAccounts.map((a) => [a.id, a.platform, captionForAccountId(a.id, a.platform).caption]),
  })

  useEffect(() => {
    if (!activeBrandId) return
    const parsed = JSON.parse(preflightKey) as {
      caption: string
      hashtags: string[]
      accounts: Array<[string, string, string]>
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setPreflightChecking(true)
      fetch('/api/social/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          brandId: activeBrandId,
          content: composePublishBody(parsed.caption, parsed.hashtags),
          targets: parsed.accounts.map(([accountId, platform, accountCaption]) => ({
            platform,
            accountId,
            customContent: composePublishBody(accountCaption, parsed.hashtags),
          })),
          tiktokAccountId: parsed.accounts.find(([, platform]) => platform === 'tiktok')?.[0],
        }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: {
          transport?: 'zernio' | 'mixpost'
          length?: Record<string, { limit: number }> | null
          validation?: { errors?: Array<{ platform: string; message: string }>; warnings?: Array<{ platform: string; message: string }> } | null
          tiktok?: ZernioTikTokCreatorInfo | null
          checked?: boolean
        } | null) => {
          if (!body) return
          if (body.transport) setPublisherTransport(body.transport)
          setPublisherLimits(limitsFromPublisher(body.length))
          setPreflightErrors(body.validation?.errors ?? [])
          setPreflightWarnings(body.validation?.warnings ?? [])
          setTiktokCreatorInfo(body.tiktok ?? null)
          setPreflightChecked(Boolean(body.checked))
        })
        .catch(() => {
          // A check that could not run must not read as a clean bill of health.
          setPreflightChecked(false)
        })
        .finally(() => setPreflightChecking(false))
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [activeBrandId, preflightKey])

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
          // The Desk hands back whatever it recorded, which may predate a
          // network being retired from the composer. Filtering through
          // isComposerPlatform rather than a hand-kept list here is the whole
          // point of that helper: a locally-written Set was how 'twitter' got
          // back in past the account strip, straight into selectedPlatforms.
          const restored = data.context.platforms
            .map((platform) => platform.toLowerCase() as PostPlatform)
            .filter((platform) => isComposerPlatform(platform))
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
  // way the media strip and the picker are guaranteed to see the same
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

  // Publish live desk snapshot for the Director rail
  useEffect(() => {
    if (!activeBrandId) {
      useComposeDeskStore.getState().setSnapshot(null)
      return
    }

    const captionPreview = caption.trim().slice(0, 240) || undefined
    useComposeDeskStore.getState().setSnapshot({
      screen: 'compose',
      brandId: activeBrandId,
      contentType,
      mediaItemIds: selectedMediaIds,
      mediaLabels: selectedMedia.map((m) => m.file_name),
      mediaTypes: selectedMedia.map((m) => m.file_type),
      platforms: selectedPlatforms,
      captionPreview,
      updatedAt: Date.now(),
    })

    return () => {
      useComposeDeskStore.getState().setSnapshot(null)
    }
  }, [
    activeBrandId,
    contentType,
    selectedMediaIds,
    selectedMedia,
    selectedPlatforms,
    caption,
  ])

  useEffect(() => {
    if (!pendingDeskActions || !activeBrandId || pendingDeskActions.brandId !== activeBrandId) {
      return
    }

    const mediaById = new Map(
      mediaItems.map((item) => [
        item.id,
        {
          mediaItemId: item.id,
          position: 0,
          type: (item.file_type?.startsWith('video')
            ? 'video'
            : item.file_type === 'image/gif'
              ? 'gif'
              : 'image') as 'image' | 'video' | 'gif',
          title: item.file_name,
          thumbnailUrl: item.thumbnail_url ?? undefined,
        },
      ]),
    )

    const applied = applyDeskActionsToCompose(
      pendingDeskActions.actions,
      {
        brandId: activeBrandId,
        caption: composeStateRef.current.caption,
        hashtags: composeStateRef.current.hashtags,
        selectedPlatforms: composeStateRef.current.selectedPlatforms,
        selectedMediaIds: composeStateRef.current.selectedMediaIds,
        selectedAccountIds: composeStateRef.current.selectedAccountIds,
        versions: composeStateRef.current.versions,
        platformOptions: composeStateRef.current.platformOptions,
        mediaById,
      },
      { hashtagsAreSuggested: pendingDeskActions.hashtagsAreSuggested },
    )

    setCaption(applied.caption)
    setHashtags(applied.hashtags)
    setSelectedPlatforms(applied.selectedPlatforms)
    setVersions(applied.versions)
    setPlatformOptions(applied.platformOptions)
    setSelectedMediaIds(applied.selectedMediaIds)
    setSelectedAccountIds(applied.selectedAccountIds)
    if (applied.showPerPlatformVersions) setShowPerPlatformVersions(true)
    setShowDirectorHashtagNote(applied.showDirectorHashtagNote)
    if (applied.scheduledAt) {
      const date = new Date(applied.scheduledAt)
      if (!Number.isNaN(date.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0')
        setScheduledWhen(
          `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
        )
      }
    }
    setCaptionEditorKey((k) => k + 1)
    useComposeDeskStore.getState().setUndoActions(applied.inverseActions)
    useComposeDeskStore.getState().enqueueDeskActions(null)

    requestAnimationFrame(() => {
      captionEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      captionEditorRef.current?.querySelector<HTMLElement>('.ProseMirror')?.focus()
    })
  }, [pendingDeskActions, activeBrandId])

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
  //
  // Measured per ACCOUNT rather than per platform, now that two accounts on one
  // network can carry different words: checking the platform's version would
  // wave through an account whose own caption is 400 characters longer.
  // The ceiling itself comes from the publisher when the pre-flight has
  // answered, and from our local table before that — never from two places at
  // once, which is how a composer ends up disagreeing with the send.
  const overLimitPlatforms = (
    selectedAccounts.length > 0
      ? selectedAccounts.map((account) => ({
          platform: account.platform,
          label: account.name,
          body: composePublishBody(
            captionForAccountId(account.id, account.platform).caption,
            hashtags,
          ),
        }))
      : selectedPlatforms.map((platform) => {
          const publish = resolvePublishCaption(versions, platform, caption, hashtags)
          return {
            platform: platform as string,
            label: platformLabel(platform),
            body: composePublishBody(publish.caption, publish.hashtags),
          }
        })
  ).flatMap((target) => {
    if (!(target.platform in PLATFORM_CHAR_LIMITS)) return []
    const key = target.platform as PlatformKey
    if (isCaptionWithinAllLimits(target.body, [key], publisherLimits)) return []
    const { limit } = limitFor(key, publisherLimits)
    // Same grapheme approximation the counts above use, so the overage quoted
    // here can never contradict the number beside the box.
    return [{ label: target.label, limit, over: Array.from(target.body).length - limit }]
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
    // Per ACCOUNT, because an account with its own words is words nobody has
    // checked. A tick earned by the master sitting over a rewritten account is
    // exactly the misleading green this section exists to stop, and on an
    // AHPRA/TGA brand a tick is what people trust instead of reading it.
    const targets = selectedAccounts.length > 0
      ? selectedAccounts.map((account) => ({
          platform: account.platform as PostPlatform,
          caption: captionForAccountId(account.id, account.platform).caption,
        }))
      : selectedPlatforms.map((platform) => ({
          platform,
          caption: resolvePublishCaption(versions, platform, caption, hashtags).caption,
        }))
    for (const target of targets) {
      const existing = byCaption.get(target.caption)
      if (existing) {
        if (!existing.platforms.includes(target.platform)) existing.platforms.push(target.platform)
      } else {
        byCaption.set(target.caption, { caption: target.caption, platforms: [target.platform] })
      }
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
  const handleSave = useCallback(async (mode: 'draft' | 'schedule' | 'now' | 'autosave', scheduledAt?: string) => {
    if (!activeBrandId || !caption.trim()) return
    // Belt and braces. The button is disabled below, but a save handler is the
    // last place that should trust its caller.
    if (hasOverLimit) return
    // Autosave lives in here rather than in its own fetch on purpose:
    // post-versions.contract.test.ts refuses any write to /api/scheduled-posts
    // outside this handler, because a second write path is exactly how the
    // preview and the saved row came to disagree about which caption a platform
    // gets. Autosave has to obey the same resolution as a press, so it goes
    // through the same door.
    const isAutosave = mode === 'autosave'
    if (isAutosave && !(editMode && editDraftId)) return
    if (isAutosave) setAutosaveState('saving')
    else setSaving(true)
    if (!isAutosave) setSaveProblem(null)

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
        if (isAutosave) {
          if (editResponse?.ok) {
            setAutosaveState('saved')
            setSavedAt(new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }))
          } else {
            // A failed autosave that looked like a saved one is worse than no
            // autosave at all — the owner walks away believing the words are
            // kept. The dot goes red and says so.
            setAutosaveState('failed')
          }
          return
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
        // Only THIS network's accounts, decided by `accountIdsForPlatform` —
        // one partitioner, unit-tested in social/safety-slice.test.ts, rather
        // than a second copy of the rule living in the composer.
        //
        // There is deliberately NO fallback to every ticked id when the filter
        // comes back empty. That fallback was the leak: a post to Instagram
        // with only a LinkedIn account ticked wrote the LinkedIn id onto the
        // Instagram row, and publish-ticked.ts walks metadata.account_ids
        // literally. An empty list is the honest answer — the row carries no
        // account override and the publisher resolves the network itself.
        const rowAccountIds = accountIdsForPlatform(selectedAccountIds, targetAccounts, platform)
        const rowAccounts = selectedAccounts.filter((account) => rowAccountIds.includes(account.id))
        const rowCaptions: Record<string, string> = {}
        for (const account of rowAccounts) {
          const own = captionsByAccountId[account.id]
          // Only a genuine override is written. Storing every account's resolved
          // caption would freeze the master into the row, so a later edit to the
          // caption would stop reaching accounts that never had their own words.
          if (typeof own === 'string' && own !== publish.caption) {
            rowCaptions[account.id] = composePublishBody(
              own,
              publish.hashtags.map((h) => h.replace(/^#/, '')),
            )
          }
        }
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
                // Only THIS network's accounts. Sending every ticked id on
                // every row told the Instagram row to publish to the LinkedIn
                // account as well; publish-ticked.ts walks this list literally.
                ...(rowAccountIds.length > 0 ? { account_ids: rowAccountIds } : {}),
                // The account-by-account words. `captionForAccount` in
                // transport.ts reads exactly this key, per account, on the way
                // to the wire — which is what lets two Instagram accounts on
                // one post carry different words and both arrive.
                ...(Object.keys(rowCaptions).length > 0
                  ? { captions_by_account_id: rowCaptions }
                  : {}),
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
      setCaptionsByAccountId({})
    } finally {
      if (!isAutosave) setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrandId, caption, hashtags, versions, hasOverLimit, reviewStamps, selectedPlatforms, selectedAccountIds, targetAccounts, captionsByAccountId, postType, selectedMediaIds, strategyContext, data, editMode, editDraftId, onDone, draftKey, platformOptions, initialScheduleDate])

  /**
   * 300ms debounced autosave, in place of a Save-draft button.
   *
   * ── What it does and, more importantly, what it will not do ──────────────
   * The reference desk watches the whole form and saves 300ms after typing
   * stops, with a dot and "Saved" in the header. Two rules make that safe here
   * rather than a way to fill the owner's Review queue with rubbish:
   *
   *  1. It never CREATES a row. Autosave only updates a draft that already
   *     exists, which is the case the reference composer is actually in — it
   *     creates the post record when the screen opens. Ours cannot, because
   *     /api/scheduled-posts writes one row per network and has no delete verb
   *     for a post: unticking a network after an autosave would strand a draft
   *     nobody asked for and nothing on this screen could clear. The first row
   *     is still born from a press, through `createDraftPost()`.
   *  2. It refuses while the health check has explicitly failed, or while the
   *     post is over a platform's ceiling. An AHPRA/TGA brand's flagged wording
   *     should not be quietly written down; the outputs library is imitated by
   *     later work, which is the whole reason `save-gate.ts` exists.
   *
   * The write itself goes through `handleSave`, never its own fetch — see the
   * note at the top of that function.
   *
   * Words are never lost either way: the local snapshot above keeps every
   * keystroke on this device regardless of what the server has.
   */
  const autosaveBodyKey = JSON.stringify({
    caption,
    hashtags,
    selectedMediaIds,
    postType,
    versions,
  })
  const autosaveSkip = useRef(true)

  useEffect(() => {
    if (!editMode || !editDraftId || !activeBrandId) return
    if (!caption.trim()) return
    if (compliancePassed === false) return
    if (hasOverLimit) return
    // The first run after a draft loads is the load itself, not an edit.
    if (autosaveSkip.current) {
      autosaveSkip.current = false
      return
    }
    const timer = setTimeout(() => { void handleSave('autosave') }, 300)
    return () => clearTimeout(timer)
  // autosaveBodyKey is the whole watched form; listing its parts again would
  // restart the debounce on every render and never let it fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveBodyKey, editMode, editDraftId, activeBrandId, compliancePassed, hasOverLimit])

  // ── No brand selected ──────────────────────────────────────────────────────
  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Select a brand from the sidebar to start creating content.</p>
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
    <div className="mx-auto flex max-w-[920px] flex-col gap-[13px]">
      <PlatformSection
        contentType={contentType}
        selected={selectedPlatforms}
        onChange={handlePlatformsChange}
        selectedAccountIds={selectedAccountIds}
        onAccountIdsChange={setSelectedAccountIds}
        onAccountsChange={setSocialAccounts}
        brandName={brandName}
      />

      <ContentTypeCompact value={contentType} onChange={setContentType} />

      <ComposeMediaStrip
        contentType={contentType}
        selectedMedia={selectedMedia}
        onReplace={() => setShowMediaLibrary(true)}
        onChooseLibrary={() => {
          setShowComposeUpload(false)
          setShowMediaLibrary(true)
        }}
        onRemove={handleMediaRemove}
        onUpload={() => {
          setShowMediaLibrary(false)
          setShowComposeUpload(true)
        }}
      />

      {/* Where the picture or video comes from. Four sources, named the way the
          owner names them — never the vendor behind any of them. */}
      <ComposeDeskCard header="Add media">
        <div className="flex flex-wrap gap-[7px]">
          <MediaSourceButton
            label="Library"
            active={showMediaLibrary}
            onClick={() => {
              setShowComposeUpload(false)
              setShowCanvaImport(false)
              setShowMediaLibrary((open) => !open)
            }}
          />
          <MediaSourceButton
            label="Upload"
            active={showComposeUpload}
            onClick={() => {
              setShowMediaLibrary(false)
              setShowCanvaImport(false)
              setShowComposeUpload((open) => !open)
            }}
          />
          <MediaSourceButton
            label="Canva"
            active={showCanvaImport}
            onClick={() => {
              setShowMediaLibrary(false)
              setShowComposeUpload(false)
              setShowCanvaImport(true)
            }}
          />
          <MediaSourceButton
            label="AI Generate"
            active={false}
            onClick={() => {
              // The Director owns image generation — it holds the brand look,
              // the compliance rules and the spend budget. A second generator
              // wired straight into this screen would have none of them.
              sendToDirector(
                [
                  `Make an image for a ${contentType.replace('_', ' ')} post for ${brandName}.`,
                  caption.trim() ? `The caption is: ${caption.trim()}` : '',
                  'Put it in the media library for this business when it is ready, and tell me when it is there.',
                ]
                  .filter(Boolean)
                  .join('\n\n'),
              )
            }}
          />
        </div>
      </ComposeDeskCard>

      {showComposeUpload && activeBrandId && (
        <ComposeDeskCard header="Upload">
          <ComposeMediaUpload
            brandId={activeBrandId}
            accept={acceptTypes.includes('video') ? 'video' : 'image'}
            onUploaded={(mediaItemId) => {
              setSelectedMediaIds((prev) =>
                maxMedia === 1 ? [mediaItemId] : [...prev, mediaItemId].slice(0, maxMedia),
              )
              void fetchMedia()
              setShowComposeUpload(false)
            }}
          />
        </ComposeDeskCard>
      )}

      {showCanvaImport && (
        <CanvaImportModal
          onClose={() => setShowCanvaImport(false)}
          onImported={() => {
            void fetchMedia()
            setShowCanvaImport(false)
            setShowMediaLibrary(true)
          }}
        />
      )}

      {showMediaLibrary && (
        <ComposeDeskCard header="Library">
          <MediaSelector
            brandId={activeBrandId}
            selectedIds={selectedMediaIds}
            onChange={handleMediaSelect}
            maxCount={maxMedia}
            acceptTypes={acceptTypes}
            items={mediaItems}
          />
        </ComposeDeskCard>
      )}

      <ComposeDeskCard flush>
        <div className="space-y-0">
          <div className="px-4 pt-3">
            <CreatorModeBar mode={creatorMode} onModeChange={setCreatorMode} />
            {creatorMode === 'template' && (
              <div className="mt-3 rounded-[8px] border p-3" style={{ borderColor: 'var(--line)', background: 'var(--panel-2)' }}>
                <PostTemplatePicker
                  brandId={activeBrandId}
                  brandName={brandName}
                  onApply={handleTemplateApply}
                />
              </div>
            )}
          </div>

          <div ref={captionEditorRef} data-caption-editor>
          <RichCaptionEditor
            key={captionEditorKey}
            desk
            value={caption}
            onChange={(text) => handleCaptionChange(text)}
            placeholder="Write your post here…"
            brandName={brandName}
            platforms={selectedPlatforms}
          />
          </div>
        </div>
      </ComposeDeskCard>

      {selectedPlatforms.length > 0 && (
        <ComposeDeskCard header="How each account will read it">
          <PlatformVersionEditor
            platforms={selectedPlatforms}
            accounts={selectedAccounts}
            captionsByAccountId={captionsByAccountId}
            onCaptionsByAccountIdChange={setCaptionsByAccountId}
            publisherLimits={publisherLimits}
            tiktokCreatorInfo={tiktokCreatorInfo}
            masterCaption={caption}
            masterHashtags={hashtags}
            versions={versions}
            onMasterChange={(c, h) => {
              setCaption(c)
              setHashtags(h)
            }}
            onVersionsChange={(next) => {
              setVersions(next)
              setShowPerPlatformVersions(true)
            }}
            platformOptions={platformOptions}
            onPlatformOptionsChange={setPlatformOptions}
            transport={publisherTransport}
          />
        </ComposeDeskCard>
      )}

      {selectedPlatforms.length > 0 && (
        <PostContentValidator
          caption={composePublishBody(caption, hashtags)}
          platforms={selectedPlatforms.filter((p) => p in PLATFORM_CHAR_LIMITS) as PlatformKey[]}
          publisherLimits={publisherLimits}
          errors={preflightErrors}
          warnings={preflightWarnings}
          checking={preflightChecking}
          checked={preflightChecked}
        />
      )}

      <ComposeDeskCard header="Hashtags">
        {showDirectorHashtagNote && (
          <p
            className="mb-3 rounded-[8px] border px-3 py-2 text-[11px] leading-snug"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--panel-2)',
              color: 'var(--ink-3)',
            }}
          >
            {DIRECTOR_HASHTAG_DISCLAIMER}
          </p>
        )}
        <HashtagSection
          embedded
          brandId={activeBrandId}
          hashtags={hashtags}
          onChange={handleHashtagsChange}
          selectedPlatforms={selectedPlatforms}
          caption={caption}
        />
      </ComposeDeskCard>

      {isHealthBrand && (
        <div
          className="rounded-[11px] border border-l-[3px] px-[14px] py-3"
          style={{
            borderColor: 'var(--line)',
            borderLeftColor: 'var(--care)',
            background: 'var(--care-wash)',
          }}
        >
          {complianceTargets.map((target) => (
            <div key={target.platforms.join('|') || 'master'}>
              {complianceTargets.length > 1 && (
                <p className="mb-2 text-[10px] font-medium" style={{ color: 'var(--ink-3)' }}>
                  {listPlatforms(target.platforms)}
                </p>
              )}
              <ComplianceSection
                caption={target.caption}
                brandName={brandName}
                isHealthBrand={isHealthBrand}
                onResult={(result) => handleComplianceResult(target.caption, result)}
              />
            </div>
          ))}
        </div>
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
      {undoActions && undoActions.length > 0 && (
        <div className="flex items-center justify-between rounded-[8px] border px-3 py-2 text-[12px]" style={{ borderColor: 'var(--line)', background: 'var(--panel-2)', color: 'var(--ink-2)' }}>
          <span>Director change is on the post.</span>
          <button
            type="button"
            onClick={() => useComposeDeskStore.getState().requestUndo()}
            className="font-[600] underline-offset-2 hover:underline"
            style={{ color: 'var(--brand-deep, var(--ink))' }}
          >
            Undo
          </button>
        </div>
      )}
      <CreatorActionBar
        platforms={selectedPlatforms}
        autosaveState={autosaveState}
        captionEmpty={!caption.trim() || hasOverLimit}
        compliancePassed={compliancePassed}
        saving={saving}
        onSave={handleSave}
        editMode={editMode}
        nextSlotIso={nextSlotIso}
        savedAt={savedAt}
        scheduledWhen={scheduledWhen}
        onScheduledWhenChange={setScheduledWhen}
      />
    </div>
  )

  // The right pane. Preview draws ONE ticked account at a time — the words that
  // account is actually publishing, resolved by the same `captionForAccountId`
  // the save handler and the pre-flight read, so the phone cannot show one
  // caption while another goes out.
  const previewPane = (
    <ComposerPreviewPane
      accounts={selectedAccounts}
      captionFor={captionForAccountId}
      mediaUrl={mediaUrl}
      mediaUrls={mediaUrls}
      brandName={brandName}
    />
  )

  // History belongs to a saved post. A brand-new post has no row to hang an
  // event or a note on yet, and the pane says exactly that rather than taking a
  // comment it cannot store.
  const activityPane = <ComposerActivityPane scheduledPostId={editDraftId} />

  return (
    <ComposerLayout
      editor={editorPane}
      preview={previewPane}
      activity={activityPane}
      actionBar={actionBar}
      chrome={chrome}
    />
  )
}
