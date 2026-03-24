import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const agentId = searchParams.get('agentId')
  const brandId = searchParams.get('brandId')
  const goalId = searchParams.get('goalId')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  let query = supabase
    .from('tasks')
    .select('*, agent_registry:assigned_agent_id(agent_type, department, role), brands:brand_id(name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (agentId) query = query.eq('assigned_agent_id', agentId)
  if (brandId) query = query.eq('brand_id', brandId)
  if (goalId) query = query.eq('goal_id', goalId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...body, user_id: user.id })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
