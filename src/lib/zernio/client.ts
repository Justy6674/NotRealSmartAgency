import Zernio from '@zernio/node';
import { messageOf } from '@/lib/errors/user-safe';

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
 */
function normaliseAccount(raw: Record<string, unknown>): ZernioAccount {
  const rawProfile = raw.profileId
  const profileId = typeof rawProfile === 'string'
    ? rawProfile
    : (rawProfile as { _id?: unknown } | null)?._id

  return {
    id: String(raw.id ?? raw._id ?? ''),
    platform: String(raw.platform ?? ''),
    ...(profileId ? { profileId: String(profileId) } : {}),
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
    const { data } = await zernio.accounts.listAccounts(profileId ? { profileId } : undefined);

    const accounts = (data.accounts ?? []) as unknown as Record<string, unknown>[]
    const normalised = accounts.map(normaliseAccount).filter((a) => a.id !== '');

    if (!profileId) return normalised;
    return normalised.filter((a) => a.profileId === profileId);
  } catch (err) {
    console.error('Failed to fetch Zernio accounts:', err);
    return [];
  }
}

function getMediaType(url: string): 'image' | 'video' | 'gif' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.mov') || lowerUrl.endsWith('.webm')) return 'video';
  if (lowerUrl.endsWith('.gif')) return 'gif';
  return 'image';
}

export async function createZernioPost(params: {
  content: string;
  accounts: { platform: string; accountId: string }[];
  mediaUrls?: string[];
  scheduledFor?: string;
  publishNow?: boolean;
}) {
  try {
    if (!process.env.ZERNIO_API_KEY) throw new Error('Missing ZERNIO_API_KEY');
    
    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
    
    const body: any = {
      content: params.content,
      platforms: params.accounts
    };

    if (params.scheduledFor) {
      body.scheduledFor = params.scheduledFor;
    } else if (params.publishNow) {
      body.publishNow = true;
    }
    
    if (params.mediaUrls && params.mediaUrls.length > 0) {
      body.mediaItems = params.mediaUrls.map(url => ({
        type: getMediaType(url),
        url: url
      }));
    }

    const { data } = await zernio.posts.createPost({ body });
    return data.post;
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
      const res = await fetch(`https://zernio.com/api/v1/analytics/daily-metrics?${qs}`, {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
      })
      if (!res.ok) throw new Error(`publisher analytics ${res.status}`)
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
 */
export async function fetchZernioPosts(params: {
  profileId?: string
  status?: 'draft' | 'scheduled' | 'published' | 'failed'
  limit?: number
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

    const res = await fetch(`https://zernio.com/api/v1/ads/campaigns${qs ? `?${qs}` : ''}`, {
      headers: { 'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(ADS_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Zernio ads ${res.status}: ${await res.text().catch(() => '')}`);

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
 */
export async function setZernioCampaignStatus(
  campaignId: string,
  status: 'active' | 'paused',
  platform: ZernioAdPlatform,
) {
  if (!process.env.ZERNIO_API_KEY) throw new Error('Missing ZERNIO_API_KEY');

  const res = await fetch(
    `https://zernio.com/api/v1/ads/campaigns/${encodeURIComponent(campaignId)}/status`,
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
  if (!res.ok) {
    throw new Error(`Zernio ads status ${res.status}: ${await res.text().catch(() => '')}`);
  }
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
    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
    const res = (await zernio.posts.getPost({ postId } as never)) as unknown;

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
