import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { memoryStore } from '@/lib/ruflo/client'

// ---------------------------------------------------------------------------
// GET /api/memories — list memories for a brand
// POST /api/memories — store a project-bound memory
// DELETE /api/memories — delete a single project memory or a whole project
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

  // RLS ensures the actor can access the project. Memory reads then use the
  // immutable project id, never a namespace prefix that could match a sibling.
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, slug')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json(
      { error: 'Brand not found or access denied' },
      { status: 404 }
    )
  }

  // Fetch active memories for this exact project only.
  let query = supabase
    .from('agent_memories')
    .select(
      'id, key, value, memory_type, confidence, source, tags, created_at, updated_at, namespace'
    )
    .eq('user_id', user.id)
    .eq('brand_id', brand.id)
    .eq('isolation_status', 'active')
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

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const brandId = typeof body.brandId === 'string' ? body.brandId : ''
  const key = typeof body.key === 'string' ? body.key.slice(0, 200) : ''
  const value = typeof body.value === 'string' ? body.value.slice(0, 10_000) : ''
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 30)
    : []

  if (!brandId || !key || !value) {
    return NextResponse.json({ error: 'brandId, key and value are required' }, { status: 400 })
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('id, slug')
    .eq('id', brandId)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 404 })

  const requestedNamespace = typeof body.namespace === 'string' ? body.namespace : ''
  const permittedPrefix = `nrs-${brand.slug}-`
  const namespace = requestedNamespace.startsWith(permittedPrefix)
    ? requestedNamespace
    : `${permittedPrefix}overall`

  await memoryStore(key, value, namespace, tags, { brandId: brand.id, userId: user.id })
  return NextResponse.json({ stored: true })
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
  const scope = searchParams.get('scope') as 'single' | 'brand' | null

  if (!scope || !['single', 'brand'].includes(scope)) {
    return NextResponse.json(
      { error: 'scope must be single or brand' },
      { status: 400 }
    )
  }

  if (scope === 'single') {
    const id = searchParams.get('id')
    const brandId = searchParams.get('brandId')
    if (!id || !brandId) {
      return NextResponse.json(
        { error: 'id and brandId are required for single delete' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('agent_memories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('brand_id', brandId)
      .eq('isolation_status', 'active')

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
      .select('id')
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
      .eq('brand_id', brand.id)
      .eq('isolation_status', 'active')

    if (error) {
      console.error('[memories/DELETE] Brand delete error:', error.message)
      return NextResponse.json(
        { error: 'Failed to delete brand memories' },
        { status: 500 }
      )
    }

    return NextResponse.json({ deleted: count ?? 0 })
  }
}
