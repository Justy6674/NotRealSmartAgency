import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createDraftPost, describeMixpostOutcome } from '@/lib/posts/create-draft'
import { userSafeError } from '@/lib/errors/user-safe'
import type { PostPlatform } from '@/types/database'

/**
 * Turn an agreed proposal into a real draft, WITHOUT rewriting it.
 *
 * The missing rung in the ladder. A clip was uploaded, transcribed and written
 * up as a proposal; the owner and his colleague then discussed it and settled
 * on the wording. And there the trail stopped: nothing ever set
 * `is_approved`, and no path existed from an agreed proposal to a draft.
 *
 * So "yes, do that one" meant asking the Director to write a post — which
 * generated NEW copy. The words they had just agreed on were thrown away and
 * replaced by something similar, every time. That is the difference between a
 * conversation that decides something and a conversation that goes in circles.
 *
 * This takes the proposal's own text, exactly as agreed, and files it as a
 * draft through the one place a draft is born — so it reaches Mixpost the same
 * way every other draft does.
 */
export function createApproveProposalTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Approve a proposal and turn it into a real draft post, using the agreed copy EXACTLY as written. Use this the moment the user says yes, go ahead, do that one, approve it, or send it to Mixpost. Do NOT rewrite the copy — this exists so the words they agreed on are the words that get filed. Pass any edits through `caption` only if the user explicitly asked for a change.',
    inputSchema: z.object({
      output_id: z.string().optional()
        .describe('The proposal to approve. Omit to approve the most recent proposal for this project, which is almost always the one being discussed.'),
      platform: z.enum(['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter']).optional()
        .describe('Where it is going. Defaults to the platform the proposal was written for.'),
      caption: z.string().optional()
        .describe('ONLY if the user asked for a specific change. Leave empty to use the agreed copy unchanged.'),
    }),

    execute: async ({ output_id, platform, caption }) => {
      // The proposal being discussed is the most recent one unless named.
      let query = supabase
        .from('outputs')
        .select('id, title, content, metadata, is_approved')
        .eq('user_id', userId)
        .eq('brand_id', brandId)
        .eq('output_type', 'social_post')

      query = output_id
        ? query.eq('id', output_id)
        : query.order('created_at', { ascending: false }).limit(1)

      const { data, error } = await query
      if (error) {
        return userSafeError('approve-proposal', error, 'Could not read that proposal. Nothing was filed.')
      }

      const proposal = (Array.isArray(data) ? data[0] : data) as
        | { id: string; title: string | null; content: string | null; metadata: Record<string, unknown>; is_approved: boolean }
        | undefined

      if (!proposal) {
        return 'There is no proposal to approve for this project yet. Send a video or ask for a post first — do NOT invent one.'
      }

      const meta = proposal.metadata ?? {}
      if (meta.stage !== 'proposal') {
        return 'That is not a proposal, so there is nothing to approve. Say so rather than filing something the user did not agree to.'
      }

      if (proposal.is_approved) {
        return `That proposal was already approved and filed as a draft. It is in Review and in Mixpost — nothing further to do.`
      }

      const mediaItemIds = Array.isArray(meta.media_item_ids)
        ? meta.media_item_ids.filter((id): id is string => typeof id === 'string')
        : []

      // The agreed words, unchanged, unless the user asked for an edit.
      const agreedCaption = caption ?? proposal.content ?? ''
      if (!agreedCaption.trim()) {
        return 'That proposal has no copy to file. Nothing was created.'
      }

      const hashtags = Array.isArray(meta.hashtags)
        ? meta.hashtags.filter((tag): tag is string => typeof tag === 'string')
        : []

      const target = (platform ?? (typeof meta.platform === 'string' ? meta.platform : 'instagram')) as PostPlatform

      try {
        const draft = await createDraftPost({
          supabase,
          userId,
          brandId,
          platform: target,
          caption: agreedCaption,
          hashtags,
          mediaItemIds,
          outputId: proposal.id,
          metadata: { source: 'approved_proposal', approved_from: proposal.id },
        })

        // Mark it approved only once the draft exists, so a failure here does
        // not leave a proposal that claims to have been filed and was not.
        await supabase.from('outputs').update({ is_approved: true }).eq('id', proposal.id)

        return [
          `Approved and filed as a ${target} draft, using the copy exactly as agreed.`,
          describeMixpostOutcome(draft),
          mediaItemIds.length > 0
            ? `${mediaItemIds.length} file${mediaItemIds.length === 1 ? '' : 's'} attached.`
            : 'No media attached — add one in Review before publishing.',
          'Relay the Mixpost line above honestly. Do NOT say it is live: it is a draft awaiting the owner in Review.',
        ].join('\n')
      } catch (err) {
        return userSafeError(
          'approve-proposal',
          err,
          'The draft could not be created, so nothing was filed and nothing was published. The proposal is untouched — try again.',
        )
      }
    },
  })
}
