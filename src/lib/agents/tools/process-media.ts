/**
 * Director tool: process_media
 *
 * Turns an uploaded media item into draft social posts. This tool sits ON TOP
 * of the canonical media processing pipeline — it does NOT transcribe, tag,
 * or thumbnail the file itself; that's the pipeline's job. This tool's single
 * responsibility is caption generation + scheduled_posts drafting.
 *
 * Flow:
 *   1. Call runMediaProcessingPipeline (ensures thumbnail + transcription + AI
 *      tagging are persisted to media_items correctly)
 *   2. Read the now-guaranteed transcription from the updated row
 *   3. Generate platform-specific captions via AI gateway
 *   4. Create scheduled_posts drafts (if requested)
 *
 * History note: an earlier version of this tool wrote `status: 'transcribed'`
 * and `status: 'captions_generated'` to media_items, but `status` is not a
 * column on that table — PostgREST rejected the entire update, silently
 * dropping the transcription write as well. Fixed by delegating all row
 * updates to the shared pipeline and storing caption-generation state in
 * metadata.processing.captions instead.
 */

import { tool } from 'ai'
import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { getGatewayRouteProviderOptions, resolveAgentModelRoute } from '@/lib/ai/model-routing'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand, PostPlatform } from '@/types/database'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'
import { createDraftPost, type MixpostSyncOutcome } from '@/lib/posts/create-draft'

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

const VIBE_GUIDANCE: Record<string, string> = {
  funny: 'Use wordplay, witty observations, and light humour. Be entertaining but not cringy.',
  inspirational: 'Be uplifting and motivational. Use powerful language that inspires action.',
  informative: 'Be clear, factual, and educational. Lead with the key insight.',
  exciting: 'High energy! Use dynamic language, exclamation points sparingly, create urgency.',
  educational: 'Teach something valuable. Break down complex topics simply. Use numbered tips or steps.',
  provocative: 'Challenge assumptions. Ask thought-provoking questions. Take a bold stance.',
}

const HASHTAG_GUIDANCE: Record<string, string> = {
  trending_niche: 'Include 5 trending hashtags for this niche on this platform PLUS 5 niche-specific hashtags.',
  niche_only: 'Use only niche-specific hashtags relevant to the brand\'s content pillars. No generic trending tags.',
  branded_only: 'Use only branded hashtags from the brand\'s keywords. Create memorable brand-specific tags.',
  mix_all: 'Mix 3 trending hashtags + 3 niche hashtags + 2 branded hashtags from the brand\'s keywords.',
}

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
  _conversationId: string | null,
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
      style_settings: z
        .object({
          vibe: z
            .enum(['funny', 'inspirational', 'informative', 'exciting', 'educational', 'provocative'])
            .optional(),
          content_type: z.enum(['entertainment', 'education', 'inspiration', 'promotional']).optional(),
          hashtag_style: z.enum(['trending_niche', 'niche_only', 'branded_only', 'mix_all']).optional(),
        })
        .optional()
        .describe('Optional content style settings for caption generation'),
    }),
    execute: async ({ media_item_id, platforms, schedule, style_settings }) => {
      const targetPlatforms: Platform[] = (platforms as Platform[] | undefined) ?? [...PLATFORMS]
      const shouldSchedule = schedule !== false

      // Verify the media item belongs to the current user before running anything.
      const { data: ownership, error: ownershipError } = await supabase
        .from('media_items')
        .select('id')
        .eq('id', media_item_id)
        .eq('user_id', userId)
        .single()

      if (ownershipError || !ownership) {
        return {
          success: false,
          error: 'Media item not found. Make sure the ID is correct and the item belongs to you.',
        }
      }

      // ── Stage A: run the canonical processing pipeline ────────────────────
      // This guarantees thumbnail, transcription, and AI tagging are persisted
      // to media_items correctly. If the media has already been processed, the
      // pipeline re-uses the existing state instead of re-transcribing.
      const pipelineResult = await runMediaProcessingPipeline({ supabase, mediaItemId: media_item_id })

      if (!pipelineResult.success) {
        return {
          success: false,
          error: `Media processing failed: ${pipelineResult.error ?? 'unknown'}`,
          report: pipelineResult.report,
        }
      }

      if (!pipelineResult.transcription) {
        // Pipeline ran but transcription didn't land (too large, or Deepgram failure).
        return {
          success: false,
          error:
            pipelineResult.report.transcription.status === 'failed'
              ? `Transcription failed: ${pipelineResult.report.transcription.error}`
              : `Cannot generate captions: media has no transcription yet (${pipelineResult.report.transcription.error ?? 'not attempted'}).`,
          report: pipelineResult.report,
        }
      }

      const transcription = pipelineResult.transcription

      // ── Stage B: fetch brand context + updated media item for captioning ──
      const { data: brand } = await supabase.from('brands').select('*').eq('id', brandId).single()
      if (!brand) {
        return { success: false, error: 'Brand not found.' }
      }

      const { data: mediaItem } = await supabase
        .from('media_items')
        .select('file_name')
        .eq('id', media_item_id)
        .single()

      // ── Stage C: generate platform-specific captions ──────────────────────
      const brandContext = buildBrandContext(brand as Brand)

      const vibeGuidance =
        style_settings?.vibe && VIBE_GUIDANCE[style_settings.vibe] ? VIBE_GUIDANCE[style_settings.vibe] : undefined
      const hashtagGuidance =
        style_settings?.hashtag_style && HASHTAG_GUIDANCE[style_settings.hashtag_style]
          ? HASHTAG_GUIDANCE[style_settings.hashtag_style]
          : undefined
      const contentTypeText = style_settings?.content_type ?? undefined

      let content: z.infer<typeof PlatformContentSchema>
      try {
        const modelRoute = resolveAgentModelRoute({
          agentType: 'content',
          input: transcription,
          isHealthBrand: Boolean((brand as Brand).compliance_flags?.ahpra || (brand as Brand).compliance_flags?.tga),
          taskCapability: 'caption_hashtag_analysis',
        })
        const { object } = await generateObject({
          model: gateway(modelRoute.model),
          providerOptions: getGatewayRouteProviderOptions(modelRoute),
          system: `You are a social media content specialist for an Australian marketing agency. Write in Australian English. Generate platform-specific, publish-ready captions from video transcriptions.

${brandContext}
${vibeGuidance ? `\nTone: ${vibeGuidance}` : ''}
${contentTypeText ? `\nContent type: Frame this as ${contentTypeText} content.` : ''}
${hashtagGuidance ? `\nHashtag strategy: ${hashtagGuidance}` : ''}

Rules:
- Each platform has specific character limits and formatting norms
- Include relevant hashtags where appropriate
- Be engaging, authentic, and brand-aligned
- For AHPRA/TGA brands: NEVER make therapeutic claims or use testimonials`,
          prompt: `Generate social media captions for all 6 platforms from this video transcription:

${transcription}

File: ${mediaItem?.file_name ?? 'video'}`,
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

      // ── Stage D: create scheduled_posts drafts ────────────────────────────
      const createdPosts: Array<{ platform: string; id: string; mixpost: MixpostSyncOutcome }> = []
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      for (const platform of targetPlatforms) {
        const caption = getCaptionText(content, platform)
        const hashtags = getHashtags(content, platform)

        if (shouldSchedule) {
          try {
            const post = await createDraftPost({
              supabase,
              userId,
              brandId,
              platform: platform as PostPlatform,
              caption,
              hashtags,
              mediaItemIds: [media_item_id],
              scheduledAt,
              metadata: { source: 'process_media', source_media_id: media_item_id },
            })
            createdPosts.push({ platform, id: post.id, mixpost: post.mixpost })
          } catch (err) {
            console.warn(`[process-media] draft failed for ${platform}:`, err)
          }
        }
      }

      // ── Stage E: persist caption-gen state in metadata.processing.captions ─
      // Merge-don't-clobber so we don't lose the pipeline's report.
      const { data: currentItem } = await supabase
        .from('media_items')
        .select('metadata')
        .eq('id', media_item_id)
        .single()

      const existingMetadata = (currentItem?.metadata as Record<string, unknown>) ?? {}
      await supabase
        .from('media_items')
        .update({
          metadata: {
            ...existingMetadata,
            processing: {
              ...((existingMetadata.processing as Record<string, unknown>) ?? {}),
              captions: {
                status: 'ok',
                platforms: targetPlatforms,
                posts_created: createdPosts.length,
                scheduled: shouldSchedule,
                completed_at: new Date().toISOString(),
              },
            },
          },
        })
        .eq('id', media_item_id)

      // ── Stage F: build response summary ───────────────────────────────────
      const transcriptionSnippet =
        transcription.length > 200 ? transcription.slice(0, 200) + '...' : transcription

      const captionPreviews = targetPlatforms.map((p) => getCaptionPreview(content, p)).join('\n\n')

      return {
        success: true,
        media_item_id,
        transcription_snippet: transcriptionSnippet,
        platforms_processed: targetPlatforms,
        posts_created: createdPosts.length,
        scheduled: shouldSchedule,
        caption_previews: captionPreviews,
        processing_report: pipelineResult.report,
        message: shouldSchedule
          ? `Transcribed your video and wrote captions for ${targetPlatforms.length} platforms. ${createdPosts.length} draft posts created, scheduled for 24 hours from now. Say "publish all" to push them live, or tell me what to change.`
          : `Transcribed your video and wrote captions for ${targetPlatforms.length} platforms. Tell me what to change, or say "schedule these" to create draft posts.`,
      }
    },
  })
}
