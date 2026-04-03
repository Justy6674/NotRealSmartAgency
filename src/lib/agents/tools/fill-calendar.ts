import { tool } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand, PostPlatform } from '@/types/database'
import { getComplianceRules } from '../compliance-rules'

// ─── Constants ────────────────────────────────────────────────────────────────

const AEST_OFFSET_HOURS = 10 // UTC+10 (AEST — not AEDT)

/** Optimal posting slots in AEST hours */
const WEEKDAY_SLOTS = [9, 12, 17] // 9am, 12pm, 5pm
const WEEKEND_SLOTS = [10, 14]     // 10am, 2pm

const PLATFORM_EMOJIS: Record<PostPlatform, string> = {
  instagram: '📱',
  facebook: '📘',
  linkedin: '💼',
  twitter: '🐦',
  tiktok: '🎵',
  youtube: '🎬',
}

const CONTENT_TYPE_DISTRIBUTION: Record<string, number> = {
  educational: 0.40,
  promotional: 0.20,
  behind_the_scenes: 0.15,
  social_proof: 0.15,
  engagement: 0.10,
}

const MAX_POSTS_PER_LLM_CALL = 10

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PostBatchSchema = z.object({
  posts: z.array(z.object({
    platform: z.enum(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']),
    caption: z.string(),
    hashtags: z.array(z.string()),
    content_type: z.enum(['educational', 'promotional', 'behind_the_scenes', 'social_proof', 'engagement', 'trending']),
    scheduled_at: z.string().describe('ISO datetime string'),
  })),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPlatforms(brand: Brand): PostPlatform[] {
  const all: PostPlatform[] = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']
  const urls = brand.social_urls ?? {}

  // If brand has social URLs configured, only use those platforms
  const configured = all.filter((p) => {
    const key = p === 'twitter' ? 'x' : p
    return urls[p] || urls[key] || urls[`${p}_url`]
  })

  return configured.length > 0 ? configured : all
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

function buildPostSlots(
  weeks: number,
  postsPerWeek: number,
  platforms: PostPlatform[],
  existingDates: Set<string>,
): { scheduledAt: string; platform: PostPlatform }[] {
  const slots: { scheduledAt: string; platform: PostPlatform }[] = []
  const now = new Date()

  // Start from next Monday
  const startDate = new Date(now)
  const dayOfWeek = startDate.getUTCDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
  startDate.setUTCDate(startDate.getUTCDate() + daysUntilMonday)
  startDate.setUTCHours(0, 0, 0, 0)

  let platformIndex = 0

  for (let week = 0; week < weeks; week++) {
    let weekPostCount = 0

    for (let dayOffset = 0; dayOffset < 7 && weekPostCount < postsPerWeek; dayOffset++) {
      const day = new Date(startDate)
      day.setUTCDate(day.getUTCDate() + week * 7 + dayOffset)

      const timeSlots = isWeekend(day) ? WEEKEND_SLOTS : WEEKDAY_SLOTS

      for (const hour of timeSlots) {
        if (weekPostCount >= postsPerWeek) break

        // Convert AEST hour to UTC
        const utcHour = hour - AEST_OFFSET_HOURS
        day.setUTCHours(utcHour < 0 ? utcHour + 24 : utcHour, 0, 0, 0)
        if (utcHour < 0) {
          day.setUTCDate(day.getUTCDate() - 1)
        }

        const isoStr = day.toISOString()
        const dateKey = isoStr.slice(0, 13) // YYYY-MM-DDTHH — hourly granularity

        // Skip if a post already exists in this slot
        if (existingDates.has(dateKey)) {
          // Reset date if we adjusted it
          if (utcHour < 0) day.setUTCDate(day.getUTCDate() + 1)
          continue
        }

        const platform = platforms[platformIndex % platforms.length]
        platformIndex++

        slots.push({
          scheduledAt: isoStr,
          platform,
        })
        weekPostCount++

        // Reset date if we adjusted it
        if (utcHour < 0) day.setUTCDate(day.getUTCDate() + 1)
      }
    }
  }

  return slots
}

function buildBrandPromptContext(brand: Brand): string {
  const parts: string[] = []

  parts.push(`Brand: ${brand.name}`)
  if (brand.niche) parts.push(`Niche: ${brand.niche}`)
  if (brand.tagline) parts.push(`Tagline: ${brand.tagline}`)
  if (brand.description) parts.push(`Description: ${brand.description}`)

  const tone = brand.tone_of_voice
  if (tone) {
    parts.push(`Brand voice: ${tone.formality ?? 'conversational'}, ${tone.humour ?? 'light'} humour`)
    if (tone.keywords?.length) parts.push(`Voice keywords: ${tone.keywords.join(', ')}`)
    if (tone.avoid_words?.length) parts.push(`Avoid words: ${tone.avoid_words.join(', ')}`)
  }

  const audience = brand.target_audience
  if (audience) {
    if (audience.demographics) parts.push(`Target audience: ${audience.demographics}`)
    if (audience.pain_points?.length) parts.push(`Pain points: ${audience.pain_points.join(', ')}`)
    if (audience.desires?.length) parts.push(`Desires: ${audience.desires.join(', ')}`)
  }

  if (brand.content_pillars?.length) {
    parts.push(`Content pillars: ${brand.content_pillars.join(', ')}`)
  }

  if (brand.products_services?.length) {
    const products = brand.products_services
      .map((p) => `${p.name}${p.description ? ` — ${p.description}` : ''}`)
      .join('; ')
    parts.push(`Products/services: ${products}`)
  }

  return parts.join('\n')
}

function formatWeekSummary(
  posts: { platform: PostPlatform; caption: string; scheduled_at: string }[],
  weekNum: number,
): string {
  if (posts.length === 0) return ''

  const sorted = [...posts].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const firstDate = new Date(sorted[0].scheduled_at)
  const lastDate = new Date(sorted[sorted.length - 1].scheduled_at)

  const formatShort = (d: Date) => `${d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const lines = sorted.map((p) => {
    const d = new Date(p.scheduled_at)
    const dayName = dayNames[d.getDay()]
    const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' })
    const emoji = PLATFORM_EMOJIS[p.platform] ?? '📝'
    const platformLabel = p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
    const preview = p.caption.length > 60 ? p.caption.slice(0, 57) + '...' : p.caption
    // Remove leading quotes if present
    const cleanPreview = preview.replace(/^["']|["']$/g, '')
    return `- ${dayName} ${time}: ${emoji} ${platformLabel} — "${cleanPreview}"`
  })

  return `### Week ${weekNum} (${formatShort(firstDate)}–${formatShort(lastDate)})\n${lines.join('\n')}`
}

// ─── Tool Factory ─────────────────────────────────────────────────────────────

export function createFillCalendarTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null,
) {
  return tool({
    description:
      'Auto-generate social media posts and fill the content calendar for the next 1-4 weeks. Creates draft posts with optimally timed slots across all configured platforms.',
    inputSchema: z.object({
      weeks: z.number().min(1).max(4).default(2).describe('Number of weeks to fill'),
      posts_per_week: z.number().min(3).max(14).default(5).describe('Posts per week'),
      platforms: z
        .array(z.enum(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']))
        .optional()
        .describe('Platforms to post to. Defaults to all configured.'),
    }),
    execute: async ({ weeks, posts_per_week, platforms: requestedPlatforms }) => {
      // 1. Fetch brand
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single()

      if (brandError || !brand) {
        return { success: false, error: 'Could not load brand. Please select a brand first.' }
      }

      // 2. Fetch existing scheduled posts for the next 4 weeks
      const now = new Date()
      const fourWeeksOut = new Date(now)
      fourWeeksOut.setDate(fourWeeksOut.getDate() + 28)

      const { data: existingPosts } = await supabase
        .from('scheduled_posts')
        .select('scheduled_at')
        .eq('brand_id', brandId)
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', fourWeeksOut.toISOString())
        .not('status', 'eq', 'cancelled')

      const existingDates = new Set(
        (existingPosts ?? []).map((p: { scheduled_at: string }) => p.scheduled_at.slice(0, 13)),
      )

      // 3. Determine platforms
      const targetPlatforms: PostPlatform[] = (requestedPlatforms as PostPlatform[] | undefined) ?? detectPlatforms(brand as Brand)
      if (targetPlatforms.length === 0) {
        return { success: false, error: 'No social platforms configured for this brand. Add social URLs in brand settings.' }
      }

      // 4. Calculate post slots
      const slots = buildPostSlots(weeks, posts_per_week, targetPlatforms, existingDates)
      if (slots.length === 0) {
        return { success: false, error: 'All available time slots already have posts scheduled. Try a later date range.' }
      }

      // 5. Build prompt context
      const brandContext = buildBrandPromptContext(brand as Brand)
      const complianceFlags = (brand as Brand).compliance_flags
      const isRegulated = complianceFlags?.ahpra || complianceFlags?.tga
      const complianceSection = isRegulated ? getComplianceRules(complianceFlags) : ''

      // 6. Generate posts in batches
      const allGeneratedPosts: {
        platform: PostPlatform
        caption: string
        hashtags: string[]
        content_type: string
        scheduled_at: string
      }[] = []

      // Split slots into batches
      const batches: typeof slots[] = []
      for (let i = 0; i < slots.length; i += MAX_POSTS_PER_LLM_CALL) {
        batches.push(slots.slice(i, i + MAX_POSTS_PER_LLM_CALL))
      }

      for (const batch of batches) {
        const slotDescriptions = batch
          .map((s, i) => `${i + 1}. ${s.platform} at ${s.scheduledAt}`)
          .join('\n')

        try {
          const { object } = await generateObject({
            model: gateway('anthropic/claude-sonnet-4'),
            system: `You are a social media strategist for ${brand.name} (${brand.niche}).

${brandContext}

${complianceSection}

Generate social media posts for the given time slots. Follow these rules:

- Rotate content types: educational (40%), promotional (20%), behind the scenes (15%), social proof (15%), engagement (10%)
- Match platform best practices:
  - TikTok: short punchy hooks, trend-aware, casual tone
  - LinkedIn: professional insights, thought leadership, value-driven
  - Instagram: visual-first captions, storytelling, emoji-friendly
  - Facebook: community-focused, shareable, conversational
  - YouTube: SEO-optimised descriptions, timestamps if applicable
  - X/Twitter: concise, thread-worthy, opinion-led
- Include 5-15 relevant hashtags per post
- Each post must be unique — no repetition of topics or hooks
- Write in Australian English
${isRegulated ? '- AHPRA/TGA brand: NO testimonials, NO guaranteed results, NO before/after claims, include risk information where relevant' : ''}
- Do NOT include the hashtags inside the caption text — put them in the hashtags array only`,
            prompt: `Generate ${batch.length} social media posts for these exact time slots:\n\n${slotDescriptions}\n\nReturn exactly ${batch.length} posts, one for each slot, matching the platform and scheduled_at exactly.`,
            schema: PostBatchSchema,
          })

          // Map generated posts back to their slots
          for (let i = 0; i < object.posts.length && i < batch.length; i++) {
            const generated = object.posts[i]
            const slot = batch[i]
            allGeneratedPosts.push({
              platform: slot.platform,
              caption: generated.caption,
              hashtags: generated.hashtags.map((h) => h.replace(/^#/, '')),
              content_type: generated.content_type,
              scheduled_at: slot.scheduledAt,
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Content generation failed'
          return {
            success: false,
            error: `Failed to generate content batch: ${message}`,
            posts_generated_before_error: allGeneratedPosts.length,
          }
        }
      }

      // 7. Insert all posts as drafts
      const insertRows = allGeneratedPosts.map((post) => ({
        user_id: userId,
        brand_id: brandId,
        platform: post.platform,
        caption: post.caption,
        hashtags: post.hashtags,
        scheduled_at: post.scheduled_at,
        status: 'draft' as const,
        metadata: {
          content_type: post.content_type,
          generated_by: 'fill_calendar',
          conversation_id: conversationId,
        },
      }))

      const { error: insertError } = await supabase
        .from('scheduled_posts')
        .insert(insertRows)

      if (insertError) {
        return { success: false, error: `Failed to save posts: ${insertError.message}` }
      }

      // 8. Build summary
      const totalPosts = allGeneratedPosts.length

      // Group by week
      const weekGroups: Record<number, typeof allGeneratedPosts> = {}
      for (const post of allGeneratedPosts) {
        const postDate = new Date(post.scheduled_at)
        const startOfSlots = new Date(allGeneratedPosts[0].scheduled_at)
        const weekNum = Math.floor((postDate.getTime() - startOfSlots.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
        if (!weekGroups[weekNum]) weekGroups[weekNum] = []
        weekGroups[weekNum].push(post)
      }

      const weekSummaries = Object.entries(weekGroups)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([weekNum, posts]) => formatWeekSummary(posts, Number(weekNum)))
        .join('\n\n')

      // Content mix breakdown
      const typeCounts: Record<string, number> = {}
      for (const post of allGeneratedPosts) {
        typeCounts[post.content_type] = (typeCounts[post.content_type] ?? 0) + 1
      }
      const contentMix = Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => {
          const pct = Math.round((count / totalPosts) * 100)
          const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          return `- ${label}: ${count} posts (${pct}%)`
        })
        .join('\n')

      const platformList = [...new Set(allGeneratedPosts.map((p) => p.platform))].join(', ')

      return {
        success: true,
        summary: `## Calendar Filled: ${totalPosts} posts across ${weeks} weeks

${weekSummaries}

### Content Mix
${contentMix}

### Platforms
${platformList}

All ${totalPosts} posts saved as drafts. View them in **Calendar** → /agency/calendar
Say **"schedule all"** to make them live, or edit individual posts in the calendar.`,
        total_posts: totalPosts,
        weeks,
        platforms: [...new Set(allGeneratedPosts.map((p) => p.platform))],
      }
    },
  })
}
