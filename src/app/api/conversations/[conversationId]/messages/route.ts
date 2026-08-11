import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BrandWorkspaceAccessError, resolveBrandWorkspaceContext } from '@/lib/auth/brand-workspace'

interface RouteParams {
  params: Promise<{ conversationId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { conversationId } = await params

  // RLS historically granted accepted teammates owner-wide conversation
  // visibility. Recheck the exact brand assignment before restoring a Desk
  // thread so a restricted teammate cannot read another business by UUID.
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, user_id, brand_id, agent_type')
    .eq('id', conversationId)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  try {
    const workspace = await resolveBrandWorkspaceContext(supabase, user.id, conv.brand_id)
    if (conv.user_id !== workspace.workspaceOwnerId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
  } catch (cause) {
    const status = cause instanceof BrandWorkspaceAccessError ? cause.status : 403
    return NextResponse.json({ error: 'Conversation not found' }, { status })
  }

  // Load messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    conversation: conv,
    messages: messages ?? [],
  })
}
