'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Brand, ScheduledPost, Output } from '@/types/database'

export interface StudioAnalytics {
  totalPosts: number
  totalDrafts: number
  failedPosts: number
  scheduledPosts: number
  aiSpendCents: number
  totalOutputs: number
  agentInteractions: number
}

export interface AgentActivityEntry {
  id: string
  agent_type: string
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}

export interface SocialAccount {
  platform: string
  accountName: string
  provider: string
}

export interface CanvaDesign {
  id: string
  title: string
  thumbnail_url: string | null
  edit_url: string | null
  view_url: string | null
  updated_at: string | null
}

export interface StudioData {
  brand: Brand | null
  posts: ScheduledPost[]
  outputs: Output[]
  videos: Output[]
  agentActivity: AgentActivityEntry[]
  accounts: SocialAccount[]
  lastPublishedByPlatform: Record<string, string>
  analytics: StudioAnalytics
  canva: { configured: boolean; designs: CanvaDesign[]; totalDesigns?: number; brandName?: string | null }
  loading: boolean
  error: string | null
  refetch: () => void
}

const EMPTY_ANALYTICS: StudioAnalytics = {
  totalPosts: 0,
  totalDrafts: 0,
  failedPosts: 0,
  scheduledPosts: 0,
  aiSpendCents: 0,
  totalOutputs: 0,
  agentInteractions: 0,
}

export function useStudioData(brandId: string | null): StudioData {
  const [data, setData] = useState<Omit<StudioData, 'loading' | 'error' | 'refetch'>>({
    brand: null,
    posts: [],
    outputs: [],
    videos: [],
    agentActivity: [],
    accounts: [],
    lastPublishedByPlatform: {},
    analytics: EMPTY_ANALYTICS,
    canva: { configured: false, designs: [] },
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!brandId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch overview + canva designs in parallel
      const [overviewRes, canvaRes] = await Promise.all([
        fetch(`/api/studio/overview?brandId=${brandId}`),
        fetch(`/api/canva/designs?brandId=${brandId}`),
      ])

      if (!overviewRes.ok) {
        throw new Error('Failed to fetch studio data')
      }

      const overview = await overviewRes.json()
      const canva = canvaRes.ok
        ? await canvaRes.json()
        : { configured: false, designs: [] }

      setData({
        brand: overview.brand ?? null,
        posts: overview.posts ?? [],
        outputs: overview.outputs ?? [],
        videos: overview.videos ?? [],
        agentActivity: overview.agentActivity ?? [],
        accounts: overview.accounts ?? [],
        lastPublishedByPlatform: overview.lastPublishedByPlatform ?? {},
        analytics: overview.analytics ?? EMPTY_ANALYTICS,
        canva,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { ...data, loading, error, refetch: fetchData }
}
