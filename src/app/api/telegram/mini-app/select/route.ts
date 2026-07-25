import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  const body = await request.json().catch(() => null) as { init_data?: unknown; grant_id?: unknown } | null
  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const grantId = typeof body?.grant_id === 'string' ? body.grant_id : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth || !grantId) return NextResponse.json({ error: 'Invalid Telegram session or project.' }, { status: 401 })

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context) return NextResponse.json({ error: 'Pair this Telegram account with NRS first.' }, { status: 403 })
  const grant = context.grants.find((candidate) => candidate.grantId === grantId)
  if (!grant) return NextResponse.json({ error: 'That project is not available to this Telegram account.' }, { status: 403 })

  await admin.from('telegram_project_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('telegram_account_id', context.accountId).eq('status', 'active')
  const { error } = await admin.from('telegram_project_sessions').insert({
    telegram_account_id: context.accountId,
    project_access_grant_id: grant.grantId,
    brand_id: grant.projectId,
    status: 'active',
  })
  if (error) return NextResponse.json({ error: 'Could not select that project.' }, { status: 500 })
  return NextResponse.json({ selected: { id: grant.grantId, name: grant.projectName, project_id: grant.projectId } })
}
