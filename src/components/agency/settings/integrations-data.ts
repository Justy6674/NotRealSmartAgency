import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { getConfirmedAccountIds, mapMixpostAccountsToBrands, type BrandStub } from '@/lib/mixpost/brand-mapping'
import { createClient } from '@/lib/supabase/server'

/**
 * What is actually true about how each brand publishes.
 *
 * NRS routes a brand's posts through Zernio when that brand carries a Zernio
 * profile id, and through the self-hosted Mixpost otherwise. The decision is
 * made per post, per platform, in the publishing cron — so the only honest way
 * to answer "where does this go?" is to read the same field the cron reads
 * (`brands.social_urls.zernio_profile_id`) and then ask each publisher what it
 * currently holds.
 *
 * Everything here distinguishes "not connected" from "could not be checked".
 * They look the same on a screen and they are not the same thing: the first is
 * a fact, the second is an absence of one. Showing the second as green is the
 * failure this page exists to stop.
 */

export type HealthState = 'connected' | 'attention' | 'absent' | 'unknown'

export type Publisher = 'zernio' | 'mixpost' | 'none'

export interface PlatformHealth {
  key: string
  label: string
  handle: string | null
  state: HealthState
  /** Set whenever the state is not 'connected'. Names the problem and the fix. */
  problem: string | null
}

export interface BrandRoute {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  publisher: Publisher
  zernioProfileId: string | null
  platforms: PlatformHealth[]
  /** False when the publisher could not be reached, so the accounts below are last-known, not current. */
  known: boolean
}

export interface PublisherStatus {
  configured: boolean
  /** null when there was nothing to reach — i.e. it is not set up at all. */
  reachable: boolean | null
  /** Plain-English reason, shown to the owner when reachable is false. */
  problem: string | null
}

/** A Zernio profile holding live accounts that no brand in NRS points at. */
export interface UnclaimedProfile {
  profileId: string
  usernames: string[]
  platforms: string[]
}

export interface IntegrationsSnapshot {
  brands: BrandRoute[]
  zernio: PublisherStatus
  mixpost: PublisherStatus
  unclaimed: UnclaimedProfile[]
  checkedAt: number
}

const ZERNIO_BASE = 'https://zernio.com/api/v1'

/** Seven days. Past this the token is fine; inside it, it is worth saying so. */
const EXPIRY_WARNING_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Zernio lists ad accounts alongside posting accounts in the same response.
 * They cannot publish a post, so they do not belong on a publishing page.
 */
const ADS_ONLY = new Set(['metaads', 'tiktokads', 'xads', 'googleads', 'linkedinads', 'pinterestads'])

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  twitter: 'X',
  x: 'X',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  googlebusiness: 'Google Business',
  telegram: 'Telegram',
  snapchat: 'Snapchat',
  whatsapp: 'WhatsApp',
  bluesky: 'Bluesky',
  discord: 'Discord',
  slack: 'Slack',
}

export function platformLabel(key: string): string {
  return PLATFORM_LABELS[key.toLowerCase()] ?? key.replace(/_/g, ' ')
}

interface ZernioHealthAccount {
  accountId: string
  platform: string
  username?: string
  displayName?: string
  profileId: string
  status?: 'healthy' | 'warning' | 'error'
  canPost?: boolean
  tokenValid?: boolean
  tokenExpiresAt?: string | null
  needsReconnect?: boolean
  issues?: string[]
}

/** Timezone-free wording, because this renders on a server that is not in his timezone. */
function relativeWhen(target: number, now: number): string {
  const diff = target - now
  const abs = Math.abs(diff)
  const days = Math.round(abs / 86_400_000)
  const hours = Math.round(abs / 3_600_000)
  const minutes = Math.round(abs / 60_000)
  const amount =
    days >= 1
      ? `${days} day${days === 1 ? '' : 's'}`
      : hours >= 1
        ? `${hours} hour${hours === 1 ? '' : 's'}`
        : `${minutes} minute${minutes === 1 ? '' : 's'}`
  return diff >= 0 ? `in ${amount}` : `${amount} ago`
}

/**
 * Zernio's own per-account verdict, turned into something a person can act on.
 *
 * `status` is Zernio's answer and is trusted first. The one place this page
 * disagrees is an expiry timestamp that has already passed while the status
 * still reads healthy — that contradiction is reported rather than resolved,
 * because quietly picking the cheerful side of it is exactly how an account
 * shows green on the day it stops posting.
 */
function zernioPlatformHealth(account: ZernioHealthAccount, now: number): PlatformHealth {
  const label = platformLabel(account.platform)
  const handle = account.username ?? account.displayName ?? null
  const expiresAt = account.tokenExpiresAt ? Date.parse(account.tokenExpiresAt) : NaN
  const hasExpiry = Number.isFinite(expiresAt)
  const expired = hasExpiry && expiresAt <= now
  const expiringSoon = hasExpiry && !expired && expiresAt - now < EXPIRY_WARNING_MS

  const attention = (problem: string): PlatformHealth => ({
    key: account.platform,
    label,
    handle,
    state: 'attention',
    problem,
  })

  if (account.needsReconnect) {
    return attention(`${label} needs reconnecting. Until then, anything scheduled for it will not go out.`)
  }
  if (account.canPost === false) {
    return attention(`Zernio holds ${label} but cannot post to it. Reconnect ${label} to restore posting.`)
  }
  if (account.status === 'error') {
    const issue = account.issues?.[0]
    return attention(
      issue
        ? `${label} is failing: ${issue}. Reconnect ${label} to clear it.`
        : `${label} is failing and Zernio did not say why. Reconnect ${label} to clear it.`,
    )
  }
  if (expired) {
    return attention(
      `Zernio still reports ${label} as working, but its access expired ${relativeWhen(expiresAt, now)}. Reconnect ${label} rather than trust it.`,
    )
  }
  if (account.status === 'warning') {
    const issue = account.issues?.[0]
    return attention(
      issue
        ? `${label} is degraded: ${issue}. Reconnect ${label} if posts start failing.`
        : `${label} is degraded and Zernio did not say why. Reconnect ${label} if posts start failing.`,
    )
  }
  if (expiringSoon) {
    return attention(`${label} keeps posting for now — its access expires ${relativeWhen(expiresAt, now)}. Reconnect it before then.`)
  }

  return { key: account.platform, label, handle, state: 'connected', problem: null }
}

async function loadZernioHealth(): Promise<{
  status: PublisherStatus
  accounts: ZernioHealthAccount[]
}> {
  const key = process.env.ZERNIO_API_KEY
  if (!key) {
    return {
      status: {
        configured: false,
        reachable: null,
        problem: 'Zernio has no API key on this server, so no brand can publish through it.',
      },
      accounts: [],
    }
  }

  try {
    const res = await fetch(`${ZERNIO_BASE}/accounts/health`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })

    if (res.status === 401 || res.status === 403) {
      return {
        status: {
          configured: true,
          reachable: false,
          problem: 'Zernio rejected this server’s API key, so account health cannot be read. Replace ZERNIO_API_KEY to see it again.',
        },
        accounts: [],
      }
    }
    if (!res.ok) {
      return {
        status: {
          configured: true,
          reachable: false,
          problem: `Zernio answered ${res.status} when asked for account health. Nothing below is current.`,
        },
        accounts: [],
      }
    }

    const body = (await res.json()) as { accounts?: ZernioHealthAccount[] }
    const accounts = (body.accounts ?? []).filter((a) => !ADS_ONLY.has(String(a.platform).toLowerCase()))
    return { status: { configured: true, reachable: true, problem: null }, accounts }
  } catch {
    return {
      status: {
        configured: true,
        reachable: false,
        problem: 'Zernio could not be reached just now, so account health is unknown rather than fine.',
      },
      accounts: [],
    }
  }
}

/**
 * The one thing to know about Mixpost: it reports whether a connection has
 * lapsed, and nothing else. There is no token expiry and no per-capability
 * answer, so a Mixpost row can only ever say "working" or "lapsed" — and this
 * page says so out loud rather than implying the same depth as Zernio.
 */
export async function loadIntegrationsSnapshot(userId: string): Promise<IntegrationsSnapshot> {
  const now = Date.now()
  const supabase = await createClient()

  const { data: brandRows } = await supabase
    .from('brands')
    .select('id, name, slug, logo_url, social_urls')
    .eq('user_id', userId)
    .order('name')

  const brands = (brandRows ?? []) as Array<{
    id: string
    name: string
    slug: string
    logo_url: string | null
    social_urls: Record<string, string> | null
  }>

  const mixpostConfigured = Boolean(process.env.MIXPOST_API_URL && process.env.MIXPOST_API_TOKEN)

  const [zernio, mixpostAccounts] = await Promise.all([
    loadZernioHealth(),
    mixpostConfigured ? fetchMixpostAccounts() : Promise.resolve(null),
  ])

  // fetchMixpostAccounts collapses "not set up" and "request failed" into null,
  // so the env check above is what separates them.
  const mixpostStatus: PublisherStatus = !mixpostConfigured
    ? {
        configured: false,
        reachable: null,
        problem: 'Mixpost has no address or token on this server, so nothing can publish through it.',
      }
    : mixpostAccounts === null
      ? {
          configured: true,
          reachable: false,
          problem: 'Mixpost could not be reached just now, so its accounts are unknown rather than fine.',
        }
      : { configured: true, reachable: true, problem: null }

  const stubs: BrandStub[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    social_urls: b.social_urls ?? undefined,
  }))

  const mixpostByBrand = mixpostAccounts ? mapMixpostAccountsToBrands(mixpostAccounts, stubs) : {}

  const routes: BrandRoute[] = brands.map((brand) => {
    const zernioProfileId = brand.social_urls?.zernio_profile_id ?? null
    const stub = stubs.find((s) => s.id === brand.id)!
    const base = {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logo_url,
      zernioProfileId,
    }

    if (zernioProfileId) {
      if (zernio.status.reachable !== true) {
        return { ...base, publisher: 'zernio' as const, platforms: [], known: false }
      }
      const mine = zernio.accounts.filter((a) => a.profileId === zernioProfileId)
      return {
        ...base,
        publisher: 'zernio' as const,
        platforms: mine.map((a) => zernioPlatformHealth(a, now)),
        known: true,
      }
    }

    // No Zernio profile means the publishing cron never considers Zernio for
    // this brand, whatever exists upstream. Mixpost is the path by default.
    const mapped = mixpostByBrand[brand.id] ?? []
    const confirmedCount = getConfirmedAccountIds(stub).length

    if (mixpostStatus.reachable !== true) {
      // Confirmed ids are stored on the brand, so we still know it is *meant*
      // to publish through Mixpost even when Mixpost itself is not answering.
      return {
        ...base,
        publisher: confirmedCount > 0 ? ('mixpost' as const) : ('none' as const),
        platforms: [],
        known: false,
      }
    }

    if (mapped.length === 0) {
      return { ...base, publisher: 'none' as const, platforms: [], known: true }
    }

    return {
      ...base,
      publisher: 'mixpost' as const,
      platforms: mapped.map((m) => ({
        key: m.provider,
        label: m.platform,
        handle: m.accountName || null,
        state: m.authorized ? ('connected' as const) : ('attention' as const),
        problem: m.authorized
          ? null
          : `${m.platform} has lapsed in Mixpost. Reconnect it there, or posts to ${m.platform} will silently not go out.`,
      })),
      known: true,
    }
  })

  // Accounts sitting in Zernio under a profile no brand points at. They are
  // genuinely connected and genuinely unused — the shape of "connected" that
  // reads as working and publishes nothing.
  const claimed = new Set(routes.map((r) => r.zernioProfileId).filter(Boolean) as string[])
  const unclaimedMap = new Map<string, UnclaimedProfile>()
  for (const account of zernio.accounts) {
    if (claimed.has(account.profileId)) continue
    const entry = unclaimedMap.get(account.profileId) ?? {
      profileId: account.profileId,
      usernames: [],
      platforms: [],
    }
    if (account.username) entry.usernames.push(account.username)
    const label = platformLabel(account.platform)
    if (!entry.platforms.includes(label)) entry.platforms.push(label)
    unclaimedMap.set(account.profileId, entry)
  }

  return {
    brands: routes,
    zernio: zernio.status,
    mixpost: mixpostStatus,
    unclaimed: [...unclaimedMap.values()],
    checkedAt: now,
  }
}
