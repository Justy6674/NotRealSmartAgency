import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { BrandWorkspaceAccessError, resolveBrandWorkspaceContext } from '@/lib/auth/brand-workspace'
import { buildDeskContext, createDeskConversationMetadata } from '@/lib/desk/context'
import type { AgentType } from '@/types/database'

const VALID_AGENT_TYPES: AgentType[] = [
  'overall', 'content', 'seo', 'paid_ads', 'strategy', 'email',
  'growth', 'brand', 'competitor', 'website', 'compliance',
  'analytics', 'automation',
  // Archived
  'martech',
]

const CreateSchema = z.object({
  brandId: z.string().uuid(),
  agentType: z.enum(VALID_AGENT_TYPES as [AgentType, ...AgentType[]]),
  title: z.string().optional(),
  source: z.literal('nrs_desk').optional(),
  mediaItemIds: z.array(z.string().uuid()).max(10).optional(),
  platforms: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const agentType = searchParams.get('agentType')

  let query = supabase
    .from('conversations')
    .select('*')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (brandId) query = query.eq('brand_id', brandId)
  if (agentType) query = query.eq('agent_type', agentType)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { brandId, agentType, title, source, mediaItemIds, platforms } = parsed.data

  let workspace
  try {
    workspace = await resolveBrandWorkspaceContext(supabase, user.id, brandId)
  } catch (error) {
    const status = error instanceof BrandWorkspaceAccessError ? error.status : 403
    return NextResponse.json({ error: 'Business access denied' }, { status })
  }

  const { workspaceOwnerId } = workspace

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: workspaceOwnerId,
      brand_id: brandId,
      agent_type: agentType,
      title: title ?? null,
      ...(source === 'nrs_desk'
        ? {
            metadata: createDeskConversationMetadata(buildDeskContext({
              actorUserId: user.id,
              mediaItemIds,
              platforms,
            })),
          }
        : {}),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
