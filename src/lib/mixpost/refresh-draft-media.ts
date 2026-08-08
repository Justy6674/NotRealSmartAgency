/**
 * Put a re-rendered video into the drafts that are still waiting on it.
 *
 * Captioning a clip did nothing to anything already drafted, and said nothing
 * about it. Mixpost does not reference our storage — it COPIES the file into
 * its own the moment a draft is made. So a caption burnt in afterwards lands
 * on a file no draft points at, the tool reports success, and the video sitting
 * in Mixpost is still the bare one. Silent, and only discoverable by opening
 * Mixpost and looking.
 *
 * Publishing preferring the captioned copy is not enough either: that decides
 * which URL a NEW draft is built from. An existing draft has already taken its
 * copy.
 *
 * So the new file is uploaded to Mixpost and swapped into every draft holding
 * the old one. Drafts only — a published or scheduled post is not ours to
 * rewrite underneath.
 */

import {
  fetchMixpostPosts, fetchMixpostPost, uploadMediaFromUrl, updateMixpostPost,
  type MixpostPost,
} from './client'

/**
 * Only a draft may be rewritten.
 *
 * A post that is scheduled, publishing or published is either already gone or
 * on its way, and swapping its video underneath is not ours to do. Matched on
 * the word Mixpost actually returns — this was compared against the number 0
 * for a while and therefore matched nothing ever.
 */
const DRAFT = 'draft'

export interface RefreshResult {
  /** Drafts whose video was replaced. */
  updated: number
  /** Drafts that hold the old file but could not be updated. */
  failed: number
  /** Nothing was drafted from this clip yet, so nothing needed doing. */
  noneFound: boolean
}

/**
 * The storage file name a Mixpost media entry was built from.
 *
 * Mixpost keeps the original name and hashes only the stored path, so the name
 * is what ties its copy back to ours.
 */
export function mediaNameFromUrl(url: string): string {
  const last = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
  return last.replace(/\.[a-z0-9]+$/i, '')
}

/** Does this post carry a copy of that file? */
export function postHoldsMedia(post: MixpostPost, name: string): boolean {
  return post.versions.some((version) =>
    version.content.some((content) =>
      (content as unknown as { media?: Array<{ name?: string } | number> }).media?.some(
        (item) => typeof item === 'object' && item !== null
          && typeof item.name === 'string'
          && item.name.startsWith(name),
      )))
}

/**
 * Swap the video in every draft still holding the old one.
 *
 * The replacement is uploaded ONCE and reused across drafts — a 70 MB file
 * pushed per draft would take minutes and fill Mixpost's library with
 * duplicates of the same video.
 */
export async function refreshDraftMedia({
  oldUrl,
  newUrl,
}: {
  oldUrl: string
  newUrl: string
}): Promise<RefreshResult> {
  const name = mediaNameFromUrl(oldUrl)
  const posts = await fetchMixpostPosts({ status: 'draft' }).catch(() => null)
  if (!posts) return { updated: 0, failed: 0, noneFound: true }

  const holding = posts.filter((post) => String(post.status) === DRAFT && postHoldsMedia(post, name))
  if (holding.length === 0) return { updated: 0, failed: 0, noneFound: true }

  const uploaded = await uploadMediaFromUrl(newUrl)
  if (!uploaded) {
    // The drafts still hold the old video. Reporting zero updated and a
    // failure count is what makes the caller say so out loud.
    return { updated: 0, failed: holding.length, noneFound: false }
  }

  let updated = 0
  let failed = 0

  for (const summary of holding) {
    // Re-read each post: the list endpoint gives a summary, and writing back a
    // partial version would drop the caption body the owner just approved.
    const post = await fetchMixpostPost(summary.uuid).catch(() => null)
    if (!post) { failed += 1; continue }

    const ok = await updateMixpostPost(post.uuid, {
      accounts: post.accounts.map((account) => account.id),
      tags: post.tags.map((tag) => tag.id),
      versions: post.versions.map((version) => ({
        ...version,
        content: version.content.map((content) => ({
          ...content,
          // Everything else about the draft is left exactly as it is. Only the
          // file changes.
          media: [uploaded.id],
        })),
      })),
    })

    if (ok) updated += 1
    else failed += 1
  }

  return { updated, failed, noneFound: false }
}
