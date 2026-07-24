import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hashTelegramPairCode, newTelegramPairCode } from '@/lib/telegram/telegram-pairing'

export const dynamic = 'force-dynamic'

/**
 * Creates a single-use pairing command for the private NRS Telegram channel.
 * The caller chooses the projects before the command exists; the raw code is
 * returned once and its hash is the only value persisted server-side.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const untrustedProjectIds: unknown[] = Array.isArray(body.project_ids) ? body.project_ids : []
  const projectIds = [...new Set(
    untrustedProjectIds.filter((value): value is string => typeof value === 'string' && value.length > 0),
  )]

  if (projectIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one project before pairing Telegram.' }, { status: 400 })
  }

  // This RLS-scoped lookup is the authority for the owner’s selectable
  // projects. A client-supplied UUID can never create a cross-owner pairing.
  const { data: permittedProjects, error: projectsError } = await supabase
    .from('brands')
    .select('id')
    .in('id', projectIds)

  if (projectsError || !permittedProjects || permittedProjects.length !== projectIds.length) {
    return NextResponse.json({ error: 'One or more selected projects are not available to you.' }, { status: 403 })
  }

  const rawCode = newTelegramPairCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const admin = createAdminClient()
  const { error } = await admin.from('telegram_pair_codes').insert({
    actor_user_id: user.id,
    code_hash: hashTelegramPairCode(rawCode),
    project_ids: projectIds,
    expires_at: expiresAt,
  })

  if (error) {
    return NextResponse.json({ error: 'Could not create the Telegram pairing command.' }, { status: 500 })
  }

  return NextResponse.json({
    start_command: `/start nrs_pair_${rawCode}`,
    expires_at: expiresAt,
    project_ids: projectIds,
  })
}
