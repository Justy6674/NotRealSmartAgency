/**
 * LinkedIn native publisher.
 *
 * Uses the LinkedIn UGC Posts API (v2) for text, image, and video posts.
 * Implements the Publisher interface from types.ts.
 *
 * API reference: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/ugc-post-api
 *
 * Required OAuth scopes: w_member_social, openid, profile
 * Required env vars: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 */

import { PLATFORM_CHAR_LIMITS } from '@/lib/mixpost/ui-tokens'
import type {
  OAuthToken,
  Publisher,
  PublishMedia,
  PublishRequest,
  PublishResult,
} from './types'

const LINKEDIN_API = 'https://api.linkedin.com/v2'
const CHAR_LIMIT = PLATFORM_CHAR_LIMITS.linkedin // 3000

// ── Helpers ─────────────────────────────────────────────────────────────────

async function linkedinFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${LINKEDIN_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
      ...options.headers,
    },
  })
}

/**
 * Register an upload with LinkedIn and upload the binary.
 * Returns the asset URN on success.
 */
async function uploadMedia(
  token: string,
  authorUrn: string,
  media: PublishMedia,
): Promise<string | null> {
  const recipePrefix = media.type === 'video'
    ? 'urn:li:digitalmediaRecipe:feedshare-video'
    : 'urn:li:digitalmediaRecipe:feedshare-image'

  // Step 1: Register upload
  const registerRes = await linkedinFetch(
    '/assets?action=registerUpload',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: [recipePrefix],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    },
  )

  if (!registerRes.ok) {
    console.error(
      '[linkedin] Register upload failed:',
      registerRes.status,
      await registerRes.text().catch(() => ''),
    )
    return null
  }

  const registerData = await registerRes.json()
  const uploadUrl =
    registerData.value?.uploadMechanism?.[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ]?.uploadUrl
  const asset = registerData.value?.asset

  if (!uploadUrl || !asset) {
    console.error('[linkedin] Missing upload URL or asset in register response')
    return null
  }

  // Step 2: Upload binary from the media URL
  const mediaResponse = await fetch(media.url)
  if (!mediaResponse.ok) {
    console.error('[linkedin] Failed to fetch media from URL:', media.url)
    return null
  }

  const mediaBuffer = await mediaResponse.arrayBuffer()

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': media.mime_type || 'application/octet-stream',
    },
    body: mediaBuffer,
  })

  if (!uploadRes.ok) {
    console.error(
      '[linkedin] Binary upload failed:',
      uploadRes.status,
      await uploadRes.text().catch(() => ''),
    )
    return null
  }

  return asset as string
}

// ── Publisher implementation ─────────────────────────────────────────────────

const linkedinPublisher: Publisher = {
  platform: 'linkedin',

  validate(req: PublishRequest) {
    const errors: string[] = []

    const fullCaption = req.hashtags?.length
      ? `${req.caption}\n\n${req.hashtags.join(' ')}`
      : req.caption

    if (fullCaption.length > CHAR_LIMIT) {
      errors.push(
        `Caption too long: ${fullCaption.length} characters exceeds LinkedIn's ${CHAR_LIMIT} limit.`,
      )
    }

    // LinkedIn allows max 9 images or 1 video per post
    const images = req.media.filter((m) => m.type === 'image')
    const videos = req.media.filter((m) => m.type === 'video')

    if (images.length > 9) {
      errors.push(`Too many images: ${images.length}, LinkedIn allows max 9.`)
    }

    if (videos.length > 1) {
      errors.push('LinkedIn allows only 1 video per post.')
    }

    if (images.length > 0 && videos.length > 0) {
      errors.push('LinkedIn does not allow mixing images and videos in a single post.')
    }

    return { ok: errors.length === 0, errors }
  },

  async publish(req: PublishRequest, token: OAuthToken): Promise<PublishResult> {
    // The account_id from our token store is the LinkedIn member URN
    const authorUrn = token.account_id.startsWith('urn:li:')
      ? token.account_id
      : `urn:li:person:${token.account_id}`

    const fullCaption = req.hashtags?.length
      ? `${req.caption}\n\n${req.hashtags.join(' ')}`
      : req.caption

    // Upload media if present
    const mediaAssets: Array<{
      status: string
      media: string
      description?: { text: string }
    }> = []

    for (const m of req.media) {
      const asset = await uploadMedia(token.access_token, authorUrn, m)
      if (!asset) {
        return {
          ok: false,
          publisher: 'native',
          error: `Failed to upload media to LinkedIn: ${m.url}`,
        }
      }
      mediaAssets.push({
        status: 'READY',
        media: asset,
        ...(m.alt_text ? { description: { text: m.alt_text } } : {}),
      })
    }

    // Build the UGC post body
    const shareMediaCategory =
      req.media.length === 0
        ? 'NONE'
        : req.media[0]!.type === 'video'
          ? 'VIDEO'
          : 'IMAGE'

    const ugcPost: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: fullCaption },
          shareMediaCategory,
          ...(mediaAssets.length > 0 ? { media: mediaAssets } : {}),
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }

    try {
      const res = await linkedinFetch('/ugcPosts', token.access_token, {
        method: 'POST',
        body: JSON.stringify(ugcPost),
      })

      // Handle rate limiting
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After')
        const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
        return {
          ok: false,
          publisher: 'native',
          error: 'LinkedIn rate limit hit.',
          retry_after_ms: retryMs,
        }
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return {
          ok: false,
          publisher: 'native',
          error: `LinkedIn API ${res.status}: ${errText}`,
        }
      }

      // LinkedIn returns the post ID in the x-restli-id header
      const postId = res.headers.get('x-restli-id') ?? ''
      const permalink = postId
        ? `https://www.linkedin.com/feed/update/${postId}/`
        : undefined

      return {
        ok: true,
        publisher: 'native',
        external_post_id: postId,
        external_permalink: permalink,
      }
    } catch (err) {
      return {
        ok: false,
        publisher: 'native',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },
}

export default linkedinPublisher
