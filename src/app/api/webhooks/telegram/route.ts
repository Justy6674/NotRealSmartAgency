import { randomBytes, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDirectorJob } from '@/lib/mcp/director-job'
import { createTelegramDirectorExecution } from '@/lib/agents/director-execution'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { getGitHubAppConfig } from '@/lib/github/github-app'
import { hashGitHubConnectState } from '@/lib/github/project-connection'
import { TELEGRAM_CHANNEL_STATUS } from '@/lib/telegram/telegram-channel-status'
import { hashTelegramPairCode } from '@/lib/telegram/telegram-pairing'
import { sendTelegramText } from '@/lib/telegram/telegram-api'
import { formatTelegramMarketingCopy } from '@/lib/telegram/telegram-marketing-copy'
import { getTelegramJobAcknowledgement } from '@/lib/telegram/telegram-job-status'
import {
  acknowledgeAttachment,
  readAttachment,
  storeTelegramMedia,
  type TelegramAttachment,
} from '@/lib/telegram/telegram-media'
import { resolveAlbum, buildMediaDirective } from '@/lib/telegram/telegram-album'
import {
  addMiniAppButton,
  buildScopedProjectKeyboard,
  parseScopedTelegramIntent,
} from '@/lib/telegram/scoped-telegram'

export const runtime = 'nodejs'
export const maxDuration = 300

const TELEGRAM_CAPABILITIES = [
  'director:chat',
  'draft:post',
  'direct:read',
  'direct:utility',
] as const

interface TelegramInbound {
  chatId: string
  telegramUserId: string
  text?: string
  callbackData?: string
  /** A video, photo or recording sent instead of, or alongside, text. */
  attachment?: TelegramAttachment
}

interface TelegramGrant {
  grantId: string
  projectId: string
  projectName: string
  capabilities: readonly string[]
}

function secretsMatch(supplied: string | null, expected: string): boolean {
  if (!supplied || supplied.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}

/** Only private human messages or private callback presses can enter NRS. */
function parseInbound(update: unknown): TelegramInbound | null {
  if (!update || typeof update !== 'object') return null
  const candidate = update as Record<string, unknown>

  const callback = candidate.callback_query as Record<string, unknown> | undefined
  if (callback && typeof callback.data === 'string') {
    const message = callback.message as Record<string, unknown> | undefined
    const chat = message?.chat as Record<string, unknown> | undefined
    const from = callback.from as Record<string, unknown> | undefined
    if (chat?.type !== 'private' || from?.is_bot === true || chat?.id === undefined || from?.id === undefined) return null
    return {
      chatId: String(chat.id),
      telegramUserId: String(from.id),
      callbackData: callback.data,
    }
  }

  const message = candidate.message as Record<string, unknown> | undefined
  const chat = message?.chat as Record<string, unknown> | undefined
  const from = message?.from as Record<string, unknown> | undefined
  if (chat?.type !== 'private' || from?.is_bot === true || chat?.id === undefined || from?.id === undefined) return null

  // A message with a file but no text used to be dropped silently, so footage
  // filmed on a phone never reached the agency at all.
  const attachment = message ? readAttachment(message) : null
  if (typeof message?.text !== 'string' && !attachment) return null

  return {
    chatId: String(chat.id),
    telegramUserId: String(from.id),
    ...(typeof message?.text === 'string' ? { text: message.text } : {}),
    ...(attachment ? { attachment } : {}),
  }
}

async function getTelegramAccount(
  admin: ReturnType<typeof createAdminClient>,
  inbound: TelegramInbound,
) {
  const { data } = await admin
    .from('telegram_accounts')
    .select('id, actor_user_id')
    .eq('telegram_user_id', inbound.telegramUserId)
    .eq('telegram_chat_id', inbound.chatId)
    .is('revoked_at', null)
    .maybeSingle()
  return data as { id: string; actor_user_id: string } | null
}

async function getTelegramGrants(
  admin: ReturnType<typeof createAdminClient>,
  actorUserId: string,
): Promise<TelegramGrant[]> {
  const { data } = await admin
    .from('project_access_grants')
    .select('id, brand_id, capabilities, brands!inner(name)')
    .eq('actor_user_id', actorUserId)
    .eq('channel', 'telegram')
    .eq('status', 'active')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const brand = row.brands as { name?: unknown } | null
    if (typeof row.id !== 'string' || typeof row.brand_id !== 'string' || typeof brand?.name !== 'string') return []
    return [{
      grantId: row.id,
      projectId: row.brand_id,
      projectName: brand.name,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter((value): value is string => typeof value === 'string') : [],
    }]
  })
}

async function sendProjectPicker({
  botToken,
  chatId,
  grants,
}: {
  botToken: string
  chatId: string
  grants: TelegramGrant[]
}): Promise<void> {
  if (grants.length === 0) {
    await sendTelegramText({
      botToken,
      chatId,
      text: 'This Telegram chat has no enabled NRS project access. Create a new pairing command from NRS Settings.',
    })
    return
  }

  await sendTelegramText({
    botToken,
    chatId,
    text: 'Choose the project for this marketing request. NRS keeps every project separate unless you explicitly create an approved link.',
    replyMarkup: addMiniAppButton(buildScopedProjectKeyboard(grants)),
  })
}

async function startTelegramGitHubConnection({
  admin,
  account,
  grants,
  botToken,
  chatId,
  requestUrl,
}: {
  admin: ReturnType<typeof createAdminClient>
  account: { id: string; actor_user_id: string }
  grants: TelegramGrant[]
  botToken: string
  chatId: string
  requestUrl: string
}): Promise<void> {
  if (!getGitHubAppConfig()) {
    await sendTelegramText({
      botToken,
      chatId,
      text: 'The private GitHub connection is not configured on NRS yet. No project data was accessed.',
    })
    return
  }
  if (grants.length === 0) {
    await sendTelegramText({ botToken, chatId, text: 'Choose a project from the NRS project list before connecting GitHub.' })
    return
  }

  const state = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { error } = await admin.from('github_connect_requests').insert({
    actor_user_id: account.actor_user_id,
    telegram_account_id: account.id,
    project_access_grant_ids: grants.map((grant) => grant.grantId),
    brand_ids: grants.map((grant) => grant.projectId),
    state_hash: hashGitHubConnectState(state),
    expires_at: expiresAt,
  })

  if (error) {
    await sendTelegramText({ botToken, chatId, text: 'NRS could not create the private GitHub connection link. Your selected projects are unchanged; please try again.' })
    return
  }

  const connectUrl = new URL('/api/integrations/github/start', requestUrl)
  connectUrl.searchParams.set('state', state)
  await sendTelegramText({
    botToken,
    chatId,
    text: `Open GitHub to connect ${grants.length === 1 ? grants[0].projectName : `${grants.length} selected projects`}. Select only the repositories you want NRS to read. NRS gets read-only product documentation and public-site discovery—not secrets, databases, or customer data.`,
    replyMarkup: {
      inline_keyboard: [[{ text: 'Connect private GitHub repositories', url: connectUrl.toString() }]],
    },
  })
  await logExecution(admin, {
    actorUserId: account.actor_user_id,
    action: 'github_connect_started',
    outcome: 'allowed',
    detail: { project_count: grants.length },
  })
}

async function logExecution(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    actorUserId: string
    grantId?: string
    projectId?: string
    action: string
    outcome: 'allowed' | 'denied' | 'error'
    detail?: Record<string, string | number | boolean>
  },
): Promise<void> {
  await admin.from('execution_audit').insert({
    actor_user_id: input.actorUserId,
    project_access_grant_id: input.grantId ?? null,
    brand_id: input.projectId ?? null,
    channel: 'telegram',
    action: input.action,
    outcome: input.outcome,
    policy_version: 1,
    detail: input.detail ?? {},
  })
}

async function redeemPairCode({
  admin,
  inbound,
  code,
}: {
  admin: ReturnType<typeof createAdminClient>
  inbound: TelegramInbound
  code: string
}): Promise<{ actorUserId: string; accountId: string } | null> {
  const existing = await getTelegramAccount(admin, inbound)
  if (existing) return null

  const now = new Date().toISOString()
  const { data: pairCode } = await admin
    .from('telegram_pair_codes')
    .update({ used_at: now })
    .eq('code_hash', hashTelegramPairCode(code))
    .is('used_at', null)
    .gt('expires_at', now)
    .select('actor_user_id, project_ids')
    .maybeSingle()

  const pair = pairCode as { actor_user_id?: unknown; project_ids?: unknown } | null
  const projectIds = Array.isArray(pair?.project_ids)
    ? pair.project_ids.filter((value): value is string => typeof value === 'string')
    : []
  if (!pair || typeof pair.actor_user_id !== 'string' || projectIds.length === 0) return null

  const { error: grantsError } = await admin
    .from('project_access_grants')
    .upsert(projectIds.map((brandId) => ({
      actor_user_id: pair.actor_user_id,
      brand_id: brandId,
      channel: 'telegram',
      capabilities: [...TELEGRAM_CAPABILITIES],
      status: 'active',
      created_by: pair.actor_user_id,
      revoked_at: null,
    })), { onConflict: 'actor_user_id,brand_id,channel' })

  if (grantsError) return null

  const { data: account, error: accountError } = await admin
    .from('telegram_accounts')
    .insert({
      actor_user_id: pair.actor_user_id,
      telegram_user_id: inbound.telegramUserId,
      telegram_chat_id: inbound.chatId,
    })
    .select('id')
    .single()

  if (accountError || !account) return null
  return { actorUserId: pair.actor_user_id, accountId: account.id }
}

async function getActiveSession(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
): Promise<{ grantId: string; projectId: string } | null> {
  const { data } = await admin
    .from('telegram_project_sessions')
    .select('project_access_grant_id, brand_id')
    .eq('telegram_account_id', accountId)
    .eq('status', 'active')
    .maybeSingle()
  if (!data || typeof data.project_access_grant_id !== 'string' || typeof data.brand_id !== 'string') return null
  return { grantId: data.project_access_grant_id, projectId: data.brand_id }
}

async function queueTelegramDirectorWork({
  admin,
  account,
  grant,
  message,
  botToken,
  chatId,
}: {
  admin: ReturnType<typeof createAdminClient>
  account: { id: string; actor_user_id: string }
  grant: TelegramGrant
  message: string
  botToken: string
  chatId: string
}): Promise<void> {
  const inspection = inspectMarketingInput(message)
  if (!inspection.allowed) {
    await logExecution(admin, {
      actorUserId: account.actor_user_id,
      grantId: grant.grantId,
      projectId: grant.projectId,
      action: 'director_request',
      outcome: 'denied',
      detail: { reason: 'marketing_boundary' },
    })
    await sendTelegramText({ botToken, chatId, text: inspection.reason })
    return
  }

  let execution
  try {
    execution = createTelegramDirectorExecution({
      userId: account.actor_user_id,
      grant: {
        grantId: grant.grantId,
        projectId: grant.projectId,
        capabilities: grant.capabilities.filter((capability): capability is 'director:chat' => capability === 'director:chat'),
      },
      chatId,
    })
  } catch {
    await logExecution(admin, {
      actorUserId: account.actor_user_id,
      grantId: grant.grantId,
      projectId: grant.projectId,
      action: 'director_request',
      outcome: 'denied',
      detail: { reason: 'missing_director_capability' },
    })
    await sendTelegramText({ botToken, chatId, text: 'This selected project is not permitted to run Director work in Telegram.' })
    return
  }

  const { data: job, error: jobError } = await admin
    .from('mcp_jobs')
    .insert({
      user_id: execution.actorUserId,
      brand_id: execution.projectId,
      channel: execution.channel,
      api_key_id: null,
      project_access_grant_id: execution.projectAccessGrantId,
      policy_version: execution.policyVersion,
      job_type: 'director_chat',
      status: 'queued',
      input: { brand_id: execution.projectId, message },
    })
    .select('id')
    .single()

  if (jobError || !job) {
    await logExecution(admin, {
      actorUserId: account.actor_user_id,
      grantId: grant.grantId,
      projectId: grant.projectId,
      action: 'director_request',
      outcome: 'error',
      detail: { reason: 'queue_failed' },
    })
    await sendTelegramText({ botToken, chatId, text: 'NRS could not start that marketing request. Your project remains selected; please try again.' })
    return
  }

  await logExecution(admin, {
    actorUserId: account.actor_user_id,
    grantId: grant.grantId,
    projectId: grant.projectId,
    action: 'director_request',
    outcome: 'allowed',
    detail: { job_created: true },
  })
  await sendTelegramText({
    botToken,
    chatId,
    text: getTelegramJobAcknowledgement(grant.projectName, message),
  })

  after(async () => {
    try {
      await runDirectorJob(job.id, execution, { brand_id: execution.projectId, message })
      const { data: completed } = await admin
        .from('mcp_jobs')
        .select('status, result')
        .eq('id', job.id)
        .eq('user_id', execution.actorUserId)
        .eq('brand_id', execution.projectId)
        .eq('channel', 'telegram')
        .eq('project_access_grant_id', execution.projectAccessGrantId)
        .is('api_key_id', null)
        .maybeSingle()
      const response = (completed?.result as { response?: unknown } | null)?.response
      if (completed?.status !== 'done' || typeof response !== 'string') {
        await sendTelegramText({ botToken, chatId, text: 'That marketing draft could not be completed. Your project selection is unchanged; please try again.' })
        return
      }

      const outputInspection = inspectMarketingInput(response)
      if (!outputInspection.allowed) {
        await logExecution(admin, {
          actorUserId: execution.actorUserId,
          grantId: execution.projectAccessGrantId,
          projectId: execution.projectId,
          action: 'director_response',
          outcome: 'denied',
          detail: { reason: 'marketing_boundary' },
        })
        await sendTelegramText({ botToken, chatId, text: 'NRS withheld that response because it did not meet the project marketing data boundary.' })
        return
      }

      const telegramResponse = formatTelegramMarketingCopy(response)

      await logExecution(admin, {
        actorUserId: execution.actorUserId,
        grantId: execution.projectAccessGrantId,
        projectId: execution.projectId,
        action: 'director_response',
        outcome: 'allowed',
        detail: { delivered: true, response_length: telegramResponse.length },
      })
      await sendTelegramText({ botToken, chatId, text: telegramResponse })
    } catch {
      await logExecution(admin, {
        actorUserId: execution.actorUserId,
        grantId: execution.projectAccessGrantId,
        projectId: execution.projectId,
        action: 'director_response',
        outcome: 'error',
        detail: { reason: 'runner_failed' },
      })
      await sendTelegramText({ botToken, chatId, text: 'NRS could not complete that marketing draft. Your project selection is unchanged; please try again.' })
    }
  })
}

/**
 * The only Telegram channel is the owner-paired NRS control channel. It is
 * disabled unless an explicit environment switch is true, even if a webhook
 * happens to exist. Every reachable route below is scoped by a pairing grant.
 */
export async function POST(request: NextRequest) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) {
    return NextResponse.json({ received: true, status: TELEGRAM_CHANNEL_STATUS })
  }

  if (!secretsMatch(request.headers.get('x-telegram-bot-api-secret-token'), config.webhookSecret)) {
    return NextResponse.json({ received: false, status: 'invalid_webhook_secret' }, { status: 401 })
  }

  const update = await request.json().catch(() => null)
  const inbound = parseInbound(update)
  if (!inbound) return NextResponse.json({ received: true, status: 'ignored' })

  const admin = createAdminClient()
  const intent = parseScopedTelegramIntent(inbound.text, inbound.callbackData)
  let account = await getTelegramAccount(admin, inbound)

  if (intent.kind === 'pair') {
    if (account) {
      await sendTelegramText({ botToken: config.botToken, chatId: inbound.chatId, text: 'This Telegram chat is already paired with NRS. Choose a project from the list below.' })
      return NextResponse.json({ received: true, status: 'already_paired' })
    }
    const paired = await redeemPairCode({ admin, inbound, code: intent.code })
    if (!paired) {
      await sendTelegramText({ botToken: config.botToken, chatId: inbound.chatId, text: 'That pairing command is invalid, expired or already used. Create a new one in NRS Settings.' })
      return NextResponse.json({ received: true, status: 'pairing_denied' })
    }
    account = { id: paired.accountId, actor_user_id: paired.actorUserId }
    const grants = await getTelegramGrants(admin, account.actor_user_id)
    await logExecution(admin, {
      actorUserId: account.actor_user_id,
      action: 'pair',
      outcome: 'allowed',
      detail: { project_count: grants.length },
    })
    await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants })
    return NextResponse.json({ received: true, status: 'paired' })
  }

  if (!account) {
    await sendTelegramText({ botToken: config.botToken, chatId: inbound.chatId, text: 'This private NRS Telegram channel is not paired. Create a pairing command in NRS Settings, then send it here.' })
    return NextResponse.json({ received: true, status: 'unpaired' })
  }

  const grants = await getTelegramGrants(admin, account.actor_user_id)
  if (intent.kind === 'choose_project') {
    await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants })
    return NextResponse.json({ received: true, status: 'project_picker' })
  }

  if (intent.kind === 'select_project') {
    const grant = grants.find((candidate) => candidate.grantId === intent.grantId)
    if (!grant) {
      await sendTelegramText({ botToken: config.botToken, chatId: inbound.chatId, text: 'That project selection is not available to this Telegram account. Choose a project from the current list.' })
      return NextResponse.json({ received: true, status: 'selection_denied' })
    }

    await admin
      .from('telegram_project_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('telegram_account_id', account.id)
      .eq('status', 'active')
    await admin.from('telegram_project_sessions').insert({
      telegram_account_id: account.id,
      project_access_grant_id: grant.grantId,
      brand_id: grant.projectId,
      status: 'active',
    })
    await logExecution(admin, {
      actorUserId: account.actor_user_id,
      grantId: grant.grantId,
      projectId: grant.projectId,
      action: 'project_selected',
      outcome: 'allowed',
    })
    await sendTelegramText({ botToken: config.botToken, chatId: inbound.chatId, text: `Using ${grant.projectName}. Send a marketing request whenever you are ready.` })
    return NextResponse.json({ received: true, status: 'project_selected' })
  }

  if (intent.kind === 'connect_github') {
    const session = await getActiveSession(admin, account.id)
    const selectedGrant = session
      ? grants.find((candidate) => candidate.grantId === session.grantId && candidate.projectId === session.projectId)
      : undefined
    if (intent.scope === 'current' && !selectedGrant) {
      await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants })
      return NextResponse.json({ received: true, status: 'project_required' })
    }
    const projectsToConnect: TelegramGrant[] = intent.scope === 'all'
      ? grants
      : selectedGrant ? [selectedGrant] : []
    await startTelegramGitHubConnection({
      admin,
      account,
      grants: projectsToConnect,
      botToken: config.botToken,
      chatId: inbound.chatId,
      requestUrl: request.url,
    })
    return NextResponse.json({ received: true, status: 'github_connect_started' })
  }

  if (intent.kind !== 'marketing_request') return NextResponse.json({ received: true, status: 'ignored' })

  const session = await getActiveSession(admin, account.id)
  const grant = session ? grants.find((candidate) => candidate.grantId === session.grantId && candidate.projectId === session.projectId) : undefined
  if (!grant) {
    await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants })
    return NextResponse.json({ received: true, status: 'project_required' })
  }

  // A file gets stored and processed before the Director is asked anything,
  // so the transcript exists by the time it writes. Sending a video used to
  // do nothing at all.
  let mediaNote = ''
  if (inbound.attachment) {
    await sendTelegramText({
      botToken: config.botToken,
      chatId: inbound.chatId,
      text: acknowledgeAttachment(inbound.attachment, grant.projectName),
    })

    const stored = await storeTelegramMedia({
      supabase: admin,
      botToken: config.botToken,
      userId: account.actor_user_id,
      brandId: grant.projectId,
      attachment: inbound.attachment,
    })

    if ('error' in stored) {
      await sendTelegramText({ botToken: config.botToken, chatId: inbound.chatId, text: stored.error })
      return NextResponse.json({ received: true, status: 'media_rejected' })
    }

    // Transcription and description happen through the one pipeline that owns
    // every media_items write, rather than a second path that could drift.
    const { runMediaProcessingPipeline } = await import('@/lib/media/process-pipeline')
    await runMediaProcessingPipeline({ supabase: admin, mediaItemId: stored.media.mediaItemId })
      .catch(() => { /* the Director is told below what is and is not available */ })

    // Several photos sent together arrive as separate messages sharing an
    // album id. Wait for the rest, then let exactly one of them speak for the
    // whole album — otherwise a carousel becomes N separate posts.
    const album = await resolveAlbum({
      supabase: admin,
      brandId: grant.projectId,
      mediaGroupId: inbound.attachment.mediaGroupId,
      myMediaItemId: stored.media.mediaItemId,
    })

    if (!album.isLeader) {
      // A sibling of this album is running the Director for all of them.
      return NextResponse.json({ received: true, status: 'album_member' })
    }

    const { data: processed } = await admin
      .from('media_items')
      .select('transcription, ai_description')
      .eq('id', stored.media.mediaItemId)
      .maybeSingle()

    const transcript = typeof processed?.transcription === 'string' ? processed.transcription.trim() : ''
    const described = typeof processed?.ai_description === 'string' ? processed.ai_description.trim() : ''

    mediaNote = buildMediaDirective({
      kind: inbound.attachment.kind,
      mediaItemIds: album.mediaItemIds,
      transcript,
      description: described,
    })
  }

  await queueTelegramDirectorWork({
    admin,
    account,
    grant,
    message: (intent.message || 'Write captions for what I just sent.') + mediaNote,
    botToken: config.botToken,
    chatId: inbound.chatId,
  })
  return NextResponse.json({ received: true, status: 'queued' })
}
