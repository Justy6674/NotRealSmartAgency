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

    // The Zernio API accepts profileId as a filter
    const { data } = await zernio.accounts.listAccounts(profileId ? { profileId } : undefined);

    const accounts = (data.accounts ?? []) as unknown as Record<string, unknown>[]
    return accounts.map(normaliseAccount).filter((a) => a.id !== '');
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

export async function fetchZernioAnalytics(params: {
  profileId?: string;
  accountId?: string;
  platform?: string;
  fromDate?: string;
  toDate?: string;
}) {
  try {
    if (!process.env.ZERNIO_API_KEY) return null;
    const zernio = new Zernio({ apiKey: process.env.ZERNIO_API_KEY });
    const query: Record<string, string> = {};
    if (params.profileId) query.profileId = params.profileId;
    if (params.accountId) query.accountId = params.accountId;
    if (params.platform) query.platform = params.platform;
    if (params.fromDate) query.fromDate = params.fromDate;
    if (params.toDate) query.toDate = params.toDate;
    
    // Zernio's analytics surface uses a generic GET helper; fall back to REST for reliability
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`https://zernio.com/api/v1/analytics/daily-metrics${qs ? `?${qs}` : ''}`, {
      headers: { 'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}` }
    });
    if (!res.ok) throw new Error(`Zernio analytics ${res.status}: ${await res.text()}`);
    return await res.json();
  } catch (err: any) {
    console.error('Failed to fetch Zernio analytics:', err.message);
    return null;
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
