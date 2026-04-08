import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryStore } from '@/lib/ruflo/client'
import { getBrandNamespace, getNamespace } from '@/lib/ruflo/namespaces'
import { fetchMixpostAccounts, fetchMixpostReports } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'

// ── Platform benchmarks (2026 data from social-media-benchmarks.ts) ─────────

const ENGAGEMENT_BENCHMARKS: Record<string, { median: number; good: number; excellent: number }> = {
  instagram:  { median: 5.4,  good: 6,  excellent: 10 },
  facebook:   { median: 0.15, good: 0.5, excellent: 1 },
  linkedin:   { median: 6.2,  good: 8,  excellent: 15 },
  tiktok:     { median: 4.5,  good: 6,  excellent: 10 },
  youtube:    { median: 3.5,  good: 5,  excellent: 8 },
  twitter:    { median: 0.05, good: 0.1, excellent: 0.5 },
}

interface PublishedPost {
  id: string
  platform: string
  caption: string
  hashtags: string[] | null
  post_type: string
  content_type: string | null
  content_pillar: string | null
  published_at: string
  media_item_ids: string[] | null
}

interface PerformanceInsight {
  postId: string
  platform: string
  postType: string
  contentType: string | null
  contentPillar: string | null
  engagementRate: number | null
  benchmark: number
  rating: 'excellent' | 'good' | 'average' | 'below_average'
  insight: string
  captionPreview: string
  publishedAt: string
}

/**
 * Analyses published posts and stores performance insights as Director memories.
 * Called by cron or heartbeat — finds posts published 24-72 hours ago that
 * haven't been analysed yet.
 *
 * The Director then recalls these insights when recommending future content:
 * "Carousels about fragrance reviews averaged 8% engagement on Instagram
 * (above the 5.4% benchmark) — recommend more of this content type."
 */
export async function learnFromPublishedPosts(
  supabase: SupabaseClient,
  brandId: string,
  brandSlug: string
): Promise<{ analysed: number; insights: PerformanceInsight[] }> {
  // 1. Find posts published 24-72 hours ago
  const now = new Date()
  const from = new Date(now.getTime() - 72 * 60 * 60 * 1000) // 72 hours ago
  const to = new Date(now.getTime() - 24 * 60 * 60 * 1000)   // 24 hours ago

  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('id, platform, caption, hashtags, post_type, content_type, content_pillar, published_at, media_item_ids')
    .eq('brand_id', brandId)
    .eq('status', 'published')
    .gte('published_at', from.toISOString())
    .lte('published_at', to.toISOString())
    .order('published_at', { ascending: false })

  if (error || !posts?.length) {
    return { analysed: 0, insights: [] }
  }

  // 2. Fetch real engagement metrics from Mixpost
  const namespace = getNamespace(brandSlug, 'analytics')
  let platformMetrics: Record<string, Record<string, number>> = {}

  try {
    const accounts = await fetchMixpostAccounts()
    if (accounts) {
      const { data: brands } = await supabase
        .from('brands')
        .select('id, name, slug, social_urls')
        .eq('id', brandId)

      const brandMapping = mapAccountsToBrandsRaw(accounts, brands ?? [])
      const brandAccounts = brandMapping.get(brandId) ?? []

      for (const account of brandAccounts) {
        const report = await fetchMixpostReports(account.id, '7_days')
        if (report?.metrics) {
          const platform = account.provider === 'facebook_page' ? 'facebook'
            : account.provider === 'x' ? 'twitter'
            : account.provider
          platformMetrics[platform] = report.metrics
        }
      }
    }
  } catch {
    // Mixpost analytics optional — continue without if unavailable
  }

  // 3. Analyse each post
  const insights: PerformanceInsight[] = []

  for (const post of posts as PublishedPost[]) {
    const benchmark = ENGAGEMENT_BENCHMARKS[post.platform] ?? ENGAGEMENT_BENCHMARKS.instagram

    // For now, we don't have per-post engagement metrics from Mixpost
    // (their API returns aggregate reports, not per-post).
    // Instead, we store the post metadata as a learning record so the
    // Director knows what was published, when, and on which platform.
    // When platform analytics APIs are connected, this will include real metrics.

    const isCarousel = post.post_type === 'carousel'
    const hasMedia = (post.media_item_ids?.length ?? 0) > 0
    const captionLength = post.caption?.length ?? 0
    const hashtagCount = post.hashtags?.length ?? 0

    // Generate insight based on content characteristics
    const characteristics: string[] = []
    if (isCarousel) characteristics.push('carousel format')
    if (hasMedia) characteristics.push(`${post.media_item_ids?.length ?? 1} media`)
    if (captionLength > 500) characteristics.push('long caption')
    else if (captionLength < 100) characteristics.push('short caption')
    if (hashtagCount > 10) characteristics.push(`${hashtagCount} hashtags`)
    if (post.content_pillar) characteristics.push(`pillar: ${post.content_pillar}`)
    if (post.content_type) characteristics.push(`type: ${post.content_type}`)

    // Pull real metrics from Mixpost if available
    const metrics = platformMetrics[post.platform]
    const likes = metrics?.likes ?? metrics?.reactions ?? null
    const comments = metrics?.comments ?? null
    const reach = metrics?.reach ?? metrics?.impressions ?? null
    const shares = metrics?.shares ?? metrics?.reposts ?? null

    // Calculate engagement rate if we have reach
    let engagementRate: number | null = null
    let rating: PerformanceInsight['rating'] = 'average'
    if (reach && reach > 0 && (likes || comments)) {
      engagementRate = ((likes ?? 0) + (comments ?? 0) + (shares ?? 0)) / reach * 100
      if (engagementRate >= benchmark.excellent) rating = 'excellent'
      else if (engagementRate >= benchmark.good) rating = 'good'
      else if (engagementRate >= benchmark.median) rating = 'average'
      else rating = 'below_average'
    }

    const metricsStr = likes !== null
      ? ` Metrics: ${likes} likes, ${comments ?? 0} comments, ${shares ?? 0} shares, ${reach ?? 'unknown'} reach.${engagementRate !== null ? ` Engagement: ${engagementRate.toFixed(1)}% (${rating}).` : ''}`
      : ' Metrics: not yet available (check next cycle).'

    const insight: PerformanceInsight = {
      postId: post.id,
      platform: post.platform,
      postType: post.post_type,
      contentType: post.content_type,
      contentPillar: post.content_pillar,
      engagementRate,
      benchmark: benchmark.median,
      rating,
      insight: `Published ${post.post_type} on ${post.platform} (${characteristics.join(', ')}).${metricsStr} Benchmark: ${benchmark.median}% median, ${benchmark.good}%+ good, ${benchmark.excellent}%+ excellent.`,
      captionPreview: post.caption?.slice(0, 150) ?? '',
      publishedAt: post.published_at,
    }

    insights.push(insight)

    // 4. Store as Director memory
    const memoryValue = [
      `Published ${post.post_type} on ${post.platform} at ${new Date(post.published_at).toLocaleDateString('en-AU')}.`,
      characteristics.length > 0 ? `Characteristics: ${characteristics.join(', ')}.` : '',
      engagementRate !== null
        ? `REAL METRICS: ${likes} likes, ${comments ?? 0} comments, ${shares ?? 0} shares, ${reach} reach. Engagement rate: ${engagementRate.toFixed(1)}% (${rating}). Benchmark: ${benchmark.median}%.`
        : `Platform benchmark: ${benchmark.median}% median engagement, ${benchmark.good}%+ good, ${benchmark.excellent}%+ excellent.`,
      post.content_pillar ? `Content pillar: ${post.content_pillar}.` : '',
      post.content_type ? `Content type: ${post.content_type}.` : '',
      `Caption: "${post.caption?.slice(0, 200)}${(post.caption?.length ?? 0) > 200 ? '...' : ''}"`,
      rating === 'excellent' ? 'REPLICATE THIS APPROACH — high performer.' : '',
      rating === 'below_average' ? 'REVIEW THIS APPROACH — underperformed vs benchmark.' : '',
    ].filter(Boolean).join(' ')

    await memoryStore(
      `perf-${post.id}`,
      memoryValue,
      namespace,
      ['performance', 'published', post.platform, post.post_type, ...(post.content_pillar ? [post.content_pillar] : [])]
    )

    // Also store to brand-wide namespace so Director can see it
    await memoryStore(
      `perf-${post.id}`,
      memoryValue,
      getBrandNamespace(brandSlug),
      ['performance', 'published', post.platform, 'cross_department']
    )
  }

  // 5. Store aggregate insight for the period
  const platformCounts: Record<string, number> = {}
  const typeCounts: Record<string, number> = {}
  for (const post of posts as PublishedPost[]) {
    platformCounts[post.platform] = (platformCounts[post.platform] ?? 0) + 1
    if (post.post_type) typeCounts[post.post_type] = (typeCounts[post.post_type] ?? 0) + 1
  }

  const aggregateInsight = [
    `Published ${posts.length} post${posts.length !== 1 ? 's' : ''} in the last 24-72 hours.`,
    `Platforms: ${Object.entries(platformCounts).map(([p, c]) => `${p} (${c})`).join(', ')}.`,
    `Types: ${Object.entries(typeCounts).map(([t, c]) => `${t} (${c})`).join(', ')}.`,
    'Use this data to inform next content recommendations.',
  ].join(' ')

  await memoryStore(
    `perf-aggregate-${now.toISOString().slice(0, 10)}`,
    aggregateInsight,
    getNamespace(brandSlug, 'overall'),
    ['performance', 'aggregate', 'weekly_review']
  )

  return { analysed: insights.length, insights }
}
