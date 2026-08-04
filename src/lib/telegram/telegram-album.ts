/**
 * Reassemble a Telegram album into one post.
 *
 * Selecting several photos in Telegram and sending them together does NOT
 * arrive as one update. Telegram delivers N separate messages that share a
 * `media_group_id`, within a second or so of each other. Treating each one on
 * its own turned an eight-image carousel into eight unrelated single-image
 * posts — the owner sent a carousel and got spam.
 *
 * There is no album-complete signal to wait for, so this settles for a short
 * quiet period: wait for arrivals to stop, then let exactly one message act.
 *
 * Leader election is deterministic rather than locked: the OLDEST media item in
 * the group wins. Every message runs the same query and reaches the same
 * answer, so no coordination — and no migration — is needed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * How long to let stragglers arrive. Telegram sends album parts within about a
 * second; this leaves room without making the owner wait noticeably.
 */
const ALBUM_SETTLE_MS = 4000

/** Give up rather than hang if an album is somehow enormous. */
const ALBUM_MAX_ITEMS = 20

export interface AlbumResult {
  /** True when this message should run the Director for the whole album. */
  isLeader: boolean
  /** Every media item in the album, oldest first. One entry if not an album. */
  mediaItemIds: string[]
}

/**
 * Wait for the album to settle, then report whether this message leads it.
 *
 * Called with the group id and the media item this particular message stored.
 */
export async function resolveAlbum({
  supabase,
  brandId,
  mediaGroupId,
  myMediaItemId,
  settleMs = ALBUM_SETTLE_MS,
}: {
  supabase: SupabaseClient
  brandId: string
  mediaGroupId: string | undefined
  myMediaItemId: string
  settleMs?: number
}): Promise<AlbumResult> {
  // Not an album — this message is trivially its own leader.
  if (!mediaGroupId) {
    return { isLeader: true, mediaItemIds: [myMediaItemId] }
  }

  await new Promise((resolve) => setTimeout(resolve, settleMs))

  const { data, error } = await supabase
    .from('media_items')
    .select('id, created_at')
    .eq('brand_id', brandId)
    .eq('metadata->>telegram_media_group_id', mediaGroupId)
    .order('created_at', { ascending: true })
    .limit(ALBUM_MAX_ITEMS)

  if (error || !data?.length) {
    // Never lose the owner's post to a bookkeeping failure — act alone.
    console.warn(`[telegram-album] could not read group ${mediaGroupId}: ${error?.message}`)
    return { isLeader: true, mediaItemIds: [myMediaItemId] }
  }

  const ids = data.map((row) => row.id as string)

  // Oldest wins. Every sibling computes this identically, so exactly one acts.
  return { isLeader: ids[0] === myMediaItemId, mediaItemIds: ids }
}

/**
 * The instruction handed to the Director once media has been processed.
 *
 * The old wording asked only for captions, so whether anything reached the
 * review queue came down to whether the Director happened to choose to create
 * a draft. Saying what is wanted is what makes the outcome reliable: real
 * drafts, on the connected platforms, with the media attached.
 */
export function buildMediaDirective({
  kind,
  mediaItemIds,
  transcript,
  description,
}: {
  kind: string
  mediaItemIds: string[]
  transcript?: string | null
  description?: string | null
}): string {
  const isAlbum = mediaItemIds.length > 1
  const idList = mediaItemIds.join(', ')

  const what = isAlbum
    ? `The owner sent ${mediaItemIds.length} images together as one album. They are in the media library as: ${idList}. Treat them as ONE carousel post, in this order — not as separate posts.`
    : `The owner sent a ${kind}. It is in the media library as ${mediaItemIds[0]}.`

  return [
    `\n\n[${what}`,
    transcript ? `What he says in it: "${transcript.slice(0, 2000)}"` : null,
    description ? `What it shows: ${description.slice(0, 600)}` : null,
    !transcript && !description
      ? 'It could not be transcribed or described — ask him what is in it rather than guessing.'
      : null,
    'Write from what is actually in it. Never invent something that was not said or shown.',
    '',
    // Speech-to-text mangles brand names, and tidying a mangled name into a
    // plausible one is how a product that does not exist gets published. It has
    // happened twice on the same video: "Bijous Saffron" became "Bijou Saffron"
    // once and "Bijou Zafran" the next time — two different inventions, both
    // confident, neither real.
    'PRODUCT NAMES — CHECK, DO NOT GUESS.',
    'Speech-to-text mangles brand and product names. Collect EVERY uncertain name from the transcript and check them ALL in ONE verify_product call using the `products` array, BEFORE writing any of them — caption, title or hashtag. A walkthrough names a dozen products; checking them one call each runs the step budget out before the copy is written.',
    'Only write a name whose verdict came back "exists". If it comes back not_found or uncertain, do NOT print the name: refer to it naturally ("today\'s scent of the day", "this one") and tell the owner you need him to confirm which product it was.',
    'Tidying a garbled name into one that merely sounds right is the exact failure this prevents. A missing name is recoverable; a fabricated one published to customers is not.',
    '',
    'THEN CREATE THE DRAFTS — do not stop at writing captions in chat.',
    `Use manage_posts with action=create_draft, once per connected platform, passing media_item_ids ${isAlbum ? `[${idList}]` : `[${mediaItemIds[0]}]`}.`,
    'Write each caption for that specific platform, and include the brand hashtags.',
    'Leave them as unscheduled drafts for review. Do not schedule or publish.',
    "Then tell him, per platform, exactly what the tool's mixpost field said — synced, pending or failed. Never say a draft is ready to review unless it came back synced.]",
  ]
    .filter(Boolean)
    .join('\n')
}
