import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/agents/audit'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const body = await request.json()
  const { status, decision_note } = body

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('approval_queue')
    .update({
      status,
      decision_note: decision_note ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logAudit({
    supabase,
    userId: user.id,
    agentId: data.agent_id,
    taskId: data.task_id,
    action: `approval_${status}`,
    entityType: 'approval',
    entityId: id,
    detail: { actionType: data.action_type, decisionNote: decision_note },
  })

  return NextResponse.json(data)
}
