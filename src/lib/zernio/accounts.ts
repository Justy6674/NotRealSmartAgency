/**
 * Connected accounts, and whether they can actually post.
 *
 * Depended on by: the accounts grid and reconnect prompts (S5), the composer's
 * per-account avatar strip and TikTok pre-flight (S3), and the department
 * chrome's business subtitle (S2).
 *
 * ── The fault this closes ──────────────────────────────────────────────
 * `useSocialAccounts.ts` stamped `status: 'active'` on every account in BOTH
 * branches. The health dot was a constant. Measured live on 2026-08-18: ten
 * accounts, eight healthy, **two in warning** — and the desk said everything
 * was fine. An expiring token now shows as needing reconnection before it fails
 * a publish, which is the only moment the owner can do anything about it.
 *
 * ── Isolation ──────────────────────────────────────────────────────────
 * `getAllAccountsHealth()` takes no filter: it answers for the whole TEAM. Every
 * function here narrows to the accounts `fetchZernioAccounts(profileId)` has
 * already scoped, in our code. A Zernio profile is an organisational boundary,
 * never a security one — see `account-scoping.test.ts`, which no slice may
 * weaken.
 */

import { fetchZernioAccounts, getZernioClient, type ZernioAccount } from './client'
import { unwrapZernio } from './errors'
import type { ZernioAccountHealth, ZernioAccountsHealth } from './types'

export type { ZernioAccount }

/**
 * Accounts for one brand.
 *
 * `page` and `limit` must travel together or the API answers 400, so they are
 * one optional pair here rather than two independent numbers a caller can half
 * fill in.
 */
export async function listZernioAccounts(params: {
  profileId?: string
  status?: 'connected' | 'disconnected'
  platform?: string
  page?: { page: number; limit: number }
}): Promise<ZernioAccount[]> {
  // The unfiltered listing and our own profile filter both live in client.ts,
  // because that pair is what account-scoping.test.ts pins. Extra filters are
  // applied on top of its result rather than around it.
  const scoped = await fetchZernioAccounts(params.profileId)
  if (!params.status && !params.platform) return scoped

  // Status is not on the normalised account, so it is read from a health
  // lookup rather than assumed — assuming it is the exact fault above.
  let out = scoped
  if (params.platform) {
    out = out.filter((account) => account.platform === params.platform)
  }
  if (params.status) {
    const health = await fetchZernioAccountsHealth(params.profileId)
    const byId = new Map(health.accounts.map((entry) => [entry.accountId, entry]))
    out = out.filter((account) => {
      const entry = byId.get(account.id)
      if (!entry) return params.status === 'connected'
      return params.status === 'connected' ? !entry.needsReconnect : entry.needsReconnect
    })
  }
  return out
}

function healthOf(raw: unknown): ZernioAccountHealth | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const accountId = typeof rec.accountId === 'string' ? rec.accountId : ''
  if (!accountId) return null
  const status = rec.status === 'warning' || rec.status === 'error' ? rec.status : 'healthy'
  return {
    accountId,
    platform: typeof rec.platform === 'string' ? rec.platform : '',
    ...(typeof rec.username === 'string' ? { username: rec.username } : {}),
    ...(typeof rec.displayName === 'string' ? { displayName: rec.displayName } : {}),
    ...(typeof rec.profileId === 'string' ? { profileId: rec.profileId } : {}),
    status,
    canPost: rec.canPost !== false,
    canFetchAnalytics: rec.canFetchAnalytics === true,
    tokenValid: rec.tokenValid !== false,
    ...(typeof rec.tokenExpiresAt === 'string' ? { tokenExpiresAt: rec.tokenExpiresAt } : {}),
    needsReconnect: rec.needsReconnect === true,
    issues: Array.isArray(rec.issues)
      ? rec.issues.filter((issue): issue is string => typeof issue === 'string')
      : [],
  }
}

const EMPTY_SUMMARY = { total: 0, healthy: 0, warning: 0, error: 0, needsReconnect: 0 }

/**
 * Health for one brand's accounts, with the summary recounted from them.
 *
 * The upstream summary counts the whole team. Handing a subscriber "ten
 * accounts, two need attention" when four of those are another customer's is
 * both wrong and a leak, so the counts are rebuilt from the scoped rows.
 */
export async function fetchZernioAccountsHealth(profileId?: string): Promise<ZernioAccountsHealth> {
  const zernio = getZernioClient('accounts.getAllAccountsHealth')
  const result = await zernio.accounts.getAllAccountsHealth()
  const data = unwrapZernio<Record<string, unknown>>('accounts.getAllAccountsHealth', result as never)

  const all = (Array.isArray(data.accounts) ? data.accounts : [])
    .map(healthOf)
    .filter((entry): entry is ZernioAccountHealth => entry !== null)

  let accounts = all
  if (profileId) {
    const own = await fetchZernioAccounts(profileId)
    const allowed = new Set(own.map((account) => account.id))
    accounts = all.filter((entry) => allowed.has(entry.accountId))
  }

  const summary = { ...EMPTY_SUMMARY, total: accounts.length }
  for (const entry of accounts) {
    if (entry.status === 'error') summary.error += 1
    else if (entry.status === 'warning') summary.warning += 1
    else summary.healthy += 1
    if (entry.needsReconnect) summary.needsReconnect += 1
  }

  return { summary, accounts }
}

/**
 * Health for one account, refused unless the brand owns it.
 *
 * The upstream call validates the id against the whole team, so without this
 * check a customer could read the token state of another customer's account by
 * guessing an id.
 */
export async function fetchZernioAccountHealth(params: {
  accountId: string
  profileId?: string
}): Promise<ZernioAccountHealth | null> {
  if (params.profileId) {
    const own = await fetchZernioAccounts(params.profileId)
    if (!own.some((account) => account.id === params.accountId)) return null
  }
  const zernio = getZernioClient('accounts.getAccountHealth')
  const result = await zernio.accounts.getAccountHealth({ path: { accountId: params.accountId } })
  const data = unwrapZernio<Record<string, unknown>>('accounts.getAccountHealth', result as never)
  return healthOf(data.account ?? data)
}

export interface ZernioTikTokCreatorInfo {
  nickname?: string
  privacyLevelOptions: string[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
  maxVideoPostDurationSec?: number
}

/**
 * What THIS TikTok account is allowed to do, before the options are shown.
 *
 * TikTok requires this pre-flight: the privacy levels a creator may choose, and
 * whether comments, duet and stitch are available at all, differ per account.
 * NRS showed every switch unconditionally, so an owner could set a privacy
 * level TikTok would reject and only find out at publish time.
 */
export async function fetchTikTokCreatorInfo(params: {
  accountId: string
  profileId?: string
  mediaType?: 'video' | 'photo'
}): Promise<ZernioTikTokCreatorInfo | null> {
  if (params.profileId) {
    const own = await fetchZernioAccounts(params.profileId)
    if (!own.some((account) => account.id === params.accountId)) return null
  }
  const zernio = getZernioClient('accounts.getTikTokCreatorInfo')
  const result = await zernio.accounts.getTikTokCreatorInfo({
    path: { accountId: params.accountId },
    ...(params.mediaType ? { query: { mediaType: params.mediaType } } : {}),
  })
  const data = unwrapZernio<Record<string, unknown>>('accounts.getTikTokCreatorInfo', result as never)
  const info = (data.creatorInfo ?? data.data ?? data) as Record<string, unknown>

  return {
    ...(typeof info.nickname === 'string' ? { nickname: info.nickname } : {}),
    privacyLevelOptions: Array.isArray(info.privacyLevelOptions)
      ? info.privacyLevelOptions.filter((v): v is string => typeof v === 'string')
      : [],
    // Absent means "not stated", and the safe reading of an unstated permission
    // on a live platform is that it is unavailable — never that it is allowed.
    commentDisabled: info.commentDisabled !== false,
    duetDisabled: info.duetDisabled !== false,
    stitchDisabled: info.stitchDisabled !== false,
    ...(typeof info.maxVideoPostDurationSec === 'number'
      ? { maxVideoPostDurationSec: info.maxVideoPostDurationSec }
      : {}),
  }
}

export interface ZernioFollowerPoint {
  date: string
  followers: number
}

/** Follower history per account, scoped to the brand. */
export async function fetchZernioFollowerStats(params: {
  profileId?: string
  fromDate?: string
  toDate?: string
  granularity?: 'daily' | 'weekly' | 'monthly'
}): Promise<Record<string, ZernioFollowerPoint[]>> {
  const zernio = getZernioClient('accounts.getFollowerStats')
  const allowed = params.profileId
    ? new Set((await fetchZernioAccounts(params.profileId)).map((a) => a.id))
    : null

  const result = await zernio.accounts.getFollowerStats({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.fromDate ? { fromDate: params.fromDate } : {}),
      ...(params.toDate ? { toDate: params.toDate } : {}),
      ...(params.granularity ? { granularity: params.granularity } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('accounts.getFollowerStats', result as never)
  const stats = (data.stats ?? {}) as Record<string, unknown>

  const out: Record<string, ZernioFollowerPoint[]> = {}
  for (const [accountId, series] of Object.entries(stats)) {
    if (allowed && !allowed.has(accountId)) continue
    if (!Array.isArray(series)) continue
    out[accountId] = series.flatMap((point) => {
      const rec = (point ?? {}) as Record<string, unknown>
      const date = typeof rec.date === 'string' ? rec.date : ''
      const followers = typeof rec.followers === 'number' ? rec.followers : null
      return date && followers !== null ? [{ date, followers }] : []
    })
  }
  return out
}
