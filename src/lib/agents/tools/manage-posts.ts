import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPostSummary(post: {
  id: string
  platform: string
  caption: string
  scheduled_at: string | null
  status: string
}): string {
  const platformLabel = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
  const preview = post.caption.length > 60 ? post.caption.slice(0, 57) + '...' : post.caption
  const time = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString('en-AU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Sydney',
      })
    : 'unscheduled'
  return `- **${platformLabel}** (${time}): "${preview}" [${post.id.slice(0, 8)}]`
}

function startOfToday(): string {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString()
}

function endOfToday(): string {
  const now = new Date()
  now.setUTCHours(23, 59, 59, 999)
  return now.toISOString()
}

function endOfThisWeek(): string {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const endOfWeek = new Date(now)
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + daysUntilSunday)
  endOfWeek.setUTCHours(23, 59, 59, 999)
  return endOfWeek.toISOString()
}

// ─── Tool Factory ────────────────────────────────────────────────────────────

export function createManagePostsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Manage scheduled social media posts — schedule a draft for a specific time, approve all drafts to go live, or cancel a scheduled post. Always confirm with the user before making changes.',
    inputSchema: z.object({
      action: z.enum(['schedule', 'approve_all', 'cancel']).describe(
        'schedule = set a draft post to scheduled status with a time. approve_all = move all drafts to scheduled. cancel = cancel a specific post.',
      ),
      post_id: z
        .string()
        .uuid()
        .optional()
        .describe('Specific post ID for schedule or cancel actions'),
      scheduled_at: z
        .string()
        .optional()
        .describe('ISO datetime for scheduling (e.g. 2026-04-07T09:00:00+10:00)'),
      approve_scope: z
        .enum(['all_drafts', 'this_week', 'today'])
        .optional()
        .describe('Scope for approve_all action — which drafts to approve'),
    }),
    execute: async ({ action, post_id, scheduled_at, approve_scope }) => {
      // ── SCHEDULE ─────────────────────────────────────────────────────────
      if (action === 'schedule') {
        if (!post_id) {
          return { success: false, error: 'post_id is required for the schedule action. Ask the user which post to schedule.' }
        }
        if (!scheduled_at) {
          return { success: false, error: 'scheduled_at is required. Ask the user when they want this post published.' }
        }

        // Validate the datetime
        const scheduledDate = new Date(scheduled_at)
        if (isNaN(scheduledDate.getTime())) {
          return { success: false, error: `Invalid datetime: "${scheduled_at}". Use ISO format like 2026-04-07T09:00:00+10:00.` }
        }

        if (scheduledDate.getTime() < Date.now()) {
          return { success: false, error: 'Cannot schedule a post in the past. Please provide a future date and time.' }
        }

        // Fetch the post to verify it belongs to this brand
        const { data: post, error: fetchError } = await supabase
          .from('scheduled_posts')
          .select('id, platform, caption, status, scheduled_at')
          .eq('id', post_id)
          .eq('brand_id', brandId)
          .single()

        if (fetchError || !post) {
          return { success: false, error: `Post not found (${post_id.slice(0, 8)}). Check the ID and make sure it belongs to this brand.` }
        }

        if (post.status === 'published') {
          return { success: false, error: 'This post has already been published.' }
        }
        if (post.status === 'publishing') {
          return { success: false, error: 'This post is currently being published. Wait for it to complete.' }
        }

        // Update
        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update({
            status: 'scheduled',
            scheduled_at: scheduledDate.toISOString(),
          })
          .eq('id', post_id)

        if (updateError) {
          return { success: false, error: `Failed to schedule post: ${updateError.message}` }
        }

        const platformLabel = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
        const formattedTime = scheduledDate.toLocaleString('en-AU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Australia/Sydney',
        })

        return {
          success: true,
          message: `Scheduled **${platformLabel}** post for **${formattedTime}** (AEST).\n\nThe cron publisher will pick it up automatically when it's time.`,
          post_id,
          platform: post.platform,
          scheduled_at: scheduledDate.toISOString(),
        }
      }

      // ── APPROVE ALL ──────────────────────────────────────────────────────
      if (action === 'approve_all') {
        const scope = approve_scope ?? 'all_drafts'

        // Build query for draft posts
        let query = supabase
          .from('scheduled_posts')
          .select('id, platform, caption, scheduled_at, status')
          .eq('brand_id', brandId)
          .eq('status', 'draft')
          .order('scheduled_at', { ascending: true })

        // Apply scope filters
        if (scope === 'today') {
          query = query
            .gte('scheduled_at', startOfToday())
            .lte('scheduled_at', endOfToday())
        } else if (scope === 'this_week') {
          query = query
            .gte('scheduled_at', startOfToday())
            .lte('scheduled_at', endOfThisWeek())
        }

        const { data: drafts, error: fetchError } = await query

        if (fetchError) {
          return { success: false, error: `Failed to fetch drafts: ${fetchError.message}` }
        }

        if (!drafts || drafts.length === 0) {
          const scopeLabel = scope === 'all_drafts' ? '' : scope === 'this_week' ? ' for this week' : ' for today'
          return { success: false, error: `No draft posts found${scopeLabel}. Use /fill to generate content first.` }
        }

        // Check all drafts have a scheduled_at time
        const unscheduled = drafts.filter((d) => !d.scheduled_at)
        if (unscheduled.length > 0) {
          const summaries = unscheduled.map(formatPostSummary).join('\n')
          return {
            success: false,
            error: `${unscheduled.length} draft(s) have no scheduled time. Schedule them individually first:\n\n${summaries}`,
          }
        }

        // Update all drafts to scheduled
        const draftIds = drafts.map((d) => d.id)
        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update({ status: 'scheduled' })
          .in('id', draftIds)

        if (updateError) {
          return { success: false, error: `Failed to approve posts: ${updateError.message}` }
        }

        const scopeLabel =
          scope === 'all_drafts' ? '' : scope === 'this_week' ? ' (this week)' : ' (today)'

        // Group by platform for summary
        const platformCounts: Record<string, number> = {}
        for (const d of drafts) {
          platformCounts[d.platform] = (platformCounts[d.platform] ?? 0) + 1
        }
        const platformBreakdown = Object.entries(platformCounts)
          .map(([p, c]) => `${p.charAt(0).toUpperCase() + p.slice(1)}: ${c}`)
          .join(', ')

        const postList = drafts.map(formatPostSummary).join('\n')

        return {
          success: true,
          message: `Approved **${drafts.length}** draft posts${scopeLabel} and set them to scheduled.\n\n${postList}\n\n**Platforms:** ${platformBreakdown}\n\nThe cron publisher will post them at their scheduled times automatically.`,
          approved_count: drafts.length,
          scope,
        }
      }

      // ── CANCEL ───────────────────────────────────────────────────────────
      if (action === 'cancel') {
        if (!post_id) {
          return { success: false, error: 'post_id is required for the cancel action. Ask the user which post to cancel.' }
        }

        // Fetch the post
        const { data: post, error: fetchError } = await supabase
          .from('scheduled_posts')
          .select('id, platform, caption, status, scheduled_at')
          .eq('id', post_id)
          .eq('brand_id', brandId)
          .single()

        if (fetchError || !post) {
          return { success: false, error: `Post not found (${post_id.slice(0, 8)}). Check the ID and make sure it belongs to this brand.` }
        }

        if (post.status === 'published') {
          return { success: false, error: 'This post has already been published. It cannot be cancelled.' }
        }
        if (post.status === 'cancelled') {
          return { success: false, error: 'This post is already cancelled.' }
        }

        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update({ status: 'cancelled' })
          .eq('id', post_id)

        if (updateError) {
          return { success: false, error: `Failed to cancel post: ${updateError.message}` }
        }

        const platformLabel = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
        const preview = post.caption.length > 80 ? post.caption.slice(0, 77) + '...' : post.caption

        return {
          success: true,
          message: `Cancelled **${platformLabel}** post: "${preview}"`,
          post_id,
          platform: post.platform,
        }
      }

      return { success: false, error: `Unknown action: ${action}` }
    },
  })
}
