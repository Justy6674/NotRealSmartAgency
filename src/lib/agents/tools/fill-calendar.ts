import { tool } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'
import type { Brand, PostPlatform, PostingScheduleSlot } from '@/types/database'
import { getComplianceRules } from '../compliance-rules'
import { createDraftPosts } from '@/lib/posts/create-draft'
import { loadState, selectBestArms, hasEnoughData, type BanditArm } from '@/lib/content-optimisation/bandit'
import { nextOccurrence } from '@/lib/posting-queue/assign-to-slot'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_EMOJIS: Record<PostPlatform, string> = {
  instagram: '📱',
  facebook: '📘',
  linkedin: '💼',
  twitter: '🐦',
  tiktok: '🎵',
  youtube: '🎬',
  bluesky: '🦋',
  mastodon: '🐘',
  pinterest: '📌',
  threads: '🧵',
  google_business: '📍',
}

const CONTENT_TYPE_DISTRIBUTION: Record<string, number> = {
  educational: 0.40,
  promotional: 0.20,
  behind_the_scenes: 0.15,
  social_proof: 0.15,
  engagement: 0.10,
}

const MAX_POSTS_PER_LLM_CALL = 10

/**
 * Build a content type distribution string for the LLM prompt.
 * If bandit state exists with enough data, uses Thompson Sampling
 * to determine the mix. Otherwise falls back to fixed percentages.
 */
function buildContentMixInstruction(
  banditArms: BanditArm[] | null,
): string {
  if (!banditArms || banditArms.length === 0) {
    // Fixed distribution fallback
    return 'Rotate content types: educational (40%), promotional (20%), behind the scenes (15%), social proof (15%), engagement (10%)'
  }

  // Count how often each content_type appears in the bandit's top picks
  const typeCounts: Record<string, number> = {}
  for (const arm of banditArms) {
    typeCounts[arm.content_type] = (typeCounts[arm.content_type] ?? 0) + 1
  }

  // Convert to percentages
  const total = banditArms.length
  const parts = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => {
      const pct = Math.round((count / total) * 100)
      const label = type.replace(/_/g, ' ')
      return `${label} (${pct}%)`
    })

  return `Rotate content types based on past performance data: ${parts.join(', ')}. These proportions reflect what has worked best for this brand.`
}

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

function buildPostSlots(
  weeks: number,
  postsPerWeek: number,
  scheduleSlots: PostingScheduleSlot[],
  existingDates: Set<string>,
  now = new Date(),
): { scheduledAt: string; platform: PostPlatform; slotId: string }[] {
  const horizon = new Date(now.getTime() + weeks * 7 * 86_400_000)
  const candidates: { scheduledAt: string; platform: PostPlatform; slotId: string }[] = []

  for (const slot of scheduleSlots) {
    let cursor = now
    while (true) {
      const occurrence = nextOccurrence(slot, cursor)
      if (occurrence > horizon) break
      const scheduledAt = occurrence.toISOString()
      const key = `${slot.platform}|${scheduledAt.slice(0, 13)}`
      if (!existingDates.has(key)) {
        candidates.push({ scheduledAt, platform: slot.platform, slotId: slot.id })
      }
      cursor = new Date(occurrence.getTime() + 1000)
    }
  }

  candidates.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  const counts = new Map<number, number>()
  return candidates.filter((slot) => {
    const week = Math.floor(
      (new Date(slot.scheduledAt).getTime() - now.getTime()) / (7 * 86_400_000),
    )
    const count = counts.get(week) ?? 0
    if (count >= postsPerWeek) return false
    counts.set(week, count + 1)
    return true
  })
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

      // 2. Fetch the owner's posting times and existing posts.
      const now = new Date()
      const fourWeeksOut = new Date(now)
      fourWeeksOut.setDate(fourWeeksOut.getDate() + 28)

      const [{ data: configuredSlots, error: slotsError }, { data: existingPosts }] = await Promise.all([
        supabase
          .from('posting_schedule_slots')
          .select('*')
          .eq('brand_id', brandId),
        supabase
        .from('scheduled_posts')
        .select('platform, scheduled_at')
        .eq('brand_id', brandId)
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', fourWeeksOut.toISOString())
        .not('status', 'eq', 'cancelled'),
      ])

      const existingDates = new Set(
        (existingPosts ?? []).map(
          (post: { platform: PostPlatform; scheduled_at: string }) =>
            `${post.platform}|${post.scheduled_at.slice(0, 13)}`,
        ),
      )

      if (slotsError) {
        return { success: false, error: 'Could not load the posting times for this business.' }
      }
      const requested = requestedPlatforms as PostPlatform[] | undefined
      const scheduleSlots = (configuredSlots ?? [])
        .filter((slot: PostingScheduleSlot) => !requested || requested.includes(slot.platform)) as PostingScheduleSlot[]
      if (scheduleSlots.length === 0) {
        return { success: false, error: 'No posting times are set for those accounts yet. Add posting times first.' }
      }
      const targetPlatforms = [...new Set(scheduleSlots.map((slot) => slot.platform))]

      // 4. Fill configured empty slots only. nextOccurrence applies each slot's
      // IANA timezone, including Sydney daylight-saving transitions.
      const slots = buildPostSlots(weeks, posts_per_week, scheduleSlots, existingDates, now)
      if (slots.length === 0) {
        return { success: false, error: 'All available time slots already have posts scheduled. Try a later date range.' }
      }

      // 5. Build prompt context
      const brandContext = buildBrandPromptContext(brand as Brand)
      const complianceFlags = (brand as Brand).compliance_flags
      const isRegulated = complianceFlags?.ahpra || complianceFlags?.tga
      const complianceSection = isRegulated ? getComplianceRules(complianceFlags) : ''

      // 5b. Check bandit state for data-driven content mix
      let banditArms: BanditArm[] | null = null
      try {
        const banditState = await loadState(supabase, brandId)
        if (banditState && hasEnoughData(banditState)) {
          banditArms = selectBestArms(banditState, slots.length, {
            platforms: targetPlatforms,
          })
        }
      } catch {
        // Bandit is optional — fall back to fixed distribution
      }
      const contentMixInstruction = buildContentMixInstruction(banditArms)

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
            model: gateway(getGatewayModel('agency')),
            providerOptions: getGatewayProviderOptions('agency'),
            system: `You are a social media strategist for ${brand.name} (${brand.niche}).

${brandContext}

${complianceSection}

Generate social media posts for the given time slots. Follow these rules:

- ${contentMixInstruction}
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

      // 7. Insert all posts as drafts — through createDraftPosts so each one
      // also lands in Mixpost. Bounded concurrency keeps a month-long calendar
      // from opening dozens of simultaneous Mixpost uploads on the VPS.
      const draftResults = await createDraftPosts(
        allGeneratedPosts.map((post) => ({
          supabase,
          userId,
          brandId,
          platform: post.platform as PostPlatform,
          caption: post.caption,
          hashtags: post.hashtags,
          scheduledAt: post.scheduled_at,
          contentType: post.content_type,
          metadata: {
            source: 'fill_calendar',
            created_by: 'Director',
            content_type: post.content_type,
            conversation_id: conversationId,
            queue_slot_id: slots.find(
              (slot) =>
                slot.platform === post.platform &&
                slot.scheduledAt === post.scheduled_at,
            )?.slotId,
          },
        })),
      )

      const failedDrafts = draftResults.filter((r): r is { error: string } => 'error' in r)
      if (failedDrafts.length === draftResults.length) {
        return { success: false, error: `Failed to save posts: ${failedDrafts[0]?.error ?? 'unknown error'}` }
      }

      const notInMixpost = draftResults.filter(
        (r) => !('error' in r) && r.mixpost !== 'synced',
      ).length

      // 8. Build summary — count what was actually saved, not what was written.
      const totalPosts = draftResults.length - failedDrafts.length

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
Say **"schedule all"** to make them live, or edit individual posts in the calendar.${
          failedDrafts.length > 0 ? `\n\n⚠️ ${failedDrafts.length} post(s) could not be saved: ${failedDrafts[0].error}` : ''
        }${
          notInMixpost > 0 ? `\n\nNote: ${notInMixpost} post(s) are still syncing to Mixpost and will appear in Review shortly.` : ''
        }`,
        total_posts: totalPosts,
        failed_posts: failedDrafts.length,
        not_yet_in_mixpost: notInMixpost,
        weeks,
        platforms: [...new Set(allGeneratedPosts.map((p) => p.platform))],
      }
    },
  })
}
