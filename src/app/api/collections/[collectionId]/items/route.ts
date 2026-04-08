import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('media_collection_items')
    .select('*, media_items(id, file_url, file_name, file_type, thumbnail_url, tags, ai_description)')
    .eq('collection_id', collectionId)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { mediaItemIds } = body as { mediaItemIds: string[] }
  if (!mediaItemIds?.length) {
    return NextResponse.json({ error: 'mediaItemIds required' }, { status: 400 })
  }

  // Get current max position
  const { data: existing } = await supabase
    .from('media_collection_items')
    .select('position')
    .eq('collection_id', collectionId)
    .order('position', { ascending: false })
    .limit(1)

  const startPosition = (existing?.[0]?.position ?? -1) + 1

  const items = mediaItemIds.map((mediaItemId, i) => ({
    collection_id: collectionId,
    media_item_id: mediaItemId,
    position: startPosition + i,
  }))

  const { data, error } = await supabase
    .from('media_collection_items')
    .upsert(items, { onConflict: 'collection_id,media_item_id' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()

  // Reorder: { items: [{ id, position }] }
  if (body.items && Array.isArray(body.items)) {
    const updates = body.items as { id: string; position: number }[]
    for (const item of updates) {
      await supabase
        .from('media_collection_items')
        .update({ position: item.position })
        .eq('id', item.id)
        .eq('collection_id', collectionId)
    }
    return NextResponse.json({ success: true, reordered: updates.length })
  }

  // Update slide overrides: { id, slide_title, slide_subtitle, slide_caption, slide_type }
  const { id, slide_title, slide_subtitle, slide_caption, slide_type } = body
  if (!id) return NextResponse.json({ error: 'item id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (slide_title !== undefined) updates.slide_title = slide_title
  if (slide_subtitle !== undefined) updates.slide_subtitle = slide_subtitle
  if (slide_caption !== undefined) updates.slide_caption = slide_caption
  if (slide_type !== undefined) updates.slide_type = slide_type

  const { data, error } = await supabase
    .from('media_collection_items')
    .update(updates)
    .eq('id', id)
    .eq('collection_id', collectionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const { error } = await supabase
    .from('media_collection_items')
    .delete()
    .eq('id', itemId)
    .eq('collection_id', collectionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
