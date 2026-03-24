import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const body = await request.json()

  // Handle special actions
  if (body.action === 'pause') {
    const { data, error } = await supabase
      .from('agent_registry')
      .update({ status: 'paused' })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  if (body.action === 'resume') {
    const { data, error } = await supabase
      .from('agent_registry')
      .update({ status: 'idle' })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  // General update
  const { action: _action, ...updates } = body
  const { data, error } = await supabase
    .from('agent_registry')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
