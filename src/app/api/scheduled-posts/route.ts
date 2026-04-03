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
  const from = searchParams.get('from')
  const to = searchParams.get('to')

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
  status: z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled']).optional(),
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

  const { id, ...updates } = parsed.data

  // Only include fields that were provided
  const fieldsToUpdate: Record<string, unknown> = {}
  if (updates.scheduled_at !== undefined) fieldsToUpdate.scheduled_at = updates.scheduled_at
  if (updates.caption !== undefined) fieldsToUpdate.caption = updates.caption
  if (updates.status !== undefined) fieldsToUpdate.status = updates.status

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
