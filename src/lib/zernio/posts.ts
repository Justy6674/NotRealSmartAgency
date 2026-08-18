/**
 * The post lifecycle: list, read, update, retry, take down, edit, re-title.
 *
 * Depended on by: the Social posts list, calendar and row actions (S4), the
 * composer's autosave and reschedule (S3), and the analytics timeline (S6).
 * Nothing outside this file may build a `/v1/posts` URL or call
 * `zernio.posts.*` directly — the two traps below are why.
 *
 * ── Trap one: `listPosts` hides your history by default ────────────────
 * The API defaults to `source: 'zernio'`, which returns only posts authored
 * through the publisher. On the live account that is ZERO rows, while analytics
 * reports 210 published posts; the other 210 are `source: 'external'`. A Posts
 * page built on the default shows a brand with 210 published posts an empty
 * screen and no error. So `listZernioPosts` REFUSES a call that does not name a
 * source. Guessing on the caller's behalf is what produced the empty screen.
 *
 * ── Trap two: `getPost` 404s on external ids ───────────────────────────
 * `posts.getPost` resolves Zernio-authored posts only. The cross-resolver that
 * accepts BOTH id kinds is `analytics.getAnalytics({ query: { postId } })`, so
 * `getZernioPost` falls through to it rather than reporting a post that plainly
 * exists as missing.
 *
 * ── Publishing, and what is not here ───────────────────────────────────
 * There is no create here. A post is born in `src/lib/posts/create-draft.ts`
 * and reaches a live account only through
 * `src/lib/publishers/dispatcher.ts publishToPlatform()`, which runs
 * `publish-gate.ts` first. `editZernioPost` changes words that are ALREADY
 * public, so it takes a `ZernioOutboundApproval` — the same review, made
 * impossible to forget.
 */

import { fetchZernioAccounts, getZernioClient } from './client'
import { unwrapZernio, ZernioError } from './errors'
import {
  isZernioEditablePlatform,
  isZernioUnpublishPlatform,
  zernioIdOf,
  type ZernioEditablePlatform,
  type ZernioMediaItem,
  type ZernioOutboundApproval,
  type ZernioPagination,
  type ZernioPlatformTarget,
  type ZernioPostSort,
  type ZernioPostSource,
  type ZernioPostStatus,
  type ZernioPostStatusFilter,
  type ZernioUnpublishPlatform,
} from './types'

/** One target as it comes back on a listed post. */
export interface ZernioPostPlatform {
  platform: string
  accountId: string
  status?: string
  publishedAt?: string
  platformPostUrl?: string
  /** Set when the post was removed from the platform after publishing. */
  removedFromPlatformAt?: string
  customContent?: string
}

export interface ZernioPostRecord {
  id: string
  status: ZernioPostStatus | null
  content: string
  platforms: ZernioPostPlatform[]
  accountIds: string[]
  scheduledFor?: string
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
  isExternal: boolean
  thumbnailUrl?: string
  mediaItems: ZernioMediaItem[]
  tags: string[]
  /** Free-text bag we stamp `nrsScheduledPostId` into on create. */
  metadata: Record<string, unknown>
}

export interface ZernioPostPage {
  posts: ZernioPostRecord[]
  pagination: ZernioPagination
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const STATUSES = new Set<string>([
  'draft', 'scheduled', 'publishing', 'published', 'failed', 'partial',
])

function statusOf(raw: unknown): ZernioPostStatus | null {
  const value = str(raw)?.toLowerCase()
  return value && STATUSES.has(value) ? (value as ZernioPostStatus) : null
}

function mediaItemsOf(raw: unknown): ZernioMediaItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const url = str(rec.url)
    if (!url) return []
    const type = str(rec.type)
    return [{
      url,
      ...(type === 'image' || type === 'video' || type === 'gif' || type === 'document'
        ? { type }
        : {}),
      ...(str(rec.altText) ? { altText: str(rec.altText)! } : {}),
      ...(str(rec.thumbnail) ? { thumbnail: str(rec.thumbnail)! } : {}),
      ...(str(rec.instagramThumbnail) ? { instagramThumbnail: str(rec.instagramThumbnail)! } : {}),
      ...(str(rec.filename) ? { filename: str(rec.filename)! } : {}),
      ...(str(rec.mimeType) ? { mimeType: str(rec.mimeType)! } : {}),
    }]
  })
}

function platformsOf(raw: unknown): ZernioPostPlatform[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const platform = str(rec.platform)
    if (!platform) return []
    // accountId is sometimes a populated {_id, platform, …} object rather than
    // a string, per endpoint and per field. zernioIdOf accepts both; picking
    // one is how the publish cron matched nothing at all for weeks.
    const accountId = zernioIdOf(rec.accountId)
    return [{
      platform,
      accountId,
      ...(str(rec.status) ? { status: str(rec.status)! } : {}),
      ...(str(rec.publishedAt) ? { publishedAt: str(rec.publishedAt)! } : {}),
      ...(str(rec.platformPostUrl) ? { platformPostUrl: str(rec.platformPostUrl)! } : {}),
      ...(str(rec.removedFromPlatformAt)
        ? { removedFromPlatformAt: str(rec.removedFromPlatformAt)! }
        : {}),
      ...(str(rec.customContent) ? { customContent: str(rec.customContent)! } : {}),
    }]
  })
}

/** One raw Zernio post → the shape the desk reads. Accepts `_id` and `id`. */
export function normaliseZernioPost(raw: unknown): ZernioPostRecord | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = zernioIdOf(rec)
  if (!id) return null
  const platforms = platformsOf(rec.platforms)
  return {
    id,
    status: statusOf(rec.status),
    content: typeof rec.content === 'string' ? rec.content : '',
    platforms,
    accountIds: platforms.map((p) => p.accountId).filter(Boolean),
    ...(str(rec.scheduledFor) ? { scheduledFor: str(rec.scheduledFor)! } : {}),
    ...(str(rec.publishedAt) ? { publishedAt: str(rec.publishedAt)! } : {}),
    ...(str(rec.createdAt) ? { createdAt: str(rec.createdAt)! } : {}),
    ...(str(rec.updatedAt) ? { updatedAt: str(rec.updatedAt)! } : {}),
    isExternal: rec.isExternal === true,
    ...(str(rec.thumbnailUrl) ? { thumbnailUrl: str(rec.thumbnailUrl)! } : {}),
    mediaItems: mediaItemsOf(rec.mediaItems),
    tags: Array.isArray(rec.tags) ? rec.tags.filter((t): t is string => typeof t === 'string') : [],
    metadata: (rec.metadata && typeof rec.metadata === 'object'
      ? rec.metadata as Record<string, unknown>
      : {}),
  }
}

function paginationOf(raw: unknown, fallbackLimit: number, count: number): ZernioPagination {
  const rec = (raw ?? {}) as Record<string, unknown>
  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return {
    page: num(rec.page, 1),
    limit: num(rec.limit, fallbackLimit),
    total: num(rec.total, count),
    pages: num(rec.pages, 1),
  }
}

export interface ListZernioPostsParams {
  /**
   * Which collection to read. REQUIRED — there is no safe default. `zernio` is
   * what we published; `external` is the history published outside this app.
   */
  source: ZernioPostSource
  profileId?: string
  status?: ZernioPostStatusFilter
  search?: string
  platform?: string
  accountId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: ZernioPostSort
  page?: number
  limit?: number
  /**
   * Keep only posts on accounts this profile owns. On by default whenever a
   * profileId is given: a Zernio profile is an organisational boundary, never a
   * security one, so ownership is decided here rather than upstream.
   */
  scopeToProfileAccounts?: boolean
}

export async function listZernioPosts(params: ListZernioPostsParams): Promise<ZernioPostPage> {
  // Before the key check and before the network, so a missing source is always
  // the same loud failure rather than an empty list on some deployments.
  if (params?.source !== 'zernio' && params?.source !== 'external') {
    throw new ZernioError(
      'posts.listPosts',
      'listZernioPosts needs an explicit source. The API default hides every ' +
        "post published outside this app — say source: 'external' for history, " +
        "source: 'zernio' for posts we sent.",
    )
  }

  const limit = params.limit ?? 25
  const zernio = getZernioClient('posts.listPosts')
  const result = await zernio.posts.listPosts({
    query: {
      source: params.source,
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      page: params.page ?? 1,
      limit,
    },
  })

  const data = unwrapZernio<Record<string, unknown>>('posts.listPosts', result as never)
  const rawPosts = Array.isArray(data.posts) ? data.posts : []
  let posts = rawPosts
    .map(normaliseZernioPost)
    .filter((post): post is ZernioPostRecord => post !== null)

  const scope = params.scopeToProfileAccounts ?? Boolean(params.profileId)
  if (scope && params.profileId) {
    const own = await fetchZernioAccounts(params.profileId)
    const allowed = new Set(own.map((account) => account.id))
    posts = posts.filter((post) => post.accountIds.some((id) => allowed.has(id)))
  }

  return { posts, pagination: paginationOf(data.pagination, limit, posts.length) }
}

/**
 * One post by id, whoever published it.
 *
 * `getPost` answers for Zernio-authored posts. An external id 404s there, so
 * the analytics resolver — documented as accepting both id kinds — answers for
 * the rest. Returns null only when neither knows the id.
 */
export async function getZernioPost(postId: string): Promise<ZernioPostRecord | null> {
  const zernio = getZernioClient('posts.getPost')

  const direct = await zernio.posts.getPost({ path: { postId } })
  if (!direct.error && direct.data) {
    const node = direct.data as Record<string, unknown>
    const post = normaliseZernioPost((node.post ?? node) as unknown)
    if (post) return post
  }

  const viaAnalytics = await zernio.analytics.getAnalytics({ query: { postId } })
  if (viaAnalytics.error || !viaAnalytics.data) return null
  const node = viaAnalytics.data as Record<string, unknown>
  const candidate = node.post ?? (Array.isArray(node.posts) ? node.posts[0] : undefined)
  return candidate ? normaliseZernioPost(candidate) : null
}

export interface UpdateZernioPostParams {
  postId: string
  content?: string
  /**
   * Sending `platforms` replaces the whole array. A `<platform>Settings`
   * namespace left out of a target is PRESERVED; one that is sent replaces that
   * namespace entirely. It is not deep-merged — send the whole namespace or
   * none of it.
   */
  platforms?: ZernioPlatformTarget[]
  scheduledFor?: string
  isDraft?: boolean
  mediaItems?: ZernioMediaItem[]
}

export async function updateZernioPost(params: UpdateZernioPostParams): Promise<void> {
  const zernio = getZernioClient('posts.updatePost')
  const result = await zernio.posts.updatePost({
    path: { postId: params.postId },
    body: {
      ...(params.content !== undefined ? { content: params.content } : {}),
      ...(params.platforms ? { platforms: params.platforms } : {}),
      ...(params.scheduledFor ? { scheduledFor: params.scheduledFor } : {}),
      ...(params.isDraft !== undefined ? { isDraft: params.isDraft } : {}),
      ...(params.mediaItems ? { mediaItems: params.mediaItems } : {}),
    } as never,
  })
  if (result.error) {
    throw new ZernioError('posts.updatePost', 'The publisher would not accept the change.', {
      cause: result.error,
    })
  }
}

/** Removes the post from the publisher. It does NOT touch the live platform. */
export async function deleteZernioPost(postId: string): Promise<void> {
  const zernio = getZernioClient('posts.deletePost')
  const result = await zernio.posts.deletePost({ path: { postId } })
  if (result.error) {
    throw new ZernioError('posts.deletePost', 'The post could not be removed.', {
      cause: result.error,
    })
  }
}

/**
 * Re-send a post that failed.
 *
 * The words are unchanged, so the regulatory review that cleared them the first
 * time still stands — the same reasoning `dispatcher.ts` uses when it gates on
 * attempt 1 only. If the copy has been edited since, update it and let the
 * normal publishing path re-run the gate instead of retrying here.
 */
export async function retryZernioPost(postId: string): Promise<void> {
  const zernio = getZernioClient('posts.retryPost')
  const result = await zernio.posts.retryPost({ path: { postId } })
  if (result.error) {
    throw new ZernioError('posts.retryPost', 'The post could not be sent again.', {
      cause: result.error,
    })
  }
}

/**
 * Take a published post off the live platform.
 *
 * This is the takedown. For a brand advertising regulated health services it is
 * the only way to act on an AHPRA or TGA complaint about something already
 * public, and NRS had no equivalent at all before this slice. Ten platforms
 * support it; anything else has to be removed by hand and the caller is told so
 * rather than being allowed to believe it worked.
 */
export async function unpublishZernioPost(
  postId: string,
  platform: ZernioUnpublishPlatform,
): Promise<void> {
  if (!isZernioUnpublishPlatform(platform)) {
    throw new ZernioError(
      'posts.unpublishPost',
      `A published post cannot be removed from ${platform} automatically.`,
    )
  }
  const zernio = getZernioClient('posts.unpublishPost')
  const result = await zernio.posts.unpublishPost({ path: { postId }, body: { platform } })
  if (result.error) {
    throw new ZernioError('posts.unpublishPost', 'The post could not be taken down.', {
      cause: result.error,
    })
  }
}

/**
 * Change the words of a post that is already public.
 *
 * Four platforms allow it. It needs an approval because this is publishing: the
 * new words reach the same audience the old ones did, and a health brand's
 * corrected caption is exactly the copy that most needs the review.
 */
export async function editZernioPost(params: {
  postId: string
  platform: ZernioEditablePlatform
  content: string
  approval: ZernioOutboundApproval
}): Promise<void> {
  if (!isZernioEditablePlatform(params.platform)) {
    throw new ZernioError(
      'posts.editPost',
      `A published ${params.platform} post cannot be edited after it goes out.`,
    )
  }
  const zernio = getZernioClient('posts.editPost')
  const result = await zernio.posts.editPost({
    path: { postId: params.postId },
    body: { platform: params.platform, content: params.content },
  })
  if (result.error) {
    throw new ZernioError('posts.editPost', 'The wording could not be changed.', {
      cause: result.error,
    })
  }
}

/**
 * YouTube title, description, tags, thumbnail and playlist after publishing.
 *
 * Pass `postId: '_'` with `videoId` + `accountId` to reach a video that never
 * went through this app. Description and title are public copy, so this takes
 * an approval for the same reason `editZernioPost` does.
 */
export async function updateZernioPostMetadata(params: {
  postId: string
  videoId?: string
  accountId?: string
  title?: string
  description?: string
  tags?: string[]
  categoryId?: string
  privacyStatus?: 'public' | 'private' | 'unlisted'
  thumbnailUrl?: string
  madeForKids?: boolean
  containsSyntheticMedia?: boolean
  playlistId?: string
  approval: ZernioOutboundApproval
}): Promise<void> {
  const zernio = getZernioClient('posts.updatePostMetadata')
  const result = await zernio.posts.updatePostMetadata({
    path: { postId: params.postId },
    body: {
      platform: 'youtube',
      ...(params.videoId ? { videoId: params.videoId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.title ? { title: params.title.slice(0, 100) } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.tags ? { tags: params.tags } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.privacyStatus ? { privacyStatus: params.privacyStatus } : {}),
      ...(params.thumbnailUrl ? { thumbnailUrl: params.thumbnailUrl } : {}),
      ...(params.madeForKids !== undefined ? { madeForKids: params.madeForKids } : {}),
      ...(params.containsSyntheticMedia !== undefined
        ? { containsSyntheticMedia: params.containsSyntheticMedia }
        : {}),
      ...(params.playlistId ? { playlistId: params.playlistId } : {}),
    },
  })
  if (result.error) {
    throw new ZernioError('posts.updatePostMetadata', 'The video details could not be updated.', {
      cause: result.error,
    })
  }
}
