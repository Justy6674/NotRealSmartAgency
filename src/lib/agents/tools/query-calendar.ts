import { tool } from 'ai'
import { userSafeError } from '@/lib/errors/user-safe'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

const PLATFORM_EMOJIS: Record<string, string> = {
  instagram: '📱',
  facebook: '📘',
  linkedin: '💼',
  twitter: '🐦',
  tiktok: '🎵',
  youtube: '🎬',
}

function getDateRange(period: string): { start: Date; end: Date; label: string } {
  const now = new Date()
  // Use AEST (UTC+10)
  const aestOffset = 10 * 60 * 60 * 1000
  const aestNow = new Date(now.getTime() + aestOffset)

  // Start of today in AEST
  const todayStart = new Date(Date.UTC(aestNow.getUTCFullYear(), aestNow.getUTCMonth(), aestNow.getUTCDate()))
  const todayStartUTC = new Date(todayStart.getTime() - aestOffset)

  switch (period) {
    case 'today': {
      const end = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000)
      return { start: todayStartUTC, end, label: 'Today' }
    }
    case 'this_week': {
      const day = aestNow.getUTCDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      const weekStart = new Date(todayStartUTC.getTime() + mondayOffset * 24 * 60 * 60 * 1000)
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      return { start: weekStart, end: weekEnd, label: 'This Week' }
    }
    case 'next_week': {
      const day = aestNow.getUTCDay()
      const mondayOffset = day === 0 ? 1 : 8 - day
      const weekStart = new Date(todayStartUTC.getTime() + mondayOffset * 24 * 60 * 60 * 1000)
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      return { start: weekStart, end: weekEnd, label: 'Next Week' }
    }
    case 'this_month': {
      const monthStart = new Date(Date.UTC(aestNow.getUTCFullYear(), aestNow.getUTCMonth(), 1))
      const monthStartUTC = new Date(monthStart.getTime() - aestOffset)
      const monthEnd = new Date(Date.UTC(aestNow.getUTCFullYear(), aestNow.getUTCMonth() + 1, 1))
      const monthEndUTC = new Date(monthEnd.getTime() - aestOffset)
      return { start: monthStartUTC, end: monthEndUTC, label: 'This Month' }
    }
    default:
      return getDateRange('this_week')
  }
}

function formatAestDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Sydney',
  })
}

export function createQueryCalendarTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Check the content calendar to see what posts are scheduled, drafted, or published. Use this when the user asks about upcoming posts, their schedule, or what content is planned.',
    inputSchema: z.object({
      period: z
        .enum(['today', 'this_week', 'next_week', 'this_month'])
        .default('this_week')
        .describe('Time period to check'),
      platform: z
        .enum(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'])
        .optional()
        .describe('Filter by platform'),
      status: z
        .enum(['draft', 'scheduled', 'published', 'failed'])
        .optional()
        .describe('Filter by post status'),
    }),
    execute: async ({ period, platform, status }) => {
      const { start, end, label } = getDateRange(period)

      let query = supabase
        .from('scheduled_posts')
        .select('id, platform, caption, status, scheduled_at, published_at')
        .eq('brand_id', brandId)
        .gte('scheduled_at', start.toISOString())
        .lt('scheduled_at', end.toISOString())
        .order('scheduled_at', { ascending: true })

      if (platform) {
        query = query.eq('platform', platform)
      }
      if (status) {
        query = query.eq('status', status)
      }

      const { data: posts, error } = await query.limit(30)

      if (error) {
        return userSafeError('query-calendar', error, 'Could not read the calendar just now. Try again in a moment.')
      }

      if (!posts || posts.length === 0) {
        return `## ${label}'s Schedule\n\nNo posts found for this period.${platform ? ` (filtered to ${platform})` : ''}${status ? ` (filtered to ${status})` : ''}\n\nWant me to create some content and fill the calendar?`
      }

      const lines: string[] = [`## ${label}'s Schedule (${posts.length} post${posts.length === 1 ? '' : 's'})\n`]

      for (const post of posts) {
        const emoji = PLATFORM_EMOJIS[post.platform] ?? '📝'
        const when = formatAestDate(post.scheduled_at)
        const statusLabel = post.status as string
        const preview = post.caption
          ? post.caption.length > 80
            ? `"${post.caption.slice(0, 80)}..."`
            : `"${post.caption}"`
          : '(no caption)'

        lines.push(`**${when}** — ${emoji} ${post.platform} (${statusLabel}) [id: ${post.id}]`)
        lines.push(`${preview}\n`)
      }

      // Summary counts
      const drafts = posts.filter((p) => p.status === 'draft').length
      const scheduled = posts.filter((p) => p.status === 'scheduled').length
      const published = posts.filter((p) => p.status === 'published').length
      const failed = posts.filter((p) => p.status === 'failed').length

      lines.push('---')
      const parts: string[] = []
      if (drafts > 0) parts.push(`${drafts} draft${drafts === 1 ? '' : 's'} need approval`)
      if (scheduled > 0) parts.push(`${scheduled} scheduled`)
      if (published > 0) parts.push(`${published} published`)
      if (failed > 0) parts.push(`${failed} failed`)

      if (parts.length > 0) {
        lines.push(parts.join('. ') + '.')
      }

      if (drafts > 0) {
        lines.push("Say 'schedule all drafts' to queue them.")
      }

      return lines.join('\n')
    },
  })
}
