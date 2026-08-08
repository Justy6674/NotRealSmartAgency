import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { relayIfSafe } from '@/lib/errors/user-safe'
import {
  dateWindow,
  getEventsBy,
  getTrafficBy,
  getTrafficTotals,
  VercelAnalyticsError,
  vercelAnalyticsConfigured,
} from '@/lib/analytics/vercel-analytics'

/**
 * How many people actually visited the brand's website, and what they did.
 *
 * `query_analytics` reports what NRS itself DID — posts published, outputs
 * written, spend. It has always been silent on whether any of it worked. This
 * is the other half: real visitors, where they came from, what they looked at,
 * and any custom events the site sends.
 *
 * Read-only, and scoped to the one brand in play.
 */
export function createQuerySiteTrafficTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Get REAL website visitor numbers for this brand — visitors, pageviews, top pages, where traffic came from, and custom events like signups or listings created. Use this whenever the user asks how the site or a campaign is performing, whether anyone saw something, where traffic comes from, or what is converting. This is actual audience data, unlike query_analytics which reports what NRS published.',
    inputSchema: z.object({
      days: z.number().min(1).max(90).default(7)
        .describe('How many days back to look. 7 = this week, 30 = this month.'),
      breakdown: z
        .enum(['summary', 'day', 'route', 'country', 'referrerHostname', 'deviceType', 'utmCampaign'])
        .default('summary')
        .describe("What to break the traffic down by. 'summary' is the headline totals; 'route' is the most-viewed pages; 'referrerHostname' is where visitors came from."),
      event_name: z.string().optional()
        .describe("Optional: a custom event to count instead of pageviews, e.g. 'Listing Created'."),
    }),

    execute: async ({ days, breakdown, event_name }) => {
      if (!vercelAnalyticsConfigured()) {
        return 'Website visitor data is not connected yet — VERCEL_API_TOKEN is not set on NRS. Tell the owner that the site analytics connection needs its Vercel key before real visitor numbers can be reported. Do NOT guess or estimate any numbers.'
      }

      const { data: brand } = await supabase
        .from('brands')
        .select('name, website_url, vercel_project, vercel_team')
        .eq('id', brandId)
        .maybeSingle()

      if (!brand) return 'That project could not be read.'

      if (!brand.vercel_project) {
        return `${brand.name} has no website connected for visitor tracking yet, so there are no real visitor numbers to report. Say that plainly — do NOT estimate, and do not present published-post counts as if they were visitors.`
      }

      const target = { project: brand.vercel_project as string, team: brand.vercel_team as string | null }
      const now = new Date()
      // Both ends, always: the API rejects a lone `since` outright.
      const { since, until } = dateWindow(days, now)
      const window = `the last ${days} day${days === 1 ? '' : 's'}`

      try {
        if (event_name) {
          const rows = await getEventsBy(
            target,
            'day',
            { since, until, filter: `eventName eq '${event_name.replace(/'/g, "''")}'`, limit: days },
          )
          const total = rows.reduce((sum, row) => sum + row.count, 0)
          if (total === 0) {
            return `${brand.name}: no "${event_name}" events recorded in ${window}. Either it has not happened, or the site is not sending that event yet.`
          }
          return [
            `${brand.name} — "${event_name}" over ${window}: ${total} in total.`,
            ...rows.map((row) => `  ${row.label}: ${row.count} (${row.visitors} people)`),
          ].join('\n')
        }

        const totals = await getTrafficTotals(target, { since, until })

        if (breakdown === 'summary') {
          if (totals.visitors === 0) {
            return `${brand.name} (${brand.website_url ?? 'site'}): no recorded visitors in ${window}.`
          }
          return `${brand.name} (${brand.website_url ?? 'site'}) over ${window}: ${totals.visitors} visitors, ${totals.pageviews} page views.`
        }

        const rows = await getTrafficBy(target, breakdown, { since, until, limit: 10 })
        const heading = {
          day: 'by day',
          route: 'most-viewed pages',
          country: 'by country',
          referrerHostname: 'where visitors came from',
          deviceType: 'by device',
          utmCampaign: 'by campaign',
        }[breakdown]

        if (rows.length === 0) {
          return `${brand.name}: no recorded traffic in ${window}.`
        }

        return [
          `${brand.name} — ${heading}, ${window} (${totals.visitors} visitors, ${totals.pageviews} views in total):`,
          ...rows.map((row) => `  ${row.label}: ${row.visitors} visitors, ${row.pageviews} views`),
        ].join('\n')
      } catch (err) {
        if (err instanceof VercelAnalyticsError) {
          // These messages are OURS — written for a person, about a setting.
          // relayIfSafe passes them through and refuses anything that turns
          // out to carry internal detail, so a new Vercel error string cannot
          // become the next leak.
          const reason = relayIfSafe('query-site-traffic', err, 'the connection is not ready')
          return `Could not read visitor numbers for ${brand.name}: ${reason} Report this to the owner rather than estimating.`
        }
        return `Could not read visitor numbers for ${brand.name}. Say so plainly rather than estimating.`
      }
    },
  })
}
