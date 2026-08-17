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
 * The platforms the one door can actually reach.
 *
 * THE FAULT: a caller handed `post.platform` — a bare `string` off a database
 * row — straight into a `PublisherPlatform` parameter, and TypeScript is not
 * there at runtime to object. `resolveAccountIdsForPlatform` falls back to
 * `[platform]` for anything it does not recognise, so an unrecognised value did
 * not fail at the edge; it matched no accounts and failed several steps later
 * with a message about Mixpost that named nothing the owner could act on.
 *
 * This lived as a private const inside the cron. Every other caller that wants
 * to stop going around the door needs the same narrowing, and a second copy of
 * a six-member union is how the two lists come to disagree — so it lives with
 * the union it guards. Checked against live data on 2026-08-17: all 158 rows in
 * `scheduled_posts` use one of these six.
 */
export const DISPATCHABLE_PLATFORMS: readonly PublisherPlatform[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'twitter',
  'youtube',
]

export function asPublisherPlatform(value: unknown): PublisherPlatform | null {
  return typeof value === 'string' &&
    (DISPATCHABLE_PLATFORMS as readonly string[]).includes(value)
    ? (value as PublisherPlatform)
    : null
}

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
  | {
      backend: 'refused'
      /** Owner-facing. Never names a vendor. */
      reason: string
    }

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
  /**
   * `media_items.id`, so a fresh upload can be cached back onto the row it came
   * from. Without it the dispatcher can read a cache but never fill one, and
   * every publish of the same video pays the transcode again.
   */
  media_item_id?: string | null
  /**
   * `media_items.mixpost_media_id` — the numeric id Mixpost gave this file the
   * first time it was uploaded (migration 031, `integer`).
   *
   * Mixpost re-transcodes a video on upload; a 141MB .mov measured at ~382s.
   * `publish_to_social` has skipped that on a cache hit since April and the
   * dispatcher did not, so moving a caller onto the door would have made every
   * repeat publish six minutes slower than the path it replaced.
   */
  mixpost_media_id?: number | null
  /**
   * `media_items.thumbnail_url` — the poster frame Mixpost shows on a video
   * (its `video_thumbs`). Carried here because the caller is the only one that
   * has read the `media_items` row; see the note at the version literal in
   * dispatcher.ts for why it is not sent yet.
   */
  thumbnail_url?: string | null
}

export interface PublishRequest {
  scheduled_post_id: string
  brand_id: string
  /**
   * The exact account this call may touch. Required. Two Instagrams on one
   * brand are two ids — matching on platform alone posts twice to the first.
   * Linked + zernio: a live zernio_account_map row. Unlinked / toggle=mixpost:
   * the Mixpost uuid or native OAuth id — never looked up on the Zernio map.
   */
  account_id: string
  /** UUIDv4 sent as Zernio x-request-id and stored on the run. */
  idempotency_key?: string
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
  /**
   * 'single' | 'carousel' | 'reel' | 'video'. Decides Instagram/Facebook
   * reel-vs-feed and whether TikTok is asked to add music to a photo post.
   *
   * THE FAULT: the cron passed this inside `metadata`, under a comment
   * promising the dispatcher would apply it. Nothing in the dispatcher ever
   * read `req.metadata` — it is inert to this day — so a vertical 9:16 video
   * was published as a feed post and rendered pillarboxed with black bars down
   * both sides. It is a field rather than a metadata key so that it cannot be
   * promised and ignored a second time: a caller that sets it can see, in this
   * type, that something reads it.
   */
  post_type?: string | null
  /**
   * The owner's per-platform choices from the composer, as stored in
   * `scheduled_posts.metadata.platform_options`.
   *
   * Carried as its own field rather than spliced into `metadata` because only
   * the keys verified against Mixpost Pro's own *PostOptions classes may be
   * sent — Mixpost runs `Arr::only($version['options'], array_keys($providers))`
   * and discards anything else without a word, so an unverified key reads as a
   * setting that applied when it never did. The rest travel this far and stop,
   * so the one place that shapes those options
   * (`buildPlatformOptions`, src/lib/mixpost/sync-draft.ts) can start using
   * them without another schema hunt.
   */
  platform_options?: Record<string, unknown> | null
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
  /**
   * The publisher was never reached, as opposed to refusing the content.
   *
   * Both arrive as `{ ok: false, error }`, and the cron currently tells them
   * apart by matching the error PROSE against a hard-coded list of phrases
   * (PUBLISHER_UNREACHABLE, cron/publish-posts/route.ts:122) — whose own
   * comment says to delete it the moment this flag exists. Prose is not a
   * protocol: reword one message and a transport outage starts being read as a
   * rejection, and the post is written off instead of requeued.
   *
   * True for: no accounts reachable, a rate limit, and every thrown transport
   * error. FALSE for a compliance block, a validation failure and 'no account
   * mapped to this project' — those are decisions about the content or the
   * setup, and requeueing a decision loops forever.
   */
  retryable?: boolean
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
