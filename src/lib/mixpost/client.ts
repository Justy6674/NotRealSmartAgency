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
export interface MixpostVersion {
  account_id: number
  is_original: boolean
  content: Array<{
    body: string
    media: number[]
    url: null
    video_thumbs: never[]
  }>
  options?: Record<string, unknown>
}

export interface CreatePostParams {
  accounts: number[]
  versions: MixpostVersion[]
  date?: string        // YYYY-MM-DD
  time?: string        // HH:mm
  timezone?: string    // IANA e.g. 'Australia/Brisbane'
  schedule?: boolean
  schedule_now?: boolean
}

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

/**
 * Upload media to Mixpost from a public URL (e.g. Supabase Storage).
 * Returns the Mixpost media ID (integer).
 */
export async function uploadMediaFromUrl(
  mediaUrl: string,
  altText?: string
): Promise<{ id: number } | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const path = workspace
    ? `${base}/api/${workspace}/media/remote/initiate`
    : `${base}/api/media/remote/initiate`

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: mediaUrl, alt_text: altText ?? '' }),
    })

    if (!res.ok) {
      console.error('[mixpost] Media upload error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    // Response: { status: 'completed', media: { id: 42, ... } } or { status: 'pending', download_id: '...' }
    if (data.status === 'completed' && data.media?.id) {
      return { id: data.media.id }
    }
    // For pending (large files), poll — but for now return null and log
    if (data.status === 'pending') {
      console.warn('[mixpost] Large file upload pending, download_id:', data.download_id)
      return null
    }
    // Some versions return media directly
    if (data.id) return { id: data.id }
    if (data.data?.id) return { id: data.data.id }
    return null
  } catch (err) {
    console.error('[mixpost] Media upload failed:', err)
    return null
  }
}

/**
 * Create a post in Mixpost with full version support.
 */
export async function createMixpostPost(
  params: CreatePostParams
): Promise<{ id: string; uuid: string } | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const path = workspace
    ? `${base}/api/${workspace}/posts`
    : `${base}/api/posts`

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        accounts: params.accounts,
        versions: params.versions,
        date: params.date,
        time: params.time,
        timezone: params.timezone ?? 'Australia/Brisbane',
        schedule: params.schedule ?? false,
        schedule_now: params.schedule_now ?? true,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[mixpost] Create post error:', res.status, errText)
      return null
    }

    const data = await res.json()
    return {
      id: String(data.data?.id ?? data.id ?? ''),
      uuid: data.data?.uuid ?? data.uuid ?? '',
    }
  } catch (err) {
    console.error('[mixpost] Create post failed:', err)
    return null
  }
}

/** Map a platform name to Mixpost provider names */
const PLATFORM_TO_PROVIDER: Record<string, string[]> = {
  instagram: ['instagram'],
  facebook: ['facebook_page', 'facebook_group'],
  linkedin: ['linkedin', 'linkedin_page'],
  twitter: ['x', 'twitter'],
  tiktok: ['tiktok'],
  youtube: ['youtube'],
}

/**
 * Find Mixpost account IDs matching a platform for a brand.
 */
export function resolveAccountIdsForPlatform(
  platform: string,
  brandAccounts: MixpostAccount[]
): number[] {
  const providers = PLATFORM_TO_PROVIDER[platform] ?? [platform]
  return brandAccounts
    .filter(a => providers.includes(a.provider))
    .map(a => a.id)
}
