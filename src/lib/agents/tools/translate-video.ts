import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, translateVideo } from '@/lib/heygen/client'

export function createTranslateVideoTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Translate an existing video into another language with natural lip sync. Supports 175+ languages. Provide the video URL and target language code (e.g. "es" for Spanish, "fr" for French, "zh" for Chinese).',
    inputSchema: z.object({
      video_url: z
        .string()
        .describe('Public URL of the video to translate'),
      target_language: z
        .string()
        .describe('Target language code, e.g. "es", "fr", "zh", "ja", "de"'),
      title: z
        .string()
        .optional()
        .describe('Optional title for the translated video'),
    }),
    execute: async ({ video_url, target_language, title }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. To translate videos, get an API key from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const result = await translateVideo(apiKey, video_url, target_language, title)

        if (!result) {
          return {
            success: false,
            error: 'HeyGen translation API returned an error. Check the video URL is publicly accessible and the language code is valid.',
          }
        }

        // Save as output so it appears in the output library
        const videoTitle = title ?? `Translated video (${target_language})`

        const { data: videoOutput } = await supabase
          .from('outputs')
          .insert({
            user_id: userId,
            brand_id: brandId,
            conversation_id: conversationId,
            output_type: 'video',
            title: videoTitle,
            content: `Translation of ${video_url} to ${target_language}`,
            metadata: {
              job_id: result.video_translate_id,
              provider: 'heygen',
              type: 'translation',
              source_url: video_url,
              target_language,
              status: 'processing',
            },
          })
          .select('id')
          .single()

        return {
          success: true,
          video_translate_id: result.video_translate_id,
          output_id: videoOutput?.id,
          title: videoTitle,
          target_language,
          estimated_time: '3-10 minutes',
          message: `I've started translating your video into ${target_language}. This typically takes 3-10 minutes depending on the video length.\n\nTranslation ID: ${result.video_translate_id}\n\nI'll save the translated video to your output library once it's ready.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to translate video with HeyGen',
        }
      }
    },
  })
}
