'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, Heart, TrendingUp, Users, Loader2 } from 'lucide-react'

interface ZernioAnalyticsPanelProps {
  brandId: string
  from?: string
  to?: string
}

export function ZernioAnalyticsPanel({ brandId, from, to }: ZernioAnalyticsPanelProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchZernioAnalytics() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ brandId })
        if (from) params.set('fromDate', from)
        if (to) params.set('toDate', to)
        const res = await fetch(`/api/zernio/analytics?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch analytics')
        const json = await res.json()
        if (json.configured) {
          setData(json.metrics)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchZernioAnalytics()
  }, [brandId, from, to])

  // Explicitly check for loading first
  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-muted/10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Fails silently if no account or not configured
  if (error || !data) {
    return null 
  }

  const totals = data.totals || {}
  const reach = totals.reach || 0
  const impressions = totals.impressions || 0
  const engagement = (totals.likes || 0) + (totals.comments || 0) + (totals.shares || 0)
  const views = totals.views || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">SaaS Aggregated Metrics</h2>
        <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
          Powered by Zernio
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none rounded-xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-mono tracking-tight text-foreground">{impressions.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-none rounded-xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-mono tracking-tight text-foreground">{reach.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="shadow-none rounded-xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Engagement</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-mono tracking-tight text-foreground">{engagement.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="shadow-none rounded-xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Video Views</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-mono tracking-tight text-foreground">{views.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
