import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { ownerFacingPlatformLabel, periodToDateRange } from '@/lib/studio/social-read-source'
import {
  fetchZernioAccounts,
  fetchZernioAnalytics,
  fetchZernioPosts,
} from '@/lib/zernio/client'

export function createQuerySocialAnalyticsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Get real social media engagement metrics — likes, comments, reach, impressions, follower counts — from connected platforms.',
    inputSchema: z.object({
      period: z
        .enum(['7_days', '30_days', '90_days'])
        .default('7_days')
        .describe('Time period for analytics'),
    }),
    execute: async ({ period }) => {
      const { data: brands } = await supabase
        .from('brands')
        .select('id, name, slug, social_urls')
        .eq('id', brandId)

      const brand = brands?.[0]
      const profileId = zernioProfileIdFromSocialUrls(brand?.social_urls)

      if (profileId) {
        if (!process.env.ZERNIO_API_KEY) {
          return {
            success: true,
            message: 'No social accounts connected for this brand.',
            data: {},
          }
        }

        const accounts = await fetchZernioAccounts(profileId)
        if (accounts.length === 0) {
          return {
            success: true,
            message: 'No social accounts connected for this brand.',
            data: {},
          }
        }

        const { fromDate, toDate } = periodToDateRange(period)
        const analytics = await fetchZernioAnalytics({ profileId, fromDate, toDate })
        if (!analytics) {
          return {
            success: true,
            message: 'Analytics are not available right now. Showing publishing activity instead.',
            data: {},
          }
        }

        const results: Record<string, { account_name: string; metrics: Record<string, number> }> = {}
        for (const account of accounts) {
          const label = ownerFacingPlatformLabel(account.platform)
          const row = analytics.platformBreakdown.find(
            (item) => item.platform.toLowerCase() === account.platform.toLowerCase(),
          )
          results[label] = {
            account_name: account.displayName || account.username || label,
            metrics: row
              ? {
                  ...(typeof row.impressions === 'number' ? { impressions: row.impressions } : {}),
                  ...(typeof row.reach === 'number' ? { reach: row.reach } : {}),
                  ...(typeof row.likes === 'number' ? { likes: row.likes } : {}),
                  ...(typeof row.comments === 'number' ? { comments: row.comments } : {}),
                  ...(typeof row.shares === 'number' ? { shares: row.shares } : {}),
                  ...(typeof row.saves === 'number' ? { saves: row.saves } : {}),
                  ...(typeof row.clicks === 'number' ? { clicks: row.clicks } : {}),
                  ...(typeof row.views === 'number' ? { views: row.views } : {}),
                }
              : {},
          }
        }

        const livePosts = await fetchZernioPosts({
          profileId,
          status: 'published',
          limit: 10,
        })

        let summary = `Social analytics for the last ${period.replace('_', ' ')}:\n\n`
        for (const [platform, data] of Object.entries(results)) {
          summary += `**${platform}** (${data.account_name}):\n`
          const entries = Object.entries(data.metrics)
          if (entries.length === 0) {
            summary += '  - no figures for this period\n'
          } else {
            for (const [key, value] of entries) {
              summary += `  - ${key.replace(/_/g, ' ')}: ${value.toLocaleString()}\n`
            }
          }
          summary += '\n'
        }

        if (livePosts.length > 0) {
          summary += 'Recently published:\n'
          for (const post of livePosts.slice(0, 5)) {
            const platforms = post.platforms.map(ownerFacingPlatformLabel).join(', ') || 'Social'
            const preview = post.content.slice(0, 80).replace(/\n/g, ' ')
            summary += `- ${platforms}: ${preview || '(no caption)'}\n`
          }
        }

        return { success: true, message: summary, data: results }
      }

      const { fetchMixpostReports } = await import('@/lib/mixpost/client')

      const accounts = await fetchMixpostAccounts()
      if (!accounts) {
        return {
          success: false,
          error: 'Cannot reach the publishing server just now.',
        }
      }

      const brandMapping = mapAccountsToBrandsRaw(accounts, brands ?? [])
      const brandAccounts = brandMapping.get(brandId) ?? []

      if (brandAccounts.length === 0) {
        return {
          success: false,
          error: 'No social accounts connected for this brand.',
        }
      }

      const results: Record<string, { account_name: string; metrics: Record<string, number>; audience: Record<string, unknown> }> = {}

      for (const account of brandAccounts) {
        const report = await fetchMixpostReports(account.id, period)
        if (report) {
          const platformName = ownerFacingPlatformLabel(account.provider)
          results[platformName] = {
            account_name: account.name,
            metrics: report.metrics ?? {},
            audience: report.audience ?? {},
          }
        }
      }

      if (Object.keys(results).length === 0) {
        return {
          success: true,
          message: 'Analytics not available right now. Showing publishing activity instead.',
          data: {},
        }
      }

      let summary = `Social analytics for the last ${period.replace('_', ' ')}:\n\n`
      for (const [platform, data] of Object.entries(results)) {
        summary += `**${platform}** (${data.account_name}):\n`
        for (const [key, value] of Object.entries(data.metrics)) {
          summary += `  - ${key.replace(/_/g, ' ')}: ${value.toLocaleString()}\n`
        }
        summary += '\n'
      }

      return { success: true, message: summary, data: results }
    },
  })
}
