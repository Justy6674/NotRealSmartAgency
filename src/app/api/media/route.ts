import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')

  let query = supabase
    .from('media_items')
    .select('*, brands(name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query.limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'No id provided' }, { status: 400 })

  // Fetch item to get storage path
  const { data: item } = await supabase
    .from('media_items')
    .select('file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (item?.file_url) {
    // Extract storage path from public URL
    const urlParts = item.file_url.split('/storage/v1/object/public/media/')
    if (urlParts[1]) {
      await supabase.storage.from('media').remove([urlParts[1]])
    }
  }

  const { error } = await supabase
    .from('media_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
