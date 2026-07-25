export const maxDuration = 120

import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'
import type { Brand } from '@/types/database'

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaItemId: string }> }
) {
  const { mediaItemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Parse optional style query params
  const url = new URL(request.url)
  const vibe = url.searchParams.get('vibe') ?? undefined
  const contentType = url.searchParams.get('content_type') ?? undefined
  const hashtagStyle = url.searchParams.get('hashtag_style') ?? undefined
  const carouselMediaIdsRaw = url.searchParams.get('carousel_media_ids') ?? undefined
  const carouselMediaIds = carouselMediaIdsRaw
    ? carouselMediaIdsRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined

  // Fetch media item with brand
  const { data: mediaItem, error: mediaError } = await supabase
    .from('media_items')
    .select('*, brands(*)')
    .eq('id', mediaItemId)
    .eq('user_id', user.id)
    .single()

  if (mediaError || !mediaItem) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 })
  }

  // Allow generation from transcription, AI description, or just brand context + filename
  const hasTranscript = !!mediaItem.transcription
  const hasAIDescription = !!mediaItem.ai_description
  const hasTags = !!(mediaItem.tags as string[] | null)?.length
  if (!hasTranscript && !hasAIDescription && !hasTags) {
    return NextResponse.json(
      { error: 'Media is still being analysed by AI. Please wait a moment and try again.' },
      { status: 400 }
    )
  }

  const brand = mediaItem.brands as Brand

  // Build brand context for the AI
  let brandContext = ''
  if (brand) {
    brandContext = `Brand: ${brand.name}\nNiche: ${brand.niche}\n`
    if (brand.tone_of_voice) {
      brandContext += `Tone: ${brand.tone_of_voice.formality}, humour: ${brand.tone_of_voice.humour}\n`
    }
    if (brand.target_audience?.demographics) {
      brandContext += `Audience: ${brand.target_audience.demographics}\n`
    }
    if (brand.content_pillars?.length) {
      brandContext += `Pillars: ${brand.content_pillars.join(', ')}\n`
    }
    if (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) {
      brandContext += `\nCOMPLIANCE: This is an AHPRA/TGA regulated brand. NO therapeutic claims, NO testimonials, NO before/after. Use safe language only.\n`
    }
  }

  // Build style guidance strings
  const vibeGuidance = vibe && VIBE_GUIDANCE[vibe] ? VIBE_GUIDANCE[vibe] : undefined
  const hashtagGuidance = hashtagStyle && HASHTAG_GUIDANCE[hashtagStyle] ? HASHTAG_GUIDANCE[hashtagStyle] : undefined
  const contentTypeText = contentType ? contentType : undefined

  // Build carousel context if carousel_media_ids provided
  let carouselContext = ''
  if (carouselMediaIds?.length) {
    const { data: carouselItems } = await supabase
      .from('media_items')
      .select('id, metadata')
      .in('id', carouselMediaIds)
      .eq('user_id', user.id)

    if (carouselItems?.length) {
      const slideDescriptions = carouselMediaIds
        .map((id, idx) => {
          const item = carouselItems.find((ci) => ci.id === id)
          const meta = item?.metadata as Record<string, unknown> | null
          const va = meta?.visual_analysis as { summary?: string } | undefined
          return `Slide ${idx + 1}: ${va?.summary ?? 'no visual analysis available'}`
        })
        .join('. ')

      carouselContext = `This is a carousel post with ${carouselMediaIds.length} slides. Visual context: ${slideDescriptions}. Write ONE unified caption per platform that covers the story across all slides. Use slide progression language like 'Swipe to see...' or '→ Next slide'.`
    }
  }

  try {
    // Include visual analysis context if available (single media)
    const metadata = mediaItem.metadata as Record<string, unknown> | null
    const visualAnalysis = metadata?.visual_analysis as { summary?: string; products?: string[]; textOnScreen?: string[]; mood?: string } | undefined
    const visualContext = visualAnalysis
      ? `\n\nVisual content: ${visualAnalysis.summary ?? 'not available'}. Products visible: ${visualAnalysis.products?.join(', ') ?? 'none'}. Text on screen: ${visualAnalysis.textOnScreen?.join(', ') ?? 'none'}. Mood: ${visualAnalysis.mood ?? 'not analysed'}.`
      : ''

    // Format-aware guidance based on video duration
    const durationSeconds = mediaItem.duration_seconds as number | null
    const formatGuidance = durationSeconds && durationSeconds < 60
      ? '\nFORMAT: This is a SHORT-FORM video (<60s). Write hook-first, punchy captions optimised for TikTok and Instagram Reels. YouTube title should include "Shorts" or be Shorts-optimised. Keep energy high and front-load the hook.'
      : durationSeconds && durationSeconds > 120
      ? '\nFORMAT: This is a FULL-LENGTH video. Write SEO-optimised YouTube descriptions with timestamps/chapters if the transcript suggests segments. LinkedIn and Facebook get thoughtful, detailed captions. Prioritise discoverability.'
      : ''

    const { object: content } = await generateObject({
      model: gateway(getGatewayModel('agency')),
      providerOptions: getGatewayProviderOptions('agency'),
      system: `You are a social media content specialist for an Australian marketing agency. Write in Australian English. Generate platform-specific, publish-ready captions.

${brandContext}
${brand?.description ? `About: ${brand.description}\n` : ''}
${vibeGuidance ? `\nTone: ${vibeGuidance}` : ''}
${contentTypeText ? `\nContent type: Frame this as ${contentTypeText} content.` : ''}
${hashtagGuidance ? `\nHashtag strategy: ${hashtagGuidance}` : ''}
${carouselContext ? `\n${carouselContext}` : ''}
${formatGuidance}

Rules:
- Each platform has specific character limits and formatting norms
- Include relevant hashtags where appropriate
- Be engaging, authentic, and brand-aligned
- Reference what's VISIBLE in the video when visual analysis is available
- For AHPRA/TGA brands: NEVER make therapeutic claims or use testimonials
- If limited context is available, use the brand description, niche, and filename to write relevant content. Be creative but stay on-brand.
- ALWAYS produce all 6 platform outputs. Never skip one.`,
      prompt: `Generate social media captions for all 6 platforms for this ${(mediaItem.file_type as string).startsWith('image/') ? 'image' : 'video'} from ${brand?.name ?? 'a brand'}.

${mediaItem.transcription ? `Transcription:\n${mediaItem.transcription}\n` : ''}${mediaItem.ai_description ? `Description: ${mediaItem.ai_description}\n` : ''}${(mediaItem.tags as string[] | null)?.length ? `Tags: ${(mediaItem.tags as string[]).join(', ')}\n` : ''}${visualContext ? visualContext + '\n' : ''}
File: ${mediaItem.file_name}
${!mediaItem.transcription && !mediaItem.ai_description ? `\nNote: No transcription or AI description available yet. Use the brand context, tags, and filename to create engaging captions that match the brand\'s niche (${brand?.niche ?? 'general'}).` : ''}`,
      schema: PlatformContentSchema,
    })

    // Create scheduled_post records for each platform (status: draft)
    const platforms = [
      { platform: 'youtube', caption: `${content.youtube.title}\n\n${content.youtube.description}`, hashtags: content.youtube.tags },
      { platform: 'tiktok', caption: content.tiktok.caption, hashtags: [] },
      { platform: 'instagram', caption: content.instagram.caption, hashtags: content.instagram.hashtags },
      { platform: 'facebook', caption: content.facebook.post, hashtags: [] },
      { platform: 'linkedin', caption: content.linkedin.post, hashtags: [] },
      { platform: 'twitter', caption: content.twitter.tweet, hashtags: [] },
    ] as const

    const postType = carouselMediaIds?.length ? 'carousel' : 'single'
    const mediaItemIds = carouselMediaIds ?? []

    const scheduledPosts = []
    for (const p of platforms) {
      const { data: post, error: postError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: user.id,
          brand_id: brand.id,
          media_item_id: mediaItemId,
          media_item_ids: mediaItemIds,
          platform: p.platform,
          caption: p.caption,
          hashtags: p.hashtags,
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default: 24h from now
          status: 'draft',
          post_type: postType,
          content_type: contentType ?? null,
          metadata: {
            source: 'ai_generate',
            created_by: 'AI Generate',
            media_item_id: mediaItemId,
          },
        })
        .select()
        .single()

      if (!postError && post) scheduledPosts.push(post)
    }

    return NextResponse.json({ content, scheduledPosts, mediaItemId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Content generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
