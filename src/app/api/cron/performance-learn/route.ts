import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { learnFromPublishedPosts } from '@/lib/agents/performance-learner'
import { isCronAuthorised, CRON_UNAUTHORISED_BODY } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron endpoint: Analyse recently published posts and store performance
 * insights as Director memories. Called every 6 hours via Vercel Cron.
 *
 * Flow:
 * 1. Fetch all brands with published posts in the last 24-72 hours
 * 2. For each brand, run performance analysis
 * 3. Store insights to agent_memories (analytics + brand namespace)
 * 4. Director recalls these next time user creates content
 */
export async function GET(request: Request) {
  // Fail closed: with CRON_SECRET unset the old inline compare matched the
  // literal string 'Bearer undefined', so anyone sending it reached the
  // service-role client below.
  if (!isCronAuthorised(request)) {
    return NextResponse.json(CRON_UNAUTHORISED_BODY, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // Find all brands that have published posts in the analysis window (24-72h ago)
    const now = new Date()
    const from = new Date(now.getTime() - 72 * 60 * 60 * 1000)
    const to = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { data: recentPosts } = await supabase
      .from('scheduled_posts')
      .select('brand_id')
      .eq('status', 'published')
      .gte('published_at', from.toISOString())
      .lte('published_at', to.toISOString())

    if (!recentPosts?.length) {
      return NextResponse.json({ message: 'No recent published posts to analyse', analysed: 0 })
    }

    // Get unique brand IDs
    const brandIds = [...new Set(recentPosts.map(p => p.brand_id))]

    // Fetch brand details
    const { data: brands } = await supabase
      .from('brands')
      .select('id, slug, user_id')
      .in('id', brandIds)

    if (!brands?.length) {
      return NextResponse.json({ message: 'No brands found', analysed: 0 })
    }

    // Run analysis per brand
    let totalAnalysed = 0
    const results: Record<string, number> = {}

    for (const brand of brands) {
      const { analysed } = await learnFromPublishedPosts(supabase, brand.id, brand.slug, brand.user_id)
      totalAnalysed += analysed
      results[brand.slug] = analysed
    }

    return NextResponse.json({
      message: `Analysed ${totalAnalysed} posts across ${brands.length} brand${brands.length !== 1 ? 's' : ''}`,
      analysed: totalAnalysed,
      brands: results,
    })
  } catch (error) {
    console.error('[cron/performance-learn] Error:', error)
    return NextResponse.json(
      { error: 'Performance analysis failed' },
      { status: 500 }
    )
  }
}
