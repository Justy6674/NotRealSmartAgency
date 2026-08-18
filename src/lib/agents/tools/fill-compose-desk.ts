/**
 * fill_compose_desk — put a post onto the Compose screen the owner is looking at.
 *
 * Does not save, schedule, or publish. Buttons still do that. This is the
 * Director's extra pair of hands: caption, media, accounts, title, first
 * comment, privacy, and when.
 */

import { randomUUID } from 'node:crypto'
import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { userSafeError } from '@/lib/errors/user-safe'
import { fillPayloadToDeskActions, stillNeededOnDesk } from '@/lib/social/fill-payload'
import { SOCIAL_PLATFORMS } from '@/lib/social/model'

const PLATFORMS = SOCIAL_PLATFORMS

function toOffsetIso(raw: string): string | null {
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function createFillComposeDeskTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description: `Put the post onto the Compose screen the owner is looking at. Use this after you know the caption, media, accounts, title, first comment, privacy, or time — including partial fills. It does not save, schedule, or publish; the owner still presses the buttons. Ask in plain language for anything still missing. Never name departments, Mixpost, Zernio, or internal tool names to the owner.`,
    inputSchema: z.object({
      caption: z.string().max(100_000).optional().describe('The words on the post'),
      hashtags: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
      platforms: z.array(z.enum(PLATFORMS)).min(1).max(6).optional(),
      media_ids: z.array(z.string().uuid()).max(10).optional().describe('media_items UUIDs from query_media'),
      account_ids: z.array(z.string().min(1).max(300)).max(20).optional().describe('Connected account ids already on the desk'),
      title: z.string().max(2_200).optional().describe('YouTube / Facebook title'),
      first_comment: z.string().max(10_000).optional().describe('Instagram first comment'),
      cover_image_url: z.string().url().optional().describe('HTTPS cover image for Reels / TikTok'),
      tiktok_privacy: z.enum(['public', 'friends', 'private']).optional(),
      youtube_privacy: z.enum(['public', 'private', 'unlisted']).optional(),
      allow_comments: z.boolean().optional(),
      allow_duet: z.boolean().optional(),
      allow_stitch: z.boolean().optional(),
      ai_disclosure: z.boolean().optional(),
      made_for_kids: z.boolean().optional(),
      youtube_category: z.string().max(20).optional(),
      scheduled_at: z.string().optional().describe('When to post, ISO-8601. Omit to leave as a draft.'),
    }),
    execute: async (input) => {
      try {
        if (input.media_ids && input.media_ids.length > 0) {
          const { data: rows, error } = await supabase
            .from('media_items')
            .select('id')
            .in('id', input.media_ids)
            .eq('brand_id', brandId)

          if (error) {
            console.error('[fill-compose-desk] media lookup failed', error)
            return {
              success: false,
              fill_id: randomUUID(),
              owner_summary: 'I could not check that media against this business just now. Nothing was put on the post.',
              desk_actions: [],
              still_needed: stillNeededOnDesk({
                platforms: input.platforms ?? [],
                caption: input.caption ?? '',
                mediaIds: [],
                accountIds: input.account_ids ?? [],
                youtubeTitle: input.title,
                scheduledAt: input.scheduled_at,
              }),
            }
          }

          const found = new Set((rows ?? []).map((row) => row.id as string))
          const missing = input.media_ids.filter((id) => !found.has(id))
          if (missing.length > 0) {
            return {
              success: false,
              fill_id: randomUUID(),
              owner_summary: 'That photo or video is not in this business’s library. Pick one from the media strip, or tell me which file to use.',
              desk_actions: [],
              still_needed: stillNeededOnDesk({
                platforms: input.platforms ?? [],
                caption: input.caption ?? '',
                mediaIds: [],
                accountIds: input.account_ids ?? [],
                youtubeTitle: input.title,
                scheduledAt: input.scheduled_at,
              }),
            }
          }
        }

        const scheduledAt = input.scheduled_at ? toOffsetIso(input.scheduled_at) : undefined
        if (input.scheduled_at && !scheduledAt) {
          return {
            success: false,
            fill_id: randomUUID(),
            owner_summary: 'That date and time did not look like a real time. Try “tomorrow at 9am” or pick a time on the post.',
            desk_actions: [],
            still_needed: stillNeededOnDesk({
              platforms: input.platforms ?? [],
              caption: input.caption ?? '',
              mediaIds: input.media_ids ?? [],
              accountIds: input.account_ids ?? [],
              youtubeTitle: input.title,
              scheduledAt: undefined,
            }),
          }
        }

        const desk_actions = fillPayloadToDeskActions({
          ...input,
          scheduled_at: scheduledAt ?? undefined,
          timezone: 'Australia/Sydney',
        })

        if (desk_actions.length === 0) {
          return {
            success: false,
            fill_id: randomUUID(),
            owner_summary: 'Nothing new to put on the post yet. Tell me the caption, the accounts, or which photo to use.',
            desk_actions: [],
            still_needed: stillNeededOnDesk({
              platforms: input.platforms ?? [],
              caption: input.caption ?? '',
              mediaIds: input.media_ids ?? [],
              accountIds: input.account_ids ?? [],
              youtubeTitle: input.title,
              scheduledAt: scheduledAt ?? undefined,
            }),
          }
        }

        const still_needed = stillNeededOnDesk({
          platforms: input.platforms ?? [],
          caption: input.caption ?? '',
          mediaIds: input.media_ids ?? [],
          accountIds: input.account_ids ?? [],
          youtubeTitle: input.title,
          scheduledAt: scheduledAt ?? undefined,
        })

        const fill_id = randomUUID()
        const appliedBits = [
          input.caption ? 'caption' : null,
          input.media_ids?.length ? 'media' : null,
          input.account_ids?.length ? 'accounts' : null,
          input.title ? 'title' : null,
          input.first_comment ? 'first comment' : null,
          input.tiktok_privacy || input.youtube_privacy ? 'privacy' : null,
          scheduledAt ? 'time' : null,
        ].filter(Boolean)

        return {
          success: true,
          fill_id,
          desk_actions,
          still_needed,
          owner_summary: still_needed[0]
            ? `I put the ${appliedBits.join(', ') || 'details'} on the post. ${still_needed[0]}`
            : `I put the ${appliedBits.join(', ') || 'details'} on the post. You can still change anything with the buttons, then save or schedule when you are ready.`,
        }
      } catch (err) {
        return {
          success: false,
          fill_id: randomUUID(),
          owner_summary: userSafeError(
            'fill-compose-desk',
            err,
            'I could not put that on the post just now. Nothing was saved.',
          ),
          desk_actions: [],
          still_needed: [],
        }
      }
    },
  })
}
