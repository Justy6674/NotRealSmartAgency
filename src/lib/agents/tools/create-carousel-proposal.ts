import { tool } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod/v3'
import { createCarouselProposal } from '@/lib/carousel/proposal'

/** Turn saved slide receipts into an explicit, unapproved visual review item. */
export function createCarouselProposalTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description: 'Create an unapproved carousel review item from saved image media. Use only after every slide has a media_item_id. This does not publish or create a Mixpost draft; it gives the owner the actual swipeable slides to inspect and explicitly approve.',
    inputSchema: z.object({
      title: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()).default([]),
      platform: z.enum(['instagram', 'facebook', 'linkedin']),
      media_item_ids: z.array(z.string()).min(2).max(10),
      opener: z.string().optional(),
    }),
    execute: async ({ title, caption, hashtags, platform, media_item_ids, opener }) => {
      const proposal = await createCarouselProposal(supabase, userId, brandId, {
        title,
        caption,
        hashtags,
        platform,
        mediaItemIds: media_item_ids,
        opener,
      })
      return proposal.ok
        ? {
            success: true,
            output_id: proposal.outputId,
            media: proposal.metadata.carousel_slides,
            message: 'Carousel saved for visual review. It is not in Mixpost yet and has not been published.',
          }
        : { success: false, error: proposal.error }
    },
  })
}
