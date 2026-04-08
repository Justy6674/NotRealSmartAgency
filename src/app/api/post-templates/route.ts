import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  const platform = searchParams.get('platform')

  let query = supabase
    .from('post_templates')
    .select('*')
    .eq('brand_id', brandId)
    .order('name')

  if (platform) query = query.or(`platform.eq.${platform},platform.is.null`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { brandId, name, captionTemplate, defaultHashtags, platform, variables } = await request.json()
  if (!brandId || !name || !captionTemplate) {
    return NextResponse.json({ error: 'brandId, name, and captionTemplate required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('post_templates')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      name,
      caption_template: captionTemplate,
      default_hashtags: defaultHashtags ?? [],
      platform: platform ?? null,
      variables: variables ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id, name, captionTemplate, defaultHashtags, platform, variables } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (captionTemplate !== undefined) updates.caption_template = captionTemplate
  if (defaultHashtags !== undefined) updates.default_hashtags = defaultHashtags
  if (platform !== undefined) updates.platform = platform
  if (variables !== undefined) updates.variables = variables

  const { data, error } = await supabase
    .from('post_templates')
    .update(updates)
    .eq('id', id)
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
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('post_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
