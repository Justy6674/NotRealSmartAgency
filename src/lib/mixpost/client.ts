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
 */
export async function fetchMixpostAccounts(): Promise<MixpostAccount[] | null> {
  const url = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN

  if (!url || !token) return null

  try {
    const res = await fetch(`${url}/api/accounts`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      next: { revalidate: 300 }, // cache for 5 min in Next.js fetch cache
    })

    if (!res.ok) return null

    const data = await res.json()
    // Mixpost returns { data: [...] } or a raw array depending on version
    const accounts: MixpostAccount[] = Array.isArray(data) ? data : (data.data ?? [])
    return accounts
  } catch {
    return null
  }
}
