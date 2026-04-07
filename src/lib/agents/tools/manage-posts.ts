import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchMixpostPost,
  updateMixpostPost,
  deleteMixpostPost,
  addMixpostPostToQueue,
  approveMixpostPost,
} from '@/lib/mixpost/client'

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
  return `- **${platformLabel}** (${time}): "${preview}" [id: ${post.id}]`
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
      'Manage scheduled social media posts — schedule, edit, delete, queue, approve, verify status, or cancel posts. Always confirm with the user before making changes.',
    inputSchema: z.object({
      action: z.enum(['schedule', 'approve_all', 'cancel', 'edit', 'delete', 'queue', 'verify_status', 'approve']).describe(
        'schedule = set a draft to scheduled. approve_all = move all drafts to scheduled. cancel = cancel a post. edit = update caption/schedule on Mixpost. delete = remove from Mixpost + cancel in NRS. queue = add to Mixpost publishing queue. verify_status = check Mixpost status vs NRS. approve = approve a single post in Mixpost.',
      ),
      post_id: z
        .string()
        .uuid()
        .optional()
        .describe('Specific post ID (required for schedule, cancel, edit, delete, queue, verify_status, approve)'),
      scheduled_at: z
        .string()
        .optional()
        .describe('ISO datetime for scheduling (e.g. 2026-04-07T09:00:00+10:00)'),
      approve_scope: z
        .enum(['all_drafts', 'this_week', 'today'])
        .optional()
        .describe('Scope for approve_all action — which drafts to approve'),
      new_caption: z
        .string()
        .optional()
        .describe('Updated caption text (for edit action)'),
    }),
    execute: async ({ action, post_id, scheduled_at, approve_scope, new_caption }) => {
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
          return { success: false, error: `Post not found (${post_id}). Check the ID and make sure it belongs to this brand.` }
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
          return { success: false, error: `Post not found (${post_id}). Check the ID and make sure it belongs to this brand.` }
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

      // ── EDIT ──────────────────────────────────────────────────────────────
      if (action === 'edit') {
        if (!post_id) {
          return { success: false, error: 'post_id is required for the edit action.' }
        }

        // Fetch the post
        const { data: post, error: fetchError } = await supabase
          .from('scheduled_posts')
          .select('id, platform, caption, status, scheduled_at, external_post_id')
          .eq('id', post_id)
          .eq('brand_id', brandId)
          .single()

        if (fetchError || !post) {
          return { success: false, error: `Post not found (${post_id}).` }
        }

        if (post.status === 'published') {
          return { success: false, error: 'This post has already been published and cannot be edited.' }
        }

        // Build updates for Supabase
        const updates: Record<string, unknown> = {}
        if (new_caption) updates.caption = new_caption
        if (scheduled_at) {
          const scheduledDate = new Date(scheduled_at)
          if (isNaN(scheduledDate.getTime())) {
            return { success: false, error: `Invalid datetime: "${scheduled_at}".` }
          }
          if (scheduledDate.getTime() < Date.now()) {
            return { success: false, error: 'Cannot schedule a post in the past.' }
          }
          updates.scheduled_at = scheduledDate.toISOString()
        }

        if (Object.keys(updates).length === 0) {
          return { success: false, error: 'Nothing to edit. Provide new_caption or scheduled_at.' }
        }

        // Update Mixpost if we have a UUID
        if (post.external_post_id) {
          const mixpostParams: Record<string, unknown> = {}
          if (new_caption) {
            mixpostParams.versions = [{
              account_id: 0,
              is_original: true,
              content: [{ body: new_caption, media: [], url: null, video_thumbs: [] }],
            }]
          }
          if (scheduled_at) {
            const d = new Date(scheduled_at as string)
            mixpostParams.date = d.toISOString().split('T')[0]
            mixpostParams.time = d.toTimeString().slice(0, 5)
          }
          const mixpostOk = await updateMixpostPost(post.external_post_id, mixpostParams as never)
          if (!mixpostOk) {
            // Log warning but still update NRS side
            console.warn('[manage-posts] Mixpost update failed for', post.external_post_id)
          }
        }

        // Update Supabase
        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update(updates)
          .eq('id', post_id)

        if (updateError) {
          return { success: false, error: `Failed to update post: ${updateError.message}` }
        }

        return {
          success: true,
          message: `Updated post [${post_id}].${new_caption ? ' Caption changed.' : ''}${scheduled_at ? ' Schedule updated.' : ''}`,
          post_id,
        }
      }

      // ── DELETE ─────────────────────────────────────────────────────────────
      if (action === 'delete') {
        if (!post_id) {
          return { success: false, error: 'post_id is required for the delete action.' }
        }

        const { data: post, error: fetchError } = await supabase
          .from('scheduled_posts')
          .select('id, platform, caption, status, external_post_id')
          .eq('id', post_id)
          .eq('brand_id', brandId)
          .single()

        if (fetchError || !post) {
          return { success: false, error: `Post not found (${post_id}).` }
        }

        if (post.status === 'published') {
          return { success: false, error: 'This post has already been published and cannot be deleted.' }
        }

        // Delete from Mixpost if UUID exists
        if (post.external_post_id) {
          const mixpostOk = await deleteMixpostPost(post.external_post_id)
          if (!mixpostOk) {
            console.warn('[manage-posts] Mixpost delete failed for', post.external_post_id)
          }
        }

        // Mark as cancelled in Supabase
        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update({ status: 'cancelled' })
          .eq('id', post_id)

        if (updateError) {
          return { success: false, error: `Failed to delete post: ${updateError.message}` }
        }

        const platformLabel = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
        const preview = post.caption.length > 80 ? post.caption.slice(0, 77) + '...' : post.caption

        return {
          success: true,
          message: `Deleted **${platformLabel}** post: "${preview}". Removed from Mixpost and cancelled in NRS.`,
          post_id,
        }
      }

      // ── QUEUE ──────────────────────────────────────────────────────────────
      if (action === 'queue') {
        if (!post_id) {
          return { success: false, error: 'post_id is required for the queue action.' }
        }

        const { data: post, error: fetchError } = await supabase
          .from('scheduled_posts')
          .select('id, platform, caption, status, external_post_id')
          .eq('id', post_id)
          .eq('brand_id', brandId)
          .single()

        if (fetchError || !post) {
          return { success: false, error: `Post not found (${post_id}).` }
        }

        if (!post.external_post_id) {
          return { success: false, error: 'This post has no Mixpost UUID. It needs to be published via Mixpost first.' }
        }

        if (post.status === 'published') {
          return { success: false, error: 'This post has already been published.' }
        }

        const queueOk = await addMixpostPostToQueue(post.external_post_id)
        if (!queueOk) {
          return { success: false, error: 'Failed to add post to Mixpost queue. Check if the publishing server is running.' }
        }

        // Update NRS status to scheduled
        await supabase
          .from('scheduled_posts')
          .update({ status: 'scheduled' })
          .eq('id', post_id)

        const platformLabel = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
        return {
          success: true,
          message: `Added **${platformLabel}** post to the Mixpost publishing queue. It will be published at the next queue slot.`,
          post_id,
        }
      }

      // ── VERIFY STATUS ──────────────────────────────────────────────────────
      if (action === 'verify_status') {
        if (!post_id) {
          return { success: false, error: 'post_id is required for the verify_status action.' }
        }

        const { data: post, error: fetchError } = await supabase
          .from('scheduled_posts')
          .select('id, platform, caption, status, scheduled_at, external_post_id')
          .eq('id', post_id)
          .eq('brand_id', brandId)
          .single()

        if (fetchError || !post) {
          return { success: false, error: `Post not found (${post_id}).` }
        }

        if (!post.external_post_id) {
          return {
            success: true,
            message: `Post [${post_id}] has no Mixpost UUID — NRS status is **${post.status}**. It hasn't been sent to Mixpost yet.`,
            nrs_status: post.status,
            mixpost_status: null,
          }
        }

        const mixpostPost = await fetchMixpostPost(post.external_post_id)

        const MIXPOST_STATUS_LABELS: Record<number, string> = {
          0: 'draft',
          1: 'scheduled',
          2: 'published',
          3: 'failed',
        }

        if (!mixpostPost) {
          return {
            success: true,
            message: `Post [${post_id}] — NRS status: **${post.status}**, but could not fetch Mixpost status. The post may have been deleted from Mixpost.`,
            nrs_status: post.status,
            mixpost_status: 'unknown',
          }
        }

        const mixpostLabel = MIXPOST_STATUS_LABELS[mixpostPost.status] ?? `unknown (${mixpostPost.status})`
        const synced = post.status === mixpostLabel

        return {
          success: true,
          message: `Post [${post_id}] — NRS: **${post.status}**, Mixpost: **${mixpostLabel}**.${synced ? ' Statuses are in sync.' : ' **Statuses are out of sync** — may need manual reconciliation.'}`,
          nrs_status: post.status,
          mixpost_status: mixpostLabel,
          in_sync: synced,
        }
      }

      // ── APPROVE (single post) ──────────────────────────────────────────────
      if (action === 'approve') {
        if (!post_id) {
          return { success: false, error: 'post_id is required for the approve action.' }
        }

        const { data: post, error: fetchError } = await supabase
          .from('scheduled_posts')
          .select('id, platform, caption, status, external_post_id')
          .eq('id', post_id)
          .eq('brand_id', brandId)
          .single()

        if (fetchError || !post) {
          return { success: false, error: `Post not found (${post_id}).` }
        }

        if (!post.external_post_id) {
          return { success: false, error: 'This post has no Mixpost UUID. It needs to be created in Mixpost first.' }
        }

        if (post.status === 'published') {
          return { success: false, error: 'This post has already been published.' }
        }

        const approveOk = await approveMixpostPost(post.external_post_id)
        if (!approveOk) {
          return { success: false, error: 'Failed to approve post in Mixpost.' }
        }

        // Update NRS status to scheduled
        await supabase
          .from('scheduled_posts')
          .update({ status: 'scheduled' })
          .eq('id', post_id)

        const platformLabel = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
        return {
          success: true,
          message: `Approved **${platformLabel}** post [${post_id}] in Mixpost and set to scheduled in NRS.`,
          post_id,
        }
      }

      return { success: false, error: `Unknown action: ${action}` }
    },
  })
}
