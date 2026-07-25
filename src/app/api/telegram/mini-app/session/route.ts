import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  const body = await request.json().catch(() => null) as { init_data?: unknown } | null
  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })

  const context = await resolveTelegramMiniAppContext(createAdminClient(), auth)
  if (!context) return NextResponse.json({ error: 'Pair this Telegram account with NRS before opening the Mini App.' }, { status: 403 })

  return NextResponse.json({
    user: { first_name: auth.user.first_name ?? null, username: auth.user.username ?? null },
    projects: context.grants.map((grant) => ({ id: grant.grantId, name: grant.projectName, project_id: grant.projectId })),
    active_project_id: context.activeSession?.grantId ?? null,
  })
}
