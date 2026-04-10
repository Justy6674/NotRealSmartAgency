/**
 * Mixpost tag sync — mirror NRS brands and hashtag_groups into Mixpost
 * tags so the Mixpost library is filterable by NRS's own taxonomy.
 *
 * Direction: NRS → Mixpost, one-way. We cache the Mixpost tag id/uuid
 * on the source row (brands.mixpost_tag_id, hashtag_groups.mixpost_tag_id)
 * so subsequent calls no-op — first sync creates, everything after
 * reuses the cached tag.
 *
 * Used by:
 * - syncDraftToMixpost — attaches the brand tag to every draft pushed
 *   to Mixpost so Justin can filter his library by brand
 * - /api/hashtag-groups POST/PATCH — auto-mirrors new/renamed hashtag
 *   groups into Mixpost so they exist as filters too
 * - scripts/backfill-tags-to-mixpost.ts — one-shot catch-up for
 *   existing brands and hashtag groups created before this feature
 *
 * NODE RUNTIME ONLY — calls Mixpost REST API with long-ish timeouts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createMixpostTag } from './client'

/** Deterministic hex colour derived from a string so tags get consistent
 *  colours across runs without us storing a colour per brand. Mixpost
 *  expects `#RRGGBB`. */
function hexFromString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  // Keep saturation high by using the low bits for HSL-like mapping.
  const hue = Math.abs(hash) % 360
  // HSL (hue, 65%, 55%) → RGB conversion, inlined because we only need a
  // one-liner hex — avoids pulling in a colour library.
  const s = 0.65
  const l = 0.55
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = hue / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0, g1 = 0, b1 = 0
  if (hp < 1) { r1 = c; g1 = x }
  else if (hp < 2) { r1 = x; g1 = c }
  else if (hp < 3) { g1 = c; b1 = x }
  else if (hp < 4) { g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; b1 = c }
  else { r1 = c; b1 = x }
  const m = l - c / 2
  const toByte = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toByte(r1)}${toByte(g1)}${toByte(b1)}`
}

interface TagSyncResult {
  id: number
  uuid: string
}

/**
 * Ensure a Mixpost tag exists for the given brand. Returns the cached
 * tag id/uuid on subsequent calls. Safe to call from the hot path of
 * every draft sync — the fast path is a single DB read.
 */
export async function ensureBrandTagInMixpost(
  supabase: SupabaseClient,
  brandId: string,
): Promise<TagSyncResult | null> {
  const { data: brand, error } = await supabase
    .from('brands')
    .select('id, name, brand_colours, mixpost_tag_id, mixpost_tag_uuid')
    .eq('id', brandId)
    .single()

  if (error || !brand) return null

  if (brand.mixpost_tag_id && brand.mixpost_tag_uuid) {
    return { id: brand.mixpost_tag_id as number, uuid: brand.mixpost_tag_uuid as string }
  }

  // Prefer the brand's declared primary colour if set, otherwise derive
  // a stable hex from the name so the tag still looks consistent.
  const brandColours = (brand.brand_colours as Record<string, string> | null) ?? {}
  const hex =
    brandColours.primary ??
    brandColours.accent ??
    brandColours['0'] ??
    hexFromString(brand.name as string)

  const tag = await createMixpostTag(brand.name as string, hex)
  if (!tag) return null

  await supabase
    .from('brands')
    .update({
      mixpost_tag_id: tag.id,
      mixpost_tag_uuid: tag.uuid,
      mixpost_tag_synced_at: new Date().toISOString(),
    })
    .eq('id', brandId)

  return { id: tag.id, uuid: tag.uuid }
}

/**
 * Ensure a Mixpost tag exists for the given hashtag group. Same cache
 * pattern as ensureBrandTagInMixpost — first call creates, every
 * subsequent call is a single DB read.
 */
export async function ensureHashtagGroupTagInMixpost(
  supabase: SupabaseClient,
  hashtagGroupId: string,
): Promise<TagSyncResult | null> {
  const { data: group, error } = await supabase
    .from('hashtag_groups')
    .select('id, name, mixpost_tag_id, mixpost_tag_uuid')
    .eq('id', hashtagGroupId)
    .single()

  if (error || !group) return null

  if (group.mixpost_tag_id && group.mixpost_tag_uuid) {
    return { id: group.mixpost_tag_id as number, uuid: group.mixpost_tag_uuid as string }
  }

  const hex = hexFromString(group.name as string)
  const tag = await createMixpostTag(group.name as string, hex)
  if (!tag) return null

  await supabase
    .from('hashtag_groups')
    .update({
      mixpost_tag_id: tag.id,
      mixpost_tag_uuid: tag.uuid,
      mixpost_tag_synced_at: new Date().toISOString(),
    })
    .eq('id', hashtagGroupId)

  return { id: tag.id, uuid: tag.uuid }
}
