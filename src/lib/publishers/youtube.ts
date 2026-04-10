/**
 * YouTube Data API v3 native publisher.
 *
 * Implements the Publisher interface for uploading videos to YouTube
 * via the resumable upload protocol. YouTube only accepts video content —
 * text-only and image-only posts are rejected at validation.
 *
 * API reference: https://developers.google.com/youtube/v3/docs/videos/insert
 * Resumable upload: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
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

const YOUTUBE_UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'

const YOUTUBE_CAPTION_LIMIT = PLATFORM_CHAR_LIMITS.youtube // 5000
const YOUTUBE_MAX_VIDEO_SIZE_MB = PLATFORM_MEDIA_LIMITS.youtube.maxVideoSizeMb // 256 GB
const YOUTUBE_MAX_VIDEO_SIZE_BYTES = YOUTUBE_MAX_VIDEO_SIZE_MB * 1024 * 1024

const YOUTUBE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract hashtags from caption text for YouTube tags. */
function extractHashtags(caption: string, explicit?: string[]): string[] {
  const fromCaption = (caption.match(/#[\w]+/g) ?? []).map((t) => t.slice(1))
  const merged = [...new Set([...(explicit ?? []), ...fromCaption])]
  // YouTube tags have a 500-character combined limit
  const tags: string[] = []
  let totalLength = 0
  for (const tag of merged) {
    if (totalLength + tag.length + 1 > 500) break
    tags.push(tag)
    totalLength += tag.length + 1
  }
  return tags
}

/** Derive a YouTube title from the first line of the caption (max 100 chars). */
function deriveTitle(caption: string): string {
  const firstLine = caption.split('\n')[0]?.trim() ?? 'Untitled'
  return firstLine.length > 100 ? firstLine.slice(0, 97) + '...' : firstLine
}

/** Find the first video in the media list. */
function findVideo(media: PublishMedia[]): PublishMedia | undefined {
  return media.find((m) => m.type === 'video')
}

/**
 * Refresh an expired YouTube (Google) access token using the refresh token.
 * Returns the new access token string.
 */
async function refreshAccessToken(token: OAuthToken): Promise<string> {
  if (!token.refresh_token) {
    throw new Error('No refresh token available — user must re-authorise')
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET not configured')
  }

  const res = await fetch(YOUTUBE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

/**
 * Determine whether the token is expired (or will expire within 60s).
 */
function isTokenExpired(token: OAuthToken): boolean {
  if (!token.expires_at) return false
  const expiresAt = new Date(token.expires_at).getTime()
  return Date.now() >= expiresAt - 60_000
}

// ── YouTube Publisher ──────────────────────────────────────────────────────

export const youtubePublisher: Publisher = {
  platform: 'youtube',

  validate(req: PublishRequest): { ok: boolean; errors: string[] } {
    const errors: string[] = []

    // YouTube requires a video
    const video = findVideo(req.media)
    if (!video) {
      errors.push('YouTube requires a video — text-only and image-only posts are not supported.')
      return { ok: false, errors }
    }

    // Caption length
    if (req.caption.length > YOUTUBE_CAPTION_LIMIT) {
      errors.push(
        `Description exceeds YouTube's ${YOUTUBE_CAPTION_LIMIT} character limit (${req.caption.length} characters).`
      )
    }

    // Video file size (if known)
    if (video.size_bytes && video.size_bytes > YOUTUBE_MAX_VIDEO_SIZE_BYTES) {
      errors.push(
        `Video exceeds YouTube's maximum file size of ${YOUTUBE_MAX_VIDEO_SIZE_MB} MB.`
      )
    }

    // Max duration (12 hours for verified accounts)
    const maxDuration = PLATFORM_MEDIA_LIMITS.youtube.maxVideoDurationSec
    if (video.duration_seconds && video.duration_seconds > maxDuration) {
      errors.push(
        `Video exceeds YouTube's maximum duration of ${maxDuration / 3600} hours.`
      )
    }

    return { ok: errors.length === 0, errors }
  },

  async publish(req: PublishRequest, token: OAuthToken): Promise<PublishResult> {
    const video = findVideo(req.media)
    if (!video) {
      return {
        ok: false,
        publisher: 'native',
        error: 'YouTube requires a video.',
      }
    }

    // Resolve the access token — refresh if expired
    let accessToken = token.access_token
    if (isTokenExpired(token)) {
      try {
        accessToken = await refreshAccessToken(token)
      } catch (err) {
        return {
          ok: false,
          publisher: 'native',
          error: err instanceof Error ? err.message : 'Token refresh failed',
        }
      }
    }

    const title = deriveTitle(req.caption)
    const tags = extractHashtags(req.caption, req.hashtags)

    // Step 1: Initiate resumable upload session
    const metadata = {
      snippet: {
        title,
        description: req.caption,
        tags,
        categoryId: '22', // People & Blogs (safe default)
      },
      status: {
        privacyStatus: (req.metadata?.privacyStatus as string) ?? 'public',
        selfDeclaredMadeForKids: false,
      },
    }

    let uploadUri: string
    try {
      const initRes = await fetch(YOUTUBE_UPLOAD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': video.mime_type || 'video/mp4',
          ...(video.size_bytes
            ? { 'X-Upload-Content-Length': String(video.size_bytes) }
            : {}),
        },
        body: JSON.stringify(metadata),
      })

      if (!initRes.ok) {
        const errorBody = await initRes.text()

        // Rate-limit detection
        if (initRes.status === 403 && errorBody.includes('quotaExceeded')) {
          return {
            ok: false,
            publisher: 'native',
            error: 'YouTube API daily quota exceeded. Retrying in 1 hour.',
            retry_after_ms: 3_600_000,
          }
        }

        return {
          ok: false,
          publisher: 'native',
          error: `YouTube upload init failed (${initRes.status}): ${errorBody.slice(0, 500)}`,
        }
      }

      const location = initRes.headers.get('Location')
      if (!location) {
        return {
          ok: false,
          publisher: 'native',
          error: 'YouTube did not return a resumable upload URI.',
        }
      }
      uploadUri = location
    } catch (err) {
      return {
        ok: false,
        publisher: 'native',
        error: `YouTube upload init network error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    // Step 2: Fetch the video binary from its Supabase Storage URL
    let videoBuffer: ArrayBuffer
    try {
      const videoRes = await fetch(video.url)
      if (!videoRes.ok) {
        return {
          ok: false,
          publisher: 'native',
          error: `Failed to fetch video from storage (${videoRes.status}).`,
        }
      }
      videoBuffer = await videoRes.arrayBuffer()
    } catch (err) {
      return {
        ok: false,
        publisher: 'native',
        error: `Failed to download video: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    // Step 3: Upload video binary to the resumable URI
    try {
      const uploadRes = await fetch(uploadUri, {
        method: 'PUT',
        headers: {
          'Content-Type': video.mime_type || 'video/mp4',
          'Content-Length': String(videoBuffer.byteLength),
        },
        body: videoBuffer,
      })

      if (!uploadRes.ok) {
        const errorBody = await uploadRes.text()

        // Rate-limit detection on upload
        if (uploadRes.status === 403 && errorBody.includes('quotaExceeded')) {
          return {
            ok: false,
            publisher: 'native',
            error: 'YouTube API daily quota exceeded during upload. Retrying in 1 hour.',
            retry_after_ms: 3_600_000,
          }
        }

        return {
          ok: false,
          publisher: 'native',
          error: `YouTube video upload failed (${uploadRes.status}): ${errorBody.slice(0, 500)}`,
        }
      }

      const result = (await uploadRes.json()) as {
        id: string
        snippet?: { title?: string }
        status?: { uploadStatus?: string }
      }

      if (!result.id) {
        return {
          ok: false,
          publisher: 'native',
          error: 'YouTube upload succeeded but no video ID was returned.',
        }
      }

      return {
        ok: true,
        publisher: 'native',
        external_post_id: result.id,
        external_permalink: `https://youtube.com/watch?v=${result.id}`,
      }
    } catch (err) {
      return {
        ok: false,
        publisher: 'native',
        error: `YouTube upload network error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
}
