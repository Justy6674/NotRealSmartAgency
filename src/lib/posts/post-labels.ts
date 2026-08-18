/**
 * Labels on the social desk — the one thing in the Posts list that is ours all
 * the way down.
 *
 * The publisher has no tag taxonomy. Its post records carry `tags` and
 * `hashtags` as plain string arrays: no colour, no per-business list, no way to
 * filter a list by one. So the coloured chips in the Labels column and the
 * stripes down the side of a calendar card are backed by
 * `social_post_labels` + `social_post_label_links` (migration
 * `20260819000000`), not by anything upstream.
 *
 * This module is pure and server-safe: shapes, colours and the read/attach
 * helpers, with no React and no fetch. The API route imports it; so does the
 * picker, for the palette.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PostLabel {
  id: string
  name: string
  /** A full CSS colour, always oklch. Never a hex — DESIGN.md is explicit. */
  colour: string
}

/**
 * The palette a new label can take.
 *
 * Eight hues at one lightness and one chroma, so no chip ever shouts louder
 * than another and none of them can be mistaken for a status dot — the status
 * tokens sit at a different lightness on purpose. Hue 240 (the house silver) is
 * deliberately absent: a label the same colour as the furniture is not a label.
 */
export const LABEL_COLOURS: readonly string[] = [
  'oklch(0.62 0.10 20)',   // clay
  'oklch(0.66 0.11 55)',   // amber
  'oklch(0.66 0.10 100)',  // olive
  'oklch(0.62 0.10 152)',  // green
  'oklch(0.62 0.09 195)',  // teal
  'oklch(0.60 0.10 265)',  // indigo
  'oklch(0.60 0.11 305)',  // violet
  'oklch(0.62 0.10 345)',  // rose
]

export const DEFAULT_LABEL_COLOUR = LABEL_COLOURS[5]!

/** A colour we are willing to store. Anything else falls back to the default. */
export function safeLabelColour(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_LABEL_COLOUR
  const trimmed = value.trim()
  // oklch only. A hex here would be a silent DESIGN.md violation that survives
  // every review because it renders fine.
  return /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*(\/\s*[\d.%]+\s*)?\)$/.test(trimmed)
    ? trimmed
    : DEFAULT_LABEL_COLOUR
}

/** Trimmed, length-bounded, and never empty. Mirrors the table's own check. */
export function safeLabelName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.length > 40) return null
  return trimmed
}

export function normaliseLabel(raw: unknown): PostLabel | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = typeof rec.id === 'string' ? rec.id : ''
  const name = safeLabelName(rec.name)
  if (!id || !name) return null
  return { id, name, colour: safeLabelColour(rec.colour) }
}

/** Every label defined for one business, alphabetical. */
export async function listBrandLabels(
  supabase: SupabaseClient,
  brandId: string,
): Promise<PostLabel[]> {
  const { data, error } = await supabase
    .from('social_post_labels')
    .select('id, name, colour')
    .eq('brand_id', brandId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((row) => {
    const label = normaliseLabel(row)
    return label ? [label] : []
  })
}

/**
 * Labels for a set of posts, keyed by post id.
 *
 * One query for the whole page rather than one per row: the Labels column is on
 * every row of a list that can be a few hundred long, and an N+1 here is how a
 * list page becomes a spinner.
 */
export async function labelsForPosts(
  supabase: SupabaseClient,
  postIds: readonly string[],
): Promise<Map<string, PostLabel[]>> {
  const out = new Map<string, PostLabel[]>()
  if (postIds.length === 0) return out

  const { data, error } = await supabase
    .from('social_post_label_links')
    .select('scheduled_post_id, social_post_labels(id, name, colour)')
    .in('scheduled_post_id', postIds as string[])
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const postId = (row as Record<string, unknown>).scheduled_post_id
    if (typeof postId !== 'string') continue
    // PostgREST returns the embedded row as an object for a to-one relation and
    // an array for a to-many. The foreign key here is to-one, but the shape has
    // changed between PostgREST versions before, so both are accepted.
    const embedded = (row as Record<string, unknown>).social_post_labels
    const candidates = Array.isArray(embedded) ? embedded : [embedded]
    for (const candidate of candidates) {
      const label = normaliseLabel(candidate)
      if (!label) continue
      const list = out.get(postId) ?? []
      list.push(label)
      out.set(postId, list)
    }
  }

  for (const list of out.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }
  return out
}

/** A uuid, and nothing that merely looks like one. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Deduplicated, uuid-shaped ids, in the order first seen. */
export function safeLabelIds(values: readonly unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!UUID_PATTERN.test(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/**
 * Replace the labels on one post.
 *
 * Delete-then-insert rather than a diff: the set is at most a handful of rows,
 * and a diff has an ordering bug waiting in it that a full replace does not.
 *
 * Both ids are checked against `brandId` BEFORE anything is written, because
 * the ids arrive straight off a request body. A link row carries a denormalised
 * `brand_id` — which is what every policy and every filter on this table trusts
 * — so a label from one business linked to a post in another would file itself
 * under whichever brand the caller named and be invisible to the business that
 * actually owns the label. The migration makes that unrepresentable with
 * composite foreign keys; this is the same rule stated where the error can be
 * a sentence the owner understands rather than a constraint name.
 *
 * It fails closed on the whole call: an id that does not belong is a rejected
 * request, never a quietly dropped label. Silently saving four of five labels
 * is worse than saving none, because nobody notices.
 */
export async function setPostLabels(
  supabase: SupabaseClient,
  params: { scheduledPostId: string; brandId: string; labelIds: readonly string[] },
): Promise<void> {
  if (!UUID_PATTERN.test(params.scheduledPostId) || !UUID_PATTERN.test(params.brandId)) {
    throw new Error('That post could not be identified.')
  }

  const requested = safeLabelIds(params.labelIds)
  if (requested.length !== params.labelIds.length) {
    throw new Error('One of those labels was not recognised.')
  }

  // The post must be this business's. RLS already stops another workspace's
  // row being read at all, so a miss here is either a wrong brandId from the
  // caller or a post the acting user cannot see — both are a refusal.
  const { data: post, error: postError } = await supabase
    .from('scheduled_posts')
    .select('id')
    .eq('id', params.scheduledPostId)
    .eq('brand_id', params.brandId)
    .maybeSingle()
  if (postError) throw new Error(postError.message)
  if (!post) throw new Error('That post does not belong to this business.')

  if (requested.length > 0) {
    const { data: owned, error: ownedError } = await supabase
      .from('social_post_labels')
      .select('id')
      .eq('brand_id', params.brandId)
      .in('id', requested)
    if (ownedError) throw new Error(ownedError.message)
    const ownedIds = new Set(
      (owned ?? []).flatMap((row) => {
        const id = (row as Record<string, unknown>).id
        return typeof id === 'string' ? [id] : []
      }),
    )
    if (requested.some((id) => !ownedIds.has(id))) {
      throw new Error('One of those labels does not belong to this business.')
    }
  }

  const { error: delError } = await supabase
    .from('social_post_label_links')
    .delete()
    .eq('scheduled_post_id', params.scheduledPostId)
  if (delError) throw new Error(delError.message)

  if (requested.length === 0) return

  const { error: insError } = await supabase
    .from('social_post_label_links')
    .insert(
      requested.map((labelId) => ({
        label_id: labelId,
        scheduled_post_id: params.scheduledPostId,
        brand_id: params.brandId,
      })),
    )
  if (insError) throw new Error(insError.message)
}

/** Post ids carrying any of the given labels. Used by the list filter. */
export async function postIdsWithLabels(
  supabase: SupabaseClient,
  brandId: string,
  labelIds: readonly string[],
): Promise<Set<string>> {
  // Same sanitising as the write path: these ids come off a query string, and a
  // filter that quietly matches nothing is better than one that hands PostgREST
  // whatever the URL said.
  const wanted = safeLabelIds(labelIds)
  if (wanted.length === 0) return new Set()
  const { data, error } = await supabase
    .from('social_post_label_links')
    .select('scheduled_post_id')
    .eq('brand_id', brandId)
    .in('label_id', wanted)
  if (error) throw new Error(error.message)
  return new Set(
    (data ?? []).flatMap((row) => {
      const id = (row as Record<string, unknown>).scheduled_post_id
      return typeof id === 'string' ? [id] : []
    }),
  )
}
