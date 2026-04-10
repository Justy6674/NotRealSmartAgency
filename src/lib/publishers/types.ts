/**
 * Shared types for the direct-to-platform publisher infrastructure.
 *
 * Every native publisher (LinkedIn, Meta, TikTok, YouTube, X) implements
 * the Publisher interface. The dispatcher routes to native vs Mixpost
 * based on per-platform feature flags.
 */

export type PublisherPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'twitter'

export type PublisherBackend = 'native' | 'mixpost'

export type PublishRunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'rate_limited'

// ── OAuth Token ─────────────────────────────────────────────────────────────

export interface OAuthToken {
  id: string
  brand_id: string
  platform: PublisherPlatform
  account_id: string
  account_name: string | null
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  scopes: string[]
  status: 'active' | 'expired' | 'revoked' | 'review_pending'
  last_refreshed_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Publish Request / Result ────────────────────────────────────────────────

export interface PublishMedia {
  url: string
  type: 'image' | 'video'
  mime_type: string
  size_bytes?: number
  duration_seconds?: number
  alt_text?: string
}

export interface PublishRequest {
  scheduled_post_id: string
  brand_id: string
  platform: PublisherPlatform
  caption: string
  media: PublishMedia[]
  hashtags?: string[]
  metadata?: Record<string, unknown>
}

export interface PublishResult {
  ok: boolean
  publisher: PublisherBackend
  external_post_id?: string
  external_permalink?: string
  error?: string
  /** If the platform returned a rate-limit, how long to wait (ms). */
  retry_after_ms?: number
}

// ── Publisher interface ─────────────────────────────────────────────────────

export interface Publisher {
  platform: PublisherPlatform

  /** Pre-flight validation (caption length, media constraints, etc.) */
  validate(req: PublishRequest): { ok: boolean; errors: string[] }

  /** Execute the publish. Token is pre-fetched by the dispatcher. */
  publish(req: PublishRequest, token: OAuthToken): Promise<PublishResult>
}
