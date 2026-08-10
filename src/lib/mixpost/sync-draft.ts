/**
 * Mixpost draft sync — push NRS scheduled_posts drafts to Mixpost.
 *
 * Why this exists:
 * - NRS stores drafts in scheduled_posts (Supabase). Mixpost stores them in
 *   its own DB on the VPS.
 * - For Path 3 of the Review tab — embed Mixpost as the actual preview /
 *   approval surface — every NRS draft needs a corresponding Mixpost draft
 *   so the user can click "View in Mixpost" and see / play the real post.
 * - The publish-to-social tool already does this on PUBLISH. This helper
 *   does the same thing on SAVE (status='draft'), so the Mixpost preview
 *   is ready by the time the user opens the Review tab.
 *
 * It's also why "recent NRS uploads not in Mixpost library" — they go to
 * Supabase Storage but never get pushed to Mixpost until publish runs.
 * This sync now uploads them at draft-creation time too.
 *
 * Reuses the same Mixpost remote-initiate + poll + cache pattern as
 * publish-to-social.ts so videos only transcode once per media_item.
 *
 * NODE RUNTIME ONLY — uses fetch with long timeouts and writes to
 * Supabase Storage. Do not import from edge routes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchMixpostAccounts,
  resolveAccountIdsForPlatform,
  createMixpostPost,
  type MixpostVersion,
} from './client'
import { ensureBrandTagInMixpost, ensureHashtagGroupTagInMixpost } from './sync-tags'
import { mapAccountsToBrandsRaw } from './brand-mapping'

const POLL_MAX_SECONDS = 1800 // 30 min — covers worst-case 2 GB video transcode with 2-pass ffmpeg on the VPS

interface DraftSyncResult {
  ok: boolean
  mixpost_post_id?: number
  mixpost_post_uuid?: string
  mixpost_workspace_uuid?: string
  error?: string
  /** Per-media outcomes so the caller can surface partial failures */
  media_results?: Array<{ media_item_id: string; mixpost_media_id: number | null; error?: string }>
}

/**
 * Which file actually gets published for a media item.
 *
 * Videos may have derived copies — `_captioned.mp4`, `_tight.mp4`,
 * `_social.mp4` — and the most finished one must win, in that order: captioned
 * is built ON TOP of tightened, so publishing the tightened copy after captions
 * were asked for would drop them silently, and Instagram fetches this URL
 * itself and fails on a 300 MB master long after the draft looked fine.
 *
 * IMAGES ALWAYS PUBLISH THE ORIGINAL BYTES. Nothing in the pipeline writes any
 * of those three keys onto an image row today, but the chain was not gated on
 * file type, so one stray key would have silently published a derived file in
 * place of the owner's upload. That risk is not abstract here: he lost a full
 * day to a blurry card — a clean 117 KB PNG uploaded twice, and a 48 KB
 * Telegram-compressed JPEG published instead.
 */
export function resolvePublishUrl(item: {
  file_url: string
  file_type?: string | null
  metadata?: Record<string, unknown> | null
}): string {
  const isVideoItem = typeof item.file_type === 'string' && item.file_type.startsWith('video/')
  if (!isVideoItem) return item.file_url

  const metadata = item.metadata ?? {}
  const urlAt = (key: string): string | null => {
    const value = (metadata[key] as { url?: unknown } | undefined)?.url
    return typeof value === 'string' && value ? value : null
  }

  return urlAt('captioned') ?? urlAt('tightened') ?? urlAt('delivery') ?? item.file_url
}

/**
 * Ensure a single media_items row is uploaded to Mixpost.
 * Returns the Mixpost numeric media_id (cached or freshly uploaded).
 *
 * If the row already has mixpost_media_id, returns it directly (cache hit).
 * Otherwise calls Mixpost's /media/remote/initiate, polls until completed,
 * caches the result on the media_items row.
 */
export async function ensureMediaInMixpost(
  supabase: SupabaseClient,
  mediaItemId: string,
): Promise<{ id: number | null; error?: string }> {
  const apiBase = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID
  if (!apiBase || !token) {
    return { id: null, error: 'Mixpost not configured (MIXPOST_API_URL/TOKEN missing)' }
  }

  const workspaceBase = workspace ? `${apiBase}/api/${workspace}` : `${apiBase}/api`

  // Fetch media item
  const { data: item, error: fetchErr } = await supabase
    .from('media_items')
    .select('id, file_url, file_type, file_name, mixpost_media_id, thumbnail_url, metadata')
    .eq('id', mediaItemId)
    .single()

  if (fetchErr || !item) {
    return { id: null, error: `media_items row not found: ${fetchErr?.message ?? mediaItemId}` }
  }

  // Cache hit — already in Mixpost
  if (item.mixpost_media_id) {
    return { id: item.mixpost_media_id as number }
  }

  // Exactly one caller may upload a given media item.
  //
  // The cache above is only written when an upload FINISHES. Without this,
  // every draft created while the first upload is still transcoding starts its
  // own — the Director creates its drafts CONCURRENTLY, so three drafts of one
  // video put four copies of it in the Mixpost library, each costing a full
  // transcode of a 240MB file.
  //
  // The claim is a compare-and-set: the UPDATE only matches while no claim
  // exists, so Postgres row locking settles the race and the losers wait for
  // the winner instead of duplicating its work.
  const claimed = await claimUpload(supabase, mediaItemId)
  if (!claimed) {
    const waited = await waitForUploadedMedia(supabase, mediaItemId)
    if (waited) return { id: waited }
    // The holder died without finishing. Clear the dead claim so this media
    // isn't stuck forever, then upload it ourselves.
    console.warn(`[sync-draft] stale upload claim on ${mediaItemId}; taking it over`)
    await clearUploadClaim(supabase, mediaItemId)
    const retaken = await claimUpload(supabase, mediaItemId)
    if (!retaken) {
      const second = await waitForUploadedMedia(supabase, mediaItemId)
      if (second) return { id: second }
      return { id: null, error: 'Another upload of this media is in progress and did not complete' }
    }
  }

  // Publish the delivery copy when the pipeline made one.
  //
  // Instagram does not receive an upload — it fetches this URL and transcodes
  // its end, and a 300 MB phone video fails that fetch with "error code
  // 2207082" long after the draft looked fine. The master stays in the library
  // untouched; what goes out is the lighter copy.
  //
  // A captioned copy outranks both. Asking for captions and then publishing
  // the version without them would be the worst possible outcome — it looks
  // like it worked right up until the post is live.
  const publishUrl = resolvePublishUrl({
    file_url: item.file_url as string,
    file_type: item.file_type as string | null,
    metadata: item.metadata as Record<string, unknown> | null,
  })

  // Remote initiate
  const initiateRes = await fetch(`${workspaceBase}/media/remote/initiate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: publishUrl, alt_text: '' }),
  })

  if (!initiateRes.ok) {
    const txt = await initiateRes.text().catch(() => '')
    await clearUploadClaim(supabase, mediaItemId)
    return { id: null, error: `Mixpost remote/initiate ${initiateRes.status}: ${txt.slice(0, 200)}` }
  }

  const initiateData = await initiateRes.json()
  let uploadedId: number | null = null
  let uploadedUuid: string | null = null

  if (initiateData.status === 'completed') {
    // Fast path — image
    const id = Number(initiateData.media?.id ?? initiateData.id ?? initiateData.data?.id ?? NaN)
    uploadedId = Number.isFinite(id) ? id : null
    uploadedUuid = initiateData.media?.uuid ?? initiateData.uuid ?? initiateData.data?.uuid ?? null
  } else if (initiateData.status === 'pending' && initiateData.download_id) {
    // Slow path — video. We already hold the claim, so anyone else wanting
    // this media waits for us rather than starting a second transcode.
    const result = await pollRemoteUpload(workspaceBase, token, String(initiateData.download_id))
    if (result.id) {
      uploadedId = result.id
      uploadedUuid = result.uuid
    } else {
      // Release so this media can be retried instead of being stuck behind a
      // claim that will never complete.
      await clearUploadClaim(supabase, mediaItemId)
      return { id: null, error: result.error ?? 'Mixpost remote upload polling failed' }
    }
  } else if (initiateData.status === 'failed') {
    await clearUploadClaim(supabase, mediaItemId)
    return { id: null, error: `Mixpost remote/initiate returned failed: ${initiateData.error ?? 'unknown'}` }
  }

  if (uploadedId == null) {
    await clearUploadClaim(supabase, mediaItemId)
    return { id: null, error: 'Mixpost remote/initiate returned an unexpected shape' }
  }

  // Cache on the media_items row so future syncs are instant.
  // MUST be awaited — the earlier fire-and-forget version silently
  // dropped the writeback, causing subsequent sync calls to re-upload
  // the same video and trigger a fresh ~6 minute ffmpeg transcode for
  // every draft referencing it. Bug discovered 2026-04-10 during the
  // drafts backfill when post 1 hung for 10+ min.
  await cacheMixpostMedia(supabase, mediaItemId, uploadedId, uploadedUuid)

  return { id: uploadedId }
}

/**
 * Per-platform publishing options Mixpost expects on a version.
 *
 * These were never sent, and the defaults are wrong for what NRS creates:
 *   - Instagram/Facebook default to type 'post', so a vertical 9:16 video was
 *     published as a feed video and rendered pillarboxed with black bars down
 *     both sides instead of as a Reel.
 *   - YouTube defaults to an EMPTY title, which is why YouTube drafts arrived
 *     broken — a YouTube video with no title is not a valid post.
 *
 * Shapes taken from Mixpost Pro's own *PostOptions classes on the VPS
 * (InstagramPostOptions, FacebookPagePostOptions, YoutubePostOptions).
 */
export function buildPlatformOptions(
  provider: string,
  postType: string | null,
  caption: string,
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  const isReel = postType === 'reel'

  switch (provider) {
    case 'instagram':
    case 'instagram_standalone':
    case 'facebook_page':
    case 'facebook':
      // 'post' | 'reel' | 'story'. A carousel or single image stays a 'post';
      // only a vertical video should become a Reel.
      return { [provider]: { type: isReel ? 'reel' : 'post' } }

    case 'tiktok':
      // TikTok will add a recommended track to a PHOTO post by itself, and the
      // owner can swap it in the app afterwards. Choosing a specific trending
      // sound is not possible through any API — TikTok does not expose its
      // music library to third parties, for licensing reasons — but silence on
      // a photo carousel is a choice nobody wanted, and this avoids it.
      //
      // Video is deliberately left alone: its audio is already in the file, and
      // TikTok will not add music over an existing soundtrack.
      return {
        tiktok: {
          auto_add_music: { 'account-0': !isReel && postType !== 'video' },
        },
      }

    case 'youtube':
      return {
        youtube: {
          title: deriveYoutubeTitle(caption, metadata),
          // Mixpost defaults this to 'public'. A draft the owner has not
          // approved must never default to publishing publicly, so say
          // 'private' unless the post explicitly asks otherwise.
          status: (metadata?.youtube_status as string) ?? 'private',
          made_for_kids: Boolean(metadata?.made_for_kids ?? false),
        },
      }

    default:
      return undefined
  }
}

/** YouTube titles are capped at 100 characters and must not be empty. */
const YOUTUBE_TITLE_MAX = 100

/**
 * A YouTube video needs a title, and the Director writes a caption. Prefer an
 * explicit title if one was set, otherwise take the first real line of the
 * caption — hashtags stripped, trimmed to YouTube's limit on a word boundary.
 */
export function deriveYoutubeTitle(
  caption: string,
  metadata: Record<string, unknown> | null,
): string {
  const explicit = (metadata?.youtube_title as string | undefined)?.trim()
  if (explicit) return explicit.slice(0, YOUTUBE_TITLE_MAX)

  const firstLine =
    (caption ?? '')
      .split('\n')
      .map((line) => line.replace(/#[\w-]+/g, '').trim())
      .find((line) => line.length > 0) ?? ''

  if (!firstLine) return 'Untitled video'
  if (firstLine.length <= YOUTUBE_TITLE_MAX) return firstLine

  // Cut on a word boundary so the title doesn't end mid-word.
  const clipped = firstLine.slice(0, YOUTUBE_TITLE_MAX)
  const lastSpace = clipped.lastIndexOf(' ')
  return (lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trim()
}

/** How long a recorded upload claim is trusted before it's treated as dead. */
const UPLOAD_CLAIM_TTL_MS = (POLL_MAX_SECONDS + 300) * 1000

/**
 * Take exclusive ownership of uploading this media, or report that someone
 * else already has it.
 *
 * The `.is(metadata->mixpost_upload, null)` filter makes this a compare-and-set:
 * Postgres serialises the concurrent UPDATEs on the row, so of N simultaneous
 * callers exactly one gets a row back and the rest get none. Verified against
 * the live database — two concurrent attempts, one winner.
 */
async function claimUpload(supabase: SupabaseClient, mediaItemId: string): Promise<boolean> {
  const { data: row } = await supabase
    .from('media_items')
    .select('metadata')
    .eq('id', mediaItemId)
    .single()

  const metadata = (row?.metadata as Record<string, unknown> | null) ?? {}

  // A claim already visible here means someone beat us — no need to attempt.
  if (isLiveClaim(metadata.mixpost_upload)) return false

  const { data, error } = await supabase
    .from('media_items')
    .update({
      metadata: {
        ...metadata,
        mixpost_upload: { started_at: new Date().toISOString() },
      },
    })
    .eq('id', mediaItemId)
    .is('metadata->mixpost_upload', null)
    .select('id')

  if (error) {
    // Never block the upload on claim bookkeeping — worst case is the old
    // duplicate-upload behaviour, which is better than no draft at all.
    console.warn(`[sync-draft] claim attempt failed for ${mediaItemId}: ${error.message}`)
    return true
  }

  return (data?.length ?? 0) > 0
}

/** True when a claim exists and is recent enough to still be trusted. */
function isLiveClaim(claim: unknown): boolean {
  const startedAt = (claim as { started_at?: string } | undefined)?.started_at
  if (!startedAt) return false
  const t = new Date(startedAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= UPLOAD_CLAIM_TTL_MS
}

/** Clear a claim so the media can be retried. */
async function clearUploadClaim(supabase: SupabaseClient, mediaItemId: string): Promise<void> {
  const { data: row } = await supabase
    .from('media_items')
    .select('metadata')
    .eq('id', mediaItemId)
    .single()
  const metadata = { ...((row?.metadata as Record<string, unknown> | null) ?? {}) }
  delete metadata.mixpost_upload
  await supabase.from('media_items').update({ metadata }).eq('id', mediaItemId)
}

/**
 * Wait for whoever holds the claim to finish, returning their uploaded media id.
 * Returns null if they never finish inside the claim's lifetime.
 */
async function waitForUploadedMedia(
  supabase: SupabaseClient,
  mediaItemId: string,
): Promise<number | null> {
  const started = Date.now()
  while (Date.now() - started < UPLOAD_CLAIM_TTL_MS) {
    await new Promise((r) => setTimeout(r, 3000))
    const { data } = await supabase
      .from('media_items')
      .select('mixpost_media_id, metadata')
      .eq('id', mediaItemId)
      .single()

    if (data?.mixpost_media_id) return data.mixpost_media_id as number

    // Holder released the claim without producing a media id — it failed.
    const claim = (data?.metadata as Record<string, unknown> | null)?.mixpost_upload
    if (!claim) return null
  }
  return null
}

/**
 * Cache the Mixpost media id and clear the in-flight claim.
 *
 * MUST be awaited — the original fire-and-forget version silently dropped the
 * writeback, causing every draft referencing a video to trigger a fresh
 * multi-minute transcode (2026-04-10).
 */
async function cacheMixpostMedia(
  supabase: SupabaseClient,
  mediaItemId: string,
  uploadedId: number,
  uploadedUuid: string | null,
): Promise<void> {
  const { data: row } = await supabase
    .from('media_items')
    .select('metadata')
    .eq('id', mediaItemId)
    .single()

  const metadata = { ...((row?.metadata as Record<string, unknown> | null) ?? {}) }
  delete metadata.mixpost_upload

  const { error } = await supabase
    .from('media_items')
    .update({
      mixpost_media_id: uploadedId,
      mixpost_media_uuid: uploadedUuid,
      mixpost_cached_at: new Date().toISOString(),
      metadata,
    })
    .eq('id', mediaItemId)

  if (error) {
    console.warn(
      `[sync-draft] Failed to cache mixpost_media_id on ${mediaItemId}: ${error.message}`,
    )
  }
}

async function pollRemoteUpload(
  workspaceBase: string,
  token: string,
  downloadId: string,
): Promise<{ id: number | null; uuid: string | null; error?: string }> {
  const started = Date.now()
  const statusUrl = `${workspaceBase}/media/remote/${downloadId}/status`
  while (Date.now() - started < POLL_MAX_SECONDS * 1000) {
    await new Promise((r) => setTimeout(r, 3000))
    try {
      const r = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (!r.ok) continue
      const d = await r.json()
      if (d.status === 'completed') {
        const id = d.media?.id ?? d.id ?? d.data?.id
        const uuid = d.media?.uuid ?? d.uuid ?? d.data?.uuid ?? null
        return { id: id ? Number(id) : null, uuid }
      }
      if (d.status === 'failed') {
        return { id: null, uuid: null, error: `Mixpost transcode failed: ${d.error ?? 'unknown'}` }
      }
    } catch {
      /* transient — keep polling */
    }
  }
  return { id: null, uuid: null, error: `Polling timeout after ${POLL_MAX_SECONDS}s` }
}

/**
 * Sync a NRS scheduled_posts row to Mixpost as a draft.
 *
 * Idempotent: if metadata.mixpost.post_uuid is already set, returns the
 * cached values without re-syncing.
 *
 * Background-friendly: caller can fire this with `void` and it will
 * complete in its own time. Updates the scheduled_posts row directly
 * with the Mixpost identifiers when done.
 */
export async function syncDraftToMixpost(
  supabase: SupabaseClient,
  scheduledPostId: string,
): Promise<DraftSyncResult> {
  const apiBase = process.env.MIXPOST_API_URL
  const workspace = process.env.MIXPOST_WORKSPACE_UUID
  if (!apiBase || !workspace) {
    return { ok: false, error: 'Mixpost not configured' }
  }

  const { data: post, error: postErr } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('id', scheduledPostId)
    .single()

  if (postErr || !post) {
    return { ok: false, error: `scheduled_posts row not found: ${postErr?.message ?? scheduledPostId}` }
  }

  // Idempotency check — already synced
  const existingMixpost = (post.metadata as Record<string, unknown> | null)?.mixpost as
    | { post_uuid?: string; post_id?: number; workspace_uuid?: string }
    | undefined
  if (existingMixpost?.post_uuid) {
    return {
      ok: true,
      mixpost_post_id: existingMixpost.post_id,
      mixpost_post_uuid: existingMixpost.post_uuid,
      mixpost_workspace_uuid: existingMixpost.workspace_uuid,
    }
  }

  // Resolve Mixpost accounts for this brand's platform.
  //
  // Every account in the workspace used to be passed here. The resolver then
  // filtered only by platform, so a draft was attached to every account on
  // that platform across every project: an Underground Parfums post was
  // queued to publish on Scent Sell, Do Today, TeleScribe AND the Downscale
  // weight loss clinic's Instagram. One approval would have put fragrance
  // copy on a regulated health account.
  const allAccounts = await fetchMixpostAccounts()
  if (!allAccounts || allAccounts.length === 0) {
    return { ok: false, error: 'No Mixpost accounts found' }
  }

  const { data: ownerBrands } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')
    .eq('user_id', post.user_id as string)

  const byBrand = mapAccountsToBrandsRaw(allAccounts, ownerBrands ?? [])
  const brandAccounts = byBrand.get(post.brand_id as string) ?? []

  if (brandAccounts.length === 0) {
    return {
      ok: false,
      error: `No Mixpost account is mapped to this project. Connect its accounts in Mixpost first — a draft is never sent to another project's accounts.`,
    }
  }

  const accountIds = resolveAccountIdsForPlatform(post.platform as string, brandAccounts)
  if (accountIds.length === 0) {
    return {
      ok: false,
      error: `No ${post.platform} account is connected for this project. Connect it in Mixpost first.`,
    }
  }

  // Sync media (each video may take ~6 minutes if not cached)
  const mediaIds: number[] = []
  const mediaResults: DraftSyncResult['media_results'] = []
  const allMediaItemIds: string[] = [
    ...((post.media_item_ids as string[] | null) ?? []),
    ...(post.media_item_id ? [post.media_item_id as string] : []),
  ]
  // De-dup
  const uniqueMediaIds = [...new Set(allMediaItemIds)]

  for (const mediaItemId of uniqueMediaIds) {
    const result = await ensureMediaInMixpost(supabase, mediaItemId)
    mediaResults.push({
      media_item_id: mediaItemId,
      mixpost_media_id: result.id,
      error: result.error,
    })
    if (result.id != null) mediaIds.push(result.id)
  }

  // If we expected media but none uploaded, fail loud
  if (uniqueMediaIds.length > 0 && mediaIds.length === 0) {
    return {
      ok: false,
      error: 'All media uploads to Mixpost failed',
      media_results: mediaResults,
    }
  }

  // Build the Mixpost version payload
  const hashtagLine =
    (post.hashtags as string[] | null)?.length
      ? '\n\n' +
        (post.hashtags as string[]).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : ''

  const body = (post.caption as string) + hashtagLine

  const versions: MixpostVersion[] = [
    {
      account_id: accountIds[0]!,
      is_original: true,
      content: [
        {
          body,
          media: mediaIds,
          url: null,
          video_thumbs: [],
        },
      ],
      // Keyed by the Mixpost PROVIDER of the account we're actually posting to
      // (e.g. 'facebook_page', not 'facebook'). Mixpost runs
      // Arr::only($options, providerKeys) and silently discards anything else,
      // so a flat object is dropped without a word and the defaults apply.
      options: buildPlatformOptions(
        brandAccounts.find((a) => a.id === accountIds[0])?.provider ?? (post.platform as string),
        post.post_type as string | null,
        post.caption as string,
        post.metadata as Record<string, unknown> | null,
      ),
    },
  ]

  // Resolve Mixpost tag ids for this post — brand tag always, plus the
  // hashtag-group tag if the post's content_pillar matches a group by
  // name. Both calls are idempotent + cached on the source row, so this
  // is a fast DB hit after the first call per brand/group. Failures
  // here are non-blocking — we still create the post without tags.
  const tagIds: number[] = []
  try {
    const brandTag = await ensureBrandTagInMixpost(supabase, post.brand_id as string)
    if (brandTag) tagIds.push(brandTag.id)

    if (post.content_pillar) {
      const { data: matchingGroup } = await supabase
        .from('hashtag_groups')
        .select('id')
        .eq('brand_id', post.brand_id as string)
        .eq('name', post.content_pillar as string)
        .maybeSingle()
      if (matchingGroup?.id) {
        const groupTag = await ensureHashtagGroupTagInMixpost(supabase, matchingGroup.id as string)
        if (groupTag) tagIds.push(groupTag.id)
      }
    }
  } catch (err) {
    console.warn('[sync-draft] Mixpost tag resolution failed (non-blocking):', err)
  }

  // Create as draft — schedule:false + schedule_now:false means Mixpost
  // creates the post in DRAFT status.
  const createResult = await createMixpostPost({
    accounts: accountIds,
    versions,
    schedule: false,
    schedule_now: false,
    tags: tagIds,
  })

  if (!createResult || !createResult.uuid) {
    return {
      ok: false,
      error: 'Mixpost createMixpostPost returned no uuid',
      media_results: mediaResults,
    }
  }

  // Persist to scheduled_posts.metadata.mixpost AND external_post_id
  // (the webhook handler matches on external_post_id when post.published fires)
  const currentMetadata = (post.metadata as Record<string, unknown>) ?? {}
  await supabase
    .from('scheduled_posts')
    .update({
      external_post_id: createResult.id,
      metadata: {
        ...currentMetadata,
        mixpost: {
          post_id: Number(createResult.id),
          post_uuid: createResult.uuid,
          workspace_uuid: workspace,
          synced_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', scheduledPostId)

  return {
    ok: true,
    mixpost_post_id: Number(createResult.id),
    mixpost_post_uuid: createResult.uuid,
    mixpost_workspace_uuid: workspace,
    media_results: mediaResults,
  }
}

/**
 * Build the URL of the Mixpost draft screen for a synced draft.
 * Returns null if Mixpost isn't configured or the draft hasn't been synced.
 */
export function buildMixpostEditUrl(metadata: Record<string, unknown> | null | undefined): string | null {
  const mixpost = metadata?.mixpost as
    | { post_uuid?: string; workspace_uuid?: string }
    | undefined
  if (!mixpost?.post_uuid || !mixpost.workspace_uuid) return null
  // Mixpost web UI lives under MIXPOST_WEB_URL (the bare host, not /api).
  // Default to MIXPOST_API_URL stripped of /api if web URL not configured.
  const webBase =
    process.env.MIXPOST_WEB_URL ?? process.env.MIXPOST_API_URL?.replace(/\/api$/, '') ?? ''
  if (!webBase) return null
  return `${webBase}/${mixpost.workspace_uuid}/posts/${mixpost.post_uuid}`
}
