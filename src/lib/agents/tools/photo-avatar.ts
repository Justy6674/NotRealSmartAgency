import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, generatePhotoAvatar } from '@/lib/heygen/client'

export function createGeneratePhotoAvatarTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Generate an AI photo avatar using HeyGen. Creates a realistic headshot from a text description — useful for creating brand spokespeople, social media profiles, or video avatars without needing a real photo.',
    inputSchema: z.object({
      age: z
        .string()
        .optional()
        .describe('Age range, e.g. "young", "middle-aged", "elderly"'),
      gender: z
        .string()
        .optional()
        .describe('Gender, e.g. "male", "female"'),
      ethnicity: z
        .string()
        .optional()
        .describe('Ethnicity/appearance description'),
      pose: z
        .string()
        .optional()
        .describe('Pose description, e.g. "front-facing", "slight-left"'),
      style: z
        .string()
        .optional()
        .describe('Style, e.g. "professional", "casual", "corporate"'),
      appearance: z
        .string()
        .optional()
        .describe('Additional appearance details — hair, clothing, expression'),
    }),
    execute: async ({ age, gender, ethnicity, pose, style, appearance }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const result = await generatePhotoAvatar(apiKey, {
          age,
          gender,
          ethnicity,
          pose,
          style,
          appearance,
        })

        if (!result) {
          return {
            success: false,
            error:
              'Photo avatar generation failed. Check your HeyGen credits and API key.',
          }
        }

        return {
          success: true,
          photo_avatar_id: result.photo_avatar_id,
          image_url: result.image_url,
          message: `Photo avatar generated successfully. You can use this avatar ID (${result.photo_avatar_id}) when creating videos.\n\nPreview: ${result.image_url}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate photo avatar with HeyGen',
        }
      }
    },
  })
}
