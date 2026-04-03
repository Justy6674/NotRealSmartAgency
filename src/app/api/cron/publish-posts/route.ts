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
      // Fetch Ayrshare API key for the post owner
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('cached_data')
        .eq('user_id', post.user_id)
        .eq('provider', 'ayrshare')
        .single()

      if (!integration?.cached_data?.api_key) {
        throw new Error('Ayrshare API key not configured')
      }

      const apiKey = integration.cached_data.api_key as string
      const mediaUrl = post.media_items?.file_url

      // Post via Ayrshare
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

      // Mark as published
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_id: result.id ?? result.postId ?? null,
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
