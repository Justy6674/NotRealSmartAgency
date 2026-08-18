import { useCallback, useEffect, useState } from 'react'
import type { MixpostAccount } from '@/lib/mixpost/client'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'

/**
 * Shared hook for reading the brand's connected social accounts.
 *
 * A brand with a publisher profile (Scent Sell, EndorseMe) is loaded only
 * from `/api/zernio/accounts`, which is already session-scoped. The self-hosted
 * workspace list is the fallback for every other brand, already mapped to
 * that brand. The two must never be merged: the fallback ignores brandId and
 * would dump every connected page onto a linked brand.
 *
 * ── THE FAULT THIS CLOSES ──────────────────────────────────────────────
 * Both branches used to stamp `status: 'active'` on every account they
 * returned. Not "assume active when unknown" — a literal, in two places, with
 * nothing behind it. The green tick on the accounts grid was decoration.
 *
 * Measured live on 2026-08-18: ten accounts, eight healthy, **two in warning**,
 * and the desk said everything was fine. The first the owner would have learned
 * about an expiring connection was a publish failing — the one moment he can no
 * longer do anything about it, and for a brand advertising a regulated health
 * service, a silence nobody is watching.
 *
 * So health is now read, never assumed, and an account with no health reading
 * comes back `'unknown'` rather than being flattered into `'connected'`.
 * Absent is not the same as fine; the grid renders them differently on purpose.
 */

export type AccountHealth = 'connected' | 'attention' | 'reconnect' | 'unknown'

export interface SocialAccount {
  id: string
  name: string
  platform: string
  username?: string
  image?: string
  /** Where this account lives on its own platform, for "View profile". */
  profileUrl?: string
  /**
   * Measured, never assumed.
   *  · connected — the connection answered and can post
   *  · attention — it answered, and something is wrong or about to be
   *  · reconnect — it will not post until the owner signs in again
   *  · unknown   — nothing came back. Not the same as fine.
   */
  health: AccountHealth
  /**
   * The older four-word vocabulary, kept because the Connections index reads it
   * and it is not this slice's file. It is now DERIVED from `health` rather
   * than being the literal `'active'` that made every account look well — see
   * `statusOf`. New code should read `health`.
   */
  status: 'active' | 'expired' | 'revoked' | 'unknown'
  /** Plain-language reasons behind `attention` / `reconnect`, if any were given. */
  issues: string[]
  /** ISO date the connection lapses, when the publisher states one. */
  expiresAt?: string
  /** false = the owner never switched it on, so posting and scheduling skip it. */
  enabled: boolean
  connectedAt?: string
  followers?: number
  external_id?: string
}

interface UseSocialAccountsResult {
  accounts: SocialAccount[]
  /** Counts recomputed from the rows above, so the banner can never disagree. */
  summary: { total: number; needsAttention: number; needsReconnect: number; unmeasured: number }
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface DeskAccountRow {
  id?: string
  platform?: string
  displayName?: string
  username?: string
  image?: string
  profileUrl?: string
  connectedAt?: string
  followers?: number
  enabled?: boolean
  health?: 'healthy' | 'warning' | 'error' | 'unknown'
  needsReconnect?: boolean
  canPost?: boolean
  tokenExpiresAt?: string
  issues?: string[]
}

/** One health word out of the several signals the publisher reports. */
function healthOf(row: DeskAccountRow): AccountHealth {
  if (row.needsReconnect) return 'reconnect'
  if (row.health === 'error') return 'reconnect'
  if (row.health === 'warning') return 'attention'
  if (row.health === 'healthy') return row.canPost === false ? 'attention' : 'connected'
  return 'unknown'
}

/**
 * The legacy word for a measured health. `'active'` is now something that has
 * to be earned by a connection that answered and can post, rather than the
 * constant it used to be.
 */
function statusOf(health: AccountHealth): SocialAccount['status'] {
  if (health === 'connected') return 'active'
  if (health === 'reconnect') return 'expired'
  if (health === 'attention') return 'expired'
  return 'unknown'
}

function fromDesk(row: DeskAccountRow): SocialAccount {
  const id = String(row.id ?? '')
  const health = healthOf(row)
  return {
    id,
    name: row.displayName || row.username || row.platform || 'Account',
    platform: canonicalSocialPlatform(row.platform || 'unknown'),
    ...(row.username ? { username: row.username } : {}),
    ...(row.image ? { image: row.image } : {}),
    ...(row.profileUrl ? { profileUrl: row.profileUrl } : {}),
    health,
    status: statusOf(health),
    issues: Array.isArray(row.issues) ? row.issues : [],
    ...(row.tokenExpiresAt ? { expiresAt: row.tokenExpiresAt } : {}),
    enabled: row.enabled !== false,
    ...(row.connectedAt ? { connectedAt: row.connectedAt } : {}),
    ...(typeof row.followers === 'number' ? { followers: row.followers } : {}),
    external_id: id,
  }
}

interface BrandMappingRow {
  platform?: string
  accountName?: string
  provider?: string
  authorized?: boolean
}

/**
 * The self-hosted fallback reports one health signal and one only: whether the
 * connection has lapsed. Where it says nothing, the answer is `'unknown'` —
 * writing `'connected'` there is exactly the fiction this rewrite removes.
 */
function fromFallback(raw: MixpostAccount, mapping: BrandMappingRow[]): SocialAccount {
  const match = mapping.find(
    (m) => m.accountName === raw.name && (!m.provider || m.provider === raw.provider),
  )
  const authorized = raw.authorized ?? match?.authorized
  const health: AccountHealth =
    authorized === false ? 'reconnect' : authorized === true ? 'connected' : 'unknown'
  return {
    id: String(raw.id),
    name: raw.name ?? 'Unknown',
    platform: canonicalSocialPlatform(raw.provider ?? 'unknown'),
    ...(raw.username ? { username: raw.username } : {}),
    ...(raw.media_url ? { image: raw.media_url } : {}),
    health,
    status: statusOf(health),
    issues: authorized === false ? ['This connection has lapsed and will not post.'] : [],
    enabled: true,
    external_id: String(raw.id),
  }
}

export function useSocialAccounts(brandId: string | null): UseSocialAccountsResult {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!brandId) {
      setAccounts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const zernioRes = await fetch(`/api/zernio/accounts?brandId=${brandId}`)
      const zData = (await zernioRes.json().catch(() => null)) as {
        linked?: boolean
        accounts?: DeskAccountRow[]
        error?: string
      } | null

      if (!zernioRes.ok) {
        // The route writes its own owner-facing sentence. Replacing it with
        // "HTTP 403" is how a permissions problem used to reach the screen as
        // a number nobody could act on.
        throw new Error(
          zData?.error ?? 'The connected accounts could not be read just now. Nothing has been changed.',
        )
      }

      if (zData?.linked) {
        setAccounts((zData.accounts ?? []).map(fromDesk).filter((a) => a.id !== ''))
        return
      }

      const res = await fetch(`/api/mixpost/accounts?brandId=${brandId}`)
      if (!res.ok) {
        throw new Error('The connected accounts could not be read just now. Nothing has been changed.')
      }
      const body = (await res.json()) as {
        accounts?: MixpostAccount[]
        brandMapping?: Record<string, BrandMappingRow[]>
      }
      const raw: MixpostAccount[] = Array.isArray(body) ? body : (body.accounts ?? [])
      const mapping = body.brandMapping?.[brandId] ?? []
      setAccounts(raw.map((a) => fromFallback(a, mapping)))
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'The connected accounts could not be read just now. Nothing has been changed.',
      )
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { refetch() }, [refetch])

  const summary = {
    total: accounts.length,
    needsAttention: accounts.filter((a) => a.health === 'attention').length,
    needsReconnect: accounts.filter((a) => a.health === 'reconnect').length,
    unmeasured: accounts.filter((a) => a.health === 'unknown').length,
  }

  return { accounts, summary, loading, error, refetch }
}
