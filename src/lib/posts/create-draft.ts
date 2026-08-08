/**
 * Canonical draft-post creation — the ONE place a draft is born.
 *
 * Why this exists:
 * Before this, `syncDraftToMixpost` had exactly one caller — the browser route
 * `POST /api/scheduled-posts`. Every AI path that created a draft inserted
 * straight into `scheduled_posts` and stopped: the MCP `draft_post` tool,
 * `repurpose_content`, `fill_calendar`, `process_media`, `ab_test`. So a draft
 * made from Claude, Codex, Hermes or Telegram existed in NRS and was invisible
 * in Mixpost — the user was told their post was ready for review when the
 * review surface had never heard of it.
 *
 * Every draft-creation site now goes through `createDraftPost`, so reaching
 * Mixpost is not something a caller can forget to do.
 *
 * Honesty contract: the returned `mixpost` field says what actually happened.
 * Callers MUST relay it rather than claiming success — 'synced' means Mixpost
 * confirmed it, 'pending' means the upload is still running past our wait
 * bound, 'failed' means it did not get there. Never report 'pending' as done.
 *
 * NODE RUNTIME ONLY — syncDraftToMixpost uses long fetches and Storage writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncDraftToMixpost } from '@/lib/mixpost/sync-draft'
import { userSafeError } from '@/lib/errors/user-safe'
import type { PostPlatform, PostType, ScheduledPostStatus } from '@/types/database'
import { enforceBrandName } from '@/lib/brand/enforce-name'

/**
 * How long a caller waits for Mixpost before it reports 'pending' and moves on.
 *
 * Media already pushed to Mixpost is cached on `media_items.mixpost_media_id`,
 * so re-used media returns in well under a second. A first-time large video
 * transcode can take far longer than this — hence the bound, and hence
 * 'pending' rather than a lie.
 */
const MIXPOST_WAIT_MS = 90_000

export type MixpostSyncOutcome = 'synced' | 'pending' | 'failed' | 'skipped' | 'duplicate'

export interface CreateDraftInput {
  /** Client used for the insert — RLS applies where the caller is a user. */
  supabase: SupabaseClient
  userId: string
  brandId: string
  platform: PostPlatform
  caption: string
  hashtags?: string[]
  /** Media to attach. Post type and image_url are derived from the first item. */
  mediaItemIds?: string[]
  /** Override the derived post type (carousel, for instance). */
  postType?: PostType
  status?: ScheduledPostStatus
  /** ISO datetime. Defaults to now, which is what a draft carries. */
  scheduledAt?: string
  metadata?: Record<string, unknown>
  contentType?: string | null
  contentPillar?: string | null
  outputId?: string | null
  /**
   * Wait for Mixpost before returning (default true). The browser route sets
   * this false so the user's POST stays fast — it already returns the row and
   * the Review tab polls for the Mixpost pill.
   */
  awaitMixpost?: boolean
}

export interface CreateDraftResult {
  id: string
  postType: PostType
  mediaItemIds: string[]
  mixpost: MixpostSyncOutcome
  mixpostError?: string
  /** Present once Mixpost confirms — this is what the Review tab renders from. */
  mixpostPostUuid?: string
  /**
   * The draft this request matched instead of creating a second one.
   *
   * Returned rather than hidden so the caller can SAY "that one already
   * exists" — silently returning an old id would be its own quiet lie.
   */
  duplicateOf?: string
}

/**
 * Platforms that will only accept video. Handing them a photo carousel makes a
 * draft that cannot ever publish.
 *
 * Seen in practice: a three-photo Telegram album produced an Instagram
 * carousel, a Facebook carousel AND a YouTube carousel. The first two are
 * fine; the third is impossible — YouTube has no concept of an image post, so
 * that draft was destined to fail at publish time having looked fine in review.
 */
const VIDEO_ONLY_PLATFORMS = new Set<PostPlatform>(['youtube', 'tiktok'])

/**
 * Reject a draft the platform could never publish, with a reason the agent can
 * act on. Returns null when the combination is fine.
 */
export function checkPlatformSupportsMedia(
  platform: PostPlatform,
  hasVideo: boolean,
  mediaCount: number,
): string | null {
  if (VIDEO_ONLY_PLATFORMS.has(platform)) {
    if (mediaCount === 0) {
      return `${platform} requires a video — it cannot publish a text-only post. Attach the video, or drop ${platform} from this set.`
    }
    if (!hasVideo) {
      return `${platform} only publishes video and cannot post images. Use Instagram or Facebook for a photo carousel, and keep ${platform} for the video.`
    }
  }
  return null
}

/**
 * Coerce whatever a caller sent for a schedule time into something Postgres
 * will accept, falling back to now.
 *
 * Callers here include language models, which send "", "null", "none" or a
 * half-formed date when they mean "no schedule — it's a draft". None of those
 * should cost the user the copy that was already written.
 */
export function normaliseTimestamp(value: string | null | undefined): string {
  if (typeof value !== 'string') return new Date().toISOString()
  const trimmed = value.trim()
  if (!trimmed || ['null', 'none', 'undefined', 'n/a'].includes(trimmed.toLowerCase())) {
    return new Date().toISOString()
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

/**
 * Derive the post type Mixpost expects from the attached media.
 *
 * Reels are the native vertical-video format on Instagram, Facebook and TikTok;
 * everywhere else a video is just a video. No media at all means a single post.
 */
function derivePostType(
  platform: PostPlatform,
  isVideo: boolean,
  mediaCount: number,
): PostType {
  if (isVideo) {
    return platform === 'instagram' || platform === 'facebook' || platform === 'tiktok'
      ? 'reel'
      : 'video'
  }
  return mediaCount > 1 ? 'carousel' : 'single'
}

/**
 * Create one draft and push it to Mixpost.
 *
 * Throws only if the NRS insert itself fails — a Mixpost problem is reported
 * through `mixpost`/`mixpostError`, never by discarding a draft the user's
 * agent already wrote.
 */
/** Long enough to catch a repeated request, short enough to allow a repost. */
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000
/** Enough of the caption to identify it; not so much that an edit slips past. */
const DUPLICATE_MATCH_CHARS = 120

export async function createDraftPost(input: CreateDraftInput): Promise<CreateDraftResult> {
  const {
    supabase,
    userId,
    brandId,
    platform,
    caption,
    hashtags = [],
    mediaItemIds = [],
    postType: postTypeOverride,
    status = 'draft',
    scheduledAt,
    metadata = {},
    contentType,
    contentPillar,
    outputId,
    awaitMixpost = true,
  } = input

  // Spell the brand right in anything that will be published.
  //
  // This is the ONE place a draft is born, so it is the one place the check
  // has to hold — a caption can reach here from the Director, from a tool, or
  // from a hand edit, and the copy that goes to a customer must be correct
  // whichever door it came through. URLs and handles are left alone.
  const { data: namingBrand } = await supabase
    .from('brands').select('name, name_never').eq('id', brandId).maybeSingle()

  const naming = namingBrand?.name
    ? enforceBrandName(caption, {
      name: namingBrand.name as string,
      nameNever: (namingBrand.name_never as string[] | null) ?? [],
    })
    : { text: caption, corrected: [] as string[] }

  if (naming.corrected.length > 0) {
    console.warn(`[create-draft] brand name corrected in caption: ${naming.corrected.join(', ')}`)
  }
  const correctedCaption = naming.text

  // Has this exact post already been drafted?
  //
  // The owner asked once and received SIX drafts — three identical pairs. He
  // even said "you did them already" and got two more, because nothing
  // anywhere checked, and a Director that has just written a caption has no
  // way to know it wrote the same one four minutes ago.
  //
  // Matched on brand, platform, media and the opening of the caption, within a
  // short window. Not on the whole caption: a reworded version IS a new draft
  // and must be allowed through. The window keeps a deliberate repost next
  // week working.
  const { data: recent } = await supabase
    .from('scheduled_posts')
    .select('id, caption, media_item_ids, metadata')
    .eq('brand_id', brandId)
    .eq('platform', platform)
    .eq('status', 'draft')
    .gte('created_at', new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  const opening = correctedCaption.trim().slice(0, DUPLICATE_MATCH_CHARS).toLowerCase()
  const duplicate = (recent ?? []).find((row) => {
    const sameOpening = typeof row.caption === 'string'
      && row.caption.trim().slice(0, DUPLICATE_MATCH_CHARS).toLowerCase() === opening
    const sameMedia = JSON.stringify((row.media_item_ids ?? []).slice().sort())
      === JSON.stringify(mediaItemIds.slice().sort())
    return sameOpening && sameMedia
  })

  if (duplicate) {
    console.warn(`[create-draft] duplicate suppressed for ${platform}; returning ${duplicate.id}`)
    return {
      id: duplicate.id as string,
      postType: postTypeOverride ?? 'single',
      mediaItemIds,
      mixpost: 'duplicate',
      // The Mixpost id lives in metadata, not a column — a select-columns test
      // caught this being asked for as a field that has never existed.
      ...(() => {
        const uuid = (duplicate.metadata as { mixpost?: { uuid?: unknown } } | null)?.mixpost?.uuid
        return typeof uuid === 'string' ? { mixpostPostUuid: uuid } : {}
      })(),
      duplicateOf: duplicate.id as string,
    }
  }

  // Resolve the media so post_type and image_url match what's attached.
  let isVideo = false
  let firstMediaUrl: string | null = null
  if (mediaItemIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('media_items')
      .select('id, file_url, file_type')
      .in('id', mediaItemIds)

    const first = mediaRows?.find((row) => row.id === mediaItemIds[0]) ?? mediaRows?.[0]
    if (first) {
      isVideo = typeof first.file_type === 'string' && first.file_type.startsWith('video/')
      firstMediaUrl = first.file_url as string
    }
  }

  // Refuse now, with a reason, rather than producing a draft that looks right
  // in review and fails the moment it is published.
  const unsupported = checkPlatformSupportsMedia(platform, isVideo, mediaItemIds.length)
  if (unsupported) throw new Error(unsupported)

  const postType = postTypeOverride ?? derivePostType(platform, isVideo, mediaItemIds.length)

  // An agent asked for an unscheduled draft naturally sends "" (or a stray
  // "null"/"none") for scheduled_at. `??` only catches null/undefined, so the
  // empty string reached Postgres and the whole insert died with "invalid
  // input syntax for type timestamp" — losing copy the Director had already
  // written. A draft has no schedule by definition: anything unusable means now.
  const resolvedScheduledAt = normaliseTimestamp(scheduledAt)

  const insertData: Record<string, unknown> = {
    user_id: userId,
    brand_id: brandId,
    platform,
    caption: correctedCaption,
    hashtags,
    status,
    scheduled_at: resolvedScheduledAt,
    post_type: postType,
    media_item_ids: mediaItemIds,
    metadata: { ...metadata, source: metadata.source ?? 'unknown' },
  }
  // Images render from image_url in the Review tab; videos render from the
  // Mixpost preview, so setting it for a video would show a broken still.
  if (firstMediaUrl && !isVideo) insertData.image_url = firstMediaUrl
  if (mediaItemIds.length > 0) insertData.media_item_id = mediaItemIds[0]
  if (contentType) insertData.content_type = contentType
  if (contentPillar) insertData.content_pillar = contentPillar
  if (outputId) insertData.output_id = outputId

  const { data, error } = await supabase
    .from('scheduled_posts')
    .insert(insertData)
    .select('id')
    .single()

  if (error || !data) {
    // Four callers relay this straight to the owner, including the prewritten
    // calendar summary. The database's own words must not travel that far.
    throw new Error(
      userSafeError('create-draft', error, 'Could not save the draft. Nothing was published — try again.'),
    )
  }

  const postId = data.id as string
  const base: CreateDraftResult = { id: postId, postType, mediaItemIds, mixpost: 'skipped' }

  // Only drafts and scheduled posts belong in Mixpost.
  if (status !== 'draft' && status !== 'scheduled') return base

  const sync = pushToMixpost(postId)

  if (!awaitMixpost) {
    return { ...base, mixpost: 'pending' }
  }

  const outcome = await Promise.race([
    sync,
    new Promise<{ outcome: MixpostSyncOutcome }>((resolve) =>
      setTimeout(() => resolve({ outcome: 'pending' }), MIXPOST_WAIT_MS),
    ),
  ])

  return { ...base, ...outcome, mixpost: outcome.outcome }
}

/**
 * Run the Mixpost sync with an admin client, swallowing nothing.
 *
 * Uses admin because the sync writes across rows the calling user may not own
 * directly (`media_items.mixpost_media_id`, `scheduled_posts.metadata.mixpost`).
 * Never rejects — a Mixpost failure is data, not a crash.
 */
function pushToMixpost(postId: string): Promise<{
  outcome: MixpostSyncOutcome
  mixpostError?: string
  mixpostPostUuid?: string
}> {
  return (async () => {
    try {
      const admin = createAdminClient()
      const result = await syncDraftToMixpost(admin, postId)
      if (!result.ok) {
        console.warn(`[create-draft] Mixpost sync failed for ${postId}:`, result.error)
        return { outcome: 'failed' as const, mixpostError: result.error }
      }
      return { outcome: 'synced' as const, mixpostPostUuid: result.mixpost_post_uuid }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[create-draft] Mixpost sync threw for ${postId}:`, err)
      return { outcome: 'failed' as const, mixpostError: message }
    }
  })()
}

/**
 * Create several drafts at once — used by fill_calendar, which plans a whole
 * week or month in one go.
 *
 * Mixpost pushes run with bounded concurrency so a 30-post calendar doesn't
 * open 30 simultaneous video transcodes on the VPS.
 */
export async function createDraftPosts(
  inputs: readonly CreateDraftInput[],
  concurrency = 3,
): Promise<Array<CreateDraftResult | { error: string }>> {
  const results: Array<CreateDraftResult | { error: string }> = new Array(inputs.length)
  let cursor = 0

  async function worker() {
    while (cursor < inputs.length) {
      const index = cursor++
      try {
        results[index] = await createDraftPost(inputs[index])
      } catch (err) {
        results[index] = { error: err instanceof Error ? err.message : String(err) }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()),
  )

  return results
}

/**
 * One line a caller can put in front of the user without overstating things.
 * Keeps the honesty contract in one place instead of each tool inventing it.
 */
export function describeMixpostOutcome(result: CreateDraftResult): string {
  switch (result.mixpost) {
    case 'synced':
      return 'In Mixpost and ready to review.'
    case 'pending':
      return 'Saved in NRS. Still uploading to Mixpost — it will appear in Review shortly.'
    case 'failed':
      // The reason is logged where the sync failed. Repeating it here puts a
      // Mixpost stack trace in front of someone deciding whether to post.
      return 'Saved in NRS, but it did NOT reach Mixpost. It is safe to try again.'
    case 'skipped':
      return 'Saved in NRS.'
    case 'duplicate':
      // Said out loud rather than passed off as a new draft. The owner asked
      // once and got six; being told plainly that one already exists is the
      // whole point of catching it.
      return 'That one is already drafted — I have not made a second copy. It is in Mixpost'
        + ' waiting for you.'
  }
}
