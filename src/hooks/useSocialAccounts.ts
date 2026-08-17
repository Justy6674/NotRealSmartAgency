import { useCallback, useEffect, useState } from 'react'
import type { MixpostAccount } from '@/lib/mixpost/client'

/**
 * Shared hook for reading the brand's connected social accounts.
 *
 * A brand with a publisher profile (Scent Sell, EndorseMe) is loaded only
 * from `/api/zernio/accounts`, which is already session-scoped. Mixpost's
 * workspace list is the fallback for every other brand, already mapped to
 * that brand. The two must never be merged: Mixpost ignores brandId and
 * would dump every connected page onto a linked brand.
 */

export interface SocialAccount {
  id: string
  name: string
  platform: string
  username?: string
  image?: string
  status: 'active' | 'expired' | 'revoked' | 'unknown'
  last_refreshed_at?: string
  external_id?: string
}

interface UseSocialAccountsResult {
  accounts: SocialAccount[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function normaliseMixpostAccount(raw: MixpostAccount): SocialAccount {
  const platform = (raw.provider ?? 'unknown').replace(/_(page|group)$/, '')
  return {
    id: String(raw.id),
    name: raw.name ?? 'Unknown',
    platform,
    username: raw.username ?? undefined,
    image: raw.media_url ?? undefined,
    status: 'active',
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
      if (!zernioRes.ok) throw new Error(`HTTP ${zernioRes.status}`)
      const zData = await zernioRes.json() as {
        linked?: boolean
        accounts?: Array<{
          id?: string
          displayName?: string
          username?: string
          platform?: string
        }>
      }

      if (zData.linked) {
        setAccounts((zData.accounts ?? []).map((za) => ({
          id: String(za.id ?? ''),
          name: za.displayName || za.username || za.platform || 'Account',
          platform: za.platform || 'unknown',
          username: za.username,
          status: 'active' as const,
          external_id: String(za.id ?? ''),
        })))
        return
      }

      const res = await fetch(`/api/mixpost/accounts?brandId=${brandId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json() as { accounts?: MixpostAccount[] }
      const raw: MixpostAccount[] = Array.isArray(body) ? body : (body.accounts ?? [])
      setAccounts(raw.map(normaliseMixpostAccount))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fetch failed')
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { refetch() }, [refetch])

  return { accounts, loading, error, refetch }
}
