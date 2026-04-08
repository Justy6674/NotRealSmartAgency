import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const type = searchParams.get('type') // carousel, campaign, album, story_set
  const archived = searchParams.get('archived') === 'true'

  let query = supabase
    .from('media_collections')
    .select('*, media_collection_items(*, media_items(id, file_url, file_name, file_type, thumbnail_url))')
    .eq('user_id', user.id)
    .eq('is_archived', archived)
    .order('created_at', { ascending: false })

  if (brandId) query = query.eq('brand_id', brandId)
  if (type) query = query.eq('collection_type', type)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort items by position within each collection
  const collections = (data ?? []).map(c => ({
    ...c,
    media_collection_items: (c.media_collection_items ?? []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    ),
  }))

  return NextResponse.json(collections)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { brandId, name, description, collectionType, mediaItemIds } = body as {
    brandId: string
    name: string
    description?: string
    collectionType?: string
    mediaItemIds?: string[]
  }

  if (!brandId || !name) {
    return NextResponse.json({ error: 'brandId and name are required' }, { status: 400 })
  }

  // Create the collection
  const { data: collection, error: collError } = await supabase
    .from('media_collections')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      name,
      description: description ?? null,
      collection_type: collectionType ?? 'carousel',
    })
    .select()
    .single()

  if (collError) return NextResponse.json({ error: collError.message }, { status: 500 })

  // Add items if provided
  if (mediaItemIds?.length) {
    const items = mediaItemIds.map((mediaItemId, i) => ({
      collection_id: collection.id,
      media_item_id: mediaItemId,
      position: i,
    }))

    const { error: itemsError } = await supabase
      .from('media_collection_items')
      .insert(items)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Set cover image from first item
    const { data: firstItem } = await supabase
      .from('media_items')
      .select('file_url')
      .eq('id', mediaItemIds[0])
      .single()

    if (firstItem) {
      await supabase
        .from('media_collections')
        .update({ cover_image_url: firstItem.file_url })
        .eq('id', collection.id)
    }
  }

  return NextResponse.json(collection, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { id, name, description, is_archived } = body as {
    id: string
    name?: string
    description?: string
    is_archived?: boolean
  }

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (is_archived !== undefined) updates.is_archived = is_archived

  const { data, error } = await supabase
    .from('media_collections')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('media_collections')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
