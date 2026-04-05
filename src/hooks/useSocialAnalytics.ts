'use client'
import { useState, useEffect } from 'react'

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
