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
import {
  bookedTimes,
  isTaken,
  type BookedTimes,
  type WeeklyPostingTime,
} from '@/lib/posting-queue/next-free-time'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { listZernioQueues } from '@/lib/zernio/queue'
import { listZernioAccounts } from '@/lib/zernio/accounts'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'

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

/** One posting time, and the networks it posts to. */
export interface CalendarSlot {
  scheduledAt: string
  platform: PostPlatform
  /** The weekly time's id, or undefined when the week has no id to give. */
  slotId?: string
}

/**
 * The empty times in the owner's own week, soonest first.
 *
 * ── The two rules ──────────────────────────────────────────────────────
 * · Nothing invents a time. Every candidate is an occurrence of a time the
 *   owner set, converted through each time's own zone.
 * · A time with a post already on it is not empty. "Taken" is judged by the
 *   INSTANT, so a time the owner filled by hand — which carries no weekly-time
 *   id at all — is respected exactly as one the calendar filled.
 *
 * One time is stored as one row per connected network, so several rows share an
 * instant. They are ONE posting occasion going to several accounts, which is
 * why `postsPerWeek` counts distinct instants: asking for five posts a week and
 * getting twenty because four networks are connected is not what anybody meant.
 */
export function buildPostSlots(
  weeks: number,
  postsPerWeek: number,
  scheduleSlots: Array<WeeklyPostingTime & { platform: PostPlatform }>,
  taken: BookedTimes,
  now = new Date(),
): CalendarSlot[] {
  const horizon = new Date(now.getTime() + weeks * 7 * 86_400_000)
  const byInstant = new Map<string, CalendarSlot[]>()

  for (const slot of scheduleSlots) {
    let cursor = now
    while (true) {
      const occurrence = nextOccurrence(
        {
          day_of_week: slot.day_of_week,
          time: slot.time,
          timezone: slot.timezone ?? 'Australia/Brisbane',
        },
        cursor,
      )
      if (occurrence > horizon) break
      cursor = new Date(occurrence.getTime() + 1000)
      if (isTaken(slot.id, occurrence, taken)) continue
      const scheduledAt = occurrence.toISOString()
      const existing = byInstant.get(scheduledAt) ?? []
      // The same network twice on one instant would be two posts to one account
      // at one minute.
      if (existing.some((entry) => entry.platform === slot.platform)) continue
      existing.push({
        scheduledAt,
        platform: slot.platform,
        ...(slot.id ? { slotId: slot.id } : {}),
      })
      byInstant.set(scheduledAt, existing)
    }
  }

  const instants = [...byInstant.keys()].sort()
  const counts = new Map<number, number>()
  const chosen: CalendarSlot[] = []
  for (const instant of instants) {
    const week = Math.floor((Date.parse(instant) - now.getTime()) / (7 * 86_400_000))
    const count = counts.get(week) ?? 0
    if (count >= postsPerWeek) continue
    counts.set(week, count + 1)
    chosen.push(...(byInstant.get(instant) ?? []))
  }
  return chosen
}

/** The six networks this tool can write for. */
const WRITEABLE_PLATFORMS: PostPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
]

/**
 * The owner's week when it is kept with the publisher rather than in our table.
 *
 * A business publishing through the main connection sets its posting times on
 * the publisher's own schedule, so `posting_schedule_slots` is empty for it and
 * this tool would otherwise tell the owner they have no posting times minutes
 * after they set some. The times come back with no id — the column that would
 * carry one points at our table — so a post on one of them holds its minute
 * rather than a named time, which `buildPostSlots` already handles.
 *
 * Nothing is invented here either: an unset week comes back empty.
 */
async function weekFromPublisher(
  brand: Brand,
  requested: PostPlatform[] | undefined,
): Promise<Array<WeeklyPostingTime & { platform: PostPlatform }>> {
  const profileId = zernioProfileIdFromSocialUrls((brand as { social_urls?: unknown }).social_urls)
  if (!profileId) return []

  try {
    const view = await listZernioQueues({ profileId })
    const schedule = view.schedules[0] ?? null
    if (!schedule || schedule.slots.length === 0) return []

    let platforms: PostPlatform[] = requested ?? []
    if (platforms.length === 0) {
      const accounts = await listZernioAccounts({ profileId, status: 'connected' })
      platforms = [
        ...new Set(
          accounts
            .map((account) => canonicalSocialPlatform(account.platform) as PostPlatform)
            .filter((platform) => WRITEABLE_PLATFORMS.includes(platform)),
        ),
      ]
    }
    if (platforms.length === 0) return []

    const timezone = schedule.timezone || 'Australia/Brisbane'
    return schedule.slots.flatMap((slot) =>
      platforms.map((platform) => ({
        id: null,
        day_of_week: slot.dayOfWeek,
        time: slot.time,
        timezone,
        platform,
      })),
    )
  } catch (err) {
    // A week we cannot read is not a week that is empty. The caller says so in
    // words rather than filling a calendar off a failed lookup.
    console.error('[fill-calendar] posting times could not be read from the publisher:', err)
    return []
  }
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
        // `queue_slot_id` is read as well as the time, because a post can hold
        // a posting time two ways: it was given that time, or it simply sits on
        // that minute. Reading only the hour — which this used to do — let a
        // second post be written onto a minute that already had one.
        .select('platform, scheduled_at, queue_slot_id, status')
        .eq('brand_id', brandId)
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', fourWeeksOut.toISOString())
        .not('status', 'eq', 'cancelled'),
      ])

      const taken = bookedTimes(
        (existingPosts ?? []) as Array<{
          scheduled_at: string | null
          queue_slot_id: string | null
          status: string | null
        }>,
      )

      if (slotsError) {
        return { success: false, error: 'Could not load the posting times for this business.' }
      }
      const requested = requestedPlatforms as PostPlatform[] | undefined

      /*
       * The owner's week, from wherever they keep it.
       *
       * Times set on the schedule screen live in `posting_schedule_slots` and
       * carry an id, so a post given one of them owns it. A business publishing
       * through the main connection keeps its week with the publisher instead;
       * those times are just as real and just as much the owner's, they simply
       * have no id we may store, so a post on one of them holds the minute
       * rather than the time. Either way nothing here invents a time — an
       * empty week is answered with a sentence, never with a guess.
       */
      let scheduleSlots: Array<WeeklyPostingTime & { platform: PostPlatform }> = (configuredSlots ?? [])
        .map((slot: PostingScheduleSlot) => ({
          id: slot.id as string | null,
          day_of_week: slot.day_of_week,
          // Postgres hands back "09:00:00".
          time: String(slot.time ?? '09:00').slice(0, 5),
          timezone: slot.timezone ?? 'Australia/Brisbane',
          platform: slot.platform,
        }))
        .filter((slot) => !requested || requested.includes(slot.platform))

      if (scheduleSlots.length === 0) {
        scheduleSlots = await weekFromPublisher(brand as Brand, requested)
      }

      if (scheduleSlots.length === 0) {
        return {
          success: false,
          error:
            'No posting times are set for this business yet, so there is nowhere to put these posts. ' +
            'Set the times you want to post at first — Social → Schedule.',
        }
      }
      const targetPlatforms = [...new Set(scheduleSlots.map((slot) => slot.platform))]

      // 4. Fill the owner's own empty times only. `nextOccurrence` applies each
      // time's own zone — Brisbane is a fixed UTC+10 all year, a brand in a
      // daylight-saving zone moves with it.
      const slots = buildPostSlots(weeks, posts_per_week, scheduleSlots, taken, now)
      if (slots.length === 0) {
        return {
          success: false,
          error: 'Every one of your posting times over that stretch already has a post on it. Try a longer stretch, or add another time to your week.',
        }
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
        /** Absent when the time came from the publisher's own week. */
        queue_slot_id?: string
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
              ...(slot.slotId ? { queue_slot_id: slot.slotId } : {}),
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
          queueSlotId: post.queue_slot_id,
          contentType: post.content_type,
          metadata: {
            source: 'fill_calendar',
            created_by: 'Director',
            content_type: post.content_type,
            conversation_id: conversationId,
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
