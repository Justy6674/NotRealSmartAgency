'use client'

import { useMemo } from 'react'
import type { Brand, ScheduledPost } from '@/types/database'
import type { SocialAccount } from '@/hooks/useStudioData'

export interface StrategyContext {
  /** Smart one-liner suggestion for what to create next */
  suggestion: string
  /** Which platform needs attention most */
  suggestedPlatform: string | null
  /** Which content pillar to rotate to */
  suggestedPillar: string | null
  /** Which content type is needed */
  suggestedContentType: 'entertainment' | 'education' | 'inspiration' | 'promotional' | null
  /** Posts this week vs target */
  postsThisWeek: number
  postsTarget: number
  /** Platform distribution this week */
  platformCounts: Record<string, number>
  /** Content type distribution this week */
  typeCounts: Record<string, number>
  /** Connected platforms from Mixpost */
  connectedPlatforms: string[]
  /** Full context string to embed in agent messages */
  agentContext: string
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

const FREQUENCY_TARGETS: Record<string, number> = {
  daily: 7,
  '3x_week': 3,
  '2x_week': 2,
  weekly: 1,
  custom: 3,
}

export function useStrategyContext(
  brand: Brand | null,
  posts: ScheduledPost[],
  accounts: SocialAccount[],
): StrategyContext | null {
  return useMemo(() => {
    if (!brand) return null

    const strategy = brand.channel_strategy as Record<string, unknown> | null
    const channels = (strategy?.channels ?? {}) as Record<string, number>
    const frequency = (strategy?.posting_frequency as string) ?? '3x_week'
    const pillars = (brand.content_pillars as string[]) ?? []
    const postsTarget = FREQUENCY_TARGETS[frequency] ?? 3

    const weekStart = getWeekStart()
    const weekPosts = posts.filter(p => {
      const d = new Date(p.scheduled_at || p.created_at)
      return d >= weekStart && ['scheduled', 'published', 'draft', 'publishing'].includes(p.status)
    })

    const postsThisWeek = weekPosts.length

    // Platform counts this week
    const platformCounts: Record<string, number> = {}
    for (const p of weekPosts) {
      platformCounts[p.platform] = (platformCounts[p.platform] ?? 0) + 1
    }

    // Content type counts this week
    const typeCounts: Record<string, number> = {}
    for (const p of weekPosts) {
      const ct = (p as unknown as Record<string, unknown>).content_type as string | null
      if (ct) typeCounts[ct] = (typeCounts[ct] ?? 0) + 1
    }

    // Connected platforms
    const connectedPlatforms = accounts.map(a => a.platform.toLowerCase())

    // Find platform that's most underserved relative to strategy
    let suggestedPlatform: string | null = null
    let worstRatio = Infinity
    for (const [platform, targetPct] of Object.entries(channels)) {
      const actual = platformCounts[platform.toLowerCase()] ?? 0
      const expected = Math.max(1, Math.round((targetPct / 100) * postsTarget))
      const ratio = actual / expected
      if (ratio < worstRatio) {
        worstRatio = ratio
        suggestedPlatform = platform
      }
    }

    // Find pillar to rotate to (least recently used)
    const usedPillars = weekPosts
      .map(p => (p as unknown as Record<string, unknown>).content_pillar as string | null)
      .filter(Boolean)
    const suggestedPillar = pillars.find(p => !usedPillars.includes(p)) ?? pillars[0] ?? null

    // Determine content type needed (aim for balance, favour entertainment if low)
    const entertainmentCount = typeCounts['entertainment'] ?? 0
    const educationCount = typeCounts['education'] ?? 0
    let suggestedContentType: StrategyContext['suggestedContentType'] = null
    if (entertainmentCount === 0 && postsThisWeek > 0) {
      suggestedContentType = 'entertainment'
    } else if (educationCount === 0 && postsThisWeek > 0) {
      suggestedContentType = 'education'
    } else if (postsThisWeek === 0) {
      suggestedContentType = 'education' // Start with authority content
    }

    // Build suggestion one-liner
    const parts: string[] = []
    if (postsThisWeek < postsTarget) {
      parts.push(`${postsTarget - postsThisWeek} more post${postsTarget - postsThisWeek > 1 ? 's' : ''} needed this week`)
    }
    if (suggestedPlatform && worstRatio < 1) {
      parts.push(`${suggestedPlatform} needs attention`)
    }
    if (suggestedPillar) {
      parts.push(`rotate to '${suggestedPillar}'`)
    }
    if (suggestedContentType) {
      parts.push(`${suggestedContentType} content needed`)
    }

    const suggestion = parts.length > 0
      ? parts.join('. ') + '.'
      : `On track — ${postsThisWeek}/${postsTarget} posts this week.`

    // Build full agent context string
    const agentContext = [
      `Strategy context for ${brand.name}:`,
      `Posting target: ${postsTarget}/week (${frequency}). This week: ${postsThisWeek}/${postsTarget}.`,
      suggestedPlatform ? `Suggested platform: ${suggestedPlatform} (underserved).` : '',
      suggestedPillar ? `Content pillar to rotate to: "${suggestedPillar}".` : '',
      suggestedContentType ? `Content type needed: ${suggestedContentType}.` : '',
      connectedPlatforms.length > 0 ? `Connected via Mixpost: ${connectedPlatforms.join(', ')}.` : '',
      Object.keys(channels).length > 0
        ? `Channel allocation: ${Object.entries(channels).map(([p, pct]) => `${p} ${pct}%`).join(', ')}.`
        : '',
      brand.compliance_flags?.ahpra ? 'AHPRA compliant required.' : '',
      brand.compliance_flags?.tga ? 'TGA compliant required.' : '',
      brand.tone_of_voice ? `Voice: ${(brand.tone_of_voice as unknown as Record<string, unknown>).formality ?? ''}, ${(brand.tone_of_voice as unknown as Record<string, unknown>).humour ?? ''}.` : '',
      (brand.post_signature as Record<string, unknown>)?.enabled ? `Post signature required.` : '',
    ].filter(Boolean).join(' ')

    return {
      suggestion,
      suggestedPlatform,
      suggestedPillar,
      suggestedContentType,
      postsThisWeek,
      postsTarget,
      platformCounts,
      typeCounts,
      connectedPlatforms,
      agentContext,
    }
  }, [brand, posts, accounts])
}
