import type { SupabaseClient } from '@supabase/supabase-js'

export interface CarouselSlideReceipt {
  media_item_id: string
  file_url: string
  file_name: string
}

interface SavedMediaRow {
  id: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
}

export interface CarouselProposalInput {
  title: string
  caption: string
  hashtags: string[]
  platform: string
  mediaItemIds: string[]
  opener?: string
}

export interface CarouselProposalMetadata {
  source: 'canva_carousel'
  stage: 'proposal'
  post_type: 'carousel'
  platform: string
  hashtags: string[]
  media_item_ids: string[]
  carousel_slides: CarouselSlideReceipt[]
  opener?: string
}

export type BuildCarouselProposalResult =
  | { ok: true; metadata: CarouselProposalMetadata }
  | { ok: false; error: string }

/**
 * Turn media receipts into the one durable record the Mini App and Mixpost
 * both understand.  It is intentionally pure: a model can suggest a slide
 * list, but cannot make a missing file look reviewable by describing it.
 */
export function buildCarouselProposalRecord(
  input: CarouselProposalInput,
  mediaRows: readonly SavedMediaRow[],
): BuildCarouselProposalResult {
  const mediaItemIds = input.mediaItemIds.filter((id, index, ids) => id && ids.indexOf(id) === index)
  if (mediaItemIds.length < 2) {
    return { ok: false, error: 'A carousel needs at least two saved slides. No carousel proposal was created.' }
  }
  if (mediaItemIds.length > 10) {
    return { ok: false, error: 'A carousel can contain at most ten slides. No carousel proposal was created.' }
  }

  const byId = new Map(mediaRows.map((row) => [row.id, row]))
  const carouselSlides: CarouselSlideReceipt[] = []
  for (const [index, mediaItemId] of mediaItemIds.entries()) {
    const row = byId.get(mediaItemId)
    if (!row?.file_url || !row.file_name || !row.file_type?.startsWith('image/')) {
      return {
        ok: false,
        error: `Slide ${index + 1} is missing from the saved media library. No carousel proposal was created.`,
      }
    }
    carouselSlides.push({
      media_item_id: row.id,
      file_url: row.file_url,
      file_name: row.file_name,
    })
  }

  return {
    ok: true,
    metadata: {
      source: 'canva_carousel',
      stage: 'proposal',
      post_type: 'carousel',
      platform: input.platform,
      hashtags: input.hashtags,
      media_item_ids: mediaItemIds,
      carousel_slides: carouselSlides,
      ...(input.opener?.trim() ? { opener: input.opener.trim() } : {}),
    },
  }
}

export type CreateCarouselProposalResult =
  | { ok: true; outputId: string; metadata: CarouselProposalMetadata }
  | { ok: false; error: string }

/**
 * Persist an unapproved carousel proposal. This deliberately never creates a
 * scheduled post or publishes; the owner must explicitly choose "Save as
 * Mixpost draft" from the visual review card afterwards.
 */
export async function createCarouselProposal(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  input: CarouselProposalInput,
): Promise<CreateCarouselProposalResult> {
  const uniqueIds = input.mediaItemIds.filter((id, index, ids) => id && ids.indexOf(id) === index)
  const { data: rows, error: mediaError } = await supabase
    .from('media_items')
    .select('id, file_url, file_name, file_type')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .in('id', uniqueIds)

  if (mediaError) {
    return { ok: false, error: 'NRS could not read the saved slides. No carousel proposal was created.' }
  }

  const built = buildCarouselProposalRecord(input, (rows ?? []) as SavedMediaRow[])
  if (!built.ok) return built

  const { data: output, error: outputError } = await supabase
    .from('outputs')
    .insert({
      user_id: userId,
      brand_id: brandId,
      output_type: 'social_post',
      title: input.title.trim() || 'Carousel ready to review',
      content: input.caption,
      is_approved: false,
      metadata: built.metadata,
    })
    .select('id')
    .single()

  if (outputError || !output?.id) {
    return { ok: false, error: 'NRS could not save the carousel for review. No Mixpost draft was created.' }
  }

  return { ok: true, outputId: output.id as string, metadata: built.metadata }
}
