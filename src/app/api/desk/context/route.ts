import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { BrandWorkspaceAccessError, resolveBrandWorkspaceContext } from '@/lib/auth/brand-workspace'
import {
  buildDeskContext,
  createDeskConversationMetadata,
  readDeskContext,
} from '@/lib/desk/context'
import { createClient } from '@/lib/supabase/server'

const UpdateSchema = z.object({
  conversationId: z.string().uuid(),
  mediaItemIds: z.array(z.string().uuid()).max(10),
  intent: z.string().trim().max(2_000).nullable().optional(),
  platforms: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  state: z.enum(['collecting', 'working', 'needs_input', 'result_ready', 'completed']).optional(),
  resultRefs: z.array(z.object({
    kind: z.enum(['asset', 'proposal', 'draft']),
    id: z.string().uuid(),
  })).max(50).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const conversationId = new URL(request.url).searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'Conversation required' }, { status: 400 })

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, user_id, brand_id, metadata')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const workspace = await resolveBrandWorkspaceContext(supabase, user.id, conversation.brand_id)
    if (conversation.user_id !== workspace.workspaceOwnerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    const status = error instanceof BrandWorkspaceAccessError ? error.status : 403
    return NextResponse.json({ error: 'Not found' }, { status })
  }

  return NextResponse.json({ conversationId, context: readDeskContext(conversation.metadata) })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Desk context', details: parsed.error.issues }, { status: 400 })

  const { conversationId, mediaItemIds, intent, platforms, state, resultRefs } = parsed.data
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, user_id, brand_id, metadata')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let workspace
  try {
    workspace = await resolveBrandWorkspaceContext(supabase, user.id, conversation.brand_id)
  } catch (error) {
    const status = error instanceof BrandWorkspaceAccessError ? error.status : 403
    return NextResponse.json({ error: 'Not found' }, { status })
  }
  const { workspaceOwnerId } = workspace
  if (conversation.user_id !== workspaceOwnerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let mediaRows: Array<{ id: string }> = []
  if (mediaItemIds.length > 0) {
    const { data } = await supabase
      .from('media_items')
      .select('id')
      .eq('user_id', workspaceOwnerId)
      .eq('brand_id', conversation.brand_id)
      .in('id', mediaItemIds)
    mediaRows = data ?? []
  }
  if (mediaRows.length !== mediaItemIds.length) {
    return NextResponse.json({ error: 'One or more selected files are not available for this business.' }, { status: 403 })
  }

  const previous = readDeskContext(conversation.metadata)
  const context = buildDeskContext({
    actorUserId: user.id,
    mediaItemIds,
    intent: intent === undefined ? previous?.intent : intent,
    platforms: platforms ?? previous?.platforms,
    state: state ?? previous?.state,
    policyVersion: previous?.policy_version,
    resultRefs: resultRefs ?? previous?.result_refs,
  })

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ metadata: createDeskConversationMetadata(context), updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', workspaceOwnerId)
    .eq('brand_id', conversation.brand_id)
  if (updateError) return NextResponse.json({ error: 'NRS could not save this work context.' }, { status: 500 })

  return NextResponse.json({ conversationId, context })
}
