import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveGoal } from '@/lib/agents/goal-loop'
import { getOrCreateAgentRegistry } from '@/lib/agents/registry'

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
  if (typeof body.brand_id !== 'string') {
    return NextResponse.json({ error: 'Choose a brand before creating a task.' }, { status: 400 })
  }

  const activeGoal = await getActiveGoal(supabase, user.id, body.brand_id)
  if (!activeGoal) {
    return NextResponse.json({
      error: 'Set the end-user outcome for this brand in your NRS conversation before adding ongoing work.',
    }, { status: 409 })
  }

  const { user_id: _ignoredUserId, goal_id: _ignoredGoalId, ...task } = body
  const director = await getOrCreateAgentRegistry(supabase, user.id, 'overall')
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...task,
      user_id: user.id,
      goal_id: activeGoal.id,
      assigned_agent_id: director?.id ?? null,
      status: director ? 'assigned' : 'backlog',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
