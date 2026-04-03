import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createCreateVideoTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Generate an AI avatar video using HeyGen. The avatar will speak the script you provide. Use for brand videos, explainers, social content, and product demos.',
    inputSchema: z.object({
      script: z
        .string()
        .describe('The script/text for the avatar to speak'),
      title: z
        .string()
        .optional()
        .describe('Video title — defaults to first 50 chars of script'),
    }),
    execute: async ({ script, title }) => {
      // Fetch HeyGen API key
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('cached_data')
        .eq('user_id', userId)
        .eq('provider', 'heygen')
        .single()

      const apiKey = (integration?.cached_data?.api_key as string) ?? null

      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. To generate videos, get an API key from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      // Fetch brand video preferences
      const { data: brand } = await supabase
        .from('brands')
        .select('name, video_preferences')
        .eq('id', brandId)
        .single()

      const videoPrefs = (brand?.video_preferences as Record<string, string>) ?? {}
      const videoTitle =
        title ?? `${(brand?.name ?? 'Brand')} — ${script.slice(0, 50)}${script.length > 50 ? '...' : ''}`

      try {
        const res = await fetch('https://api.heygen.com/v2/video/generate', {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_inputs: [
              {
                character: {
                  type: 'avatar',
                  avatar_id: videoPrefs.avatar_id || 'default_avatar_id',
                  avatar_style: 'normal',
                },
                voice: {
                  type: 'text',
                  input_text: script,
                  voice_id: videoPrefs.accent || 'default_voice_id',
                },
                background: {
                  type: 'color',
                  value: '#ffffff',
                },
              },
            ],
            dimension: { width: 1920, height: 1080 },
            title: videoTitle,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          return {
            success: false,
            error: `HeyGen API error (${res.status}): ${data.message || data.error || 'Unknown error'}. Check your API key is valid and you have credits remaining.`,
          }
        }

        const videoId = data.data?.video_id

        // Save as output so it appears in the output library
        const { data: videoOutput } = await supabase
          .from('outputs')
          .insert({
            user_id: userId,
            brand_id: brandId,
            conversation_id: conversationId,
            output_type: 'video',
            title: videoTitle,
            content: script,
            metadata: {
              job_id: videoId,
              provider: 'heygen',
              status: 'processing',
            },
          })
          .select('id')
          .single()

        return {
          success: true,
          video_id: videoId,
          output_id: videoOutput?.id,
          title: videoTitle,
          estimated_time: '2-5 minutes',
          message: `I'm generating your video now. It usually takes 2-5 minutes for HeyGen to render it.\n\nTitle: "${videoTitle}"\nScript: "${script.slice(0, 100)}${script.length > 100 ? '...' : ''}"\n\nI'll save it to your output library once it's ready. You can check the status in your Outputs page.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate video with HeyGen',
        }
      }
    },
  })
}
