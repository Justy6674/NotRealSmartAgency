import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'

/**
 * Post Activity API — Phase 4b of the Mixpost UI port.
 *
 * GET  /api/post-activity?scheduled_post_id=<uuid>&limit=100
 *      Lists activity (comments + system events) for a scheduled post,
 *      newest first. RLS guarantees the caller can only see activity
 *      on posts they have brand access to.
 *
 * POST /api/post-activity
 *      Body: { scheduled_post_id: uuid, type: 'comment', body: string }
 *      Inserts a new comment by the authenticated user. Only 'comment'
 *      is accepted via the HTTP surface — system events ('created',
 *      'published', etc.) are inserted directly by server code (webhook
 *      handlers, scheduled-posts route) via the admin client.
 */

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const scheduledPostId = searchParams.get('scheduled_post_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)

  if (!scheduledPostId) {
    return NextResponse.json(
      { error: 'scheduled_post_id is required' },
      { status: 400 },
    )
  }

  // RLS does the access check — we don't need to pre-verify the post.
  // If the user can't access the scheduled_post, the select returns [].
  const { data, error } = await supabase
    .from('post_activity')
    .select(
      `
      id,
      scheduled_post_id,
      user_id,
      type,
      body,
      metadata,
      created_at,
      users:user_id (
        id,
        email,
        raw_user_meta_data
      )
    `,
    )
    .eq('scheduled_post_id', scheduledPostId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

const PostSchema = z.object({
  scheduled_post_id: z.string().uuid(),
  type: z.literal('comment'),
  body: z.string().min(1).max(5000),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let parsed
  try {
    parsed = PostSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    )
  }

  // Verify the scheduled post exists and the caller can write to it.
  // RLS would block the insert anyway, but checking first gives a
  // cleaner 404/403 response than the generic RLS error.
  const { data: post, error: postErr } = await supabase
    .from('scheduled_posts')
    .select('id, user_id')
    .eq('id', parsed.scheduled_post_id)
    .single()

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('post_activity')
    .insert({
      scheduled_post_id: parsed.scheduled_post_id,
      user_id: user.id,
      type: 'comment',
      body: parsed.body,
      metadata: {},
    })
    .select(
      `
      id,
      scheduled_post_id,
      user_id,
      type,
      body,
      metadata,
      created_at
    `,
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
