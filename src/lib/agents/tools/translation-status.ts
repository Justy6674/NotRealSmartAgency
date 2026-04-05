import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, getTranslationStatus } from '@/lib/heygen/client'

export function createTranslationStatusTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Check the status of a video translation job. Returns the current status and the translated video URL once complete.',
    inputSchema: z.object({
      translation_id: z
        .string()
        .describe('The video_translate_id returned when the translation was started'),
    }),
    execute: async ({ translation_id }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Cannot check translation status without an API key.',
        }
      }

      try {
        const result = await getTranslationStatus(apiKey, translation_id)

        if (!result) {
          return {
            success: false,
            error: 'Could not retrieve translation status. The translation ID may be invalid.',
          }
        }

        // If complete, update the output record
        if (result.status === 'completed' && result.url) {
          await supabase
            .from('outputs')
            .update({
              metadata: {
                job_id: translation_id,
                provider: 'heygen',
                type: 'translation',
                status: 'completed',
                video_url: result.url,
              },
            })
            .eq('user_id', userId)
            .filter('metadata->>job_id', 'eq', translation_id)
        }

        return {
          success: true,
          translation_id,
          status: result.status,
          video_url: result.url ?? undefined,
          message:
            result.status === 'completed' && result.url
              ? `Your translated video is ready! You can view it here: ${result.url}`
              : result.status === 'failed'
                ? 'The translation failed. This can happen if the source video has no clear speech or the format is unsupported.'
                : `Translation is still ${result.status}. It should be ready soon — check back in a minute or two.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to check translation status',
        }
      }
    },
  })
}
