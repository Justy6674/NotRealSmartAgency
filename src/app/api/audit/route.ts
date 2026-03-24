import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')
  const action = searchParams.get('action')
  const limit = parseInt(searchParams.get('limit') ?? '100')

  let query = supabase
    .from('audit_log')
    .select('*, agent_registry:agent_id(agent_type, department)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agentId) query = query.eq('agent_id', agentId)
  if (action) query = query.eq('action', action)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
