import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod/v3'
import {
  fetchMixpostAccounts,
  uploadMediaFromUrl,
  createMixpostPost,
  resolveAccountIdsForPlatform,
  type MixpostVersion,
} from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { checkPublishAllowed } from '@/lib/agents/publish-gate'

const Schema = z.object({
  postId: z.string().uuid().optional(),
  postIds: z.array(z.string().uuid()).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const ids = parsed.data.postIds ?? (parsed.data.postId ? [parsed.data.postId] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'No post IDs provided' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch the posts — user_id check ensures ownership
  const { data: posts, error } = await admin
    .from('scheduled_posts')
    .select('*, brands(id, name, slug, social_urls, post_signature, compliance_flags, brand_dna_constraints), media_items(file_url, file_name)')
    .in('id', ids)
    .eq('user_id', user.id)

  if (error || !posts?.length) {
    return NextResponse.json({ error: 'Posts not found' }, { status: 404 })
  }

  // Pre-fetch Mixpost accounts once for all posts
  const allAccounts = await fetchMixpostAccounts()
  if (!allAccounts) {
    return NextResponse.json({ error: 'Cannot reach Mixpost — check server configuration' }, { status: 503 })
  }

  // Build brand mapping from the posts' brands
  const brandStubs = posts
    .filter(p => p.brands)
    .map(p => ({
      id: (p.brands as Record<string, unknown>).id as string,
      name: (p.brands as Record<string, unknown>).name as string,
      slug: (p.brands as Record<string, unknown>).slug as string,
      social_urls: ((p.brands as Record<string, unknown>).social_urls as Record<string, string>) ?? {},
    }))

  const uniqueBrands = Array.from(
    new Map(brandStubs.map(b => [b.id, b])).values()
  )

  const brandAccountMap = mapAccountsToBrandsRaw(allAccounts, uniqueBrands)

  let published = 0
  let failed = 0
  const results: Array<{ postId: string; status: string; error?: string }> = []

  for (const post of posts) {
    try {
      const postBrand = post.brands as Record<string, unknown> | null
      const gate = await checkPublishAllowed({
        content: [String(post.caption ?? ''), ...((post.hashtags as string[] | null) ?? [])].join('\n'),
        complianceFlags: postBrand?.compliance_flags as never,
        brandDNA: postBrand?.brand_dna_constraints as never,
        brandSlug: typeof postBrand?.slug === 'string' ? postBrand.slug : null,
        label: `manual post ${post.id}`,
      })
      if (!gate.allowed) {
        throw new Error(gate.reason ?? 'This post did not pass the publishing gate.')
      }

      // Mark as publishing
      await admin
        .from('scheduled_posts')
        .update({ status: 'publishing' })
        .eq('id', post.id)

      // Resolve Mixpost account IDs for this brand + platform
      const brandAccounts = brandAccountMap.get(post.brand_id) ?? []
      const accountIds = resolveAccountIdsForPlatform(post.platform, brandAccounts)

      if (accountIds.length === 0) {
        throw new Error(
          `No Mixpost account for platform "${post.platform}" on brand "${(post.brands as Record<string, unknown>)?.name ?? post.brand_id}". Connect this platform in Mixpost first.`
        )
      }

      // Gather media URLs — carousel first, then single media fallback
      const mediaUrls: string[] = []

      const mediaItemIds = (post as Record<string, unknown>).media_item_ids as string[] | undefined
      if (mediaItemIds?.length) {
        const { data: carouselMedia } = await admin
          .from('media_items')
          .select('file_url')
          .in('id', mediaItemIds)
        mediaUrls.push(...(carouselMedia ?? []).map((m: { file_url: string }) => m.file_url))
      }

      if (mediaUrls.length === 0 && post.media_items?.file_url) {
        mediaUrls.push(post.media_items.file_url as string)
      }

      // Upload media to Mixpost
      const mixpostMediaIds: number[] = []
      for (const url of mediaUrls) {
        const uploaded = await uploadMediaFromUrl(url)
        if (uploaded) mixpostMediaIds.push(uploaded.id)
      }

      // Build caption with hashtags + signature
      const sig = (post.brands as Record<string, unknown>)?.post_signature as
        | { enabled?: boolean; text?: string; format?: string; mention?: string; hashtag?: string }
        | undefined

      let caption = post.caption as string
      const hashtags = post.hashtags as string[] | null
      if (hashtags?.length) {
        caption += '\n\n' + hashtags.map((h: string) => `#${h}`).join(' ')
      }

      if (sig?.enabled) {
        if (sig.format === 'mention' && sig.mention) caption += `\n\n${sig.mention}`
        else if (sig.format === 'hashtag' && sig.hashtag) caption += ` ${sig.hashtag}`
        else if (sig.text) caption += `\n\n${sig.text}`
      }

      // Platform-specific options
      const platformOptions: Record<string, unknown> = {}
      const postType = (post as Record<string, unknown>).post_type as string | undefined

      if (post.platform === 'instagram') {
        platformOptions.type = postType === 'reel' ? 'reel' : 'post'
      }
      if (post.platform === 'tiktok') {
        platformOptions.privacy_level = 'PUBLIC_TO_EVERYONE'
        if (postType === 'carousel') platformOptions.auto_add_music = true
      }
      if (post.platform === 'linkedin') {
        platformOptions.visibility = 'PUBLIC'
      }

      // Build version
      const version: MixpostVersion = {
        account_id: 0,
        is_original: true,
        content: [{
          body: caption,
          media: mixpostMediaIds,
          url: null,
          video_thumbs: [],
        }],
        options: Object.keys(platformOptions).length > 0 ? platformOptions : undefined,
      }

      // Create post in Mixpost (schedule_now = publish immediately)
      const result = await createMixpostPost({
        accounts: accountIds,
        versions: [version],
        schedule_now: true,
      })

      if (!result) {
        throw new Error('Mixpost post creation failed — API returned no result')
      }

      // Mark as published
      await admin
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_id: result.id,
        })
        .eq('id', post.id)

      published++
      results.push({ postId: post.id, status: 'published' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'

      await admin
        .from('scheduled_posts')
        .update({ status: 'failed', error: message })
        .eq('id', post.id)

      failed++
      results.push({ postId: post.id, status: 'failed', error: message })
    }
  }

  return NextResponse.json({ published, failed, results })
}
