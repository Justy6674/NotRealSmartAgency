import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId')
  if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })

  const { data: post, error } = await supabase
    .from('scheduled_posts')
    .select('*, media_items(file_url, file_name)')
    .eq('id', postId)
    .eq('user_id', user.id)
    .single()

  if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Build caption with hashtags appended
  const captionWithHashtags = (post.caption as string) +
    (post.hashtags?.length
      ? '\n\n' + (post.hashtags as string[]).map((h: string) => `#${h}`).join(' ')
      : '')

  return NextResponse.json({
    platform: post.platform,
    caption: captionWithHashtags,
    hashtags: post.hashtags ?? [],
    mediaUrl: post.media_items?.file_url ?? null,
    mediaFileName: post.media_items?.file_name ?? null,
    scheduledAt: post.scheduled_at,
  })
}
