import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, generateVideoAgent } from '@/lib/heygen/client'

export function createVideoAgentTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Create a full AI video from a prompt. HeyGen\'s Video Agent handles everything: scriptwriting, avatar selection, b-roll, stock footage, transitions, and editing. Best for quick, professional videos from a single idea.',
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          'What the video should be about — be specific about topic, audience, and tone'
        ),
      avatar_id: z
        .string()
        .optional()
        .describe(
          'Specific avatar ID to use (optional — Video Agent picks one if not specified)'
        ),
      voice_id: z
        .string()
        .optional()
        .describe('Specific voice ID (optional)'),
      duration_sec: z
        .number()
        .optional()
        .describe('Target duration in seconds (default 60)'),
      orientation: z
        .enum(['portrait', 'landscape'])
        .optional()
        .describe(
          'Video orientation — portrait for TikTok/Reels, landscape for YouTube/LinkedIn'
        ),
    }),
    execute: async ({ prompt, avatar_id, voice_id, duration_sec, orientation }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      // Fetch brand context to enrich the prompt
      const { data: brand } = await supabase
        .from('brands')
        .select('name, tone_of_voice, target_audience, content_pillars')
        .eq('id', brandId)
        .single()

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const brandContext = brand
        ? `\n\nBrand: ${brand.name}. ${
            brand.tone_of_voice
              ? `Voice: ${(brand.tone_of_voice as any).formality ?? ''}, ${(brand.tone_of_voice as any).humour ?? 'no'} humour.`
              : ''
          }`
        : ''
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/heygen`
        : undefined

      try {
        const result = await generateVideoAgent(apiKey, {
          prompt: prompt + brandContext,
          avatar_id,
          voice_id,
          duration_sec,
          orientation,
          callback_url: callbackUrl,
        })

        if (!result) {
          return {
            success: false,
            error:
              'Video Agent generation failed. Check your HeyGen credits and API key.',
          }
        }

        // Save as output so it appears in the library
        const { data: output } = await supabase
          .from('outputs')
          .insert({
            user_id: userId,
            brand_id: brandId,
            conversation_id: conversationId,
            output_type: 'video',
            title: `Video: ${prompt.slice(0, 80)}`,
            content: 'Generating full video with HeyGen Video Agent...',
            metadata: {
              job_id: result.video_id,
              provider: 'heygen',
              mode: 'video_agent',
              status: 'processing',
            },
          })
          .select('id')
          .single()

        return {
          success: true,
          video_id: result.video_id,
          output_id: output?.id,
          estimated_time: '3-10 minutes',
          message: `Creating your video now using HeyGen's Video Agent. It handles everything — script, visuals, b-roll, editing.\n\nPrompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"\nOrientation: ${orientation ?? 'portrait'}\n\nI'll save it to your output library when it's ready.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate video with HeyGen Video Agent',
        }
      }
    },
  })
}
