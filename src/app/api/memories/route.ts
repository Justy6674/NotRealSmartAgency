import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/memories — list memories for a brand
// DELETE /api/memories — delete memories (single, brand, or all)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const typeFilter = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  if (!brandId) {
    return NextResponse.json(
      { error: 'brandId is required' },
      { status: 400 }
    )
  }

  // Look up brand slug from brandId (RLS ensures user owns the brand)
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('slug')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json(
      { error: 'Brand not found or access denied' },
      { status: 404 }
    )
  }

  // Fetch memories for this brand namespace
  let query = supabase
    .from('agent_memories')
    .select(
      'id, key, value, memory_type, confidence, source, tags, created_at, updated_at, namespace'
    )
    .eq('user_id', user.id)
    .like('namespace', `nrs-${brand.slug}%`)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (typeFilter) {
    query = query.eq('memory_type', typeFilter)
  }

  const { data: memories, error } = await query

  if (error) {
    console.error('[memories/GET] Query error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    )
  }

  return NextResponse.json(memories ?? [])
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope') as 'single' | 'brand' | 'all' | null

  if (!scope || !['single', 'brand', 'all'].includes(scope)) {
    return NextResponse.json(
      { error: 'scope must be single, brand, or all' },
      { status: 400 }
    )
  }

  if (scope === 'single') {
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'id is required for single delete' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('agent_memories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[memories/DELETE] Single delete error:', error.message)
      return NextResponse.json(
        { error: 'Failed to delete memory' },
        { status: 500 }
      )
    }

    return NextResponse.json({ deleted: 1 })
  }

  if (scope === 'brand') {
    const brandId = searchParams.get('brandId')
    if (!brandId) {
      return NextResponse.json(
        { error: 'brandId is required for brand delete' },
        { status: 400 }
      )
    }

    const { data: brand } = await supabase
      .from('brands')
      .select('slug')
      .eq('id', brandId)
      .single()

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 404 }
      )
    }

    const { count, error } = await supabase
      .from('agent_memories')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .like('namespace', `nrs-${brand.slug}%`)

    if (error) {
      console.error('[memories/DELETE] Brand delete error:', error.message)
      return NextResponse.json(
        { error: 'Failed to delete brand memories' },
        { status: 500 }
      )
    }

    return NextResponse.json({ deleted: count ?? 0 })
  }

  // scope === 'all'
  const { count, error } = await supabase
    .from('agent_memories')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)

  if (error) {
    console.error('[memories/DELETE] All delete error:', error.message)
    return NextResponse.json(
      { error: 'Failed to delete all memories' },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted: count ?? 0 })
}
