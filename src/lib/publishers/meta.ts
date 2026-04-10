/**
 * Meta (Facebook Pages + Instagram Business) native publisher.
 *
 * Facebook: POST /{page-id}/feed (text), /{page-id}/photos (images),
 *           /{page-id}/videos (video)
 * Instagram: two-step container flow — POST /{ig-user-id}/media (create)
 *            → POST /{ig-user-id}/media_publish (publish container).
 *            Reels via media_type=REELS.
 *
 * Uses Graph API v21.0. Token refresh via fb_exchange_token grant.
 */

import { PLATFORM_CHAR_LIMITS, PLATFORM_MEDIA_LIMITS } from '@/lib/mixpost/ui-tokens'
import { refreshTokenIfNeeded } from './token-store'
import type {
  OAuthToken,
  Publisher,
  PublishMedia,
  PublishRequest,
  PublishResult,
} from './types'

// ── Constants ──────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

// ── Shared Graph API helper ────────────────────────────────────────────────

async function graphFetch<T = Record<string, unknown>>(
  path: string,
  token: string,
  options?: RequestInit & { params?: Record<string, string> },
): Promise<{ ok: boolean; data?: T; error?: string; retryAfterMs?: number }> {
  const url = new URL(`${GRAPH_BASE}${path}`)
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    // Meta rate-limit: error code 4 or 32
    const errorCode = body?.error?.code
    if (errorCode === 4 || errorCode === 32) {
      return {
        ok: false,
        error: body?.error?.message ?? 'Application request limit reached',
        retryAfterMs: 60_000, // Meta doesn't give exact retry-after; default 1 min
      }
    }
    return {
      ok: false,
      error: body?.error?.message ?? `Graph API ${res.status}`,
    }
  }

  return { ok: true, data: body as T }
}

/**
 * Refresh a Meta long-lived token. Long-lived tokens expire after ~60 days.
 * Refreshed via GET /oauth/access_token?grant_type=fb_exchange_token.
 */
export async function refreshMetaToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in?: number } | null> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return null

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('fb_exchange_token', refreshToken)

  const res = await fetch(url.toString())
  if (!res.ok) return null

  const data = await res.json()
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  }
}

// ── Facebook Publisher ─────────────────────────────────────────────────────

/**
 * Prepare token with auto-refresh for Meta.
 */
async function prepareToken(token: OAuthToken): Promise<OAuthToken | null> {
  return refreshTokenIfNeeded(token, refreshMetaToken)
}

/**
 * Publish a text-only post to a Facebook Page.
 */
async function publishFacebookText(
  pageId: string,
  caption: string,
  accessToken: string,
): Promise<{ ok: boolean; postId?: string; error?: string; retryAfterMs?: number }> {
  const result = await graphFetch<{ id: string }>(`/${pageId}/feed`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ message: caption }),
  })
  return {
    ok: result.ok,
    postId: result.data?.id,
    error: result.error,
    retryAfterMs: result.retryAfterMs,
  }
}

/**
 * Publish a photo to a Facebook Page.
 */
async function publishFacebookPhoto(
  pageId: string,
  caption: string,
  mediaUrl: string,
  accessToken: string,
): Promise<{ ok: boolean; postId?: string; error?: string; retryAfterMs?: number }> {
  const result = await graphFetch<{ id: string; post_id?: string }>(
    `/${pageId}/photos`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ url: mediaUrl, message: caption }),
    },
  )
  return {
    ok: result.ok,
    postId: result.data?.post_id ?? result.data?.id,
    error: result.error,
    retryAfterMs: result.retryAfterMs,
  }
}

/**
 * Publish a video to a Facebook Page.
 */
async function publishFacebookVideo(
  pageId: string,
  caption: string,
  mediaUrl: string,
  accessToken: string,
): Promise<{ ok: boolean; postId?: string; error?: string; retryAfterMs?: number }> {
  const result = await graphFetch<{ id: string }>(
    `/${pageId}/videos`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ file_url: mediaUrl, description: caption }),
    },
  )
  return {
    ok: result.ok,
    postId: result.data?.id,
    error: result.error,
    retryAfterMs: result.retryAfterMs,
  }
}

// ── Instagram Publisher ────────────────────────────────────────────────────

/**
 * Create an Instagram media container and publish it.
 * Two-step flow: create container → publish container.
 */
async function publishInstagramMedia(
  igUserId: string,
  caption: string,
  media: PublishMedia | null,
  accessToken: string,
): Promise<{ ok: boolean; postId?: string; permalink?: string; error?: string; retryAfterMs?: number }> {
  // Step 1: Create container
  const containerBody: Record<string, string> = { caption }

  if (media?.type === 'video') {
    containerBody.media_type = 'REELS'
    containerBody.video_url = media.url
  } else if (media?.type === 'image') {
    containerBody.image_url = media.url
  } else {
    // Text-only not supported on Instagram — must have media
    return { ok: false, error: 'Instagram requires at least one image or video' }
  }

  const containerResult = await graphFetch<{ id: string }>(
    `/${igUserId}/media`,
    accessToken,
    { method: 'POST', body: JSON.stringify(containerBody) },
  )

  if (!containerResult.ok) {
    return {
      ok: false,
      error: containerResult.error,
      retryAfterMs: containerResult.retryAfterMs,
    }
  }

  const containerId = containerResult.data?.id
  if (!containerId) return { ok: false, error: 'No container ID returned' }

  // Step 1.5: Poll container status until ready (for video processing)
  if (media?.type === 'video') {
    const ready = await pollContainerStatus(containerId, accessToken)
    if (!ready.ok) return ready
  }

  // Step 2: Publish the container
  const publishResult = await graphFetch<{ id: string }>(
    `/${igUserId}/media_publish`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ creation_id: containerId }) },
  )

  if (!publishResult.ok) {
    return {
      ok: false,
      error: publishResult.error,
      retryAfterMs: publishResult.retryAfterMs,
    }
  }

  // Fetch permalink
  const mediaId = publishResult.data?.id
  let permalink: string | undefined
  if (mediaId) {
    const infoResult = await graphFetch<{ permalink: string }>(
      `/${mediaId}`,
      accessToken,
      { params: { fields: 'permalink' } },
    )
    permalink = infoResult.data?.permalink
  }

  return { ok: true, postId: mediaId, permalink }
}

/**
 * Instagram carousel: create child containers, then a carousel container,
 * then publish.
 */
async function publishInstagramCarousel(
  igUserId: string,
  caption: string,
  mediaItems: PublishMedia[],
  accessToken: string,
): Promise<{ ok: boolean; postId?: string; permalink?: string; error?: string; retryAfterMs?: number }> {
  // Create child containers
  const childIds: string[] = []
  for (const item of mediaItems) {
    const body: Record<string, string> = { is_carousel_item: 'true' }
    if (item.type === 'video') {
      body.media_type = 'VIDEO'
      body.video_url = item.url
    } else {
      body.image_url = item.url
    }

    const childResult = await graphFetch<{ id: string }>(
      `/${igUserId}/media`,
      accessToken,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (!childResult.ok) {
      return { ok: false, error: `Carousel child failed: ${childResult.error}` }
    }
    if (childResult.data?.id) childIds.push(childResult.data.id)

    // Poll video containers
    if (item.type === 'video' && childResult.data?.id) {
      const ready = await pollContainerStatus(childResult.data.id, accessToken)
      if (!ready.ok) return ready
    }
  }

  // Create carousel container
  const carouselResult = await graphFetch<{ id: string }>(
    `/${igUserId}/media`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        caption,
        children: childIds.join(','),
      }),
    },
  )
  if (!carouselResult.ok) {
    return { ok: false, error: carouselResult.error, retryAfterMs: carouselResult.retryAfterMs }
  }

  const containerId = carouselResult.data?.id
  if (!containerId) return { ok: false, error: 'No carousel container ID' }

  // Publish
  const publishResult = await graphFetch<{ id: string }>(
    `/${igUserId}/media_publish`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ creation_id: containerId }) },
  )

  if (!publishResult.ok) {
    return { ok: false, error: publishResult.error, retryAfterMs: publishResult.retryAfterMs }
  }

  const mediaId = publishResult.data?.id
  let permalink: string | undefined
  if (mediaId) {
    const infoResult = await graphFetch<{ permalink: string }>(
      `/${mediaId}`,
      accessToken,
      { params: { fields: 'permalink' } },
    )
    permalink = infoResult.data?.permalink
  }

  return { ok: true, postId: mediaId, permalink }
}

/**
 * Poll an IG container until it's ready for publishing.
 * Videos take time to process server-side.
 */
async function pollContainerStatus(
  containerId: string,
  accessToken: string,
  maxAttempts = 30,
  intervalMs = 5000,
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await graphFetch<{ status_code: string; status: string }>(
      `/${containerId}`,
      accessToken,
      { params: { fields: 'status_code' } },
    )

    const statusCode = result.data?.status_code
    if (statusCode === 'FINISHED') return { ok: true }
    if (statusCode === 'ERROR') {
      return { ok: false, error: `Container processing failed: ${result.data?.status}` }
    }

    // IN_PROGRESS — wait and retry
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return { ok: false, error: 'Container processing timed out' }
}

// ── Facebook Publisher ─────────────────────────────────────────────────────

export const facebookPublisher: Publisher = {
  platform: 'facebook',

  validate(req: PublishRequest) {
    const errors: string[] = []
    const limits = PLATFORM_MEDIA_LIMITS.facebook
    const charLimit = PLATFORM_CHAR_LIMITS.facebook

    if (req.caption.length > charLimit) {
      errors.push(`Caption exceeds Facebook's ${charLimit.toLocaleString()} character limit`)
    }

    const images = req.media.filter((m) => m.type === 'image')
    const videos = req.media.filter((m) => m.type === 'video')

    if (images.length > limits.maxImages) {
      errors.push(`Facebook allows max ${limits.maxImages} images`)
    }
    if (videos.length > limits.maxVideos) {
      errors.push(`Facebook allows max ${limits.maxVideos} video`)
    }
    if (videos.length > 0 && images.length > 0) {
      errors.push('Facebook does not support mixing images and video in a single post')
    }

    for (const v of videos) {
      if (v.size_bytes && v.size_bytes > limits.maxVideoSizeMb * 1024 * 1024) {
        errors.push(`Video exceeds Facebook's ${limits.maxVideoSizeMb}MB limit`)
      }
      if (v.duration_seconds && v.duration_seconds > limits.maxVideoDurationSec) {
        errors.push(`Video exceeds Facebook's ${limits.maxVideoDurationSec}s duration limit`)
      }
    }

    return { ok: errors.length === 0, errors }
  },

  async publish(req: PublishRequest, token: OAuthToken): Promise<PublishResult> {
    const refreshedToken = await prepareToken(token)
    if (!refreshedToken) {
      return { ok: false, publisher: 'native', error: 'Token refresh failed' }
    }

    const pageId = refreshedToken.account_id
    const accessToken = refreshedToken.access_token
    const caption = buildCaption(req)

    const videos = req.media.filter((m) => m.type === 'video')
    const images = req.media.filter((m) => m.type === 'image')

    let result: { ok: boolean; postId?: string; error?: string; retryAfterMs?: number }

    if (videos.length > 0) {
      result = await publishFacebookVideo(pageId, caption, videos[0].url, accessToken)
    } else if (images.length > 0) {
      // For single image, use photos endpoint; multi-image not directly supported
      // as a single API call in Graph v21 — post first photo with message
      result = await publishFacebookPhoto(pageId, caption, images[0].url, accessToken)
    } else {
      result = await publishFacebookText(pageId, caption, accessToken)
    }

    if (!result.ok) {
      return {
        ok: false,
        publisher: 'native',
        error: result.error,
        retry_after_ms: result.retryAfterMs,
      }
    }

    return {
      ok: true,
      publisher: 'native',
      external_post_id: result.postId,
      external_permalink: result.postId
        ? `https://www.facebook.com/${result.postId}`
        : undefined,
    }
  },
}

// ── Instagram Publisher ────────────────────────────────────────────────────

export const instagramPublisher: Publisher = {
  platform: 'instagram',

  validate(req: PublishRequest) {
    const errors: string[] = []
    const limits = PLATFORM_MEDIA_LIMITS.instagram
    const charLimit = PLATFORM_CHAR_LIMITS.instagram

    if (req.caption.length > charLimit) {
      errors.push(`Caption exceeds Instagram's ${charLimit.toLocaleString()} character limit`)
    }

    if (req.media.length === 0) {
      errors.push('Instagram requires at least one image or video')
    }

    const images = req.media.filter((m) => m.type === 'image')
    const videos = req.media.filter((m) => m.type === 'video')

    if (images.length + videos.length > limits.maxImages) {
      errors.push(`Instagram carousel allows max ${limits.maxImages} items`)
    }
    if (videos.length > limits.maxVideos && req.media.length === 1) {
      errors.push(`Instagram allows max ${limits.maxVideos} video per post`)
    }

    for (const v of videos) {
      if (v.size_bytes && v.size_bytes > limits.maxVideoSizeMb * 1024 * 1024) {
        errors.push(`Video exceeds Instagram's ${limits.maxVideoSizeMb}MB limit`)
      }
      if (v.duration_seconds && v.duration_seconds > limits.maxVideoDurationSec) {
        errors.push(`Video exceeds Instagram's ${limits.maxVideoDurationSec}s duration limit`)
      }
    }

    return { ok: errors.length === 0, errors }
  },

  async publish(req: PublishRequest, token: OAuthToken): Promise<PublishResult> {
    const refreshedToken = await prepareToken(token)
    if (!refreshedToken) {
      return { ok: false, publisher: 'native', error: 'Token refresh failed' }
    }

    // IG business account ID stored in metadata.ig_user_id or as account_id
    const igUserId =
      (refreshedToken.metadata?.ig_user_id as string) ?? refreshedToken.account_id
    const accessToken = refreshedToken.access_token
    const caption = buildCaption(req)

    let result: {
      ok: boolean
      postId?: string
      permalink?: string
      error?: string
      retryAfterMs?: number
    }

    if (req.media.length > 1) {
      // Carousel
      result = await publishInstagramCarousel(igUserId, caption, req.media, accessToken)
    } else {
      // Single media
      result = await publishInstagramMedia(
        igUserId,
        caption,
        req.media[0] ?? null,
        accessToken,
      )
    }

    if (!result.ok) {
      return {
        ok: false,
        publisher: 'native',
        error: result.error,
        retry_after_ms: result.retryAfterMs,
      }
    }

    return {
      ok: true,
      publisher: 'native',
      external_post_id: result.postId,
      external_permalink: result.permalink,
    }
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build the final caption including hashtags.
 */
function buildCaption(req: PublishRequest): string {
  let caption = req.caption
  if (req.hashtags && req.hashtags.length > 0) {
    const tags = req.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
    caption = `${caption}\n\n${tags}`
  }
  return caption
}
