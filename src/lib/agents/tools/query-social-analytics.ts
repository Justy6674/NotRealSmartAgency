import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'

export function createQuerySocialAnalyticsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Get real social media engagement metrics — likes, comments, reach, impressions, follower counts — from connected platforms via Mixpost.',
    inputSchema: z.object({
      period: z
        .enum(['7_days', '30_days', '90_days'])
        .default('7_days')
        .describe('Time period for analytics'),
    }),
    execute: async ({ period }) => {
      // Dynamic import to avoid circular deps at module load
      const { fetchMixpostReports } = await import('@/lib/mixpost/client')

      const accounts = await fetchMixpostAccounts()
      if (!accounts) {
        return {
          success: false,
          error: 'Cannot reach Mixpost. Check if the publishing server is running.',
        }
      }

      // Get brand's accounts
      const { data: brands } = await supabase
        .from('brands')
        .select('id, name, slug, social_urls')
        .eq('id', brandId)

      const brandMapping = mapAccountsToBrandsRaw(accounts, brands ?? [])
      const brandAccounts = brandMapping.get(brandId) ?? []

      if (brandAccounts.length === 0) {
        return {
          success: false,
          error: 'No social accounts connected for this brand in Mixpost.',
        }
      }

      const results: Record<string, { account_name: string; metrics: Record<string, number>; audience: Record<string, unknown> }> = {}

      for (const account of brandAccounts) {
        const report = await fetchMixpostReports(account.id, period)
        if (report) {
          const platformName =
            account.provider === 'facebook_page'
              ? 'Facebook'
              : account.provider === 'x'
                ? 'X'
                : account.provider.charAt(0).toUpperCase() + account.provider.slice(1)
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
          message:
            'Analytics not available — Mixpost reports may require browser session. Showing publishing activity instead.',
          data: {},
        }
      }

      // Format as readable summary
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
