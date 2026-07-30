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
    .select('id, file_url, file_type, file_name, mixpost_media_id, thumbnail_url')
    .eq('id', mediaItemId)
    .single()

  if (fetchErr || !item) {
    return { id: null, error: `media_items row not found: ${fetchErr?.message ?? mediaItemId}` }
  }

  // Cache hit — already in Mixpost
  if (item.mixpost_media_id) {
    return { id: item.mixpost_media_id as number }
  }

  // Remote initiate
  const initiateRes = await fetch(`${workspaceBase}/media/remote/initiate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: item.file_url, alt_text: '' }),
  })

  if (!initiateRes.ok) {
    const txt = await initiateRes.text().catch(() => '')
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
    // Slow path — video. Poll the status endpoint until done.
    const result = await pollRemoteUpload(workspaceBase, token, String(initiateData.download_id))
    if (result.id) {
      uploadedId = result.id
      uploadedUuid = result.uuid
    } else {
      return { id: null, error: result.error ?? 'Mixpost remote upload polling failed' }
    }
  } else if (initiateData.status === 'failed') {
    return { id: null, error: `Mixpost remote/initiate returned failed: ${initiateData.error ?? 'unknown'}` }
  }

  if (uploadedId == null) {
    return { id: null, error: 'Mixpost remote/initiate returned an unexpected shape' }
  }

  // Cache on the media_items row so future syncs are instant.
  // MUST be awaited — the earlier fire-and-forget version silently
  // dropped the writeback, causing subsequent sync calls to re-upload
  // the same video and trigger a fresh ~6 minute ffmpeg transcode for
  // every draft referencing it. Bug discovered 2026-04-10 during the
  // drafts backfill when post 1 hung for 10+ min.
  const { error: cacheErr } = await supabase
    .from('media_items')
    .update({
      mixpost_media_id: uploadedId,
      mixpost_media_uuid: uploadedUuid,
      mixpost_cached_at: new Date().toISOString(),
    })
    .eq('id', mediaItemId)
  if (cacheErr) {
    console.warn(
      `[sync-draft] Failed to cache mixpost_media_id on ${mediaItemId}: ${cacheErr.message}`,
    )
  }

  return { id: uploadedId }
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

  const versions: MixpostVersion[] = [
    {
      account_id: accountIds[0]!,
      is_original: true,
      content: [
        {
          body: (post.caption as string) + hashtagLine,
          media: mediaIds,
          url: null,
          video_thumbs: [],
        },
      ],
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
 * Build the URL of the Mixpost edit screen for a synced draft.
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
  return `${webBase}/${mixpost.workspace_uuid}/posts/${mixpost.post_uuid}/edit`
}
