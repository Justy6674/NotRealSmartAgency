/**
 * The Zernio client and the account/post primitives every other module builds on.
 *
 * Depended on by: `posts.ts`, `validate.ts`, `queue.ts`, `media.ts`,
 * `accounts.ts`, `engagement.ts`, `insights.ts`,
 * `src/lib/publishers/dispatcher.ts`, and the analytics and cron routes listed
 * by `graphify explain "client.ts"`. Tenant isolation lives here and is pinned
 * by `account-scoping.test.ts` — read that test before touching the filters.
 */

import Zernio from '@zernio/node';
import { messageOf } from '@/lib/errors/user-safe';
import { assertZernioJson, ZernioNotConfiguredError } from './errors';
import { zernioIdOf } from './types';
import type { ZernioMediaItem, ZernioPlatformTarget, ZernioPostSource } from './types';

/** Raw REST base, for the few places the SDK has no operation. */
export const ZERNIO_API_BASE = 'https://zernio.com/api/v1';

export function zernioConfigured(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

/**
 * One constructor, server-side only.
 *
 * Every module in this directory goes through here so that "is the publisher
 * configured" is answered in one place and in one way, and so a client is never
 * built in a browser bundle with a key in it.
 */
export function getZernioClient(operation = 'zernio'): Zernio {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new ZernioNotConfiguredError(operation);
  return new Zernio({ apiKey });
}

export interface ZernioAccount {
  id: string;
  platform: string;
  profileId?: string;
  username?: string;
  displayName?: string;
}

/**
 * Normalise one raw Zernio account into the shape this codebase declares.
 *
 * The API does not return what `ZernioAccount` promised. It returns Mongo's
 * `_id`, not `id`, and `profileId` is a POPULATED OBJECT — `{_id, name}` — not
 * a string. Returning `data.accounts` straight through meant the declared type
 * was fiction the compiler could not catch, because it came off an `any`.
 *
 * The cost was total and silent: the publish cron selects a brand's accounts
 * with `a.profileId === profileId`, comparing an object to a string. That is
 * always false, so Zernio was never chosen for any brand, and every post fell
 * through to Mixpost while the configuration looked correct in every place a
 * person would think to check. `a.id` was `undefined` for the same reason.
 *
 * Both id shapes are accepted rather than one being assumed: the SDK may
 * populate or not depending on the call, and a publish path must not depend on
 * which.
 *
 * That last paragraph was aspiration, not code, until 2026-08-19. This function
 * read only `_id` off a populated `profileId` while `zernioIdOf` — the helper
 * written for exactly this trap, and used by posts.ts, queue.ts and
 * engagement.ts — reads `id ?? _id`. So the day an SDK release populated the
 * reference as `{id, name}` instead of `{_id, name}`, every account would lose
 * its profileId, the filter below would match nothing, and `fetchZernioAccounts`
 * would return `[]` for every brand: not an error anywhere, just a total silent
 * publishing outage with the configuration looking correct. One helper, both
 * shapes, everywhere — hand-rolling the read is the bug.
 *
 * Exported so the test can assert the behaviour rather than the source text.
 */
export function normaliseAccount(raw: Record<string, unknown>): ZernioAccount {
  const profileId = zernioIdOf(raw.profileId)

  return {
    id: zernioIdOf(raw),
    platform: String(raw.platform ?? ''),
    ...(profileId ? { profileId } : {}),
    ...(raw.username ? { username: String(raw.username) } : {}),
    ...(raw.displayName ? { displayName: String(raw.displayName) } : {}),
  }
}

export async function fetchZernioAccounts(profileId?: string): Promise<ZernioAccount[]> {
  try {
    if (!process.env.ZERNIO_API_KEY) return [];

    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });

    /*
     * The filter is applied HERE, not by Zernio.
     *
     * The previous comment on this line read "The Zernio API accepts profileId
     * as a filter". It does accept it, and it ignores it. Measured against the
     * live account on 2026-08-17: listAccounts({profileId}) returned all ten
     * accounts across every profile, byte-identical to passing no filter at all.
     *
     * Zernio's own multi-tenant guide says as much — validation is "against your
     * whole team, not against a profile", and integrators are told to "only pass
     * a customer their own account IDs". Tenant isolation is ours to enforce.
     *
     * Two live consequences of trusting it. Callers using this to answer "does
     * this account belong to this brand" were comparing against every account in
     * the team, so the answer was always yes. And with the same social accounts
     * attached to more than one profile, a publisher picking by platform alone
     * could match twice and post the same thing twice to one page.
     *
     * Each account carries its own profileId, so the filter is exact. It is
     * applied after normalisation because the raw field is sometimes a populated
     * object rather than a string.
     */
    /*
     * `query`, not a bare `{ profileId }`.
     *
     * The SDK puts filters on `options.query`. The previous call handed the id
     * in at the top level, so it was dropped before the request was built and
     * the wire call was always unfiltered — which is why "we passed profileId
     * and got every account back" reproduced so reliably.
     *
     * Sending it properly narrows the payload; it does NOT change who owns
     * what. A filtered listing is asked for first and an unfiltered one is used
     * if that call fails, because a publish path must never lose every account
     * over a filter argument. Our own filter below is what decides ownership,
     * either way.
     */
    let listed = profileId
      ? await zernio.accounts.listAccounts({ query: { profileId } })
      : await zernio.accounts.listAccounts();
    if (profileId && (listed.error || !listed.data)) {
      // A rejected or unrecognised profile filter must not read as "this brand
      // has no accounts" — that is a silent publishing outage. Ask again
      // without it and let our own filter decide.
      console.error('[zernio] profile-filtered account listing failed, retrying unfiltered');
      listed = await zernio.accounts.listAccounts();
    }
    const data = listed.data ?? ({} as Record<string, unknown>);

    const accounts = ((data as { accounts?: unknown }).accounts ?? []) as unknown as Record<string, unknown>[]
    const normalised = accounts.map(normaliseAccount).filter((a) => a.id !== '');

    if (!profileId) return normalised;
    return normalised.filter((a) => a.profileId === profileId);
  } catch (err) {
    console.error('Failed to fetch Zernio accounts:', err);
    return [];
  }
}

/**
 * Type a media URL by its path, not the signed query.
 *
 * createZernioPost used `endsWith('.mp4')` on the whole string. A Supabase
 * signed URL is `clip.mp4?token=…`, so every real video was typed as an image
 * and Zernio refused it after the caption was already written.
 */
export function mediaTypeFromUrl(url: string): 'image' | 'video' | 'gif' {
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    path = url.split('?')[0]?.split('#')[0] ?? url
  }
  const lower = path.toLowerCase()
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) return 'video'
  if (lower.endsWith('.gif')) return 'gif'
  return 'image'
}

export interface CreateZernioPostParams {
  content: string;
  /**
   * One entry per target. Each may carry its OWN words, media and time —
   * `customContent`, `customMedia`, `scheduledFor` — which is what makes two
   * accounts on the same network able to say different things.
   */
  accounts: ZernioPlatformTarget[];
  /** Simple case: public URLs, typed by extension. Prefer `media` when you know more. */
  mediaUrls?: string[];
  /** Full media items — alt text, video cover, Reel cover, filename, size. */
  media?: ZernioMediaItem[];
  scheduledFor?: string;
  publishNow?: boolean;
  /**
   * Save without sending. Zernio also defaults to a draft when none of
   * scheduledFor / publishNow / queuedFromProfile is given.
   */
  isDraft?: boolean;
  /** IANA zone, e.g. `Australia/Brisbane`. */
  timezone?: string;
  tags?: string[];
  hashtags?: string[];
  /**
   * Schedule into the profile's posting queue. Zernio picks the next free slot
   * under a lock — do NOT read `queue.getNextQueueSlot` and pass that time as
   * `scheduledFor`, which bypasses the lock and double-books a slot.
   */
  queuedFromProfile?: string;
  queueId?: string;
  /** Our `scheduled_posts.id`, stamped on the post so it can be reconciled later. */
  nrsScheduledPostId?: string;
  /** Anything else worth stamping. Merged under `nrsScheduledPostId`. */
  metadata?: Record<string, unknown>;
  /** Stored on publisher_runs.idempotency_key. Retry the same UUID. */
  requestId?: string;
  /**
   * Applied to every target that does not carry its own. Names must match the
   * SDK *PlatformData types (`toZernioPlatformData`). Omitted rather than sent
   * empty.
   */
  platformSpecificData?: Record<string, unknown>;
}

/**
 * Build the createPost body without sending it.
 *
 * Separate from the call so the per-platform fields can be asserted by a test
 * that needs no network and no key — the headline gap this slice closes was
 * invisible precisely because nothing could look at the body.
 */
export function buildZernioPostBody(params: CreateZernioPostParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    content: params.content,
    platforms: params.accounts.map((account) => ({
      platform: account.platform,
      accountId: account.accountId,
      // Per-target overrides first: a caller that took the trouble to write
      // different words for this account must not have them replaced by the
      // shared caption. Absent fields are OMITTED, never sent empty — an empty
      // customContent would publish an empty caption to that one network.
      ...(account.customContent ? { customContent: account.customContent } : {}),
      ...(account.customMedia && account.customMedia.length > 0
        ? { customMedia: account.customMedia }
        : {}),
      ...(account.scheduledFor ? { scheduledFor: account.scheduledFor } : {}),
      ...(account.platformSpecificData
        ? { platformSpecificData: account.platformSpecificData }
        : params.platformSpecificData
          ? { platformSpecificData: params.platformSpecificData }
          : {}),
    })),
  };

  if (params.scheduledFor) {
    body.scheduledFor = params.scheduledFor;
  } else if (params.publishNow) {
    body.publishNow = true;
  } else if (params.queuedFromProfile) {
    body.queuedFromProfile = params.queuedFromProfile;
    if (params.queueId) body.queueId = params.queueId;
  }

  if (params.isDraft !== undefined) body.isDraft = params.isDraft;
  if (params.timezone) body.timezone = params.timezone;
  if (params.tags && params.tags.length > 0) body.tags = params.tags;
  if (params.hashtags && params.hashtags.length > 0) body.hashtags = params.hashtags;

  const media: ZernioMediaItem[] = [
    ...(params.media ?? []),
    ...((params.mediaUrls ?? [])
      .filter((url) => !(params.media ?? []).some((item) => item.url === url))
      .map((url) => ({ type: mediaTypeFromUrl(url), url }))),
  ];
  if (media.length > 0) body.mediaItems = media;

  const metadata: Record<string, unknown> = { ...(params.metadata ?? {}) };
  if (params.nrsScheduledPostId) metadata.nrsScheduledPostId = params.nrsScheduledPostId;
  if (Object.keys(metadata).length > 0) body.metadata = metadata;

  return body;
}

export async function createZernioPost(params: CreateZernioPostParams) {
  try {
    if (!process.env.ZERNIO_API_KEY) throw new Error('Missing ZERNIO_API_KEY');

    const zernio = getZernioClient('posts.createPost');

    const body = buildZernioPostBody(params);

    // Official SDKs auto-generate x-request-id per call. A retry without our
    // stored UUID is a new logical request (docs.zernio.com/guides/idempotency).
    const { data } = await zernio.posts.createPost({
      ...(params.requestId ? { headers: { 'x-request-id': params.requestId } } : {}),
      body: body as never,
    });
    return data?.post;
  } catch (err: any) {
    console.error('Failed to create Zernio post:', err.message);
    throw err;
  }
}

export interface ZernioDailyMetrics {
  dailyData: Array<{
    date?: string
    postCount?: number
    metrics?: Record<string, number>
  }>
  platformBreakdown: Array<{
    platform: string
    postCount?: number
    impressions?: number
    reach?: number
    likes?: number
    comments?: number
    shares?: number
    saves?: number
    clicks?: number
    views?: number
  }>
}

const EMPTY_ANALYTICS: ZernioDailyMetrics = { dailyData: [], platformBreakdown: [] }

function asMetricRecord(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

function parseDailyMetrics(raw: unknown): ZernioDailyMetrics {
  const node = (raw ?? {}) as Record<string, unknown>
  const data = (node.data ?? node) as Record<string, unknown>
  const dailyRaw = Array.isArray(data.dailyData) ? data.dailyData : []
  const breakdownRaw = Array.isArray(data.platformBreakdown) ? data.platformBreakdown : []

  return {
    dailyData: dailyRaw.map((day) => {
      const row = (day ?? {}) as Record<string, unknown>
      return {
        ...(typeof row.date === 'string' ? { date: row.date } : {}),
        ...(typeof row.postCount === 'number' ? { postCount: row.postCount } : {}),
        metrics: asMetricRecord(row.metrics),
      }
    }),
    platformBreakdown: breakdownRaw.flatMap((row) => {
      const item = (row ?? {}) as Record<string, unknown>
      const platform = typeof item.platform === 'string' ? item.platform : ''
      if (!platform) return []
      return [{
        platform,
        ...(typeof item.postCount === 'number' ? { postCount: item.postCount } : {}),
        ...(typeof item.impressions === 'number' ? { impressions: item.impressions } : {}),
        ...(typeof item.reach === 'number' ? { reach: item.reach } : {}),
        ...(typeof item.likes === 'number' ? { likes: item.likes } : {}),
        ...(typeof item.comments === 'number' ? { comments: item.comments } : {}),
        ...(typeof item.shares === 'number' ? { shares: item.shares } : {}),
        ...(typeof item.saves === 'number' ? { saves: item.saves } : {}),
        ...(typeof item.clicks === 'number' ? { clicks: item.clicks } : {}),
        ...(typeof item.views === 'number' ? { views: item.views } : {}),
      }]
    }),
  }
}

function mergeDailyMetrics(parts: ZernioDailyMetrics[]): ZernioDailyMetrics {
  return {
    dailyData: parts.flatMap((part) => part.dailyData),
    platformBreakdown: parts.flatMap((part) => part.platformBreakdown),
  }
}

/**
 * Daily metrics for accounts we already know belong to this brand.
 *
 * `profileId` on the analytics endpoint is the same trap as listAccounts: it
 * is accepted and must not be trusted. We resolve the brand's accounts with
 * `fetchZernioAccounts` (filter after normalise) and ask per `accountId`.
 *
 * Null means we could not reach the publisher. An empty payload means we
 * reached it and this brand has nothing to show — those are not the same.
 */
export async function fetchZernioAnalytics(params: {
  profileId?: string
  accountId?: string
  platform?: string
  fromDate?: string
  toDate?: string
}): Promise<ZernioDailyMetrics | null> {
  try {
    if (!process.env.ZERNIO_API_KEY) return null

    const accountIds: string[] = []
    if (params.accountId) {
      if (params.profileId) {
        const own = await fetchZernioAccounts(params.profileId)
        if (!own.some((account) => account.id === params.accountId)) {
          return EMPTY_ANALYTICS
        }
      }
      accountIds.push(params.accountId)
    } else if (params.profileId) {
      const own = await fetchZernioAccounts(params.profileId)
      accountIds.push(...own.map((account) => account.id))
    } else {
      // No profile and no account is "the whole team". Isolation forbids it.
      return EMPTY_ANALYTICS
    }

    if (accountIds.length === 0) return EMPTY_ANALYTICS

    const parts = await Promise.all(accountIds.map(async (accountId) => {
      const query: Record<string, string> = { accountId }
      if (params.platform) query.platform = params.platform
      if (params.fromDate) query.fromDate = params.fromDate
      if (params.toDate) query.toDate = params.toDate
      const qs = new URLSearchParams(query).toString()
      const res = await fetch(`${ZERNIO_API_BASE}/analytics/daily-metrics?${qs}`, {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
      })
      // Not `if (!res.ok)`. A wrong path here answers 200 with an HTML page, so
      // that guard cannot fire and the parse throws somewhere unrelated later.
      assertZernioJson(res, 'analytics.daily-metrics')
      return parseDailyMetrics(await res.json())
    }))

    return mergeDailyMetrics(parts)
  } catch (err) {
    console.error('Failed to fetch publisher analytics:', messageOf(err))
    return null
  }
}

export interface ZernioPost {
  id: string
  status: string | null
  content: string
  accountIds: string[]
  platforms: string[]
  scheduledFor?: string
  createdAt?: string
}

/**
 * Account ids on a post, accepting both a string and a populated object.
 *
 * Same shape trap as accounts: `platforms[].accountId` is sometimes
 * `{_id, name}` rather than a string. Guessing `id` vs `_id` is how the
 * publish cron missed every Zernio account; both are accepted here.
 */
function accountIdsFromPost(raw: Record<string, unknown>): string[] {
  const platforms = raw.platforms
  if (!Array.isArray(platforms)) return []
  const ids: string[] = []
  for (const entry of platforms) {
    if (!entry || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    const rawId = rec.accountId
    const id = typeof rawId === 'string'
      ? rawId
      : typeof rawId === 'object' && rawId
        ? String((rawId as { _id?: unknown; id?: unknown }).id ?? (rawId as { _id?: unknown })._id ?? '')
        : ''
    if (id) ids.push(id)
  }
  return ids
}

function platformsFromPost(raw: Record<string, unknown>): string[] {
  const platforms = raw.platforms
  if (!Array.isArray(platforms)) return []
  return platforms.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const platform = (entry as Record<string, unknown>).platform
    return typeof platform === 'string' && platform ? [platform] : []
  })
}

function normalisePost(raw: Record<string, unknown>): ZernioPost {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    status: typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim() : null,
    content: typeof raw.content === 'string' ? raw.content : '',
    accountIds: accountIdsFromPost(raw),
    platforms: platformsFromPost(raw),
    ...(typeof raw.scheduledFor === 'string' ? { scheduledFor: raw.scheduledFor } : {}),
    ...(typeof raw.createdAt === 'string' ? { createdAt: raw.createdAt } : {}),
  }
}

/**
 * Posts for one brand's accounts.
 *
 * `listPosts({ profileId })` is the same contract as `listAccounts`: the
 * argument is accepted. Isolation is applied after normalisation against the
 * account ids `fetchZernioAccounts` already scoped. A post whose accounts are
 * not in that set is another tenant's.
 *
 * `source` defaults to Zernio's own default of `zernio`, which returns ONLY
 * posts authored through the publisher — zero rows on a brand whose 210 posts
 * were published outside it. New code should use `listZernioPosts` in
 * `./posts.ts`, which refuses to guess and makes the caller name the source.
 */
export async function fetchZernioPosts(params: {
  profileId?: string
  status?: 'draft' | 'scheduled' | 'published' | 'failed'
  limit?: number
  /** Say `external` to see history published outside this app. */
  source?: ZernioPostSource
}): Promise<ZernioPost[]> {
  try {
    if (!process.env.ZERNIO_API_KEY) return []
    const profileId = params.profileId
    if (!profileId) return []

    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY })
    const res = await zernio.posts.listPosts({
      query: {
        profileId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.source ? { source: params.source } : {}),
        limit: params.limit ?? 50,
      },
    } as never)

    const node = (res ?? {}) as Record<string, unknown>
    const data = (node.data ?? node) as Record<string, unknown>
    const rawPosts = (data.posts ?? []) as unknown as Record<string, unknown>[]
    const normalised = rawPosts.map(normalisePost).filter((post) => post.id !== '')

    const own = await fetchZernioAccounts(profileId)
    const allowed = new Set(own.map((account) => account.id))
    return normalised.filter((post) => post.accountIds.some((id) => allowed.has(id)))
  } catch (err) {
    console.error('Failed to fetch publisher posts:', messageOf(err))
    return []
  }
}

/** Upstream is a third party on someone else's network. Never hang the route. */
const ADS_TIMEOUT_MS = 9000;

/** The eight platforms Zernio's ads endpoints accept. */
export const ZERNIO_AD_PLATFORMS = [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'pinterest',
  'google',
  'twitter',
  'openai',
] as const;

export type ZernioAdPlatform = (typeof ZERNIO_AD_PLATFORMS)[number];

export function isZernioAdPlatform(value: unknown): value is ZernioAdPlatform {
  return typeof value === 'string' && (ZERNIO_AD_PLATFORMS as readonly string[]).includes(value);
}

/**
 * Campaigns, or the reason there are none — never the two collapsed together.
 *
 * TRANSPORT ONLY. What comes back is whatever Zernio said, for the whole team.
 * The `profileId` argument narrows the payload and DOES NOT decide ownership —
 * same contract as `listAccounts`, which accepts the filter and ignores it. A
 * caller that needs to know whose campaign this is must use
 * `listOwnedZernioCampaigns` / `findOwnedZernioCampaign` below, which re-filter
 * against accounts we scoped ourselves and fail closed.
 *
 * This used to return `[]` from its catch block and `[]` again when the API key
 * was missing. So a 401 from a rotated key, a 5xx, a timeout and a DNS failure
 * all arrived at the page as "no campaigns running" — a calm, factual sentence
 * about a brand that might be spending money at that moment. The page's own
 * error state could never fire, because nothing upstream could ever fail.
 *
 * A caller now has to decide what to do about `ok: false`, which is the whole
 * point: an empty list is a finding, and an unanswered call is not.
 */
export type ZernioCampaignsResult =
  | { ok: true; campaigns: unknown[] }
  /** No ZERNIO_API_KEY on this deployment, so nothing was ever asked. */
  | { ok: false; reason: 'not_configured' }
  /** Zernio was asked and did not answer usefully: 401, 5xx, timeout, DNS. */
  | { ok: false; reason: 'unreachable' };

export async function listZernioCampaigns(
  profileId?: string,
  accountId?: string,
): Promise<ZernioCampaignsResult> {
  if (!process.env.ZERNIO_API_KEY) return { ok: false, reason: 'not_configured' };

  try {
    const query: Record<string, string> = {};
    if (profileId) query.profileId = profileId;
    if (accountId) query.accountId = accountId;
    const qs = new URLSearchParams(query).toString();

    const res = await fetch(`${ZERNIO_API_BASE}/ads/campaigns${qs ? `?${qs}` : ''}`, {
      headers: { 'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(ADS_TIMEOUT_MS),
    });
    // Content type before status: a wrong ads path answers 200 with the site
    // shell, and "no campaigns" about a brand that is spending money is the
    // exact lie this function was rewritten to stop telling.
    assertZernioJson(res, 'ads.listCampaigns');

    const data = await res.json();
    // A response that is neither `{campaigns: [...]}` nor a bare array is not an
    // empty ledger — it is a response we do not understand, and saying "no
    // campaigns" about it would be the same lie in a different shape.
    if (Array.isArray(data?.campaigns)) return { ok: true, campaigns: data.campaigns };
    if (Array.isArray(data)) return { ok: true, campaigns: data };
    throw new Error('Zernio ads returned an unrecognised shape');
  } catch (err) {
    console.error('Failed to list Zernio campaigns:', messageOf(err));
    return { ok: false, reason: 'unreachable' };
  }
}

/**
 * One campaign, reduced to the fields that decide whose it is.
 *
 * `raw` is carried through untouched because the ledger page reads far more
 * than this (budgets, metrics, currency, review status) and normalising it here
 * would fork a second contract from the one in
 * `src/components/agency/ads/campaign.ts`.
 */
export interface ZernioAdCampaignRecord {
  /** Zernio's own record id where there is one. AdCampaign often has none. */
  id: string
  /** The id the ledger shows and the status endpoint takes. */
  platformCampaignId: string | null
  platform: ZernioAdPlatform | null
  /** The connected account this campaign runs on — our proof of ownership. */
  accountId: string | null
  /** The Zernio profile the record claims. Compared against ours, never trusted alone. */
  profileId: string | null
  raw: Record<string, unknown>
}

/**
 * `accountId` and `profileId` are `_id`-or-`id`, string-or-populated-object,
 * exactly like every other Zernio reference — hence `zernioIdOf` rather than a
 * fourth hand-rolled read of the same two fields.
 */
export function normaliseAdCampaign(raw: unknown): ZernioAdCampaignRecord {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const platformCampaignId = typeof rec.platformCampaignId === 'string' && rec.platformCampaignId.trim()
    ? rec.platformCampaignId.trim()
    : null

  return {
    id: zernioIdOf(rec),
    platformCampaignId,
    platform: isZernioAdPlatform(rec.platform) ? rec.platform : null,
    accountId: zernioIdOf(rec.accountId) || null,
    profileId: zernioIdOf(rec.profileId) || null,
    raw: rec,
  }
}

/** The brand's own side of the comparison, resolved by us before any of this. */
export interface ZernioAdScope {
  /** From `brands.social_urls.zernio_profile_id` — our record, not Zernio's. */
  profileId: string
  /** From `fetchZernioAccounts(profileId)`, which filters locally. */
  accountIds: readonly string[]
}

/**
 * Does this campaign belong to this brand? Fail closed.
 *
 * A row is kept only when it says so itself: its account is one of the accounts
 * we scoped to this brand, or its profile is the profile our own database
 * recorded for this brand. A row that names neither is not "probably ours" —
 * it is unattributable, and an unattributable row that carries a pause button
 * is another tenant's advertising one click from being stopped.
 *
 * Note what is deliberately absent: "it came back from a call we made with
 * ?profileId=". That is Zernio deciding whose data this is, and Zernio does not
 * do that — its own multi-tenant guide says validation runs against the whole
 * team. The filter has to be ours or it is not a filter.
 */
export function campaignBelongsToBrand(
  campaign: ZernioAdCampaignRecord,
  scope: ZernioAdScope,
): boolean {
  if (!scope.profileId) return false
  if (campaign.accountId && scope.accountIds.includes(campaign.accountId)) return true
  if (campaign.profileId && campaign.profileId === scope.profileId) return true
  return false
}

export type ZernioOwnedCampaignsResult =
  | {
      ok: true
      campaigns: ZernioAdCampaignRecord[]
      /** How many rows Zernio returned that we could not attribute to this brand. */
      withheld: number
      scope: ZernioAdScope
    }
  | { ok: false; reason: 'not_configured' | 'unreachable' }
  /** No profile on the brand, so there is no set of campaigns to be right about. */
  | { ok: false; reason: 'not_scoped' }

/**
 * This brand's campaigns, and only this brand's.
 *
 * The accounts are resolved first, through `fetchZernioAccounts`, because that
 * is the one place tenant scoping is already enforced in our own code. Every
 * campaign is then matched against that set before anyone can see it or act on
 * it, and the count of rows that failed the match is reported rather than
 * quietly dropped — a caller that hides everything and says nothing has told
 * the owner the same calm lie as "no campaigns running".
 */
export async function listOwnedZernioCampaigns(
  profileId: string,
  accountId?: string,
): Promise<ZernioOwnedCampaignsResult> {
  if (!process.env.ZERNIO_API_KEY) return { ok: false, reason: 'not_configured' }
  if (!profileId || !profileId.trim()) return { ok: false, reason: 'not_scoped' }

  const own = await fetchZernioAccounts(profileId)
  const accountIds = own.map((account) => account.id).filter(Boolean)
  const scope: ZernioAdScope = { profileId: profileId.trim(), accountIds }

  const listed = await listZernioCampaigns(profileId, accountId)
  if (!listed.ok) return listed

  const normalised = listed.campaigns.map(normaliseAdCampaign)
  const owned = normalised.filter((campaign) => {
    if (!campaignBelongsToBrand(campaign, scope)) return false
    // A narrowing accountId came from the caller. It has already been checked
    // against this brand's accounts, so this only holds Zernio to the filter it
    // was asked for — a row for a different account is dropped, not shown.
    if (accountId && campaign.accountId !== accountId) return false
    return true
  })

  return { ok: true, campaigns: owned, withheld: normalised.length - owned.length, scope }
}

export type ZernioOwnedCampaignResult =
  | { ok: true; campaign: ZernioAdCampaignRecord; scope: ZernioAdScope }
  | { ok: false; reason: 'not_configured' | 'unreachable' | 'not_scoped' }
  /** Matched nothing this brand owns. Covers "someone else's" and "not synced yet". */
  | { ok: false; reason: 'not_owned' }

/**
 * Find one campaign of this brand's by the id a caller sent.
 *
 * The id in a request body proves nothing whatsoever, so it is used only to
 * search a set that was already narrowed to this brand. Matching against the
 * unscoped list — which is what this route did until 2026-08-19 — meant tenant
 * A could send tenant B's `platformCampaignId`, find it, and pause B's live
 * advertising with a request that passed every other check in the file.
 */
export async function findOwnedZernioCampaign(
  profileId: string,
  campaignId: string,
): Promise<ZernioOwnedCampaignResult> {
  const listed = await listOwnedZernioCampaigns(profileId)
  if (!listed.ok) return listed

  const wanted = campaignId.trim()
  if (!wanted) return { ok: false, reason: 'not_owned' }

  const campaign = listed.campaigns.find(
    (c) => c.platformCampaignId === wanted || (c.id !== '' && c.id === wanted),
  )
  if (!campaign) return { ok: false, reason: 'not_owned' }

  return { ok: true, campaign, scope: listed.scope }
}

/**
 * Pause or resume every ad in a campaign, in one platform call.
 *
 * PUT, and `platform` alongside `status` — both verified against Zernio's own
 * documentation (PUT /v1/ads/campaigns/{campaignId}/status with
 * `{ status, platform }`) and against the SDK's `UpdateAdCampaignStatusData` in
 * node_modules/@zernio/node/dist/index.d.ts. The previous version POSTed
 * `{ status }` alone, so the control could not have worked: the UI was already
 * sending `platform` and the route was dropping it on the floor.
 *
 * Throws on failure. A pause that did not happen must never look like one that
 * did, so there is no empty-success path out of here.
 *
 * It takes the OWNED RECORD and the brand's scope, not a bare id, so the gate
 * sits at the exit rather than in whoever called it. The route checks ownership
 * too; this check is the one that cannot be skipped by writing a new route.
 * `platform` comes off the record for the same reason — a caller-supplied
 * platform is a caller-supplied claim about someone else's money.
 */
export async function setZernioCampaignStatus(
  campaign: ZernioAdCampaignRecord,
  status: 'active' | 'paused',
  scope: ZernioAdScope,
) {
  if (!process.env.ZERNIO_API_KEY) throw new Error('Missing ZERNIO_API_KEY');

  if (!campaignBelongsToBrand(campaign, scope)) {
    // Unreachable through the route, which refuses first with a sentence the
    // owner can act on. Reachable through the next route someone writes.
    throw new Error('Refusing to change a campaign that is not this brand\'s');
  }

  const campaignId = campaign.platformCampaignId ?? campaign.id;
  if (!campaignId) throw new Error('Campaign has no id to change');

  const platform = campaign.platform;
  if (!platform) throw new Error('Campaign has no platform to change it on');

  const res = await fetch(
    `${ZERNIO_API_BASE}/ads/campaigns/${encodeURIComponent(campaignId)}/status`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, platform }),
      cache: 'no-store',
      signal: AbortSignal.timeout(ADS_TIMEOUT_MS),
    },
  );
  assertZernioJson(res, 'ads.setCampaignStatus');
  return await res.json();
}

/**
 * Ask Zernio what became of a post we sent.
 *
 * The publish cron marks a row `publishing`, then a sweep reconciles it. That
 * sweep only ever asked Mixpost, behind a `/^[0-9a-f-]{36}$/` guard that matches
 * a UUID. A Zernio id is a 24-character Mongo ObjectId, so it failed the guard,
 * was never looked up, and fell through to being written off as "Never reached
 * the publisher — no post was created" twenty minutes later.
 *
 * So a post that published perfectly to Facebook read as a failure in NRS, and
 * the obvious next move — publish it again — puts it on the page twice.
 *
 * Returns the raw status string, or null when Zernio has no answer. Null means
 * "unknown", never "failed": deciding a post failed because we could not confirm
 * it is the fault this exists to remove.
 */
export async function fetchZernioPostStatus(postId: string): Promise<string | null> {
  try {
    if (!process.env.ZERNIO_API_KEY) return null;
    const zernio = getZernioClient('posts.getPost');
    /*
     * `path`, not a bare `{ postId }`.
     *
     * The SDK interpolates `/v1/posts/{postId}` from `options.path`. The
     * previous call passed `{ postId } as never`, so the placeholder was never
     * replaced and the request went to the literal path `/v1/posts/%7BpostId%7D`
     * — which, under zernio.com/api/v1, answers **200 with an HTML page**. The
     * status therefore read as null on every single reconciliation, forever,
     * and the sweep this function exists to feed could never confirm anything.
     * The `as never` was what let it compile.
     */
    const res = (await zernio.posts.getPost({ path: { postId } })) as unknown;

    // Responses nest as { data: { post: {...} } } on some endpoints and
    // { data: {...} } on others, and the SDK is young enough that this varies.
    const node = res as Record<string, unknown> | null;
    const data = (node?.data ?? node) as Record<string, unknown> | null;
    const post = (data?.post ?? data) as Record<string, unknown> | null;
    const status = post?.status;
    return typeof status === 'string' && status.trim() ? status.trim() : null;
  } catch (err) {
    console.error('[zernio] could not read post status:', messageOf(err));
    return null;
  }
}

/**
 * Map a Zernio status onto the only two verdicts worth acting on.
 *
 * The exact enum is NOT confirmed against a live post — nothing has published
 * through Zernio yet, so there was no real value to observe, only the docs'
 * `?status=failed` filter. Every value not clearly terminal therefore returns
 * null and the sweep asks again next tick. An unrecognised status must never
 * become a verdict; that is precisely how the Mixpost-only sweep invented
 * failures.
 */
export function zernioPostState(status: string | null): 'published' | 'failed' | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'published' || s === 'posted' || s === 'complete' || s === 'completed') return 'published';
  if (s === 'failed' || s === 'error' || s === 'rejected') return 'failed';
  return null;
}
