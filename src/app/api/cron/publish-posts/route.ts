export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchMixpostAccounts,
  uploadMediaFromUrl,
  createMixpostPost,
  resolveAccountIdsForPlatform,
  type MixpostVersion,
} from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Safety check: time out posts stuck in 'publishing' for more than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  await supabase
    .from('scheduled_posts')
    .update({
      status: 'failed',
      error: 'Publishing timed out — no webhook confirmation received',
    })
    .eq('status', 'publishing')
    .lt('updated_at', tenMinutesAgo)

  // Find posts due for publishing
  const { data: duePosts, error } = await supabase
    .from('scheduled_posts')
    .select('*, brands(id, name, slug, social_urls, post_signature), media_items(file_url, file_name)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20)

  if (error || !duePosts?.length) {
    return NextResponse.json({ published: 0, message: 'No posts due' })
  }

  // Pre-fetch Mixpost accounts once for all posts
  const mixpostUrl = process.env.MIXPOST_API_URL
  const mixpostToken = process.env.MIXPOST_API_TOKEN
  const useMixpost = Boolean(mixpostUrl && mixpostToken)

  let brandAccountMap: Map<string, import('@/lib/mixpost/client').MixpostAccount[]> | null = null

  if (useMixpost) {
    const allAccounts = await fetchMixpostAccounts()
    if (allAccounts) {
      // Build brand stubs from the posts' brands for mapping
      const brandStubs = duePosts
        .filter(p => p.brands)
        .map(p => ({
          id: (p.brands as Record<string, unknown>).id as string,
          name: (p.brands as Record<string, unknown>).name as string,
          slug: (p.brands as Record<string, unknown>).slug as string,
          social_urls: ((p.brands as Record<string, unknown>).social_urls as Record<string, string>) ?? {},
        }))

      // De-duplicate by brand ID
      const uniqueBrands = Array.from(
        new Map(brandStubs.map(b => [b.id, b])).values()
      )

      brandAccountMap = mapAccountsToBrandsRaw(allAccounts, uniqueBrands)
    }
  }

  let published = 0
  let failed = 0

  for (const post of duePosts) {
    // Mark as publishing
    await supabase
      .from('scheduled_posts')
      .update({ status: 'publishing' })
      .eq('id', post.id)

    try {
      // Build post signature suffix
      const sig = (post.brands as Record<string, unknown>)?.post_signature as
        | { enabled?: boolean; text?: string; format?: string; mention?: string; hashtag?: string }
        | undefined
      let signatureSuffix = ''
      if (sig?.enabled) {
        if (sig.format === 'mention' && sig.mention) signatureSuffix = `\n\n${sig.mention}`
        else if (sig.format === 'hashtag' && sig.hashtag) signatureSuffix = ` ${sig.hashtag}`
        else if (sig.text) signatureSuffix = `\n\n${sig.text}`
      }

      let externalPostId: string | null = null

      if (useMixpost && brandAccountMap) {
        // ── Publish via Mixpost (self-hosted, free) ──

        // 1. Resolve Mixpost account IDs for this brand + platform
        const brandId = post.brand_id as string
        const brandAccounts = brandAccountMap.get(brandId) ?? []
        const accountIds = resolveAccountIdsForPlatform(post.platform, brandAccounts)

        if (accountIds.length === 0) {
          throw new Error(
            `No Mixpost account found for platform "${post.platform}" on brand "${(post.brands as Record<string, unknown>)?.name ?? brandId}". Connect this platform in Mixpost first.`
          )
        }

        // 2. Gather media URLs from media_items
        const mediaUrls: string[] = []

        // Carousel support: media_item_ids array
        const mediaItemIds = (post as Record<string, unknown>).media_item_ids as string[] | undefined
        if (mediaItemIds?.length) {
          const { data: mediaItems } = await supabase
            .from('media_items')
            .select('file_url')
            .in('id', mediaItemIds)
          mediaUrls.push(...(mediaItems ?? []).map((m: { file_url: string }) => m.file_url))
        }

        // Single media fallback (joined relation)
        if (mediaUrls.length === 0 && post.media_items?.file_url) {
          mediaUrls.push(post.media_items.file_url as string)
        }

        // image_url fallback (from publish_to_social or generate_image)
        if (mediaUrls.length === 0 && (post as Record<string, unknown>).image_url) {
          mediaUrls.push((post as Record<string, unknown>).image_url as string)
        }

        // 3. Upload media to Mixpost
        const mixpostMediaIds: number[] = []
        for (const url of mediaUrls) {
          const result = await uploadMediaFromUrl(url)
          if (result) mixpostMediaIds.push(result.id)
        }

        // 4. Build caption with hashtags + signature
        let caption = post.caption as string
        const hashtags = post.hashtags as string[] | null
        if (hashtags?.length) {
          caption += '\n\n' + hashtags.map((h: string) => `#${h}`).join(' ')
        }
        caption += signatureSuffix

        // 5. Build platform-specific options
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
        if (post.platform === 'youtube') {
          platformOptions.privacy_status = 'public'
          // AI-generated content disclosure (HeyGen videos, etc.)
          platformOptions.contains_synthetic_media = true
        }

        // 6. Build version (original version targets all selected accounts)
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

        // 7. Create post in Mixpost
        const result = await createMixpostPost({
          accounts: accountIds,
          versions: [version],
          schedule_now: true,
        })

        if (!result) {
          throw new Error('Failed to create Mixpost post — API returned no result')
        }

        externalPostId = result.id
      } else if (!useMixpost) {
        // ── Fallback: Ayrshare ──
        const { data: integration } = await supabase
          .from('user_integrations')
          .select('cached_data')
          .eq('user_id', post.user_id)
          .eq('provider', 'ayrshare')
          .single()

        const apiKey =
          (integration?.cached_data?.api_key as string) ||
          process.env.AYRSHARE_API_KEY ||
          null

        if (!apiKey) {
          throw new Error(
            'No publishing service configured. Set MIXPOST_API_URL + MIXPOST_API_TOKEN or an Ayrshare API key.'
          )
        }

        const mediaUrl = post.media_items?.file_url as string | undefined

        const ayrshareRes = await fetch('https://app.ayrshare.com/api/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            post: (post.caption as string) + signatureSuffix,
            platforms: [post.platform === 'twitter' ? 'twitter' : post.platform],
            ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}),
            ...(post.hashtags ? { hashtags: post.hashtags } : {}),
          }),
        })

        const result = await ayrshareRes.json()

        if (!ayrshareRes.ok) {
          throw new Error(result.message ?? `Ayrshare error ${ayrshareRes.status}`)
        }

        externalPostId = result.id ?? result.postId ?? null
      } else {
        // Mixpost configured but accounts fetch failed — retry next cron tick
        throw new Error('Mixpost configured but could not fetch accounts. Will retry.')
      }

      // Mark as publishing — webhook will confirm final 'published' status
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'publishing',
          external_post_id: externalPostId,
        })
        .eq('id', post.id)

      published++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'

      await supabase
        .from('scheduled_posts')
        .update({ status: 'failed', error: message })
        .eq('id', post.id)

      failed++
    }
  }

  return NextResponse.json({ published, failed, total: duePosts.length })
}
