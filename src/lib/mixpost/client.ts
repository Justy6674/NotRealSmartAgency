/**
 * Lightweight Mixpost API client.
 * Fetches connected social accounts from the self-hosted Mixpost instance.
 */

export interface MixpostAccount {
  id: number
  name: string
  username: string | null
  provider: string          // facebook_page, instagram, linkedin, tiktok, youtube, x
  media_url: string | null  // avatar / profile image
}

/** Normalise Mixpost provider names to friendly platform names */
const PROVIDER_LABELS: Record<string, string> = {
  facebook_page: 'Facebook',
  facebook_group: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  linkedin_page: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  twitter: 'X',
  mastodon: 'Mastodon',
  pinterest: 'Pinterest',
  google: 'Google',
}

export function friendlyProvider(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider.replace(/_/g, ' ')
}

/**
 * Fetch all connected social accounts from Mixpost.
 * Returns null if Mixpost is not configured or the request fails.
 *
 * Mixpost Pro v6 API routes are workspace-scoped:
 *   GET {MIXPOST_API_URL}/api/{workspace_uuid}/accounts
 * The workspace UUID is configured via MIXPOST_WORKSPACE_UUID env var.
 */
export async function fetchMixpostAccounts(): Promise<MixpostAccount[] | null> {
  const url = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!url || !token) return null

  // Build API path — workspace-scoped if UUID is set (Mixpost Pro v6+)
  const accountsPath = workspace
    ? `${url}/api/${workspace}/accounts`
    : `${url}/api/accounts`

  try {
    const res = await fetch(accountsPath, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      next: { revalidate: 300 }, // cache for 5 min in Next.js fetch cache
    })

    if (!res.ok) {
      console.error('[mixpost] API error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    // Mixpost returns { data: [...] } or a raw array depending on version
    const accounts: MixpostAccount[] = Array.isArray(data) ? data : (data.data ?? [])
    return accounts
  } catch (err) {
    console.error('[mixpost] Fetch error:', err)
    return null
  }
}
