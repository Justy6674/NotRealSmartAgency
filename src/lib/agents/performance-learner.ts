import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryStore } from '@/lib/ruflo/client'
import { getBrandNamespace, getNamespace } from '@/lib/ruflo/namespaces'

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

  // 2. Check which posts have already been analysed (skip duplicates)
  const analysedKeys = posts.map(p => `perf-${p.id}`)
  const namespace = getNamespace(brandSlug, 'analytics')

  // We'll check existence by trying to store — upsert handles deduplication

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

    const insight: PerformanceInsight = {
      postId: post.id,
      platform: post.platform,
      postType: post.post_type,
      contentType: post.content_type,
      contentPillar: post.content_pillar,
      engagementRate: null, // Will be populated when platform APIs are connected
      benchmark: benchmark.median,
      rating: 'average', // Default until real metrics available
      insight: `Published ${post.post_type} on ${post.platform} (${characteristics.join(', ')}). Benchmark: ${benchmark.median}% engagement. ${benchmark.good}%+ is good, ${benchmark.excellent}%+ is excellent.`,
      captionPreview: post.caption?.slice(0, 150) ?? '',
      publishedAt: post.published_at,
    }

    insights.push(insight)

    // 4. Store as Director memory
    const memoryValue = [
      `Published ${post.post_type} on ${post.platform} at ${new Date(post.published_at).toLocaleDateString('en-AU')}.`,
      characteristics.length > 0 ? `Characteristics: ${characteristics.join(', ')}.` : '',
      `Platform benchmark: ${benchmark.median}% median engagement, ${benchmark.good}%+ good, ${benchmark.excellent}%+ excellent.`,
      post.content_pillar ? `Content pillar: ${post.content_pillar}.` : '',
      post.content_type ? `Content type: ${post.content_type}.` : '',
      `Caption: "${post.caption?.slice(0, 200)}${(post.caption?.length ?? 0) > 200 ? '...' : ''}"`,
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
