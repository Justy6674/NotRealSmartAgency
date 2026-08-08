import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDirectorJob } from '@/lib/mcp/director-job'
import { createTelegramDirectorExecution } from '@/lib/agents/director-execution'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'
import { advanceVideoBrief } from '@/lib/telegram/video-brief-run'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  const body = await request.json().catch(() => null) as {
    init_data?: unknown
    message?: unknown
    client_event_id?: unknown
  } | null
  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  /**
   * The client's own id for this send, so the same tap can never become two
   * Director runs. On phone data a slow Send is tapped again; without this that
   * is two jobs, two paid model calls and two answers.
   */
  const clientEventId =
    typeof body?.client_event_id === 'string' && /^[0-9a-f-]{8,64}$/i.test(body.client_event_id)
      ? body.client_event_id
      : null
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
    // For a private chat Telegram's chat id IS the user id, so this is where
    // finished files go. Without it the job had nowhere to send them, and the
    // carousel-as-an-album delivery could never fire from the Mini App — the
    // one Telegram surface that works without a webhook.
    //
    // The ANSWER is not sent here: this route's caller polls for it and shows
    // it in the Mini App's own box. Only the files go to the chat, because a
    // file is the thing you cannot save out of a web view.
    chatId: context.auth.telegramUserId,
    deliverText: false,
    projectName: grant.projectName,
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
    input: {
      brand_id: execution.projectId,
      message,
      ...(clientEventId ? { client_event_id: clientEventId } : {}),
    },
  }).select('id').single()

  // Insert FIRST and let the unique index arbitrate. Checking for an existing
  // job before inserting leaves a window between the read and the write that
  // two quick taps fit through exactly.
  if (error?.code === '23505' && clientEventId) {
    const { data: existing } = await admin
      .from('mcp_jobs')
      .select('id')
      .eq('user_id', execution.actorUserId)
      .eq('brand_id', execution.projectId)
      .eq('channel', 'telegram')
      .filter('input->>client_event_id', 'eq', clientEventId)
      .maybeSingle()

    if (existing) {
      // The first tap already started it. Hand back the same job.
      return NextResponse.json({ job_id: existing.id, project_name: grant.projectName, deduplicated: true })
    }
  }

  if (error || !job) return NextResponse.json({ error: 'NRS could not start that request.' }, { status: 500 })

  after(async () => {
    // A clip mid-conversation owns the reply.
    //
    // Handing "yes" or "all three" to the general Director loses it: it has no
    // idea which question it answers, so it either asks again or invents a
    // task. The step machine knows exactly what was outstanding.
    try {
      const brief = await advanceVideoBrief({
        admin,
        userId: execution.actorUserId,
        brandId: execution.projectId,
        message,
      })
      if (brief.handled && brief.reply) {
        await admin.from('mcp_jobs').update({
          status: 'done',
          result: { response: brief.reply },
          completed_at: new Date().toISOString(),
        }).eq('id', job.id)
        return
      }
    } catch (error) {
      // A fault in the brief must not eat the message. Fall through to the
      // Director, which is worse at this but always answers.
      console.error('[mini-app:brief]', error)
    }

    await runDirectorJob(job.id, execution, { brand_id: execution.projectId, message })
  })
  return NextResponse.json({ job_id: job.id, project_name: grant.projectName })
}
