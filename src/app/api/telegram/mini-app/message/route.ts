import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDirectorJob } from '@/lib/mcp/director-job'
import { createTelegramDirectorExecution } from '@/lib/agents/director-execution'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  const body = await request.json().catch(() => null) as { init_data?: unknown; message?: unknown } | null
  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })
  if (!message || message.length > 4000) return NextResponse.json({ error: 'Message must be between 1 and 4000 characters.' }, { status: 400 })

  const inspection = inspectMarketingInput(message)
  if (!inspection.allowed) return NextResponse.json({ error: inspection.reason }, { status: 400 })

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context || !context.activeSession) return NextResponse.json({ error: 'Choose a project before messaging the Director.' }, { status: 409 })
  const grant = context.grants.find((candidate) => candidate.grantId === context.activeSession?.grantId && candidate.projectId === context.activeSession?.projectId)
  if (!grant || !grant.capabilities.includes('director:chat')) return NextResponse.json({ error: 'The selected project cannot run Director work.' }, { status: 403 })

  const execution = createTelegramDirectorExecution({
    userId: context.actorUserId,
    grant: { grantId: grant.grantId, projectId: grant.projectId, capabilities: ['director:chat'] },
  })
  const { data: job, error } = await admin.from('mcp_jobs').insert({
    user_id: execution.actorUserId,
    brand_id: execution.projectId,
    channel: execution.channel,
    api_key_id: null,
    project_access_grant_id: execution.projectAccessGrantId,
    policy_version: execution.policyVersion,
    job_type: 'director_chat',
    status: 'queued',
    input: { brand_id: execution.projectId, message },
  }).select('id').single()
  if (error || !job) return NextResponse.json({ error: 'NRS could not start that request.' }, { status: 500 })

  after(async () => {
    await runDirectorJob(job.id, execution, { brand_id: execution.projectId, message })
  })
  return NextResponse.json({ job_id: job.id, project_name: grant.projectName })
}
