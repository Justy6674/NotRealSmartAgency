import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createDraftPost } from '@/lib/posts/create-draft'

// Mixpost sync can take ~6 minutes per video transcode. Run on Node runtime
// (not edge) and bump maxDuration so the request doesn't time out before the
// sync completes. The sync itself is fired with `void` so the HTTP response
// returns immediately — but Vercel still needs the function context alive
// for the background work to finish.
export const runtime = 'nodejs'
export const maxDuration = 600

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  let query = supabase
    .from('scheduled_posts')
    .select('*')
    .eq('brand_id', brandId)
    .order('scheduled_at', { ascending: true })

  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  scheduled_at: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled']).optional(),
  post_type: z.enum(['single', 'carousel', 'reel', 'video']).optional(),
  media_item_ids: z.array(z.string().uuid()).optional(),
  content_type: z.enum(['entertainment', 'education', 'inspiration', 'promotional']).optional(),
  content_pillar: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = PatchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { id, metadata: incomingMetadata, ...updates } = parsed.data

  // Only include fields that were provided
  const fieldsToUpdate: Record<string, unknown> = {}
  if (updates.scheduled_at !== undefined) fieldsToUpdate.scheduled_at = updates.scheduled_at
  if (updates.caption !== undefined) fieldsToUpdate.caption = updates.caption
  if (updates.hashtags !== undefined) fieldsToUpdate.hashtags = updates.hashtags
  if (updates.status !== undefined) fieldsToUpdate.status = updates.status
  if (updates.post_type !== undefined) fieldsToUpdate.post_type = updates.post_type
  if (updates.media_item_ids !== undefined) fieldsToUpdate.media_item_ids = updates.media_item_ids
  if (updates.content_type !== undefined) fieldsToUpdate.content_type = updates.content_type
  if (updates.content_pillar !== undefined) fieldsToUpdate.content_pillar = updates.content_pillar

  // Deep merge metadata (fetch current, spread, update)
  if (incomingMetadata !== undefined) {
    const { data: current } = await supabase
      .from('scheduled_posts')
      .select('metadata')
      .eq('id', id)
      .single()

    fieldsToUpdate.metadata = {
      ...((current?.metadata as Record<string, unknown>) ?? {}),
      ...incomingMetadata,
    }
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scheduled_posts')
    .update(fieldsToUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

const CreateSchema = z.object({
  brandId: z.string().uuid(),
  platform: z.enum(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).optional().default([]),
  scheduled_at: z.string(),
  status: z.enum(['draft', 'scheduled']).optional().default('draft'),
  media_item_id: z.string().uuid().optional(),
  media_item_ids: z.array(z.string().uuid()).optional().default([]),
  post_type: z.enum(['single', 'carousel', 'reel', 'video']).optional().default('single'),
  content_type: z.enum(['entertainment', 'education', 'inspiration', 'promotional']).optional(),
  content_pillar: z.string().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { brandId, platform, caption, hashtags, scheduled_at, status, media_item_id, media_item_ids, post_type, content_type, content_pillar, metadata } = parsed.data

  // Verify brand belongs to the user
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', user.id)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 403 })
  }

  // createDraftPost owns the insert AND the Mixpost push, so the browser and
  // every AI path create drafts the same way. awaitMixpost:false keeps this
  // route's reply instant — the Review tab already polls for the Mixpost pill.
  let created
  try {
    created = await createDraftPost({
      supabase,
      userId: user.id,
      brandId,
      platform,
      caption,
      hashtags,
      mediaItemIds: media_item_ids ?? (media_item_id ? [media_item_id] : []),
      postType: post_type,
      status,
      scheduledAt: scheduled_at,
      metadata: metadata as Record<string, unknown> | undefined,
      contentType: content_type,
      contentPillar: content_pillar,
      awaitMixpost: false,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('scheduled_posts')
    .select()
    .eq('id', created.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Draft saved but could not be read back' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
