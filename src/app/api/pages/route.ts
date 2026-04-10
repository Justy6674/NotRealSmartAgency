import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'

/**
 * Pages API — stores pages as outputs with output_type='landing_page'
 * and blocks in metadata.blocks. Avoids a migration.
 */

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const id = searchParams.get('id')

  // Single page by ID
  if (id) {
    const { data, error } = await supabase
      .from('outputs')
      .select('*')
      .eq('id', id)
      .eq('output_type', 'landing_page')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json(data)
  }

  // List pages for brand
  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('outputs')
    .select('*, brands(name, slug)')
    .eq('brand_id', brandId)
    .eq('output_type', 'landing_page')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

const CreatePageSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.string(),
    data: z.record(z.unknown()),
  })),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreatePageSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { brandId, title, slug, blocks } = parsed.data

  const { data, error } = await supabase
    .from('outputs')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      title,
      content: `Page: ${title}`,
      output_type: 'landing_page',
      metadata: {
        slug,
        blocks,
        source: 'page_builder',
        blockCount: blocks.length,
      },
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

const UpdatePageSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.string(),
    data: z.record(z.unknown()),
  })),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = UpdatePageSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { id, title, slug, blocks } = parsed.data

  const { data, error } = await supabase
    .from('outputs')
    .update({
      title,
      content: `Page: ${title}`,
      metadata: {
        slug,
        blocks,
        source: 'page_builder',
        blockCount: blocks.length,
      },
    })
    .eq('id', id)
    .eq('output_type', 'landing_page')
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('outputs')
    .delete()
    .eq('id', id)
    .eq('output_type', 'landing_page')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
