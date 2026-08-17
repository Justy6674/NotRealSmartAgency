/**
 * Shared types for the direct-to-platform publisher infrastructure.
 *
 * Every native publisher (LinkedIn, Meta, TikTok, YouTube, X) implements
 * the Publisher interface. The dispatcher routes to native, Mixpost or Zernio
 * — see selectPublisherBackend in ./dispatcher, which owns that decision.
 */

export type PublisherPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'twitter'

/**
 * 'zernio' arrived after the audit table was written.
 *
 * supabase/migrations/034_direct_publishing.sql still declares
 * `publisher text not null check (publisher in ('native','mixpost'))`, so a
 * Zernio run cannot be recorded until that constraint is widened: PostgREST
 * rejects the insert, logRun returns null, and the retry enqueue that needs the
 * run id is skipped with it. The publish still happens — what is lost is the
 * audit row, which is the one thing this table exists to guarantee. Widening it
 * is a live schema change and belongs to whoever owns the migration, not here.
 */
export type PublisherBackend = 'native' | 'mixpost' | 'zernio'

/**
 * Which publisher a given brand + platform resolves to, and the Zernio account
 * that was matched when it resolved that way.
 *
 * The account id travels with the decision on purpose. Returning a bare
 * 'zernio' would force the send path to repeat the brand→profile→account
 * lookup, and two copies of a matching rule is how a post ends up on somebody
 * else's connected account.
 */
export type PublisherSelection =
  | {
      backend: 'zernio'
      /** Already matched against the brand's profile AND the exact platform. */
      zernioAccountId: string
      /** The `social_urls.zernio_profile_id` that owned that account. */
      zernioProfileId: string
    }
  | { backend: 'native' }
  | { backend: 'mixpost' }

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
  /**
   * The brand's sign-off, appended after the hashtags exactly as given —
   * including its own leading newlines or space.
   *
   * It is a field rather than something the caller bakes into `caption` because
   * the cron publisher built a signature suffix and the dispatcher never did,
   * so the same row published with the brand's sign-off down one path and
   * without it down the other. One field, appended in one place, is the only
   * arrangement where the paths cannot disagree. A caller that has already
   * appended it to `caption` leaves this undefined; do not do both.
   */
  signature?: string
  metadata?: Record<string, unknown>
}

export interface PublishResult {
  ok: boolean
  publisher: PublisherBackend
  external_post_id?: string
  external_permalink?: string
  error?: string
  /**
   * True only when the platform itself said the post is live.
   *
   * `ok` answers the narrower question of whether the publisher accepted the
   * send without erroring. Zernio with publishNow returns the terminal outcome
   * in the create response — per-platform status, permalink, errorMessage — and
   * the cron read only the id off it, so a post that came back `failed` was
   * stored with an external id and marked `publishing`, indistinguishable from
   * one that went live. Mixpost never confirms synchronously at all; its
   * webhook does. Treating `ok` as "it is live" repeats the fault
   * src/lib/posts/create-draft.ts was written to prevent: pending is not done.
   */
  confirmed?: boolean
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
