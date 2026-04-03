import { tool } from 'ai'
import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { transcribeFile } from '@/lib/transcription/transcribe'
import type { Brand } from '@/types/database'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'] as const
type Platform = (typeof PLATFORMS)[number]

const PlatformContentSchema = z.object({
  youtube: z.object({
    title: z.string().describe('YouTube title, max 60 chars'),
    description: z.string().describe('YouTube description, detailed, with CTAs'),
    tags: z.array(z.string()).describe('YouTube tags, up to 15'),
  }),
  tiktok: z.object({
    caption: z.string().describe('TikTok caption with hashtags, max 150 chars total'),
  }),
  instagram: z.object({
    caption: z.string().describe('Instagram caption, max 2200 chars'),
    hashtags: z.array(z.string()).describe('Instagram hashtags, max 30'),
  }),
  facebook: z.object({
    post: z.string().describe('Facebook post text, 40-80 words optimal'),
  }),
  linkedin: z.object({
    post: z.string().describe('LinkedIn professional post, max 1300 chars'),
  }),
  twitter: z.object({
    tweet: z.string().describe('X/Twitter tweet, max 280 chars'),
  }),
})

function buildBrandContext(brand: Brand): string {
  let ctx = `Brand: ${brand.name}\nNiche: ${brand.niche}\n`
  if (brand.tone_of_voice) {
    ctx += `Tone: ${brand.tone_of_voice.formality}, humour: ${brand.tone_of_voice.humour}\n`
  }
  if (brand.target_audience?.demographics) {
    ctx += `Audience: ${brand.target_audience.demographics}\n`
  }
  if (brand.content_pillars?.length) {
    ctx += `Pillars: ${brand.content_pillars.join(', ')}\n`
  }
  if (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) {
    ctx += `\nCOMPLIANCE: This is an AHPRA/TGA regulated brand. NO therapeutic claims, NO testimonials, NO before/after. Use safe language only.\n`
  }
  return ctx
}

function getCaptionText(content: z.infer<typeof PlatformContentSchema>, platform: Platform): string {
  switch (platform) {
    case 'youtube':
      return `${content.youtube.title}\n\n${content.youtube.description}`
    case 'tiktok':
      return content.tiktok.caption
    case 'instagram':
      return content.instagram.caption
    case 'facebook':
      return content.facebook.post
    case 'linkedin':
      return content.linkedin.post
    case 'twitter':
      return content.twitter.tweet
  }
}

function getHashtags(content: z.infer<typeof PlatformContentSchema>, platform: Platform): string[] {
  switch (platform) {
    case 'youtube':
      return content.youtube.tags
    case 'instagram':
      return content.instagram.hashtags
    default:
      return []
  }
}

function getCaptionPreview(content: z.infer<typeof PlatformContentSchema>, platform: Platform): string {
  const text = getCaptionText(content, platform)
  const preview = text.length > 120 ? text.slice(0, 120) + '...' : text
  const labels: Record<Platform, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    twitter: 'X (Twitter)',
    tiktok: 'TikTok',
    youtube: 'YouTube',
  }
  return `**${labels[platform]}:** ${preview}`
}

export function createProcessMediaTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Process an uploaded media item through the full pipeline: transcribe the video/audio, generate platform-specific captions, and save them as draft posts. Use this when the user wants to turn a video or audio file into social media content.',
    inputSchema: z.object({
      media_item_id: z.string().uuid().describe('The ID of the uploaded media item to process'),
      platforms: z
        .array(z.enum(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']))
        .optional()
        .describe('Platforms to generate captions for. Defaults to all 6.'),
      schedule: z
        .boolean()
        .optional()
        .describe('If true, save posts as drafts scheduled 24h from now. Default true.'),
    }),
    execute: async ({ media_item_id, platforms, schedule }) => {
      const targetPlatforms: Platform[] = (platforms as Platform[] | undefined) ?? [...PLATFORMS]
      const shouldSchedule = schedule !== false

      // 1. Fetch the media item
      const { data: mediaItem, error: mediaError } = await supabase
        .from('media_items')
        .select('*')
        .eq('id', media_item_id)
        .eq('user_id', userId)
        .single()

      if (mediaError || !mediaItem) {
        return {
          success: false,
          error: 'Media item not found. Make sure the ID is correct and the item belongs to you.',
        }
      }

      // 2. Fetch the brand for context
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single()

      if (!brand) {
        return { success: false, error: 'Brand not found.' }
      }

      // 3. Transcribe if not already done
      let transcription = mediaItem.transcription as string | null
      if (!transcription) {
        const storageUrl = mediaItem.storage_path
          ? supabase.storage.from('media').getPublicUrl(mediaItem.storage_path).data.publicUrl
          : (mediaItem.file_url as string | null)

        if (!storageUrl) {
          return { success: false, error: 'No file URL found for this media item. Cannot transcribe.' }
        }

        try {
          const result = await transcribeFile(storageUrl, mediaItem.file_name ?? 'media.mp4')
          transcription = result.text

          // Update the media item with the transcription
          await supabase
            .from('media_items')
            .update({
              transcription: result.text,
              transcription_model: result.model,
              duration_seconds: result.duration ?? null,
              status: 'transcribed',
            })
            .eq('id', media_item_id)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Transcription failed'
          return { success: false, error: `Transcription failed: ${message}` }
        }
      }

      // 4. Generate platform-specific captions
      const brandContext = buildBrandContext(brand as Brand)

      let content: z.infer<typeof PlatformContentSchema>
      try {
        const { object } = await generateObject({
          model: gateway('anthropic/claude-haiku-4-5-20251001'),
          system: `You are a social media content specialist for an Australian marketing agency. Write in Australian English. Generate platform-specific, publish-ready captions from video transcriptions.

${brandContext}

Rules:
- Each platform has specific character limits and formatting norms
- Include relevant hashtags where appropriate
- Be engaging, authentic, and brand-aligned
- For AHPRA/TGA brands: NEVER make therapeutic claims or use testimonials`,
          prompt: `Generate social media captions for all 6 platforms from this video transcription:

${transcription}

File: ${mediaItem.file_name ?? 'video'}`,
          schema: PlatformContentSchema,
        })
        content = object
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Caption generation failed'
        return {
          success: false,
          error: `Caption generation failed: ${message}`,
          transcription_snippet: transcription.slice(0, 200),
        }
      }

      // 5. Create scheduled_posts for each target platform
      const createdPosts: Array<{ platform: string; id: string }> = []
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      for (const platform of targetPlatforms) {
        const caption = getCaptionText(content, platform)
        const hashtags = getHashtags(content, platform)

        if (shouldSchedule) {
          const { data: post, error: postError } = await supabase
            .from('scheduled_posts')
            .insert({
              user_id: userId,
              brand_id: brandId,
              media_item_id: media_item_id,
              platform,
              caption,
              hashtags,
              scheduled_at: scheduledAt,
              status: 'draft',
            })
            .select('id')
            .single()

          if (!postError && post) {
            createdPosts.push({ platform, id: post.id })
          }
        }
      }

      // 6. Update media item status
      await supabase
        .from('media_items')
        .update({ status: 'captions_generated' })
        .eq('id', media_item_id)

      // 7. Build the response summary
      const transcriptionSnippet =
        transcription.length > 200 ? transcription.slice(0, 200) + '...' : transcription

      const captionPreviews = targetPlatforms
        .map((p) => getCaptionPreview(content, p))
        .join('\n\n')

      return {
        success: true,
        media_item_id,
        transcription_snippet: transcriptionSnippet,
        platforms_processed: targetPlatforms,
        posts_created: createdPosts.length,
        scheduled: shouldSchedule,
        caption_previews: captionPreviews,
        message: shouldSchedule
          ? `Transcribed your video and wrote captions for ${targetPlatforms.length} platforms. ${createdPosts.length} draft posts created, scheduled for 24 hours from now. Say "publish all" to push them live, or tell me what to change.`
          : `Transcribed your video and wrote captions for ${targetPlatforms.length} platforms. Tell me what to change, or say "schedule these" to create draft posts.`,
      }
    },
  })
}
