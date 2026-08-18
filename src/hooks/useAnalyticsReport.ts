'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
import type { PlatformMetrics } from '@/lib/analytics/platform-metrics'

export interface UseAnalyticsReportParams {
  brandId: string | null
  platform: PlatformKey
  /** ISO YYYY-MM-DD. Optional — defaults to last 28 days on the server. */
  from?: string
  /** ISO YYYY-MM-DD. Optional — defaults to today on the server. */
  to?: string
  /** Skip the fetch entirely (e.g. when the platform tab isn't visible). */
  enabled?: boolean
}

export interface UseAnalyticsReportResult {
  metrics: PlatformMetrics | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetch a single platform's results for a brand.
 *
 * Delegates to `/api/studio/analytics` which in turn delegates to the
 * `getMetricsSource()` factory in `lib/analytics/platform-metrics.ts`. This
 * means UI components never know whether the data came from Mixpost or
 * directly from the platform API — Phase 10 swaps the source server-side.
 *
 * For brands with no connected account on a given platform, this returns a
 * `PlatformMetrics` object with `empty: true` rather than an error, so the
 * UI can render a friendly empty state.
 */
export function useAnalyticsReport({
  brandId,
  platform,
  from,
  to,
  enabled = true,
}: UseAnalyticsReportParams): UseAnalyticsReportResult {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    if (!brandId || !enabled) {
      setMetrics(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ brandId, platform })
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/api/studio/analytics?${params.toString()}`)

      if (!res.ok) {
        // 404 (brand not found) and 401 are real errors. Anything else,
        // we degrade — but we say so rather than rendering an empty report,
        // because "nothing happened this month" and "we could not look" are
        // different sentences and only one of them is safe to act on.
        if (res.status === 401 || res.status === 404) {
          throw new Error(`Failed to fetch report: ${res.status}`)
        }
        setMetrics({
          platform,
          from: from ?? '',
          to: to ?? '',
          empty: true,
          problem:
            'These figures could not be read just now. Nothing has been changed — try again in a moment.',
          totals: {},
          timeseries: {},
          topPosts: [],
        })
        return
      }

      const data = (await res.json()) as PlatformMetrics
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [brandId, platform, from, to, enabled])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  return { metrics, loading, error, refetch: fetchReport }
}
