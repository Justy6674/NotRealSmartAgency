import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, textToSpeech } from '@/lib/heygen/client'

export function createTextToSpeechTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Generate standalone audio from text using HeyGen text-to-speech. Perfect for podcast intros, voiceovers, audio ads, or narration. Returns a downloadable audio URL.',
    inputSchema: z.object({
      text: z
        .string()
        .describe('The text to convert to speech'),
      voice_id: z
        .string()
        .describe('HeyGen voice ID — use list_voice_locales to find available voices'),
      speed: z
        .number()
        .optional()
        .describe('Speech speed multiplier (default 1.0, range 0.5-2.0)'),
    }),
    execute: async ({ text, voice_id, speed }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const result = await textToSpeech(apiKey, text, voice_id, speed)

        if (!result) {
          return {
            success: false,
            error:
              'Text-to-speech generation failed. Check your HeyGen credits, API key, and voice ID.',
          }
        }

        // Save as output so it appears in the output library
        const { data: output } = await supabase
          .from('outputs')
          .insert({
            user_id: userId,
            brand_id: brandId,
            conversation_id: conversationId,
            output_type: 'audio',
            title: `Audio: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`,
            content: text,
            metadata: {
              provider: 'heygen',
              audio_url: result.audio_url,
              duration_seconds: result.duration,
              voice_id,
              speed: speed ?? 1.0,
            },
          })
          .select('id')
          .single()

        return {
          success: true,
          audio_url: result.audio_url,
          duration_seconds: result.duration,
          output_id: output?.id,
          message: `Audio generated successfully (${result.duration}s). Saved to your output library.\n\nListen: ${result.audio_url}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate audio with HeyGen TTS',
        }
      }
    },
  })
}
