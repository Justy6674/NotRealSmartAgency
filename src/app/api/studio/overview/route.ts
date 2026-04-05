import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'

export const dynamic = 'force-dynamic'

/**
 * GET /api/studio/overview?brandId=xxx
 *
 * Aggregated dashboard endpoint — fetches analytics, posts, accounts,
 * outputs, videos, agent activity, and brand data in a single call.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const brandId = req.nextUrl.searchParams.get('brandId')
  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  // 7-day window for analytics
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceISO = since.toISOString()

  try {
    const [
      brandResult,
      postsResult,
      outputsResult,
      videosResult,
      activityResult,
      analyticsPostsResult,
      aiUsageResult,
      mixpostAccounts,
      allBrandsResult,
    ] = await Promise.all([
      // Brand with full data
      supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single(),

      // All scheduled posts for brand
      supabase
        .from('scheduled_posts')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(50),

      // Recent outputs (non-video)
      supabase
        .from('outputs')
        .select('id, title, output_type, content, metadata, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(15),

      // Video outputs specifically
      supabase
        .from('outputs')
        .select('id, title, output_type, content, metadata, created_at')
        .eq('brand_id', brandId)
        .eq('output_type', 'video')
        .order('created_at', { ascending: false })
        .limit(10),

      // Recent agent activity from audit log
      supabase
        .from('audit_log')
        .select('id, agent_type, action, detail, created_at')
        .eq('user_id', user.id)
        .in('action', [
          'delegation_completed', 'output_saved', 'scan_completed',
          'task_created', 'task_completed', 'chat_completed',
          'approval_requested', 'heartbeat_completed',
        ])
        .order('created_at', { ascending: false })
        .limit(10),

      // Analytics: posts in last 7 days
      supabase
        .from('scheduled_posts')
        .select('id, platform, status, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', sinceISO),

      // AI usage in last 7 days (per user, not per brand)
      supabase
        .from('ai_usage')
        .select('id, cost_usd, created_at')
        .eq('user_id', user.id)
        .gte('created_at', sinceISO),

      // Mixpost connected accounts
      fetchMixpostAccounts(),

      // All brands (for Mixpost mapping)
      supabase
        .from('brands')
        .select('id, name, slug')
        .eq('user_id', user.id),
    ])

    const brand = brandResult.data
    const posts = postsResult.data ?? []
    const outputs = outputsResult.data ?? []
    const videos = videosResult.data ?? []
    const agentActivity = activityResult.data ?? []
    const analyticsPosts = analyticsPostsResult.data ?? []
    const aiUsage = aiUsageResult.data ?? []

    // Build Mixpost brand mapping
    let accounts: Record<string, { platform: string; accountName: string; provider: string }[]> = {}
    if (mixpostAccounts && allBrandsResult.data) {
      accounts = mapMixpostAccountsToBrands(mixpostAccounts, allBrandsResult.data)
      console.log('[studio/overview] Mixpost accounts:', mixpostAccounts.length, 'mapped brands:', Object.keys(accounts).length)
    } else {
      console.log('[studio/overview] Mixpost not available:', mixpostAccounts === null ? 'null (not configured or API error)' : 'no brands')
    }

    // Build analytics summary
    const totalPosts = analyticsPosts.filter(p => p.status === 'published').length
    const totalDrafts = analyticsPosts.filter(p => p.status === 'draft').length
    const failedPosts = analyticsPosts.filter(p => p.status === 'failed').length
    const scheduledPosts = analyticsPosts.filter(p => p.status === 'scheduled').length
    const aiSpendCents = Math.round(aiUsage.reduce((sum, u) => sum + (u.cost_usd ?? 0), 0) * 100)

    // Find last published date per platform
    const lastPublishedByPlatform: Record<string, string> = {}
    for (const post of posts) {
      if (post.status === 'published' && post.published_at) {
        if (!lastPublishedByPlatform[post.platform] ||
            post.published_at > lastPublishedByPlatform[post.platform]) {
          lastPublishedByPlatform[post.platform] = post.published_at
        }
      }
    }

    return NextResponse.json({
      brand,
      posts,
      outputs,
      videos,
      agentActivity,
      accounts: accounts[brandId] ?? [],
      _debug_accountBrandIds: Object.keys(accounts),
      lastPublishedByPlatform,
      analytics: {
        totalPosts,
        totalDrafts,
        failedPosts,
        scheduledPosts,
        aiSpendCents,
        totalOutputs: outputs.length,
        agentInteractions: aiUsage.length,
      },
    })
  } catch (err) {
    console.error('[studio/overview] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch studio data' }, { status: 500 })
  }
}
