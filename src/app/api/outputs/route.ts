import { NextResponse } from 'next/server'
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
