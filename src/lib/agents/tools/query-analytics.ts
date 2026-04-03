import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

function getPeriodStart(period: string): Date {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

function periodLabel(period: string): string {
  switch (period) {
    case '7d':
      return '7 Days'
    case '30d':
      return '30 Days'
    case '90d':
      return '90 Days'
    default:
      return '30 Days'
  }
}

export function createQueryAnalyticsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Get a summary of content performance, publishing activity, output creation, and AI spend. Use this when the user asks how they are doing, wants stats, or asks for a performance overview.',
    inputSchema: z.object({
      period: z
        .enum(['7d', '30d', '90d'])
        .default('30d')
        .describe('Time period for the summary'),
    }),
    execute: async ({ period }) => {
      const start = getPeriodStart(period)
      const startIso = start.toISOString()
      const label = periodLabel(period)

      // Run all queries in parallel
      const [postsResult, outputsResult, usageResult] = await Promise.all([
        // Scheduled posts
        supabase
          .from('scheduled_posts')
          .select('id, platform, status')
          .eq('brand_id', brandId)
          .gte('created_at', startIso),

        // Outputs
        supabase
          .from('outputs')
          .select('id, output_type')
          .eq('brand_id', brandId)
          .gte('created_at', startIso),

        // AI usage
        supabase
          .from('ai_usage')
          .select('cost_cents, agent_type')
          .eq('brand_id', brandId)
          .gte('created_at', startIso),
      ])

      const posts = postsResult.data ?? []
      const outputs = outputsResult.data ?? []
      const usage = usageResult.data ?? []

      // ── Post stats ────────────────────────────────────────────────────────
      const published = posts.filter((p) => p.status === 'published').length
      const drafts = posts.filter((p) => p.status === 'draft').length
      const scheduled = posts.filter((p) => p.status === 'scheduled').length

      // Platform breakdown
      const platformCounts: Record<string, number> = {}
      for (const post of posts) {
        platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1
      }
      const platformBreakdown = Object.entries(platformCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([p, c]) => `${p.charAt(0).toUpperCase() + p.slice(1)} (${c})`)
        .join(', ')

      // ── Output stats ──────────────────────────────────────────────────────
      const typeCounts: Record<string, number> = {}
      for (const output of outputs) {
        const t = (output.output_type as string).replace(/_/g, ' ')
        typeCounts[t] = (typeCounts[t] || 0) + 1
      }
      const typeBreakdown = Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([t, c]) => `${c} ${t}${c === 1 ? '' : 's'}`)
        .join(', ')

      // ── AI spend ──────────────────────────────────────────────────────────
      const totalCents = usage.reduce((sum, u) => sum + ((u.cost_cents as number) || 0), 0)
      const totalDollars = (totalCents / 100).toFixed(2)
      const interactionCount = usage.length

      // ── Build markdown ────────────────────────────────────────────────────
      const lines: string[] = [`## Your Last ${label}\n`]

      // Content line
      const contentParts: string[] = []
      if (published > 0) contentParts.push(`${published} published`)
      if (scheduled > 0) contentParts.push(`${scheduled} scheduled`)
      if (drafts > 0) contentParts.push(`${drafts} draft${drafts === 1 ? '' : 's'} waiting`)
      if (contentParts.length > 0) {
        lines.push(`**Content:** ${posts.length} total posts — ${contentParts.join(', ')}`)
      } else {
        lines.push('**Content:** No posts in this period')
      }

      // Platforms line
      if (platformBreakdown) {
        lines.push(`**Platforms:** ${platformBreakdown}`)
      }

      // Outputs line
      if (outputs.length > 0) {
        lines.push(`**Outputs:** ${outputs.length} pieces created (${typeBreakdown})`)
      } else {
        lines.push('**Outputs:** None created in this period')
      }

      // AI spend line
      lines.push(`**AI spend:** $${totalDollars} across ${interactionCount} agent interaction${interactionCount === 1 ? '' : 's'}`)

      // Insight
      lines.push('')
      if (posts.length === 0 && outputs.length === 0) {
        lines.push("Looks like things have been quiet. Want me to draft some content to get things moving?")
      } else if (drafts > 3) {
        lines.push(`You have ${drafts} drafts waiting. Want me to review and schedule them?`)
      } else if (platformBreakdown) {
        const topPlatform = Object.entries(platformCounts).sort(([, a], [, b]) => b - a)[0]
        if (topPlatform) {
          lines.push(`${topPlatform[0].charAt(0).toUpperCase() + topPlatform[0].slice(1)} is getting the most volume. Want me to balance content across other platforms?`)
        }
      }

      return lines.join('\n')
    },
  })
}
