/**
 * Where a picture's description for screen readers lives, and the one place it
 * is read out of a `media_items` row.
 *
 * THE FAULT THIS CLOSES: the description was captured (the media library has a
 * dialog for it, a filter for the pictures missing one, and a chip on every
 * card that has none) and the dispatcher already knew what to do with it —
 * `toZernioMediaItem({ altText })` and LinkedIn's `description.text` both take
 * it. Nothing in between carried it. All three routes that build `PublishMedia`
 * selected the columns they wanted by name and `metadata` was not among them,
 * so every description an owner wrote was dropped one step before the wire and
 * nothing said so. A blind follower of a clinic got an unlabelled image and the
 * owner had every reason to believe otherwise.
 *
 * It is `metadata.alt_text` rather than a column because that is where the
 * capture side already writes it, and adding a column would mean a migration on
 * live Supabase for a value the JSON already holds.
 */
export function altTextOf(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const value = (metadata as { alt_text?: unknown }).alt_text
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
