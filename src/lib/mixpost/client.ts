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
  /** False once a connection has lapsed. Such an account is still listed but
   *  will not publish, which reads as silence unless it is surfaced. */
  authorized?: boolean
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
  /** Mixpost tag ids to attach to this post. Lets Justin filter the
   *  Mixpost library by brand / hashtag-group taxonomy that NRS
   *  already owns. Populated by ensureBrandTagInMixpost and
   *  ensureHashtagGroupTagInMixpost from sync-tags.ts. */
  tags?: number[]
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
      cache: 'no-store', // no cache — tools need fresh data
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
/** How long to wait for Mixpost to fetch a large remote file, and how often to ask. */
const REMOTE_UPLOAD_POLL_MS = 3_000
const REMOTE_UPLOAD_MAX_POLLS = 60 // 3 minutes — a 240MB fetch takes well under this

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
    // Large files come back as `pending` with a download id, and Mixpost fetches
    // them in the background. This used to log a warning and give up, so every
    // video big enough to matter — a three-minute phone clip is ~240MB — reached
    // Mixpost with no media attached and the draft was useless. The polling
    // helper to finish the job was already sitting in this same file, unused.
    if (data.status === 'pending' && data.download_id) {
      const downloadId = String(data.download_id)
      for (let attempt = 0; attempt < REMOTE_UPLOAD_MAX_POLLS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, REMOTE_UPLOAD_POLL_MS))
        const poll = await pollRemoteUploadStatus(downloadId)

        if (poll.status === 'completed' && poll.media?.id) {
          return { id: poll.media.id }
        }
        if (poll.status === 'failed' || poll.status === 'error') {
          console.error('[mixpost] remote upload failed for', mediaUrl, '— status:', poll.status)
          return null
        }
      }
      console.error(
        `[mixpost] remote upload still pending after ${(REMOTE_UPLOAD_MAX_POLLS * REMOTE_UPLOAD_POLL_MS) / 1000}s —`,
        'the file may be too large for Mixpost to fetch:', mediaUrl,
      )
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
        // Only include tags when supplied — Mixpost rejects `tags: []`
        // on some versions with a 422. Omitting the key is the safe default.
        ...(params.tags && params.tags.length > 0 ? { tags: params.tags } : {}),
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

// ─── Posts ───────────────────────────────────────────────────────────────────────

export interface MixpostPost {
  id: number
  uuid: string
  /**
   * Mixpost returns a WORD here — 'draft', 'scheduled', 'publishing',
   * 'published', 'failed' — not the number this was declared as for a long
   * time. Comparing it to 0 silently matched nothing, which is how a routine
   * that swaps the video in every draft found no drafts at all and reported
   * "nothing to do" against three of them.
   */
  status: string
  accounts: Array<{ id: number; provider: string; name: string }>
  versions: MixpostVersion[]
  tags: Array<{ id: number; name: string; hex_color: string }>
  scheduled_at: string | null
  published_at: string | null
  created_at: string
}

/**
 * Fetch posts from Mixpost with optional filters.
 */
export async function fetchMixpostPosts(params?: {
  status?: string
  date_from?: string
  date_to?: string
  tag_id?: number
  page?: number
}): Promise<MixpostPost[] | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.date_from) query.set('date_from', params.date_from)
  if (params?.date_to) query.set('date_to', params.date_to)
  if (params?.tag_id) query.set('tag_id', String(params.tag_id))
  if (params?.page) query.set('page', String(params.page))

  const qs = query.toString()
  const path = workspace
    ? `${base}/api/${workspace}/posts${qs ? `?${qs}` : ''}`
    : `${base}/api/posts${qs ? `?${qs}` : ''}`

  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Fetch posts error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    const posts: MixpostPost[] = Array.isArray(data) ? data : (data.data ?? [])
    return posts
  } catch (err) {
    console.error('[mixpost] Fetch posts failed:', err)
    return null
  }
}

/**
 * Fetch a single post by UUID.
 */
export async function fetchMixpostPost(postUuid: string): Promise<MixpostPost | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const path = workspace
    ? `${base}/api/${workspace}/posts/${postUuid}`
    : `${base}/api/posts/${postUuid}`

  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Fetch post error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    return data.data ?? data
  } catch (err) {
    console.error('[mixpost] Fetch post failed:', err)
    return null
  }
}

/**
 * Update an existing Mixpost post.
 */
export async function updateMixpostPost(
  postUuid: string,
  params: Partial<CreatePostParams>
): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return false

  const path = workspace
    ? `${base}/api/${workspace}/posts/${postUuid}`
    : `${base}/api/posts/${postUuid}`

  try {
    const res = await fetch(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      console.error('[mixpost] Update post error:', res.status, await res.text().catch(() => ''))
      return false
    }

    return true
  } catch (err) {
    console.error('[mixpost] Update post failed:', err)
    return false
  }
}

/**
 * Delete a single Mixpost post.
 */
export async function deleteMixpostPost(postUuid: string): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return false

  const path = workspace
    ? `${base}/api/${workspace}/posts/${postUuid}`
    : `${base}/api/posts/${postUuid}`

  try {
    const res = await fetch(path, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Delete post error:', res.status, await res.text().catch(() => ''))
      return false
    }

    return true
  } catch (err) {
    console.error('[mixpost] Delete post failed:', err)
    return false
  }
}

/**
 * Bulk delete Mixpost posts by UUID.
 */
export async function deleteMixpostPostsBulk(postUuids: string[]): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return false

  const path = workspace
    ? `${base}/api/${workspace}/posts`
    : `${base}/api/posts`

  try {
    const res = await fetch(path, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ posts: postUuids }),
    })

    if (!res.ok) {
      console.error('[mixpost] Bulk delete posts error:', res.status, await res.text().catch(() => ''))
      return false
    }

    return true
  } catch (err) {
    console.error('[mixpost] Bulk delete posts failed:', err)
    return false
  }
}

/**
 * Add a draft post to the publishing queue.
 */
export async function addMixpostPostToQueue(postUuid: string): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return false

  const path = workspace
    ? `${base}/api/${workspace}/posts/add-to-queue/${postUuid}`
    : `${base}/api/posts/add-to-queue/${postUuid}`

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Add to queue error:', res.status, await res.text().catch(() => ''))
      return false
    }

    return true
  } catch (err) {
    console.error('[mixpost] Add to queue failed:', err)
    return false
  }
}

/**
 * Approve a post for publishing.
 */
export async function approveMixpostPost(postUuid: string): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return false

  const path = workspace
    ? `${base}/api/${workspace}/posts/approve/${postUuid}`
    : `${base}/api/posts/approve/${postUuid}`

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Approve post error:', res.status, await res.text().catch(() => ''))
      return false
    }

    return true
  } catch (err) {
    console.error('[mixpost] Approve post failed:', err)
    return false
  }
}

// ─── Tags ────────────────────────────────────────────────────────────────────────

export interface MixpostTag {
  id: number
  uuid: string
  name: string
  hex_color: string
}

/**
 * Fetch all tags from Mixpost.
 */
export async function fetchMixpostTags(): Promise<MixpostTag[] | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const path = workspace
    ? `${base}/api/${workspace}/tags`
    : `${base}/api/tags`

  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Fetch tags error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    const tags: MixpostTag[] = Array.isArray(data) ? data : (data.data ?? [])
    return tags
  } catch (err) {
    console.error('[mixpost] Fetch tags failed:', err)
    return null
  }
}

/**
 * Create a new tag in Mixpost.
 */
export async function createMixpostTag(
  name: string,
  hexColor: string
): Promise<MixpostTag | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const path = workspace
    ? `${base}/api/${workspace}/tags`
    : `${base}/api/tags`

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, hex_color: hexColor }),
    })

    if (!res.ok) {
      console.error('[mixpost] Create tag error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    return data.data ?? data
  } catch (err) {
    console.error('[mixpost] Create tag failed:', err)
    return null
  }
}

// ─── Media ───────────────────────────────────────────────────────────────────────

export interface MixpostMediaItem {
  id: number
  uuid: string
  name: string
  mime_type: string
  type: string
  url: string
  thumb_url: string | null
  is_video: boolean
  created_at: string
}

/**
 * Fetch media items from Mixpost.
 */
export async function fetchMixpostMedia(page?: number): Promise<MixpostMediaItem[] | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const qs = page ? `?page=${page}` : ''
  const path = workspace
    ? `${base}/api/${workspace}/media${qs}`
    : `${base}/api/media${qs}`

  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Fetch media error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    const items: MixpostMediaItem[] = Array.isArray(data) ? data : (data.data ?? [])
    return items
  } catch (err) {
    console.error('[mixpost] Fetch media failed:', err)
    return null
  }
}

/**
 * Update media item metadata (name, alt text).
 */
export async function updateMixpostMedia(
  mediaUuid: string,
  params: { name?: string; alt_text?: string }
): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return false

  const path = workspace
    ? `${base}/api/${workspace}/media/${mediaUuid}`
    : `${base}/api/media/${mediaUuid}`

  try {
    const res = await fetch(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      console.error('[mixpost] Update media error:', res.status, await res.text().catch(() => ''))
      return false
    }

    return true
  } catch (err) {
    console.error('[mixpost] Update media failed:', err)
    return false
  }
}

/**
 * Bulk delete media items by UUID.
 */
export async function deleteMixpostMedia(mediaUuids: string[]): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return false

  const path = workspace
    ? `${base}/api/${workspace}/media`
    : `${base}/api/media`

  try {
    const res = await fetch(path, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ media: mediaUuids }),
    })

    if (!res.ok) {
      console.error('[mixpost] Delete media error:', res.status, await res.text().catch(() => ''))
      return false
    }

    return true
  } catch (err) {
    console.error('[mixpost] Delete media failed:', err)
    return false
  }
}

/**
 * Poll the status of a remote media upload.
 */
export async function pollRemoteUploadStatus(
  downloadId: string
): Promise<{ status: string; media?: MixpostMediaItem }> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return { status: 'error' }

  const path = workspace
    ? `${base}/api/${workspace}/media/remote/${downloadId}/status`
    : `${base}/api/media/remote/${downloadId}/status`

  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Poll upload status error:', res.status, await res.text().catch(() => ''))
      return { status: 'error' }
    }

    const data = await res.json()
    return {
      status: data.status ?? 'unknown',
      media: data.media ?? undefined,
    }
  } catch (err) {
    console.error('[mixpost] Poll upload status failed:', err)
    return { status: 'error' }
  }
}

// ─── Templates (web route) ──────────────────────────────────────────────────────

export interface MixpostTemplate {
  id: number
  uuid: string
  name: string
  content: Array<{ body: string; media: number[] }>
}

/**
 * Fetch post templates from Mixpost.
 * Note: This uses the web route, not the /api/ prefix.
 */
export async function fetchMixpostTemplates(): Promise<MixpostTemplate[] | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const path = workspace
    ? `${base}/${workspace}/templates/api`
    : `${base}/templates/api`

  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      console.error('[mixpost] Fetch templates error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    const templates: MixpostTemplate[] = Array.isArray(data) ? data : (data.data ?? [])
    return templates
  } catch (err) {
    console.error('[mixpost] Fetch templates failed:', err)
    return null
  }
}

/**
 * Create a new post template in Mixpost.
 * Note: This uses the web route, not the /api/ prefix.
 */
export async function createMixpostTemplate(
  name: string,
  content: Array<{ body: string; media: number[] }>
): Promise<MixpostTemplate | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const path = workspace
    ? `${base}/${workspace}/templates/api`
    : `${base}/templates/api`

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, content }),
    })

    if (!res.ok) {
      console.error('[mixpost] Create template error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    return data.data ?? data
  } catch (err) {
    console.error('[mixpost] Create template failed:', err)
    return null
  }
}

// ─── Reports (web route) ────────────────────────────────────────────────────────

export interface MixpostReport {
  audience?: Record<string, unknown>
  metrics?: Record<string, number>
}

/**
 * Fetch analytics reports from Mixpost for a specific account.
 * Note: This uses the web route. Returns null gracefully if auth fails.
 */
export async function fetchMixpostReports(
  accountId: number,
  period: string
): Promise<MixpostReport | null> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN
  const workspace = process.env.MIXPOST_WORKSPACE_UUID

  if (!base || !token) return null

  const query = new URLSearchParams({
    account_id: String(accountId),
    period,
  })

  const path = workspace
    ? `${base}/${workspace}/reports?${query}`
    : `${base}/reports?${query}`

  try {
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      // Reports may not be available — return null gracefully
      if (res.status === 401 || res.status === 403) {
        console.warn('[mixpost] Reports auth not supported for web route')
        return null
      }
      console.error('[mixpost] Fetch reports error:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    return data.data ?? data
  } catch (err) {
    console.error('[mixpost] Fetch reports failed:', err)
    return null
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────────

/**
 * Ping Mixpost to check if the instance is reachable.
 * Uses the non-workspace-scoped /api/ping endpoint.
 */
export async function pingMixpost(): Promise<boolean> {
  const base = process.env.MIXPOST_API_URL
  const token = process.env.MIXPOST_API_TOKEN

  if (!base || !token) return false

  try {
    const res = await fetch(`${base}/api/ping`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) return false

    const data = await res.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}
