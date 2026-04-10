import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const search = searchParams.get('search')
  const tags = searchParams.get('tags') // comma-separated
  const archived = searchParams.get('archived') ?? 'false'
  const type = searchParams.get('type') // 'image' | 'video' | 'audio'
  const status = searchParams.get('status') // transcription_status
  const sort = searchParams.get('sort') ?? 'newest'
  const action = searchParams.get('action') // 'tags' for distinct tags

  // Return distinct tags for the brand
  if (action === 'tags') {
    let tagQuery = supabase
      .from('media_items')
      .select('tags')
      .eq('user_id', user.id)

    if (brandId) tagQuery = tagQuery.eq('brand_id', brandId)

    const { data, error } = await tagQuery

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const allTags = [...new Set(data?.flatMap(d => d.tags ?? []) ?? [])]
    return NextResponse.json({ tags: allTags.sort() })
  }

  // Build the main query with filters
  let query = supabase
    .from('media_items')
    .select('*, brands(name, slug)')
    .eq('user_id', user.id)

  if (brandId) query = query.eq('brand_id', brandId)

  // Archive filter (default: hide archived)
  if (archived !== 'true') query = query.eq('is_archived', false)

  // Type filter
  if (type === 'image') query = query.like('file_type', 'image/%')
  else if (type === 'video') query = query.like('file_type', 'video/%')
  else if (type === 'audio') query = query.like('file_type', 'audio/%')

  // Status filter
  if (status) query = query.eq('transcription_status', status)

  // Tag filter
  if (tags) {
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)
    if (tagArray.length) query = query.contains('tags', tagArray)
  }

  // Search (ILIKE on file_name and transcription)
  if (search) {
    query = query.or(`file_name.ilike.%${search}%,transcription.ilike.%${search}%`)
  }

  // Sort
  if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (sort === 'name') query = query.order('file_name', { ascending: true })
  else if (sort === 'file_created') query = query.order('file_created_at', { ascending: false, nullsFirst: false })
  else if (sort !== 'most_used') query = query.order('created_at', { ascending: false }) // newest (default)

  query = query.limit(100)

  const { data: mediaItems, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with usage data from scheduled_posts
  if (mediaItems?.length) {
    const mediaIds = mediaItems.map(m => m.id)

    const { data: usageData } = await supabase
      .from('scheduled_posts')
      .select('media_item_id')
      .in('media_item_id', mediaIds)
      .in('status', ['published', 'scheduled', 'publishing'])

    // Count usage per media item
    const usageMap = new Map<string, { count: number; lastPublished: string | null }>()
    for (const row of usageData ?? []) {
      if (!row.media_item_id) continue
      const existing = usageMap.get(row.media_item_id) ?? { count: 0, lastPublished: null }
      existing.count++
      usageMap.set(row.media_item_id, existing)
    }

    // Fetch published_at dates for last-published tracking
    const { data: publishedData } = await supabase
      .from('scheduled_posts')
      .select('media_item_id, published_at')
      .in('media_item_id', mediaIds)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })

    for (const row of publishedData ?? []) {
      if (!row.media_item_id) continue
      const existing = usageMap.get(row.media_item_id)
      if (existing && !existing.lastPublished) {
        existing.lastPublished = row.published_at
      }
    }

    // Enrich media items with usage
    const enriched = mediaItems.map(m => ({
      ...m,
      usage_count: usageMap.get(m.id)?.count ?? 0,
      last_published_at: usageMap.get(m.id)?.lastPublished ?? null,
    }))

    // Sort by most_used if requested (done in JS since it's a computed field)
    if (sort === 'most_used') {
      enriched.sort((a, b) => b.usage_count - a.usage_count)
    }

    return NextResponse.json(enriched)
  }

  return NextResponse.json(mediaItems ?? [])
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()

  // Single item update
  if (body.id) {
    const updates: Record<string, unknown> = {}
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.is_archived !== undefined) updates.is_archived = body.is_archived
    if (typeof body.file_name === 'string' && body.file_name.trim()) {
      updates.file_name = body.file_name.trim()
    }

    // Alt text + arbitrary metadata patches are merged into the existing
    // metadata JSONB column so we don't need a schema migration. The
    // process_media tool reads metadata.alt_text when publishing.
    const needsMetadataMerge =
      typeof body.alt_text === 'string' || (body.metadata && typeof body.metadata === 'object')
    if (needsMetadataMerge) {
      const { data: existing } = await supabase
        .from('media_items')
        .select('metadata')
        .eq('id', body.id)
        .eq('user_id', user.id)
        .single()

      const currentMeta = (existing?.metadata ?? {}) as Record<string, unknown>
      const merged: Record<string, unknown> = {
        ...currentMeta,
        ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
      }
      if (typeof body.alt_text === 'string') {
        merged.alt_text = body.alt_text.trim()
      }
      updates.metadata = merged
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('media_items')
      .update(updates)
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Bulk update
  if (body.ids?.length) {
    const updates: Record<string, unknown> = {}
    if (body.is_archived !== undefined) updates.is_archived = body.is_archived

    // For tags, handle add/remove operations
    if (body.tags_add?.length || body.tags_remove?.length) {
      // Fetch current items first
      const { data: items } = await supabase
        .from('media_items')
        .select('id, tags')
        .in('id', body.ids)
        .eq('user_id', user.id)

      for (const item of items ?? []) {
        let newTags = [...(item.tags ?? [])]
        if (body.tags_add) newTags = [...new Set([...newTags, ...body.tags_add])]
        if (body.tags_remove) newTags = newTags.filter((t: string) => !body.tags_remove.includes(t))

        await supabase
          .from('media_items')
          .update({ ...updates, tags: newTags })
          .eq('id', item.id)
          .eq('user_id', user.id)
      }
    } else if (Object.keys(updates).length) {
      await supabase
        .from('media_items')
        .update(updates)
        .in('id', body.ids)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ updated: body.ids.length })
  }

  return NextResponse.json({ error: 'Provide id or ids' }, { status: 400 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'No id provided' }, { status: 400 })

  // Fetch item to get storage path
  const { data: item } = await supabase
    .from('media_items')
    .select('file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (item?.file_url) {
    // Extract storage path from public URL
    const urlParts = item.file_url.split('/storage/v1/object/public/media/')
    if (urlParts[1]) {
      await supabase.storage.from('media').remove([urlParts[1]])
    }
  }

  const { error } = await supabase
    .from('media_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
