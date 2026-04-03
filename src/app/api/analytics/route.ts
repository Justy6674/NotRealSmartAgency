import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics?brandId=xxx&period=7d|30d|90d
 *
 * Aggregates analytics data for a brand across scheduled_posts, outputs, and ai_usage.
 * Note: ai_usage does not have a brand_id column, so spend is aggregated per-user
 * (all brands combined). This is acceptable since most users have 1-3 active brands.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const brandId = searchParams.get('brandId')
  const period = searchParams.get('period') ?? '30d'

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  // Calculate date range
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  const days = daysMap[period] ?? 30
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString()

  try {
    // Run all queries in parallel
    const [
      postsResult,
      outputsResult,
      aiUsageResult,
    ] = await Promise.all([
      // Scheduled posts for this brand in date range
      supabase
        .from('scheduled_posts')
        .select('id, platform, status, scheduled_at, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', sinceISO),

      // Outputs for this brand in date range
      supabase
        .from('outputs')
        .select('id, title, output_type, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false }),

      // AI usage for this user in date range (no brand_id column available)
      supabase
        .from('ai_usage')
        .select('id, query_type, cost_usd, created_at')
        .eq('user_id', user.id)
        .gte('created_at', sinceISO),
    ])

    const posts = postsResult.data ?? []
    const outputs = outputsResult.data ?? []
    const aiUsage = aiUsageResult.data ?? []

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalPosts = posts.filter(p => p.status === 'published').length
    const totalDrafts = posts.filter(p => p.status === 'draft').length
    const failedPosts = posts.filter(p => p.status === 'failed').length
    const totalOutputs = outputs.length
    // cost_usd is in dollars, convert to cents
    const aiSpendCents = Math.round(aiUsage.reduce((sum, u) => sum + (u.cost_usd ?? 0), 0) * 100)
    const agentInteractions = aiUsage.length

    // ── Posts by platform ────────────────────────────────────────────────────
    const postsByPlatform: Record<string, number> = {}
    for (const post of posts) {
      postsByPlatform[post.platform] = (postsByPlatform[post.platform] ?? 0) + 1
    }

    // ── Posts by status ──────────────────────────────────────────────────────
    const postsByStatus: Record<string, number> = {}
    for (const post of posts) {
      postsByStatus[post.status] = (postsByStatus[post.status] ?? 0) + 1
    }

    // ── Posts by day ─────────────────────────────────────────────────────────
    const postsByDayMap: Record<string, number> = {}
    // Pre-fill all days in range
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      postsByDayMap[key] = 0
    }
    for (const post of posts) {
      const key = post.created_at.slice(0, 10)
      if (key in postsByDayMap) {
        postsByDayMap[key]++
      }
    }
    const postsByDay = Object.entries(postsByDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // ── Outputs by type ──────────────────────────────────────────────────────
    const outputsByType: Record<string, number> = {}
    for (const output of outputs) {
      outputsByType[output.output_type] = (outputsByType[output.output_type] ?? 0) + 1
    }

    // ── Top 5 recent outputs ─────────────────────────────────────────────────
    const topOutputs = outputs.slice(0, 5).map(o => ({
      id: o.id,
      title: o.title,
      type: o.output_type,
      created_at: o.created_at,
    }))

    // ── AI spend by agent ────────────────────────────────────────────────────
    const spendByAgent: Record<string, { spend: number; interactions: number }> = {}
    for (const usage of aiUsage) {
      // query_type is like "agency_content", "agency_seo", etc.
      const agentType = usage.query_type?.replace('agency_', '') ?? 'unknown'
      if (!spendByAgent[agentType]) {
        spendByAgent[agentType] = { spend: 0, interactions: 0 }
      }
      spendByAgent[agentType].spend += Math.round((usage.cost_usd ?? 0) * 100)
      spendByAgent[agentType].interactions++
    }
    const aiSpendByAgent: Record<string, number> = {}
    const aiInteractionsByAgent: Record<string, number> = {}
    for (const [agent, data] of Object.entries(spendByAgent)) {
      aiSpendByAgent[agent] = data.spend
      aiInteractionsByAgent[agent] = data.interactions
    }

    return NextResponse.json({
      summary: {
        totalPosts,
        totalDrafts,
        failedPosts,
        totalOutputs,
        aiSpendCents,
        agentInteractions,
      },
      postsByPlatform,
      postsByStatus,
      postsByDay,
      outputsByType,
      topOutputs,
      aiSpendByAgent,
      aiInteractionsByAgent,
    })
  } catch (err) {
    console.error('[analytics] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
