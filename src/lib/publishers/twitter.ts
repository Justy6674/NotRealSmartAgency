/**
 * X (Twitter) API v2 native publisher.
 *
 * Text: POST https://api.x.com/2/tweets
 * Media: v1.1 chunked upload (INIT/APPEND/FINALIZE) then create tweet
 *        with media.media_ids
 * Thread: chain tweets by passing reply.in_reply_to_tweet_id on subsequent
 *         tweets. Auto-splits captions longer than 280 characters.
 *
 * Rate limit: 429 Too Many Requests with x-rate-limit-reset header.
 */

import { PLATFORM_CHAR_LIMITS, PLATFORM_MEDIA_LIMITS } from '@/lib/mixpost/ui-tokens'
import type {
  OAuthToken,
  Publisher,
  PublishMedia,
  PublishRequest,
  PublishResult,
} from './types'

// ── Constants ──────────────────────────────────────────────────────────────

const X_API_BASE = 'https://api.x.com/2'
const X_UPLOAD_BASE = 'https://upload.twitter.com/1.1'
const TWEET_CHAR_LIMIT = 280
const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB chunks for media upload

// ── API helpers ────────────────────────────────────────────────────────────

async function xApiFetch<T = Record<string, unknown>>(
  url: string,
  accessToken: string,
  options?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string; retryAfterMs?: number }> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (res.status === 429) {
    const resetHeader = res.headers.get('x-rate-limit-reset')
    const retryAfterMs = resetHeader
      ? (Number(resetHeader) * 1000 - Date.now())
      : 60_000 * 15 // Default 15 min
    return {
      ok: false,
      error: 'Rate limit exceeded',
      retryAfterMs: Math.max(retryAfterMs, 1000),
    }
  }

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    const detail = body?.detail ?? body?.errors?.[0]?.message ?? `X API ${res.status}`
    return { ok: false, error: detail }
  }

  return { ok: true, data: body?.data as T }
}

// ── Media upload (v1.1 chunked) ────────────────────────────────────────────

interface MediaUploadResult {
  media_id_string: string
}

/**
 * Upload media to X using the v1.1 chunked upload flow.
 * INIT → APPEND (chunks) → FINALIZE.
 */
async function uploadMediaToX(
  mediaItem: PublishMedia,
  accessToken: string,
): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
  // Fetch the binary
  const mediaRes = await fetch(mediaItem.url)
  if (!mediaRes.ok) {
    return { ok: false, error: `Failed to fetch media from ${mediaItem.url}` }
  }

  const buffer = await mediaRes.arrayBuffer()
  const totalBytes = buffer.byteLength

  // Determine media type and category
  const mediaType = mediaItem.mime_type || (mediaItem.type === 'video' ? 'video/mp4' : 'image/jpeg')
  const mediaCategory = mediaItem.type === 'video' ? 'tweet_video' : 'tweet_image'

  // INIT
  const initRes = await fetch(`${X_UPLOAD_BASE}/media/upload.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: String(totalBytes),
      media_type: mediaType,
      media_category: mediaCategory,
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.text()
    return { ok: false, error: `Media INIT failed: ${err}` }
  }

  const initData = await initRes.json()
  const mediaIdString: string = initData.media_id_string

  // APPEND (chunked)
  let segmentIndex = 0
  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const chunk = buffer.slice(offset, Math.min(offset + CHUNK_SIZE, totalBytes))

    const formData = new FormData()
    formData.append('command', 'APPEND')
    formData.append('media_id', mediaIdString)
    formData.append('segment_index', String(segmentIndex))
    formData.append('media_data', Buffer.from(chunk).toString('base64'))

    const appendRes = await fetch(`${X_UPLOAD_BASE}/media/upload.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })

    if (!appendRes.ok) {
      const err = await appendRes.text()
      return { ok: false, error: `Media APPEND segment ${segmentIndex} failed: ${err}` }
    }

    segmentIndex++
  }

  // FINALIZE
  const finalizeRes = await fetch(`${X_UPLOAD_BASE}/media/upload.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaIdString,
    }),
  })

  if (!finalizeRes.ok) {
    const err = await finalizeRes.text()
    return { ok: false, error: `Media FINALIZE failed: ${err}` }
  }

  const finalizeData = await finalizeRes.json()

  // For video, poll processing status
  if (mediaItem.type === 'video' && finalizeData.processing_info) {
    const pollResult = await pollMediaProcessing(mediaIdString, accessToken)
    if (!pollResult.ok) return pollResult
  }

  return { ok: true, mediaId: mediaIdString }
}

/**
 * Poll video processing status until succeeded or failed.
 */
async function pollMediaProcessing(
  mediaId: string,
  accessToken: string,
  maxAttempts = 60,
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await fetch(
      `${X_UPLOAD_BASE}/media/upload.json?command=STATUS&media_id=${mediaId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    if (!statusRes.ok) {
      return { ok: false, error: `Media status check failed: ${statusRes.status}` }
    }

    const statusData = await statusRes.json()
    const processingInfo = statusData.processing_info

    if (!processingInfo) return { ok: true } // Done

    if (processingInfo.state === 'succeeded') return { ok: true }
    if (processingInfo.state === 'failed') {
      return { ok: false, error: `Media processing failed: ${processingInfo.error?.message ?? 'unknown'}` }
    }

    // in_progress — wait the recommended time
    const waitMs = (processingInfo.check_after_secs ?? 5) * 1000
    await new Promise((r) => setTimeout(r, waitMs))
  }

  return { ok: false, error: 'Media processing polling timed out' }
}

// ── Tweet creation ─────────────────────────────────────────────────────────

interface TweetResponse {
  id: string
}

/**
 * Create a single tweet, optionally with media and as a reply.
 */
async function createTweet(
  text: string,
  accessToken: string,
  options?: { mediaIds?: string[]; replyToId?: string },
): Promise<{ ok: boolean; tweetId?: string; error?: string; retryAfterMs?: number }> {
  const body: Record<string, unknown> = { text }

  if (options?.mediaIds && options.mediaIds.length > 0) {
    body.media = { media_ids: options.mediaIds }
  }
  if (options?.replyToId) {
    body.reply = { in_reply_to_tweet_id: options.replyToId }
  }

  const result = await xApiFetch<TweetResponse>(`${X_API_BASE}/tweets`, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return {
    ok: result.ok,
    tweetId: result.data?.id,
    error: result.error,
    retryAfterMs: result.retryAfterMs,
  }
}

// ── Thread splitting ───────────────────────────────────────────────────────

/**
 * Split caption into tweet-sized chunks for threading.
 * Tries to break at sentence boundaries, falls back to word boundaries.
 */
function splitIntoThread(text: string): string[] {
  if (text.length <= TWEET_CHAR_LIMIT) return [text]

  const tweets: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= TWEET_CHAR_LIMIT) {
      tweets.push(remaining)
      break
    }

    // Try to break at a sentence boundary
    let breakPoint = -1
    const searchWindow = remaining.slice(0, TWEET_CHAR_LIMIT)

    // Look for sentence endings
    for (const sep of ['. ', '! ', '? ', '.\n', '!\n', '?\n']) {
      const idx = searchWindow.lastIndexOf(sep)
      if (idx > breakPoint) breakPoint = idx + sep.length
    }

    // Fall back to word boundary
    if (breakPoint <= 0 || breakPoint < TWEET_CHAR_LIMIT * 0.3) {
      breakPoint = searchWindow.lastIndexOf(' ')
    }

    // Absolute fallback: hard cut
    if (breakPoint <= 0) breakPoint = TWEET_CHAR_LIMIT

    tweets.push(remaining.slice(0, breakPoint).trim())
    remaining = remaining.slice(breakPoint).trim()
  }

  return tweets
}

// ── Publisher ──────────────────────────────────────────────────────────────

export const twitterPublisher: Publisher = {
  platform: 'twitter',

  validate(req: PublishRequest) {
    const errors: string[] = []
    const limits = PLATFORM_MEDIA_LIMITS.twitter
    const charLimit = PLATFORM_CHAR_LIMITS.twitter

    // Single tweet limit — thread splitting handles longer captions
    // but we still validate total isn't absurdly long
    if (req.caption.length > charLimit * 25) {
      errors.push('Caption is too long even for a thread (max ~25 tweets)')
    }

    const images = req.media.filter((m) => m.type === 'image')
    const videos = req.media.filter((m) => m.type === 'video')

    if (images.length > limits.maxImages) {
      errors.push(`X allows max ${limits.maxImages} images per tweet`)
    }
    if (videos.length > limits.maxVideos) {
      errors.push(`X allows max ${limits.maxVideos} video per tweet`)
    }
    if (videos.length > 0 && images.length > 0) {
      errors.push('X does not support mixing images and video in a single tweet')
    }

    for (const v of videos) {
      if (v.size_bytes && v.size_bytes > limits.maxVideoSizeMb * 1024 * 1024) {
        errors.push(`Video exceeds X's ${limits.maxVideoSizeMb}MB limit`)
      }
      if (v.duration_seconds && v.duration_seconds > limits.maxVideoDurationSec) {
        errors.push(`Video exceeds X's ${limits.maxVideoDurationSec}s duration limit`)
      }
    }

    return { ok: errors.length === 0, errors }
  },

  async publish(req: PublishRequest, token: OAuthToken): Promise<PublishResult> {
    const accessToken = token.access_token

    // Build caption with hashtags
    let caption = req.caption
    if (req.hashtags && req.hashtags.length > 0) {
      const tags = req.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
      caption = `${caption}\n\n${tags}`
    }

    // Upload media if present
    const mediaIds: string[] = []
    for (const mediaItem of req.media) {
      const uploadResult = await uploadMediaToX(mediaItem, accessToken)
      if (!uploadResult.ok) {
        return { ok: false, publisher: 'native', error: uploadResult.error }
      }
      if (uploadResult.mediaId) mediaIds.push(uploadResult.mediaId)
    }

    // Split into thread if needed
    const tweetTexts = splitIntoThread(caption)

    let firstTweetId: string | undefined
    let lastTweetId: string | undefined

    for (let i = 0; i < tweetTexts.length; i++) {
      const result = await createTweet(tweetTexts[i], accessToken, {
        // Attach media only to the first tweet
        mediaIds: i === 0 ? mediaIds : undefined,
        replyToId: lastTweetId,
      })

      if (!result.ok) {
        return {
          ok: false,
          publisher: 'native',
          error: result.error,
          retry_after_ms: result.retryAfterMs,
        }
      }

      if (i === 0) firstTweetId = result.tweetId
      lastTweetId = result.tweetId
    }

    return {
      ok: true,
      publisher: 'native',
      external_post_id: firstTweetId,
      external_permalink: firstTweetId && token.account_name
        ? `https://x.com/${token.account_name}/status/${firstTweetId}`
        : undefined,
    }
  },
}
