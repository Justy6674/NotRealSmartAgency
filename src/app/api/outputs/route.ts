import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const outputType = searchParams.get('outputType')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  let query = supabase
    .from('outputs')
    .select('*, brands(name, slug)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (brandId) query = query.eq('brand_id', brandId)
  if (outputType) query = query.eq('output_type', outputType)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

const CreateOutputSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  outputType: z.string().default('other'),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateOutputSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { brandId, title, content, outputType, metadata } = parsed.data

  const { data, error } = await supabase
    .from('outputs')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      title,
      content,
      output_type: outputType,
      metadata: { ...metadata, source: 'manual_save', wordCount: content.split(/\s+/).length },
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
