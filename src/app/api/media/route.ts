import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'

/**
 * POST /api/media — file a picture or GIF that lives somewhere else.
 *
 * No re-upload to storage; the supplier's URL is stored directly.
 *
 * Two things this used to drop on the floor:
 *
 *   1. **The credit.** A stock picture arrives with a photographer's name
 *      attached and terms that say it travels with the file. Storing the file
 *      and not the credit meant the only place it existed was the grid he
 *      picked from, which he then navigated away from.
 *   2. **The processing.** Every other way a `media_items` row is born hands it
 *      to `runMediaProcessingPipeline`, which owns every mutation of that table
 *      — tags, description, thumbnail. This path inserted and stopped, so an
 *      imported picture had no description and no tags and was invisible to
 *      every search the owner would think to run.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { brandId, file_url, file_name, file_type, source, metadata, attribution, alt_text } = body

  if (!brandId || !file_url) {
    return NextResponse.json({ error: 'brandId and file_url are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('media_items')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      file_url,
      file_name: file_name ?? 'Untitled',
      file_type: file_type ?? 'image/jpeg',
      source_type: 'import' as const,
      tags: source ? [source] : [],
      metadata: {
        ...(metadata ?? {}),
        external_source: source ?? null,
        ...(typeof attribution === 'string' && attribution.trim()
          ? { attribution: attribution.trim() }
          : {}),
        ...(typeof alt_text === 'string' && alt_text.trim()
          ? { alt_text: alt_text.trim() }
          : {}),
      },
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Same pipeline as an upload, and for the same reason: one function owns
  // every write to this table. Failure is logged, never surfaced — the picture
  // is already in the library and a missing description is not his problem to
  // act on. Note there is no `status` column here; an update carrying one is
  // rejected wholesale by PostgREST and takes the rest of the statement with it.
  after(async () => {
    const result = await runMediaProcessingPipeline({
      supabase: createAdminClient(),
      mediaItemId: data.id,
    })
    if (!result.success) console.error(`[media:${data.id}] processing failed: ${result.error}`)
  })

  return NextResponse.json(data)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const idsParam = searchParams.get('ids')
  const idList = (idsParam ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50)
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
  if (idList.length) query = query.in('id', idList)

  // Archive filter (default: hide archived). A Posts-row lookup by id must
  // still return the still even if that file was later archived.
  if (!idList.length && archived !== 'true') query = query.eq('is_archived', false)

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
  // Choosing eight files and deleting them is one action to the person doing
  // it. Eight round trips is how the fifth one fails silently and the grid
  // comes back with a file he watched himself delete.
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 100)

  const targets = id ? [id] : ids
  if (targets.length === 0) return NextResponse.json({ error: 'No id provided' }, { status: 400 })

  // Fetch the rows first, for their storage paths. Scoped by user_id so an id
  // belonging to somebody else selects nothing rather than deleting something.
  const { data: rows } = await supabase
    .from('media_items')
    .select('id, file_url')
    .in('id', targets)
    .eq('user_id', user.id)

  const storagePaths = (rows ?? [])
    .map((row) => row.file_url?.split('/storage/v1/object/public/media/')[1])
    .filter((path): path is string => Boolean(path))

  if (storagePaths.length) {
    await supabase.storage.from('media').remove(storagePaths)
  }

  const { error } = await supabase
    .from('media_items')
    .delete()
    .in('id', targets)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true, count: rows?.length ?? 0 })
}
