import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, addWebhookEndpoint } from '@/lib/heygen/client'

export function createRegisterWebhookTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Register a webhook with HeyGen so we get notified when videos finish generating instead of polling.',
    inputSchema: z.object({
      events: z
        .array(z.string())
        .optional()
        .describe(
          'Events to listen for (default: all video events)'
        ),
    }),
    execute: async ({ events }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api.',
        }
      }

      const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://notrealsmart.com.au'}/api/webhooks/heygen`
      const eventList = events ?? [
        'avatar_video.success',
        'avatar_video.fail',
        'video_translate.success',
        'video_translate.fail',
      ]

      try {
        const ok = await addWebhookEndpoint(apiKey, callbackUrl, eventList)
        return ok
          ? {
              success: true,
              message: `Webhook registered at ${callbackUrl} for events: ${eventList.join(', ')}`,
            }
          : {
              success: false,
              error: 'Failed to register webhook with HeyGen.',
            }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to register webhook',
        }
      }
    },
  })
}
