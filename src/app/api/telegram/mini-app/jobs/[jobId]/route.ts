import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatTelegramMarketingCopy } from '@/lib/telegram/telegram-marketing-copy'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  const body = await request.json().catch(() => null) as { init_data?: unknown } | null
  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })
  const context = await resolveTelegramMiniAppContext(createAdminClient(), auth)
  if (!context || !context.activeSession) return NextResponse.json({ error: 'Telegram project session is not active.' }, { status: 403 })

  const { jobId } = await params
  const { data: job } = await createAdminClient().from('mcp_jobs').select('id, status, result, error, brand_id, project_access_grant_id, channel, user_id, cost_cents, duration_ms').eq('id', jobId).eq('user_id', context.actorUserId).eq('brand_id', context.activeSession.projectId).eq('project_access_grant_id', context.activeSession.grantId).eq('channel', 'telegram').maybeSingle()
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  if (job.status === 'queued' || job.status === 'running') return NextResponse.json({ status: job.status })
  if (job.status === 'error') return NextResponse.json({ status: 'error', error: job.error ?? 'The Director could not complete that request.' })
  const result = (job.result ?? {}) as { response?: unknown }
  const raw = typeof result.response === 'string' ? result.response : ''

  // The marketing data boundary applies to what leaves NRS, not to the route
  // it leaves by. It was checked on the chat path only — and this is the path
  // that actually carries traffic, so a response the chat would have withheld
  // was handed over here in full.
  const inspection = inspectMarketingInput(raw)
  if (raw && !inspection.allowed) {
    return NextResponse.json({
      status: 'done',
      response: 'NRS withheld that response because it did not meet the project marketing data boundary.',
      withheld: true,
      cost_cents: job.cost_cents,
      duration_ms: job.duration_ms,
    })
  }

  const response = raw ? formatTelegramMarketingCopy(raw) : ''
  return NextResponse.json({ status: 'done', response, cost_cents: job.cost_cents, duration_ms: job.duration_ms })
}
