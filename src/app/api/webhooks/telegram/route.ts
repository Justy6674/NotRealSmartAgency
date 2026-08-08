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
import { sendTelegramText, type TelegramReplyMarkup } from '@/lib/telegram/telegram-api'
import { applyBrandFence } from '@/lib/telegram/project-fence'
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
  readThreadId,
  routeByTopic,
  createTopicsForProjects,
  describeTopicSetup,
} from '@/lib/telegram/forum-topics'
import { checkTopicReadiness, getBotId } from '@/lib/telegram/topic-readiness'
import { describeGroupStatus, parseMyChatMember } from '@/lib/telegram/group-join'
import {
  DIRECTOR_TOPIC_NAME,
  isTopicSetupRequest,
  selectTopicProjects,
  wantsDirectorTopic,
} from '@/lib/telegram/topic-request'
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
  /** Forum topic this arrived in, when the chat is a forum group. */
  threadId?: number
  /** True when this came from a group rather than the private chat. */
  fromGroup?: boolean
}

interface TelegramAccount {
  id: string
  actor_user_id: string
  /** Projects this Telegram user may work on. Null/empty means all granted. */
  allowed_brand_ids?: string[] | null
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
  if (from?.is_bot === true || chat?.id === undefined || from?.id === undefined) return null

  // Groups are allowed as well as the private chat, so two people can work in
  // one thread. A forum group additionally carries a topic per project, which
  // says which project without anyone picking one.
  //
  // Ordinary groups count too: requiring a forum meant a plain group the owner
  // had already made — himself, a colleague and the bot — was silently
  // ignored, with no reply to say why.
  //
  // Membership grants nothing on its own. The sender still has to be a paired
  // NRS account, and that account decides which projects they can touch.
  const isForum = chat?.is_forum === true || message?.is_topic_message === true
  const isGroup = chat?.type === 'group' || chat?.type === 'supergroup'
  const isPrivate = chat?.type === 'private'
  if (!isPrivate && !isForum && !isGroup) return null

  // A message with a file but no text used to be dropped silently, so footage
  // filmed on a phone never reached the agency at all.
  const attachment = message ? readAttachment(message) : null
  if (typeof message?.text !== 'string' && !attachment) return null

  const threadId = message ? readThreadId(message) : null

  return {
    chatId: String(chat.id),
    telegramUserId: String(from.id),
    ...(typeof message?.text === 'string' ? { text: message.text } : {}),
    ...(attachment ? { attachment } : {}),
    ...(threadId !== null ? { threadId } : {}),
    ...(isPrivate ? {} : { fromGroup: true }),
  }
}

async function getTelegramAccount(
  admin: ReturnType<typeof createAdminClient>,
  inbound: TelegramInbound,
) {
  // A group has its own chat id, not the paired private one. The PERSON is
  // what was paired, so match on them there — a group member who was never
  // paired still resolves to nothing and gets no access.
  let query = admin
    .from('telegram_accounts')
    .select('id, actor_user_id, allowed_brand_ids')
    .eq('telegram_user_id', inbound.telegramUserId)
    .is('revoked_at', null)

  if (!inbound.fromGroup) query = query.eq('telegram_chat_id', inbound.chatId)

  const { data } = await query.maybeSingle()
  return data as TelegramAccount | null
}

async function getTelegramGrants(
  admin: ReturnType<typeof createAdminClient>,
  account: TelegramAccount,
): Promise<TelegramGrant[]> {
  const { data } = await admin
    .from('project_access_grants')
    .select('id, brand_id, capabilities, brands!inner(name)')
    .eq('actor_user_id', account.actor_user_id)
    .eq('channel', 'telegram')
    .eq('status', 'active')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  const all = ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const brand = row.brands as { name?: unknown } | null
    if (typeof row.id !== 'string' || typeof row.brand_id !== 'string' || typeof brand?.name !== 'string') return []
    return [{
      grantId: row.id,
      projectId: row.brand_id,
      projectName: brand.name,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter((value): value is string => typeof value === 'string') : [],
    }]
  })

  // Shared with the Mini App rather than written twice — the fence has to hold
  // on every Telegram surface, and a second copy is a second thing to forget.
  return applyBrandFence(all, account.allowed_brand_ids)
}

async function sendProjectPicker({
  botToken,
  chatId,
  grants,
  threadId,
}: {
  botToken: string
  chatId: string
  grants: TelegramGrant[]
  threadId?: number
}): Promise<void> {
  if (grants.length === 0) {
    await sendTelegramText({
      botToken,
      chatId,
      text: 'This Telegram chat has no enabled NRS project access. Create a new pairing command from NRS Settings.',
      ...(threadId !== undefined ? { threadId } : {}),
    })
    return
  }

  await sendTelegramText({
    botToken,
    chatId,
    text: 'Choose the project for this marketing request. NRS keeps every project separate unless you explicitly create an approved link.',
    replyMarkup: addMiniAppButton(buildScopedProjectKeyboard(grants)),
    ...(threadId !== undefined ? { threadId } : {}),
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
  threadId,
}: {
  admin: ReturnType<typeof createAdminClient>
  account: { id: string; actor_user_id: string }
  grant: TelegramGrant
  message: string
  botToken: string
  chatId: string
  /** The project's forum topic, so the answer comes back to it. */
  threadId?: number
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
    await sendTelegramText({ botToken, chatId, text: inspection.reason, ...(threadId !== undefined ? { threadId } : {}) })
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
      projectName: grant.projectName,
      ...(threadId !== undefined ? { threadId } : {}),
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
    await sendTelegramText({ botToken, chatId, text: 'This selected project is not permitted to run Director work in Telegram.', ...(threadId !== undefined ? { threadId } : {}) })
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
    await sendTelegramText({ botToken, chatId, text: 'NRS could not start that marketing request. Your project remains selected; please try again.', ...(threadId !== undefined ? { threadId } : {}) })
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
    ...(threadId !== undefined ? { threadId } : {}),
  })

  // This audits the outcome. It deliberately sends NOTHING.
  //
  // Delivery moved into the job when this continuation proved it could be
  // reclaimed mid-flight — but the sends were left here as well, so every
  // answer went out twice: once from the job, once from here. Worse, the
  // boundary check below ran after the job had already delivered, so a
  // withheld response was sent and then declared withheld. The job now
  // decides and sends; this records what happened.
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
        await logExecution(admin, {
          actorUserId: execution.actorUserId,
          grantId: execution.projectAccessGrantId,
          projectId: execution.projectId,
          action: 'director_response',
          outcome: 'error',
          detail: { reason: 'job_not_done' },
        })
        return
      }

      // Same input, same function, same verdict as the job reached — so the
      // record matches what the owner actually received.
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
        return
      }

      await logExecution(admin, {
        actorUserId: execution.actorUserId,
        grantId: execution.projectAccessGrantId,
        projectId: execution.projectId,
        action: 'director_response',
        outcome: 'allowed',
        detail: {
          delivered: true,
          response_length: formatTelegramMarketingCopy(response).length,
        },
      })
    } catch {
      await logExecution(admin, {
        actorUserId: execution.actorUserId,
        grantId: execution.projectAccessGrantId,
        projectId: execution.projectId,
        action: 'director_response',
        outcome: 'error',
        detail: { reason: 'runner_failed' },
      })
    }
  })
}

/**
 * The only Telegram channel is the owner-paired NRS control channel. It is
 * disabled unless an explicit environment switch is true, even if a webhook
 * happens to exist. Every reachable route below is scoped by a pairing grant.
 */
export async function POST(request: NextRequest) {
  // Telegram RETRIES any update the webhook answers with a 5xx.
  //
  // So an unhandled throw is not a one-off error, it is a loop: the same
  // update is redelivered, throws again, and repeats. The commonest cause is
  // an outbound send failing for a reason that will never change — the person
  // blocked the bot, or the chat no longer exists. Seen live: a send to a
  // non-existent chat returned 400, the throw escaped, and the webhook 500'd.
  //
  // Once an update has been accepted, this always answers 200. Whatever went
  // wrong is logged and the update is not sent again.
  try {
    return await handleTelegramUpdate(request)
  } catch (err) {
    console.error('[telegram] update failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ received: true, status: 'error_swallowed' })
  }
}

async function handleTelegramUpdate(request: NextRequest) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) {
    return NextResponse.json({ received: true, status: TELEGRAM_CHANNEL_STATUS })
  }

  if (!secretsMatch(request.headers.get('x-telegram-bot-api-secret-token'), config.webhookSecret)) {
    return NextResponse.json({ received: false, status: 'invalid_webhook_secret' }, { status: 401 })
  }

  const update = await request.json().catch(() => null)

  // Being added to a group, or promoted in one, arrives as `my_chat_member`
  // rather than as a message. Without answering it the bot lands in silence
  // and whoever added it is left guessing which of three settings comes next.
  const membership = parseMyChatMember(update)
  if (membership) {
    const said = describeGroupStatus(membership)
    if (said) {
      await sendTelegramText({ botToken: config.botToken, chatId: membership.chatId, text: said })
        .catch((err) => console.error('[telegram] group greeting failed:', err instanceof Error ? err.message : err))
    }
    return NextResponse.json({ received: true, status: `membership:${membership.status}` })
  }

  const inbound = parseInbound(update)
  if (!inbound) return NextResponse.json({ received: true, status: 'ignored' })

  const admin = createAdminClient()
  const intent = parseScopedTelegramIntent(inbound.text, inbound.callbackData)
  let account = await getTelegramAccount(admin, inbound)

  // Every reply goes back to the topic the request came from. In a group with
  // a topic per project, answering outside the thread strands the reply in
  // General — the one topic that does not say which brand it is about.
  const thread = inbound.threadId !== undefined ? { threadId: inbound.threadId } : {}

  // Never throws. A message that cannot be delivered must not abandon the work
  // that follows it — the draft is already saved either way, and the owner is
  // better served by the job finishing than by the acknowledgement arriving.
  const reply = async (text: string, replyMarkup?: TelegramReplyMarkup) => {
    try {
      await sendTelegramText({
        botToken: config.botToken,
        chatId: inbound.chatId,
        text,
        ...thread,
        ...(replyMarkup ? { replyMarkup } : {}),
      })
    } catch (err) {
      console.error('[telegram] reply failed:', err instanceof Error ? err.message : err)
    }
  }

  if (intent.kind === 'pair') {
    if (account) {
      await reply('This Telegram chat is already paired with NRS. Choose a project from the list below.')
      return NextResponse.json({ received: true, status: 'already_paired' })
    }
    const paired = await redeemPairCode({ admin, inbound, code: intent.code })
    if (!paired) {
      await reply('That pairing command is invalid, expired or already used. Create a new one in NRS Settings.')
      return NextResponse.json({ received: true, status: 'pairing_denied' })
    }
    account = { id: paired.accountId, actor_user_id: paired.actorUserId }
    const grants = await getTelegramGrants(admin, account)
    await logExecution(admin, {
      actorUserId: account.actor_user_id,
      action: 'pair',
      outcome: 'allowed',
      detail: { project_count: grants.length },
    })
    await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants, ...thread })
    return NextResponse.json({ received: true, status: 'paired' })
  }

  if (!account) {
    await reply('This private NRS Telegram channel is not paired. Create a pairing command in NRS Settings, then send it here.')
    return NextResponse.json({ received: true, status: 'unpaired' })
  }

  const grants = await getTelegramGrants(admin, account)
  if (intent.kind === 'choose_project') {
    await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants, ...thread })
    return NextResponse.json({ received: true, status: 'project_picker' })
  }

  if (intent.kind === 'select_project') {
    const grant = grants.find((candidate) => candidate.grantId === intent.grantId)
    if (!grant) {
      await reply('That project selection is not available to this Telegram account. Choose a project from the current list.')
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
    await reply(`Using ${grant.projectName}. Send a marketing request whenever you are ready.`)
    return NextResponse.json({ received: true, status: 'project_selected' })
  }

  if (intent.kind === 'connect_github') {
    const session = await getActiveSession(admin, account.id)
    const selectedGrant = session
      ? grants.find((candidate) => candidate.grantId === session.grantId && candidate.projectId === session.projectId)
      : undefined
    if (intent.scope === 'current' && !selectedGrant) {
      await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants, ...thread })
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

  // "set up topics" — give every project its own forum topic, once.
  if (isTopicSetupRequest(inbound.text)) {
    // Check the three conditions FIRST and name the one that is missing.
    //
    // Telegram's requirements are explicit — the chat must be a forum, and the
    // bot must be an administrator holding can_manage_topics — but every one
    // of them fails as an identical "Bad Request". Attempting the call and
    // relaying that is useless to someone who just wants to know which switch
    // to flip.
    const botId = await getBotId(config.botToken)
    if (botId !== null) {
      const readiness = await checkTopicReadiness({
        botToken: config.botToken,
        chatId: inbound.chatId,
        botId,
      })
      if (!readiness.ready) {
        await reply(readiness.instruction ?? 'Topics cannot be set up here yet.')
        return NextResponse.json({ received: true, status: `topics_blocked:${readiness.blocker}` })
      }
    }

    // Only the projects he named. Fourteen brands means fourteen topics in a
    // group shared with one other person, which is not a workspace, it is a
    // wall. Naming none still means all, as before.
    const selection = selectTopicProjects(inbound.text ?? '', grants)

    const result = await createTopicsForProjects({
      supabase: admin,
      botToken: config.botToken,
      chatId: inbound.chatId,
      telegramAccountId: account.id,
      projects: selection.selected,
      directorTopicName: wantsDirectorTopic(inbound.text ?? '') ? DIRECTOR_TOPIC_NAME : null,
    })

    const lines = [describeTopicSetup(result)]
    if (selection.unknown.length > 0) {
      lines.push(
        `I could not find ${selection.unknown.join(', ')} among your projects — check the spelling, or switch it on in NRS Settings.`,
      )
    }
    await reply(lines.join('\n'))
    return NextResponse.json({ received: true, status: 'topics_setup' })
  }

  if (intent.kind !== 'marketing_request') return NextResponse.json({ received: true, status: 'ignored' })

  // Which project this is about, in order of how certain each answer is:
  //
  //   1. the forum topic it was posted in — unambiguous by construction
  //   2. the only project this Telegram user has — nothing to choose between
  //   3. the project they last selected
  //
  // and otherwise ask, rather than guess. Posting a ScentSell caption to
  // Underground Parfums because a stale selection was left over is worse than
  // asking.
  const topicRoute = await routeByTopic(admin, inbound.chatId, inbound.threadId ?? null)
  const grant = topicRoute
    ? grants.find(
        (candidate) =>
          candidate.grantId === topicRoute.grantId && candidate.projectId === topicRoute.projectId,
      )
    // Someone let in for one brand should never be asked which brand. This is
    // also what makes a plain group work for them with no setup at all.
    : grants.length === 1
      ? grants[0]
      : await (async () => {
          const session = await getActiveSession(admin, account.id)
          return session
            ? grants.find(
                (candidate) =>
                  candidate.grantId === session.grantId && candidate.projectId === session.projectId,
              )
            : undefined
        })()

  if (!grant) {
    // The topic names a real project, but not one this person was let in for.
    // Say that, rather than a generic "pick a project" that reads as a fault.
    if (topicRoute) {
      await reply('That topic is for a project your Telegram access does not cover. Post in a topic you have access to, and nothing here has changed.')
      return NextResponse.json({ received: true, status: 'topic_not_permitted' })
    }

    // Inline buttons only work in the private chat — a callback press from a
    // group is refused, because a scope change in a shared room could be made
    // by whoever taps it. So in a group, say what to do instead of sending a
    // picker that cannot be used.
    if (inbound.fromGroup) {
      await reply(
        'Which project is this for? Set it in your private chat with me, or turn on Topics for this group and say "set up topics" — then the topic decides.',
      )
      return NextResponse.json({ received: true, status: 'project_required' })
    }
    await sendProjectPicker({ botToken: config.botToken, chatId: inbound.chatId, grants, ...thread })
    return NextResponse.json({ received: true, status: 'project_required' })
  }

  // A file gets stored and processed before the Director is asked anything,
  // so the transcript exists by the time it writes. Sending a video used to
  // do nothing at all.
  let mediaNote = ''
  if (inbound.attachment) {
    await reply(acknowledgeAttachment(inbound.attachment, grant.projectName))

    const stored = await storeTelegramMedia({
      supabase: admin,
      botToken: config.botToken,
      userId: account.actor_user_id,
      brandId: grant.projectId,
      attachment: inbound.attachment,
    })

    if ('error' in stored) {
      await reply(stored.error)
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
    ...(inbound.threadId !== undefined ? { threadId: inbound.threadId } : {}),
  })
  return NextResponse.json({ received: true, status: 'queued' })
}
