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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  const countsParam = searchParams.get('counts')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)

  // Counts mode — used by the Review tab to show activity badges on
  // draft cards without N+1 fetches. Expects a comma-separated list
  // of scheduled_post_ids. RLS filters to brand-accessible posts.
  if (countsParam) {
    const ids = countsParam
      .split(',')
      .map((s) => s.trim())
      // Non-uuids are history ids, which have no rows here. Passing one to
      // `.in()` makes Postgres reject the whole query, so every badge on the
      // page would disappear because of one row that was never ours.
      .filter((s) => UUID_PATTERN.test(s))
    if (ids.length === 0) {
      return NextResponse.json({})
    }
    const { data, error } = await supabase
      .from('post_activity')
      .select('scheduled_post_id')
      .in('scheduled_post_id', ids)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const key = row.scheduled_post_id as string
      counts[key] = (counts[key] ?? 0) + 1
    }
    return NextResponse.json(counts)
  }

  if (!scheduledPostId) {
    return NextResponse.json(
      { error: 'scheduled_post_id is required' },
      { status: 400 },
    )
  }

  // The Posts list now shows history published outside this app alongside the
  // desk's own rows, and those carry the publisher's id, not a uuid. Postgres
  // rejects a non-uuid comparison outright, so the row's Activity tab would
  // show a database error where the honest answer is "there is nothing here" —
  // that post has no activity on this desk because it never happened here.
  if (!UUID_PATTERN.test(scheduledPostId)) {
    return NextResponse.json([])
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
