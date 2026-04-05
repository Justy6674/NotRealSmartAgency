import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey } from '@/lib/heygen/client'

const BACKGROUND_COLOUR_MAP: Record<string, string> = {
  office: '#f5f0eb',
  studio: '#1a1a2e',
  casual: '#faf8f5',
  outdoor: '#e8f5e9',
  minimal: '#ffffff',
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildBrandVoiceContext(brand: Record<string, any>): string {
  const parts: string[] = []

  const tone = brand.tone_of_voice as Record<string, any> | null
  if (tone) {
    const toneDesc: string[] = []
    if (tone.formality) toneDesc.push(`${tone.formality} tone`)
    if (tone.humour && tone.humour !== 'none') toneDesc.push(`${tone.humour} humour`)
    if (toneDesc.length) parts.push(`Brand voice: ${toneDesc.join(', ')}.`)
    if (tone.keywords?.length) parts.push(`Use keywords: ${tone.keywords.join(', ')}.`)
    if (tone.avoid_words?.length) parts.push(`NEVER use: ${tone.avoid_words.join(', ')}.`)
  }

  const dna = brand.brand_dna_constraints as Record<string, any> | null
  if (dna) {
    if (dna.voice_rules) parts.push(`Voice rules: ${dna.voice_rules}.`)
    if (dna.banned_words?.length) parts.push(`Banned words: ${Array.isArray(dna.banned_words) ? dna.banned_words.join(', ') : dna.banned_words}.`)
    if (dna.content_philosophy) parts.push(`Content philosophy: ${dna.content_philosophy}.`)
    if (dna.never_do?.length) parts.push(`Never do: ${Array.isArray(dna.never_do) ? dna.never_do.join(', ') : dna.never_do}.`)
  }

  const audience = brand.target_audience as Record<string, any> | null
  if (audience) {
    if (audience.demographics) parts.push(`Target audience: ${audience.demographics}.`)
    if (audience.pain_points?.length) parts.push(`Audience pain points: ${Array.isArray(audience.pain_points) ? audience.pain_points.join(', ') : audience.pain_points}.`)
  }

  if (brand.content_pillars?.length) {
    parts.push(`Content pillars: ${brand.content_pillars.join(', ')}.`)
  }

  return parts.length ? parts.join(' ') : ''
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function createCreateVideoTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Generate an AI avatar video using HeyGen, styled to the brand\'s voice and tone. The avatar will speak the script you provide. Uses brand voice, target audience, and content pillars to guide script style. Use for brand videos, explainers, social content, and product demos.',
    inputSchema: z.object({
      script: z
        .string()
        .describe('The script/text for the avatar to speak'),
      title: z
        .string()
        .optional()
        .describe('Video title — defaults to first 50 chars of script'),
      avatar_id: z
        .string()
        .optional()
        .describe('HeyGen avatar ID — falls back to brand video_preferences'),
      voice_id: z
        .string()
        .optional()
        .describe('HeyGen voice ID — falls back to brand video_preferences'),
    }),
    execute: async ({ script, title, avatar_id, voice_id }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. To generate videos, get an API key from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      // Fetch brand video preferences + voice/audience context
      const { data: brand } = await supabase
        .from('brands')
        .select('name, video_preferences, tone_of_voice, brand_dna_constraints, target_audience, content_pillars, logo_url')
        .eq('id', brandId)
        .single()

      const videoPrefs = (brand?.video_preferences as Record<string, string>) ?? {}
      const brandVoice = brand ? buildBrandVoiceContext(brand) : ''
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
                  avatar_id: avatar_id || videoPrefs.avatar_id || 'default_avatar_id',
                  avatar_style: 'normal',
                },
                voice: {
                  type: 'text',
                  input_text: script,
                  voice_id: voice_id || videoPrefs.accent || 'default_voice_id',
                },
                background: {
                  type: 'color',
                  value: BACKGROUND_COLOUR_MAP[videoPrefs.background_preference ?? ''] ?? '#ffffff',
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
          brand_voice: brandVoice || undefined,
          message: `I'm generating your video now. It usually takes 2-5 minutes for HeyGen to render it.\n\nTitle: "${videoTitle}"\nScript: "${script.slice(0, 100)}${script.length > 100 ? '...' : ''}"${brandVoice ? `\n\n${brandVoice}` : ''}\n\nI'll save it to your output library once it's ready. You can check the status in your Outputs page.`,
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
