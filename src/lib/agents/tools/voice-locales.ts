import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, fetchVoiceLocales } from '@/lib/heygen/client'

export function createListVoiceLocalesTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List all available voice locales and accents in HeyGen. Shows which languages and regional accents are available for text-to-speech and video narration — useful for finding Australian English voices or multilingual content.',
    inputSchema: z.object({}),
    execute: async () => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const locales = await fetchVoiceLocales(apiKey)

        if (locales.length === 0) {
          return {
            success: true,
            locales: [],
            message:
              'No voice locales returned from HeyGen. This may be a temporary API issue.',
          }
        }

        return {
          success: true,
          locales,
          count: locales.length,
          message: `Found ${locales.length} voice locale(s) available in HeyGen. Use these to find the right accent for your brand videos.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to fetch voice locales from HeyGen',
        }
      }
    },
  })
}
