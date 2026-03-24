import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const { data, error } = await supabase
    .from('agent_registry')
    .select('*, agent_configs!inner(display_name, description, icon, system_prompt)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('role', { ascending: true })
    .order('department', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('agent_registry')
    .insert({ ...body, user_id: user.id })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
