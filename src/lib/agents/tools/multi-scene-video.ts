import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey } from '@/lib/heygen/client'

export function createMultiSceneVideoTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Create a multi-scene avatar video with different scripts, backgrounds, or camera angles per scene. Each scene can have its own avatar, voice, and background.',
    inputSchema: z.object({
      title: z.string().describe('Video title'),
      scenes: z
        .array(
          z.object({
            script: z.string().describe('Script for this scene'),
            avatar_id: z
              .string()
              .optional()
              .describe('Avatar ID (uses brand default if not specified)'),
            voice_id: z
              .string()
              .optional()
              .describe('Voice ID (uses brand default if not specified)'),
            background_colour: z
              .string()
              .optional()
              .describe('Hex colour for background (default #ffffff)'),
          })
        )
        .min(1)
        .max(50)
        .describe('Array of scenes (1-50)'),
      dimension: z
        .object({
          width: z.number().default(1920),
          height: z.number().default(1080),
        })
        .optional(),
    }),
    execute: async ({ title, scenes, dimension }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      // Fetch brand video preferences for fallback avatar/voice
      const { data: brand } = await supabase
        .from('brands')
        .select('video_preferences')
        .eq('id', brandId)
        .single()

      const videoPrefs =
        (brand?.video_preferences as Record<string, string>) ?? {}

      const videoInputs = scenes.map((scene) => ({
        character: {
          type: 'avatar',
          avatar_id:
            scene.avatar_id || videoPrefs.avatar_id || 'default_avatar_id',
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          input_text: scene.script,
          voice_id:
            scene.voice_id || videoPrefs.accent || 'default_voice_id',
        },
        background: {
          type: 'color',
          value: scene.background_colour || '#ffffff',
        },
      }))

      try {
        const res = await fetch('https://api.heygen.com/v2/video/generate', {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_inputs: videoInputs,
            dimension: dimension ?? { width: 1920, height: 1080 },
            title,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          return {
            success: false,
            error: `HeyGen error: ${data.message ?? res.status}`,
          }
        }

        const videoId = data.data?.video_id

        // Save as output
        await supabase.from('outputs').insert({
          user_id: userId,
          brand_id: brandId,
          conversation_id: conversationId,
          output_type: 'video',
          title,
          content: scenes
            .map((s, i) => `Scene ${i + 1}: ${s.script.slice(0, 50)}`)
            .join('\n'),
          metadata: {
            job_id: videoId,
            provider: 'heygen',
            mode: 'multi_scene',
            status: 'processing',
            scene_count: scenes.length,
          },
        })

        return {
          success: true,
          video_id: videoId,
          scene_count: scenes.length,
          message: `Generating ${scenes.length}-scene video "${title}". Each scene renders separately then combines. Usually takes 3-8 minutes.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate multi-scene video with HeyGen',
        }
      }
    },
  })
}
