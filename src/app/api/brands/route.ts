import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'

const CreateBrandSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
  github_url: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  niche: z.string().min(1),
  business_stage: z.string().optional(),
  tone_of_voice: z.record(z.unknown()).optional(),
  target_audience: z.record(z.unknown()).optional(),
  competitors: z.array(z.record(z.unknown())).optional(),
  compliance_flags: z.record(z.unknown()).optional(),
  content_pillars: z.array(z.string()).optional(),
  brand_colours: z.record(z.unknown()).optional(),
  social_urls: z.record(z.unknown()).optional(),
  extra_context: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateBrandSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('brands')
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Brand ID required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('brands')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
