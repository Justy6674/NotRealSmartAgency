import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

function getPeriodMs(period: string): number {
  switch (period) {
    case '30d': return 30 * 24 * 60 * 60 * 1000
    case '60d': return 60 * 24 * 60 * 60 * 1000
    case '90d': return 90 * 24 * 60 * 60 * 1000
    default: return 30 * 24 * 60 * 60 * 1000
  }
}

export function createAnalyseContentGapsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Analyse content gaps across pillars, platforms, and posting frequency. Finds underrepresented content pillars, unbalanced platform distribution, and quiet posting periods. Use when the user asks what content they should create, what they are missing, where the gaps are, or wants a content audit.',
    inputSchema: z.object({
      period: z
        .enum(['30d', '60d', '90d'])
        .default('30d')
        .describe('Analysis window'),
    }),
    execute: async ({ period }) => {
      const startMs = Date.now() - getPeriodMs(period)
      const startIso = new Date(startMs).toISOString()
      const periodDays = parseInt(period)

      // Parallel queries: brand data + posts
      const [brandResult, postsResult] = await Promise.all([
        supabase
          .from('brands')
          .select('content_pillars, channel_strategy, social_urls, name')
          .eq('id', brandId)
          .single(),
        supabase
          .from('scheduled_posts')
          .select('platform, content_pillar, content_type, status, scheduled_at, created_at')
          .eq('brand_id', brandId)
          .gte('created_at', startIso),
      ])

      const brand = brandResult.data
      const posts = postsResult.data ?? []
      const brandName = brand?.name ?? 'this brand'
      const definedPillars: string[] = brand?.content_pillars ?? []
      const channelStrategy = brand?.channel_strategy as Record<string, number> | null

      const lines: string[] = [`## Content Gap Analysis — ${brandName} (Last ${periodDays} Days)\n`]

      if (posts.length === 0) {
        lines.push(`No posts found in the last ${periodDays} days. This brand needs content urgently.\n`)
        if (definedPillars.length > 0) {
          lines.push(`**Defined pillars:** ${definedPillars.join(', ')}`)
          lines.push(`All pillars have zero coverage. Recommend creating at least 2-3 posts per pillar.\n`)
        }
        lines.push('**Recommendation:** Start with a 2-week calendar fill across your active platforms.')
        return lines.join('\n')
      }

      // ── Pillar Analysis ───────────────────────────────────────────────────
      const pillarCounts: Record<string, number> = {}
      for (const post of posts) {
        const pillar = (post.content_pillar as string) ?? 'uncategorised'
        pillarCounts[pillar] = (pillarCounts[pillar] || 0) + 1
      }

      lines.push('### Content Pillars\n')
      if (definedPillars.length > 0) {
        const missingPillars = definedPillars.filter(
          (p) => !pillarCounts[p] || pillarCounts[p] === 0
        )
        const weakPillars = definedPillars.filter(
          (p) => pillarCounts[p] && pillarCounts[p] > 0 && pillarCounts[p] <= 2
        )

        for (const pillar of definedPillars) {
          const count = pillarCounts[pillar] ?? 0
          const status = count === 0 ? '🔴' : count <= 2 ? '🟡' : '🟢'
          lines.push(`${status} **${pillar}**: ${count} post${count !== 1 ? 's' : ''}`)
        }

        if (missingPillars.length > 0) {
          lines.push(`\n⚠️ **Missing pillars:** ${missingPillars.join(', ')} — zero posts in ${periodDays} days`)
        }
        if (weakPillars.length > 0) {
          lines.push(`⚠️ **Weak pillars:** ${weakPillars.join(', ')} — need more content`)
        }
      } else {
        lines.push('No content pillars defined for this brand. Consider setting them in Brand Settings.')
        const sortedPillars = Object.entries(pillarCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
        if (sortedPillars.length > 0) {
          lines.push(`\nDetected pillar distribution: ${sortedPillars.map(([p, c]) => `${p} (${c})`).join(', ')}`)
        }
      }

      // ── Platform Distribution ─────────────────────────────────────────────
      lines.push('\n### Platform Distribution\n')
      const platformCounts: Record<string, number> = {}
      for (const post of posts) {
        platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1
      }

      const totalPosts = posts.length
      for (const [platform, count] of Object.entries(platformCounts).sort(([, a], [, b]) => b - a)) {
        const pct = Math.round((count / totalPosts) * 100)
        const targetPct = channelStrategy?.[platform]
        const label = platform.charAt(0).toUpperCase() + platform.slice(1)
        if (targetPct) {
          const diff = pct - targetPct
          const status = Math.abs(diff) <= 10 ? '🟢' : diff > 0 ? '🟡 over' : '🔴 under'
          lines.push(`${status.split(' ')[0]} **${label}**: ${count} posts (${pct}%) — target ${targetPct}% ${Math.abs(diff) > 10 ? `(${diff > 0 ? '+' : ''}${diff}pp)` : ''}`)
        } else {
          lines.push(`**${label}**: ${count} posts (${pct}%)`)
        }
      }

      // Check for platforms with zero posts but connected socials
      const socialUrls = brand?.social_urls as Record<string, string> | null
      if (socialUrls) {
        const connectedPlatforms = Object.keys(socialUrls).filter((k) => socialUrls[k])
        const missingPlatforms = connectedPlatforms.filter((p) => !platformCounts[p])
        if (missingPlatforms.length > 0) {
          lines.push(`\n⚠️ **Connected but unused:** ${missingPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')} — you have accounts but zero posts`)
        }
      }

      // ── Posting Frequency ────────────────────────────────────────────────
      lines.push('\n### Posting Frequency\n')
      const postsPerWeek = totalPosts / (periodDays / 7)
      lines.push(`**Average:** ${postsPerWeek.toFixed(1)} posts/week`)

      // Find quiet periods (days with no posts)
      const postDates = new Set(
        posts.map((p) => new Date(p.created_at).toISOString().split('T')[0])
      )
      let quietStreak = 0
      let maxQuietStreak = 0
      const today = new Date()
      for (let d = new Date(startMs); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        if (!postDates.has(dateStr)) {
          quietStreak++
          maxQuietStreak = Math.max(maxQuietStreak, quietStreak)
        } else {
          quietStreak = 0
        }
      }

      if (maxQuietStreak >= 7) {
        lines.push(`⚠️ **Longest quiet period:** ${maxQuietStreak} days without posting`)
      }

      const activeDays = postDates.size
      const totalDays = Math.ceil((Date.now() - startMs) / (24 * 60 * 60 * 1000))
      const activePct = Math.round((activeDays / totalDays) * 100)
      lines.push(`**Active days:** ${activeDays}/${totalDays} (${activePct}%)`)

      // ── Recommendations ───────────────────────────────────────────────────
      lines.push('\n### Recommendations\n')
      const recommendations: string[] = []

      const missingPillars = definedPillars.filter((p) => !pillarCounts[p] || pillarCounts[p] === 0)
      if (missingPillars.length > 0) {
        recommendations.push(`Create ${missingPillars.length * 2}-${missingPillars.length * 3} posts covering: ${missingPillars.join(', ')}`)
      }

      if (postsPerWeek < 3) {
        recommendations.push('Increase posting frequency to at least 3-5 posts per week for consistent growth')
      }

      if (maxQuietStreak >= 5) {
        recommendations.push('Use the calendar fill feature to prevent multi-day gaps — consistency beats volume')
      }

      const socialUrlsCheck = brand?.social_urls as Record<string, string> | null
      const missingPlatforms = socialUrlsCheck
        ? Object.keys(socialUrlsCheck).filter((p) => socialUrlsCheck[p] && !platformCounts[p])
        : []
      if (missingPlatforms.length > 0) {
        recommendations.push(`Start posting on ${missingPlatforms.join(', ')} — you have connected accounts but no content`)
      }

      if (recommendations.length === 0) {
        recommendations.push('Content distribution looks healthy. Keep up the momentum!')
      }

      recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`))

      return lines.join('\n')
    },
  })
}
