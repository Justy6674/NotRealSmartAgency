import { NextResponse } from 'next/server'
import { BrandWorkspaceAccessError, resolveBrandWorkspaceContext } from '@/lib/auth/brand-workspace'
import {
  buildDeskContext,
  createDeskConversationMetadata,
  readDeskContext,
  type DeskResultRef,
} from '@/lib/desk/context'
import { createClient } from '@/lib/supabase/server'

function outputKind(output: { output_type?: string; metadata?: unknown }): 'asset' | 'proposal' {
  const metadata = output.metadata as Record<string, unknown> | null
  return output.output_type === 'video'
    || Boolean(metadata?.canva_design_id)
    || Boolean(metadata?.asset_id)
    ? 'asset'
    : 'proposal'
}

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
  const previous = readDeskContext(conversation?.metadata)
  if (!conversation || !previous) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let workspace
  try {
    workspace = await resolveBrandWorkspaceContext(supabase, user.id, conversation.brand_id)
  } catch (error) {
    const status = error instanceof BrandWorkspaceAccessError ? error.status : 403
    return NextResponse.json({ error: 'Not found' }, { status })
  }
  if (conversation.user_id !== workspace.workspaceOwnerId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: outputs }, { data: drafts }] = await Promise.all([
    supabase
      .from('outputs')
      .select('id, output_type, title, content, metadata, created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', workspace.workspaceOwnerId)
      .eq('brand_id', conversation.brand_id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('scheduled_posts')
      .select('id, platform, caption, hashtags, status, metadata, created_at')
      .eq('user_id', workspace.workspaceOwnerId)
      .eq('brand_id', conversation.brand_id)
      .eq('status', 'draft')
      .contains('metadata', { desk_conversation_id: conversationId })
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const resultRefs: DeskResultRef[] = [
    ...(outputs ?? []).map((output) => ({ kind: outputKind(output), id: output.id } as DeskResultRef)),
    ...(drafts ?? []).map((draft) => ({ kind: 'draft', id: draft.id } as DeskResultRef)),
  ]
  const uniqueRefs = resultRefs.filter((ref, index, all) => all.findIndex((candidate) => candidate.kind === ref.kind && candidate.id === ref.id) === index)

  const context = buildDeskContext({
    actorUserId: user.id,
    mediaItemIds: previous.media_item_ids,
    intent: previous.intent,
    platforms: previous.platforms,
    policyVersion: previous.policy_version,
    resultRefs: uniqueRefs,
    state: uniqueRefs.length > 0 ? 'result_ready' : previous.state,
  })
  await supabase
    .from('conversations')
    .update({ metadata: createDeskConversationMetadata(context), updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', workspace.workspaceOwnerId)

  return NextResponse.json({ conversationId, context, outputs: outputs ?? [], drafts: drafts ?? [] })
}
