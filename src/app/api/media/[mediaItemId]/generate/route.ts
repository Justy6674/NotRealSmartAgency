export const maxDuration = 120

import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import type { Brand } from '@/types/database'

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
  _request: Request,
  { params }: { params: Promise<{ mediaItemId: string }> }
) {
  const { mediaItemId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

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

  if (!mediaItem.transcription) {
    return NextResponse.json({ error: 'Media must be transcribed first' }, { status: 400 })
  }

  const brand = mediaItem.brands as Brand

  // Build brand context for the AI
  // Using the exported function from prompt-builder (need to make it accessible)
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

  try {
    // Include visual analysis context if available
    const metadata = mediaItem.metadata as Record<string, unknown> | null
    const visualAnalysis = metadata?.visual_analysis as { summary?: string; products?: string[]; textOnScreen?: string[]; mood?: string } | undefined
    const visualContext = visualAnalysis
      ? `\n\nVisual content: ${visualAnalysis.summary ?? 'not available'}. Products visible: ${visualAnalysis.products?.join(', ') ?? 'none'}. Text on screen: ${visualAnalysis.textOnScreen?.join(', ') ?? 'none'}. Mood: ${visualAnalysis.mood ?? 'not analysed'}.`
      : ''

    const { object: content } = await generateObject({
      model: gateway('anthropic/claude-sonnet-4'),
      system: `You are a social media content specialist for an Australian marketing agency. Write in Australian English. Generate platform-specific, publish-ready captions from video transcriptions and visual analysis.

${brandContext}

Rules:
- Each platform has specific character limits and formatting norms
- Include relevant hashtags where appropriate
- Be engaging, authentic, and brand-aligned
- Reference what's VISIBLE in the video when visual analysis is available
- For AHPRA/TGA brands: NEVER make therapeutic claims or use testimonials`,
      prompt: `Generate social media captions for all 6 platforms from this video transcription:

${mediaItem.transcription}${visualContext}

File: ${mediaItem.file_name}`,
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

    const scheduledPosts = []
    for (const p of platforms) {
      const { data: post, error: postError } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: user.id,
          brand_id: brand.id,
          media_item_id: mediaItemId,
          platform: p.platform,
          caption: p.caption,
          hashtags: p.hashtags,
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default: 24h from now
          status: 'draft',
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
