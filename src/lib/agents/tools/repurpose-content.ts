import { tool } from 'ai'
import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand } from '@/types/database'

const CONTENT_TYPES = ['clips', 'quotes', 'blog', 'newsletter', 'social_posts'] as const
type ContentType = (typeof CONTENT_TYPES)[number]

// --- Schemas ---

const ClipsSchema = z.object({
  clips: z.array(z.object({
    title: z.string(),
    hook: z.string().describe('First line / scroll-stopper'),
    transcript_excerpt: z.string().describe('The exact section of transcript to use'),
    start_keywords: z.string().describe('Keywords near the start of this segment'),
    platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts', 'linkedin']),
    estimated_seconds: z.number(),
    why_engaging: z.string(),
  })),
})

const QuotesSchema = z.object({
  quotes: z.array(z.object({
    text: z.string().describe('The exact quote, max 150 chars'),
    context: z.string().describe('What this quote is about'),
    visual_style: z.enum(['bold_text', 'minimal', 'gradient', 'brand_colours']),
    platform: z.enum(['instagram', 'linkedin', 'twitter', 'facebook']),
  })),
})

const BlogSchema = z.object({
  title: z.string(),
  meta_description: z.string().max(160),
  content: z.string().describe('Full markdown blog post, 800-1500 words'),
  tags: z.array(z.string()),
})

const NewsletterSchema = z.object({
  subject_line: z.string(),
  preview_text: z.string().max(100),
  body: z.string().describe('HTML-ready newsletter content with sections'),
  cta_text: z.string(),
  cta_url: z.string().optional(),
})

const SocialPostsSchema = z.object({
  posts: z.array(z.object({
    platform: z.enum(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']),
    caption: z.string(),
    hashtags: z.array(z.string()),
  })),
})

// --- Helpers ---

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
  if (brand.products_services?.length) {
    const names = brand.products_services.map((p) => p.name).join(', ')
    ctx += `Products/Services: ${names}\n`
  }
  if (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) {
    ctx += `\nCOMPLIANCE: This is an AHPRA/TGA regulated brand. NO therapeutic claims, NO testimonials, NO before/after. Use safe language only.\n`
  }
  return ctx
}

function buildComplianceNote(brand: Brand): string {
  if (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) {
    return '\n\nCRITICAL COMPLIANCE: This brand is AHPRA/TGA regulated. You MUST NOT include therapeutic claims, testimonials, before/after comparisons, guarantees, or misleading health statements. Use evidence-based, factual language only.'
  }
  return ''
}

const MODEL = gateway('anthropic/claude-sonnet-4')

// --- Generators ---

async function generateClips(
  transcription: string,
  brandCtx: string,
  complianceNote: string,
): Promise<z.infer<typeof ClipsSchema>> {
  const { object } = await generateObject({
    model: MODEL,
    system: `You are a viral video editor working for an Australian marketing agency. Write in Australian English.${complianceNote}`,
    prompt: `${brandCtx}

From this transcript, identify the 10-15 most engaging segments that would work as standalone short-form clips. Each should be 15-90 seconds, have a strong hook in the first 3 seconds, and work on the specified platform. Think: what would make someone stop scrolling?

Transcript:
${transcription}`,
    schema: ClipsSchema,
  })
  return object
}

async function generateQuotes(
  transcription: string,
  brandCtx: string,
  complianceNote: string,
): Promise<z.infer<typeof QuotesSchema>> {
  const { object } = await generateObject({
    model: MODEL,
    system: `You are a social media content designer for an Australian marketing agency. Write in Australian English.${complianceNote}`,
    prompt: `${brandCtx}

From this transcript, extract 8-10 quoteable moments that would work as standalone quote graphics. Each quote must be max 150 characters, punchy, and shareable.

Transcript:
${transcription}`,
    schema: QuotesSchema,
  })
  return object
}

async function generateBlog(
  transcription: string,
  brandCtx: string,
  complianceNote: string,
): Promise<z.infer<typeof BlogSchema>> {
  const { object } = await generateObject({
    model: MODEL,
    system: `You are a blog writer for an Australian marketing agency. Write in Australian English. Produce SEO-optimised, engaging long-form content.${complianceNote}`,
    prompt: `${brandCtx}

Turn this video transcript into a complete blog post (800-1500 words). Restructure the content for readability — don't just copy the transcript. Add an introduction, clear sections with headings, and a conclusion with a call to action.

Transcript:
${transcription}`,
    schema: BlogSchema,
  })
  return object
}

async function generateNewsletter(
  transcription: string,
  brandCtx: string,
  complianceNote: string,
): Promise<z.infer<typeof NewsletterSchema>> {
  const { object } = await generateObject({
    model: MODEL,
    system: `You are an email marketing specialist for an Australian marketing agency. Write in Australian English. Create engaging, scannable newsletter content.${complianceNote}`,
    prompt: `${brandCtx}

Turn this video transcript into an email newsletter. Include a compelling subject line, preview text, and structured body with sections. Keep it conversational and actionable.

Transcript:
${transcription}`,
    schema: NewsletterSchema,
  })
  return object
}

async function generateSocialPosts(
  transcription: string,
  brandCtx: string,
  complianceNote: string,
): Promise<z.infer<typeof SocialPostsSchema>> {
  const { object } = await generateObject({
    model: MODEL,
    system: `You are a social media content specialist for an Australian marketing agency. Write in Australian English. Generate platform-specific, publish-ready posts.${complianceNote}`,
    prompt: `${brandCtx}

From this transcript, create one optimised post for each platform: Instagram, Facebook, LinkedIn, X (Twitter), TikTok, and YouTube. Each post should match the platform's tone, format, and character limits. Include relevant hashtags.

Transcript:
${transcription}`,
    schema: SocialPostsSchema,
  })
  return object
}

// --- Main Tool ---

export function createRepurposeContentTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null,
) {
  return tool({
    description:
      'Repurpose a transcribed video or audio into a full content tree: short-form clips, quote graphics, blog post, email newsletter, and social media posts. Takes one piece of media and generates 20+ pieces of content from it.',
    inputSchema: z.object({
      media_item_id: z.string().uuid().describe('The transcribed media item to repurpose'),
      types: z
        .array(z.enum(['clips', 'quotes', 'blog', 'newsletter', 'social_posts']))
        .optional()
        .describe('Content types to generate. Defaults to all.'),
    }),
    execute: async ({ media_item_id, types }) => {
      const targetTypes: ContentType[] = (types as ContentType[] | undefined) ?? [...CONTENT_TYPES]

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

      // 2. Verify transcription exists
      const transcription = mediaItem.transcription as string | null
      if (!transcription) {
        return {
          success: false,
          error: 'This media item has no transcription yet. Process it first using the "Process Media" tool or upload and transcribe it from the Media Library.',
        }
      }

      // 3. Fetch the brand
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single()

      if (!brand) {
        return { success: false, error: 'Brand not found.' }
      }

      const brandCtx = buildBrandContext(brand as Brand)
      const complianceNote = buildComplianceNote(brand as Brand)
      const mediaTitle = (mediaItem.file_name as string) ?? 'Untitled media'

      // 4. Generate each content type
      const results: Record<string, unknown> = {}
      const savedOutputs: Array<{ type: string; id: string; title: string }> = []
      const draftPosts: Array<{ type: string; platform: string; id: string }> = []
      const errors: string[] = []

      for (const contentType of targetTypes) {
        try {
          switch (contentType) {
            case 'clips': {
              const clipData = await generateClips(transcription, brandCtx, complianceNote)
              results.clips = clipData.clips

              // Save as output
              const { data: output } = await supabase
                .from('outputs')
                .insert({
                  user_id: userId,
                  brand_id: brandId,
                  conversation_id: conversationId,
                  output_type: 'video_script',
                  title: `[Repurposed] Clip suggestions from "${mediaTitle}"`,
                  content: clipData.clips
                    .map((c, i) => `## Clip ${i + 1}: ${c.title}\n**Hook:** ${c.hook}\n**Platform:** ${c.platform} (~${c.estimated_seconds}s)\n**Why it works:** ${c.why_engaging}\n\n> ${c.transcript_excerpt}\n\n**Start keywords:** ${c.start_keywords}`)
                    .join('\n\n---\n\n'),
                  metadata: {
                    source_media_id: media_item_id,
                    repurpose_type: 'clips',
                    clip_count: clipData.clips.length,
                  },
                })
                .select('id')
                .single()

              if (output) savedOutputs.push({ type: 'clips', id: output.id, title: `${clipData.clips.length} clip suggestions` })

              // Create draft posts for each clip
              const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
              for (const clip of clipData.clips) {
                const platformMap: Record<string, string> = {
                  tiktok: 'tiktok',
                  instagram_reels: 'instagram',
                  youtube_shorts: 'youtube',
                  linkedin: 'linkedin',
                }
                const postPlatform = platformMap[clip.platform] ?? 'instagram'
                const { data: post } = await supabase
                  .from('scheduled_posts')
                  .insert({
                    user_id: userId,
                    brand_id: brandId,
                    media_item_id: media_item_id,
                    platform: postPlatform,
                    caption: `${clip.hook}\n\n${clip.transcript_excerpt}`,
                    hashtags: [],
                    scheduled_at: scheduledAt,
                    status: 'draft',
                  })
                  .select('id')
                  .single()
                if (post) draftPosts.push({ type: 'clip', platform: postPlatform, id: post.id })
              }
              break
            }

            case 'quotes': {
              const quoteData = await generateQuotes(transcription, brandCtx, complianceNote)
              results.quotes = quoteData.quotes

              const { data: output } = await supabase
                .from('outputs')
                .insert({
                  user_id: userId,
                  brand_id: brandId,
                  conversation_id: conversationId,
                  output_type: 'social_post',
                  title: `[Repurposed] Quote graphics from "${mediaTitle}"`,
                  content: quoteData.quotes
                    .map((q, i) => `## Quote ${i + 1}\n> "${q.text}"\n\n**Context:** ${q.context}\n**Style:** ${q.visual_style}\n**Platform:** ${q.platform}`)
                    .join('\n\n---\n\n'),
                  metadata: {
                    source_media_id: media_item_id,
                    repurpose_type: 'quotes',
                    quote_count: quoteData.quotes.length,
                  },
                })
                .select('id')
                .single()

              if (output) savedOutputs.push({ type: 'quotes', id: output.id, title: `${quoteData.quotes.length} quote graphics` })

              // Create draft posts for each quote
              const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
              for (const quote of quoteData.quotes) {
                const { data: post } = await supabase
                  .from('scheduled_posts')
                  .insert({
                    user_id: userId,
                    brand_id: brandId,
                    media_item_id: media_item_id,
                    platform: quote.platform,
                    caption: `"${quote.text}"`,
                    hashtags: [],
                    scheduled_at: scheduledAt,
                    status: 'draft',
                  })
                  .select('id')
                  .single()
                if (post) draftPosts.push({ type: 'quote', platform: quote.platform, id: post.id })
              }
              break
            }

            case 'blog': {
              const blogData = await generateBlog(transcription, brandCtx, complianceNote)
              results.blog = blogData

              const { data: output } = await supabase
                .from('outputs')
                .insert({
                  user_id: userId,
                  brand_id: brandId,
                  conversation_id: conversationId,
                  output_type: 'blog_article',
                  title: `[Repurposed] ${blogData.title}`,
                  content: blogData.content,
                  metadata: {
                    source_media_id: media_item_id,
                    repurpose_type: 'blog',
                    meta_description: blogData.meta_description,
                    tags: blogData.tags,
                    word_count: blogData.content.split(/\s+/).filter(Boolean).length,
                  },
                })
                .select('id')
                .single()

              if (output) savedOutputs.push({ type: 'blog', id: output.id, title: blogData.title })
              break
            }

            case 'newsletter': {
              const nlData = await generateNewsletter(transcription, brandCtx, complianceNote)
              results.newsletter = nlData

              const { data: output } = await supabase
                .from('outputs')
                .insert({
                  user_id: userId,
                  brand_id: brandId,
                  conversation_id: conversationId,
                  output_type: 'email_sequence',
                  title: `[Repurposed] Newsletter: ${nlData.subject_line}`,
                  content: nlData.body,
                  metadata: {
                    source_media_id: media_item_id,
                    repurpose_type: 'newsletter',
                    subject_line: nlData.subject_line,
                    preview_text: nlData.preview_text,
                    cta_text: nlData.cta_text,
                    cta_url: nlData.cta_url ?? null,
                  },
                })
                .select('id')
                .single()

              if (output) savedOutputs.push({ type: 'newsletter', id: output.id, title: nlData.subject_line })
              break
            }

            case 'social_posts': {
              const socialData = await generateSocialPosts(transcription, brandCtx, complianceNote)
              results.social_posts = socialData.posts

              const { data: output } = await supabase
                .from('outputs')
                .insert({
                  user_id: userId,
                  brand_id: brandId,
                  conversation_id: conversationId,
                  output_type: 'social_post',
                  title: `[Repurposed] Social posts from "${mediaTitle}"`,
                  content: socialData.posts
                    .map((p) => `## ${p.platform}\n${p.caption}\n\n${p.hashtags.length ? `#${p.hashtags.join(' #')}` : ''}`)
                    .join('\n\n---\n\n'),
                  metadata: {
                    source_media_id: media_item_id,
                    repurpose_type: 'social_posts',
                    platform_count: socialData.posts.length,
                  },
                })
                .select('id')
                .single()

              if (output) savedOutputs.push({ type: 'social_posts', id: output.id, title: `${socialData.posts.length} platform posts` })

              // Create draft posts
              const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              for (const post of socialData.posts) {
                const { data: scheduled } = await supabase
                  .from('scheduled_posts')
                  .insert({
                    user_id: userId,
                    brand_id: brandId,
                    media_item_id: media_item_id,
                    platform: post.platform,
                    caption: post.caption,
                    hashtags: post.hashtags,
                    scheduled_at: scheduledAt,
                    status: 'draft',
                  })
                  .select('id')
                  .single()
                if (scheduled) draftPosts.push({ type: 'social', platform: post.platform, id: scheduled.id })
              }
              break
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `${contentType} generation failed`
          errors.push(`${contentType}: ${message}`)
        }
      }

      // 5. Build summary
      const clipCount = Array.isArray(results.clips) ? (results.clips as unknown[]).length : 0
      const quoteCount = Array.isArray(results.quotes) ? (results.quotes as unknown[]).length : 0
      const socialCount = Array.isArray(results.social_posts) ? (results.social_posts as unknown[]).length : 0
      const totalPieces = clipCount + quoteCount + (results.blog ? 1 : 0) + (results.newsletter ? 1 : 0) + socialCount

      let summary = `## Content Tree from "${mediaTitle}"\n\n`

      if (results.clips) {
        const clips = results.clips as z.infer<typeof ClipsSchema>['clips']
        summary += `### Clips (${clips.length} suggested)\n`
        clips.forEach((c, i) => {
          summary += `${i + 1}. **Hook:** "${c.hook}" — ${c.platform.replace('_', ' ')}, ~${c.estimated_seconds}s\n`
        })
        summary += '\n'
      }

      if (results.quotes) {
        const quotes = results.quotes as z.infer<typeof QuotesSchema>['quotes']
        summary += `### Quote Graphics (${quotes.length})\n`
        quotes.forEach((q, i) => {
          summary += `${i + 1}. "${q.text}" — ${q.platform}\n`
        })
        summary += '\n'
      }

      if (results.blog) {
        const blog = results.blog as z.infer<typeof BlogSchema>
        const wordCount = blog.content.split(/\s+/).filter(Boolean).length
        summary += `### Blog Post\n**Title:** ${blog.title}\nSaved to outputs. [${wordCount.toLocaleString()} words]\n\n`
      }

      if (results.newsletter) {
        const nl = results.newsletter as z.infer<typeof NewsletterSchema>
        summary += `### Newsletter\n**Subject:** ${nl.subject_line}\nSaved to outputs.\n\n`
      }

      if (results.social_posts) {
        const posts = results.social_posts as z.infer<typeof SocialPostsSchema>['posts']
        summary += `### Social Posts (${posts.length} platforms)\nSaved as draft posts. View in Calendar.\n\n`
      }

      if (errors.length > 0) {
        summary += `### Errors\n${errors.map((e) => `- ${e}`).join('\n')}\n\n`
      }

      summary += `---\n**Total: ${totalPieces} pieces of content from one video.**\n${draftPosts.length} draft posts created.\nSay "schedule all" to queue them, or tell me what to change.`

      return {
        success: true,
        media_item_id,
        media_title: mediaTitle,
        types_generated: targetTypes.filter((t) => !errors.some((e) => e.startsWith(t))),
        total_pieces: totalPieces,
        saved_outputs: savedOutputs,
        draft_posts_created: draftPosts.length,
        errors: errors.length > 0 ? errors : undefined,
        summary,
      }
    },
  })
}
