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
import type { PostPlatform, PostType, ScheduledPostStatus } from '@/types/database'

/**
 * How long a caller waits for Mixpost before it reports 'pending' and moves on.
 *
 * Media already pushed to Mixpost is cached on `media_items.mixpost_media_id`,
 * so re-used media returns in well under a second. A first-time large video
 * transcode can take far longer than this — hence the bound, and hence
 * 'pending' rather than a lie.
 */
const MIXPOST_WAIT_MS = 90_000

export type MixpostSyncOutcome = 'synced' | 'pending' | 'failed' | 'skipped'

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

  const postType = postTypeOverride ?? derivePostType(platform, isVideo, mediaItemIds.length)

  const insertData: Record<string, unknown> = {
    user_id: userId,
    brand_id: brandId,
    platform,
    caption,
    hashtags,
    status,
    scheduled_at: scheduledAt ?? new Date().toISOString(),
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
    throw new Error(`Could not save the draft: ${error?.message ?? 'unknown error'}`)
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
      return `Saved in NRS, but it did NOT reach Mixpost${result.mixpostError ? ` (${result.mixpostError})` : ''}.`
    case 'skipped':
      return 'Saved in NRS.'
  }
}
