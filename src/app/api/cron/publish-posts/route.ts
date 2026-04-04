export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Find posts due for publishing
  const { data: duePosts, error } = await supabase
    .from('scheduled_posts')
    .select('*, brands(name, social_urls), media_items(file_url, file_name)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20)

  if (error || !duePosts?.length) {
    return NextResponse.json({ published: 0, message: 'No posts due' })
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
      const mediaUrl = post.media_items?.file_url
      const mixpostUrl = process.env.MIXPOST_API_URL // e.g. https://mixpost.notrealsmart.com.au/mixpost
      const mixpostToken = process.env.MIXPOST_API_TOKEN

      let externalPostId: string | null = null

      if (mixpostUrl && mixpostToken) {
        // ── Publish via Mixpost (self-hosted, free) ──
        const platformMap: Record<string, string> = {
          instagram: 'instagram',
          facebook: 'facebook_page',
          linkedin: 'linkedin',
          twitter: 'x',
          tiktok: 'tiktok',
          youtube: 'youtube',
        }

        const mixpostRes = await fetch(`${mixpostUrl}/api/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mixpostToken}`,
          },
          body: JSON.stringify({
            body: [{ body: post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.map((h: string) => `#${h}`).join(' ') : '') }],
            accounts: [], // Mixpost will use all connected accounts of the specified type
            schedule_at: new Date().toISOString(),
            status: 1, // 1 = published
          }),
        })

        const result = await mixpostRes.json()

        if (!mixpostRes.ok) {
          throw new Error(result.message ?? `Mixpost error ${mixpostRes.status}`)
        }

        externalPostId = result.data?.id ?? result.id ?? null
      } else {
        // ── Fallback: Ayrshare ──
        const { data: integration } = await supabase
          .from('user_integrations')
          .select('cached_data')
          .eq('user_id', post.user_id)
          .eq('provider', 'ayrshare')
          .single()

        const apiKey = (integration?.cached_data?.api_key as string) || process.env.AYRSHARE_API_KEY || null

        if (!apiKey) {
          throw new Error('No publishing service configured. Set MIXPOST_API_URL + MIXPOST_API_TOKEN or an Ayrshare API key.')
        }

        const ayrshareRes = await fetch('https://app.ayrshare.com/api/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            post: post.caption,
            platforms: [post.platform === 'twitter' ? 'twitter' : post.platform],
            ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}),
            ...(post.hashtags?.length ? { hashtags: post.hashtags } : {}),
          }),
        })

        const result = await ayrshareRes.json()

        if (!ayrshareRes.ok) {
          throw new Error(result.message ?? `Ayrshare error ${ayrshareRes.status}`)
        }

        externalPostId = result.id ?? result.postId ?? null
      }

      // Mark as published
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
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
