import { useCallback, useEffect, useState } from 'react'
import type { MixpostAccount } from '@/lib/mixpost/client'

/**
 * Shared hook for reading + managing social accounts inside NRS Studio.
 *
 * Phase 9 of the Mixpost UI port — this is the native replacement for
 * the "go to Mixpost admin to see your accounts" dependency. During
 * Phases 1-9 the source is Mixpost (via /api/mixpost/accounts).
 * After Phase 10 lands direct platform OAuth, the same hook will
 * switch to reading from social_oauth_tokens without the UI changing.
 *
 * The returned shape is intentionally framework-agnostic so both
 * Mixpost-backed and native-backed implementations can satisfy it.
 */

export interface SocialAccount {
  id: string          // Mixpost account id (stringified) or social_oauth_tokens.id
  name: string        // Display name (page name, handle, etc.)
  platform: string    // 'facebook' | 'instagram' | 'linkedin' | ...
  username?: string
  image?: string
  status: 'active' | 'expired' | 'revoked' | 'unknown'
  /** Last known refresh timestamp, if the provider exposes it */
  last_refreshed_at?: string
  /** Platform-native id used by publishers */
  external_id?: string
}

interface UseSocialAccountsResult {
  accounts: SocialAccount[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function normaliseMixpostAccount(raw: MixpostAccount): SocialAccount {
  // Mixpost's MixpostAccount shape has: id, name, username, provider,
  // media_url. Coerce to the NRS-native SocialAccount shape so the UI
  // doesn't need to know which backend it's talking to. Provider names
  // like 'facebook_page' / 'linkedin_page' collapse to canonical
  // platform keys so the ui-tokens lookup works.
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

/**
 * useSocialAccounts — fetch + normalise the brand's connected social
 * accounts. Read-only for now. Disconnect + entity management go
 * through separate hooks layered on top.
 */
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
      const res = await fetch(`/api/mixpost/accounts?brandId=${brandId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      // API returns { configured, accounts, brandMapping } — extract the array
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
