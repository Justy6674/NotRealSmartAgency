'use client'
import { useCallback, useEffect, useState } from 'react'
import type {
  BestTimeSlotView,
  DecayBucketView,
  FollowerSeriesView,
  PostingFrequencyView,
} from '@/components/agency/studio/analytics/BestTimeCard'

interface PlatformMetrics {
  [key: string]: number
}

interface SocialAnalyticsData {
  platforms: Record<string, { account_name?: string; metrics: PlatformMetrics }>
  configured: boolean
  error?: string
}

export function useSocialAnalytics(brandId: string | null, period = '7_days') {
  const [data, setData] = useState<SocialAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)

    fetch(`/api/analytics/social?brandId=${brandId}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [brandId, period])

  return { data, loading }
}

/* ── The four things a posting tool cannot tell you ─────────────────────── */

export interface SocialIntelligence {
  bestTime: BestTimeSlotView[]
  decay: DecayBucketView[]
  frequency: PostingFrequencyView[]
  followers: FollowerSeriesView[]
  responseTime: { sampleSize: number; medianSeconds: number; p90Seconds: number } | null
  /** Set when part or all of this could not be read. Never a vendor's words. */
  problem: string | null
  configured: boolean
}

const NOTHING: SocialIntelligence = {
  bestTime: [],
  decay: [],
  frequency: [],
  followers: [],
  responseTime: null,
  problem: null,
  configured: false,
}

/**
 * When to post, how long a post keeps earning, how often to post, and whether
 * the following is growing — all from this business's own results.
 *
 * One request, five upstream reads settled independently on the server, so a
 * single unavailable figure cannot blank the other four.
 */
export function useSocialIntelligence(brandId: string | null) {
  const [data, setData] = useState<SocialIntelligence>(NOTHING)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!brandId) {
      setData(NOTHING)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/zernio/analytics?brandId=${brandId}&view=intelligence`)
      if (!res.ok) {
        setData({
          ...NOTHING,
          problem: 'These figures could not be read just now. Try again in a moment.',
        })
        return
      }
      const body = (await res.json()) as Partial<SocialIntelligence> & { configured?: boolean }
      setData({
        bestTime: body.bestTime ?? [],
        decay: body.decay ?? [],
        frequency: body.frequency ?? [],
        followers: body.followers ?? [],
        responseTime: body.responseTime ?? null,
        problem: body.problem ?? null,
        configured: body.configured === true,
      })
    } catch {
      setData({
        ...NOTHING,
        problem: 'These figures could not be read just now. Try again in a moment.',
      })
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...data, loading, refresh: load }
}
