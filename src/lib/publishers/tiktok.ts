/**
 * TikTok Content Posting API native publisher.
 *
 * TikTok ONLY accepts video — no text-only, no image-only.
 *
 * Flow:
 *  1. Init upload: POST /v2/post/publish/video/init/
 *  2. Upload binary to the returned upload_url
 *  3. Poll status: POST /v2/post/publish/status/fetch/ until PUBLISH_COMPLETE
 *
 * Rate limit: TikTok returns spam_risk_too_many_posts → set retry_after_ms.
 */

import { PLATFORM_CHAR_LIMITS, PLATFORM_MEDIA_LIMITS } from '@/lib/mixpost/ui-tokens'
import type {
  OAuthToken,
  Publisher,
  PublishRequest,
  PublishResult,
} from './types'

// ── Constants ──────────────────────────────────────────────────────────────

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

// ── API helper ─────────────────────────────────────────────────────────────

async function tiktokFetch<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string; retryAfterMs?: number }> {
  const res = await fetch(`${TIKTOK_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok || json?.error?.code !== 'ok') {
    const errCode = json?.error?.code ?? ''
    const errMsg = json?.error?.message ?? `TikTok API ${res.status}`

    // spam_risk_too_many_posts — rate limited
    if (errCode === 'spam_risk_too_many_posts' || errCode === 'rate_limit_exceeded') {
      return {
        ok: false,
        error: errMsg,
        retryAfterMs: 60_000 * 5, // 5 minutes — TikTok doesn't give exact retry
      }
    }

    return { ok: false, error: `${errCode}: ${errMsg}` }
  }

  return { ok: true, data: json?.data as T }
}

// ── Publish flow ───────────────────────────────────────────────────────────

interface InitUploadResponse {
  publish_id: string
  upload_url: string
}

interface PublishStatusResponse {
  status: 'PROCESSING_UPLOAD' | 'PROCESSING_DOWNLOAD' | 'SEND_TO_USER_INBOX' | 'PUBLISH_COMPLETE' | 'FAILED'
  fail_reason?: string
  publicaly_available_post_id?: string[]
}

/**
 * Upload video binary to TikTok's upload URL.
 * Uses a single PUT for videos under the chunk threshold.
 */
async function uploadVideoToTikTok(
  uploadUrl: string,
  videoUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  // Fetch the video binary from our storage
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    return { ok: false, error: `Failed to fetch video from ${videoUrl}` }
  }

  const videoBuffer = await videoRes.arrayBuffer()
  const totalBytes = videoBuffer.byteLength

  // Single-chunk upload
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${totalBytes - 1}/${totalBytes}`,
      'Content-Length': String(totalBytes),
    },
    body: videoBuffer,
  })

  if (!uploadRes.ok) {
    return { ok: false, error: `Upload failed: ${uploadRes.status} ${uploadRes.statusText}` }
  }

  return { ok: true }
}

/**
 * Poll TikTok publish status until complete or failed.
 */
async function pollPublishStatus(
  publishId: string,
  accessToken: string,
  maxAttempts = 60,
  intervalMs = 5000,
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await tiktokFetch<PublishStatusResponse>(
      '/post/publish/status/fetch/',
      accessToken,
      { publish_id: publishId },
    )

    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    const status = result.data?.status
    if (status === 'PUBLISH_COMPLETE') {
      const postId = result.data?.publicaly_available_post_id?.[0]
      return { ok: true, postId }
    }
    if (status === 'FAILED') {
      return { ok: false, error: result.data?.fail_reason ?? 'TikTok publish failed' }
    }

    // Still processing — wait and retry
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return { ok: false, error: 'TikTok publish status polling timed out' }
}

// ── Publisher ──────────────────────────────────────────────────────────────

export const tiktokPublisher: Publisher = {
  platform: 'tiktok',

  validate(req: PublishRequest) {
    const errors: string[] = []
    const limits = PLATFORM_MEDIA_LIMITS.tiktok
    const charLimit = PLATFORM_CHAR_LIMITS.tiktok

    if (req.caption.length > charLimit) {
      errors.push(`Caption exceeds TikTok's ${charLimit.toLocaleString()} character limit`)
    }

    const videos = req.media.filter((m) => m.type === 'video')
    if (videos.length === 0) {
      errors.push('TikTok only supports video content — no text-only or image-only posts')
    }
    if (videos.length > limits.maxVideos) {
      errors.push(`TikTok allows max ${limits.maxVideos} video per post`)
    }

    for (const v of videos) {
      if (v.size_bytes && v.size_bytes > limits.maxVideoSizeMb * 1024 * 1024) {
        errors.push(`Video exceeds TikTok's ${limits.maxVideoSizeMb}MB limit`)
      }
      if (v.duration_seconds && v.duration_seconds > limits.maxVideoDurationSec) {
        errors.push(`Video exceeds TikTok's ${limits.maxVideoDurationSec}s duration limit`)
      }
    }

    return { ok: errors.length === 0, errors }
  },

  async publish(req: PublishRequest, token: OAuthToken): Promise<PublishResult> {
    const accessToken = token.access_token
    const video = req.media.find((m) => m.type === 'video')

    if (!video) {
      return { ok: false, publisher: 'native', error: 'TikTok requires a video' }
    }

    // Build caption with hashtags
    let caption = req.caption
    if (req.hashtags && req.hashtags.length > 0) {
      const tags = req.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
      caption = `${caption} ${tags}`
    }

    // Step 1: Init upload
    const initResult = await tiktokFetch<InitUploadResponse>(
      '/post/publish/video/init/',
      accessToken,
      {
        post_info: {
          title: caption,
          privacy_level: 'SELF_ONLY', // Default to private; caller can override via metadata
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
          video_cover_timestamp_ms: 0,
          ...(req.metadata?.tiktok_post_info as Record<string, unknown> ?? {}),
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: video.size_bytes ?? 0,
        },
      },
    )

    if (!initResult.ok) {
      return {
        ok: false,
        publisher: 'native',
        error: initResult.error,
        retry_after_ms: initResult.retryAfterMs,
      }
    }

    const { publish_id, upload_url } = initResult.data ?? {}
    if (!publish_id || !upload_url) {
      return { ok: false, publisher: 'native', error: 'No publish_id or upload_url returned' }
    }

    // Step 2: Upload video binary
    const uploadResult = await uploadVideoToTikTok(upload_url, video.url)
    if (!uploadResult.ok) {
      return { ok: false, publisher: 'native', error: uploadResult.error }
    }

    // Step 3: Poll status
    const statusResult = await pollPublishStatus(publish_id, accessToken)
    if (!statusResult.ok) {
      return { ok: false, publisher: 'native', error: statusResult.error }
    }

    return {
      ok: true,
      publisher: 'native',
      external_post_id: statusResult.postId,
      external_permalink: statusResult.postId
        ? `https://www.tiktok.com/@${token.account_name}/video/${statusResult.postId}`
        : undefined,
    }
  },
}
