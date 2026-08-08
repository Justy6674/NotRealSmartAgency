/**
 * Telegram short-term thread — project-scoped conversation context.
 *
 * Telegram Director jobs are not web chat rows. Each inbound message becomes an
 * mcp_jobs row. This module reconstructs a short thread from recent completed
 * jobs for the same owner + project + grant, so follow-ups like "try again"
 * and "what did I ask you" resolve against real prior turns instead of a blank slate.
 */

export const TELEGRAM_THREAD_TURN_LIMIT = 8

export interface TelegramThreadTurn {
  jobId: string
  userMessage: string
  assistantResponse: string
  completedAt: string
  /**
   * What the Director actually DID that turn, not what it said about it.
   *
   * The single biggest hole in this history. Only the prose survived, so the
   * Director could read "I've created the drafts" and have no record that a
   * draft tool ever ran — which is how one request produced six drafts and how
   * "you did them already" was answered with two more. Its own words are not
   * evidence of its own actions.
   */
  actions?: string[]
  /** The turn failed. Kept, because "that didn't work" needs a referent. */
  failed?: boolean
}

export interface TelegramModelMessage {
  role: 'user' | 'assistant'
  content: string
}

const FOLLOW_UP = /^(?:(?:please|just|can you|could you)\s+)?(?:try\s+again|retry|redo|do\s+it\s+again|again|same\s+(?:again|thing)|once\s+more)(?:\s+[.!]*)?$/i
const META_RECALL = /\b(?:what\s+did\s+i\s+ask(?:\s+you)?|what\s+was\s+(?:my|the)\s+(?:last\s+)?(?:ask|request|question)|remind\s+me\s+what\s+i\s+(?:asked|said)|you\s+(?:forgot|lost)\s+(?:the\s+)?context)\b/i

/** Short follow-ups that only make sense with prior thread turns. */
export function isTelegramFollowUp(message: string): boolean {
  const trimmed = message.trim()
  return FOLLOW_UP.test(trimmed) || META_RECALL.test(trimmed)
}

export function isTelegramMetaRecall(message: string): boolean {
  return META_RECALL.test(message.trim())
}

/**
 * Resolve the marketing work this Telegram turn should complete.
 * Follow-ups inherit the most recent non-follow-up owner ask in the thread.
 */
export function resolveTelegramWorkMessage(
  currentMessage: string,
  priorUserMessagesOldestFirst: string[],
): string {
  if (!isTelegramFollowUp(currentMessage)) return currentMessage.trim()

  for (let i = priorUserMessagesOldestFirst.length - 1; i >= 0; i -= 1) {
    const prior = priorUserMessagesOldestFirst[i]?.trim()
    if (!prior || isTelegramFollowUp(prior)) continue
    return prior
  }

  return currentMessage.trim()
}

/** Parse one completed mcp_jobs row into a thread turn (or null if incomplete). */
export function parseTelegramJobTurn(row: {
  id: string
  input?: unknown
  result?: unknown
  completed_at?: string | null
  status?: string | null
}): TelegramThreadTurn | null {
  const input = row.input && typeof row.input === 'object' ? row.input as Record<string, unknown> : null
  const result = row.result && typeof row.result === 'object' ? row.result as Record<string, unknown> : null
  const userMessage = typeof input?.message === 'string' ? input.message.trim() : ''
  const assistantResponse = typeof result?.response === 'string' ? result.response.trim() : ''

  // A turn survives if EITHER side said something.
  //
  // Requiring both dropped every turn where NRS spoke first — the upload
  // acknowledgements, the questions it asked, the "working on it" — and every
  // turn that failed. So the history handed to the model had holes in exactly
  // the places the conversation mattered, and it looked to the owner like the
  // Director had no memory at all.
  if (!userMessage && !assistantResponse) return null
  if (!row.completed_at) return null

  const actions = Array.isArray(result?.actions)
    ? (result.actions as unknown[]).filter((a): a is string => typeof a === 'string')
    : []

  return {
    jobId: row.id,
    userMessage,
    assistantResponse,
    completedAt: row.completed_at,
    ...(actions.length > 0 ? { actions } : {}),
    ...(row.status === 'error' ? { failed: true } : {}),
  }
}

/**
 * Build AI SDK chat messages: prior turns (oldest first) then the current user message.
 * Caps to the last TELEGRAM_THREAD_TURN_LIMIT completed turns.
 */
export function buildTelegramModelMessages(
  turnsOldestFirst: TelegramThreadTurn[],
  currentMessage: string,
): TelegramModelMessage[] {
  const recent = turnsOldestFirst.slice(-TELEGRAM_THREAD_TURN_LIMIT)
  const messages: TelegramModelMessage[] = []

  for (const turn of recent) {
    // NRS speaking first is a real turn. Skipping it left the model reading
    // an answer with no question above it.
    if (turn.userMessage) messages.push({ role: 'user', content: turn.userMessage })

    if (turn.failed && !turn.assistantResponse) {
      // A failure is context. "That didn't work, try again" needs something to
      // refer to, and silence reads as though it never happened.
      messages.push({ role: 'assistant', content: '[that attempt failed and produced nothing]' })
      continue
    }
    if (!turn.assistantResponse) continue

    // The actions are appended to the reply the model sees, so its own record
    // of what it DID sits right beside what it SAID. Without this it re-does
    // work it has already done and tells the owner it is doing it for the
    // first time.
    const actions = turn.actions?.length
      ? `\n\n[what I actually did: ${turn.actions.join('; ')}]`
      : ''
    messages.push({ role: 'assistant', content: turn.assistantResponse + actions })
  }

  messages.push({ role: 'user', content: currentMessage.trim() })
  return messages
}

/** Prompt contract when this turn is a follow-up / meta-recall. */
export function buildTelegramThreadContract(
  currentMessage: string,
  workMessage: string,
  hasThread: boolean,
): string {
  if (!isTelegramFollowUp(currentMessage)) return ''

  if (!hasThread) {
    return `TELEGRAM THREAD CONTRACT
The owner sent a follow-up ("${currentMessage.trim()}") but there is no prior Telegram thread for this project in scope.
- Say plainly that you do not have the previous ask in this Telegram thread.
- Ask them to restate the marketing request once. Do not dump standing instructions or ask about a 90-day goal.`
  }

  if (isTelegramMetaRecall(currentMessage)) {
    return `TELEGRAM THREAD CONTRACT
The owner asked what they previously asked. Prior concrete ask in this thread: ${workMessage}
- First line: quote that prior ask in plain language.
- Then IMMEDIATELY complete that prior ask now using brand context. Do not stop after recalling it.
- Do not ask which of several options they meant. Do not ask about a 90-day win / end-user outcome.`
  }

  return `TELEGRAM THREAD CONTRACT
The owner said "${currentMessage.trim()}" — this continues the prior ask: ${workMessage}
- Complete that prior ask now. Do not ask which task to retry (media / caption / publish / carousel).
- Do not restate capabilities. Do not ask about a 90-day win / end-user outcome.
- Deliver the finished result for the prior ask.`
}

export interface TelegramThreadLoadScope {
  userId: string
  brandId: string
  grantId: string
  excludeJobId: string
  limit?: number
  /**
   * Which channel's jobs to read. Defaults to 'telegram' for existing callers.
   * MCP passes 'mcp' so Claude, Codex and Hermes get the same continuity —
   * before this, every chat_with_director call started from a blank slate and
   * the Director could not remember work it had just done.
   */
  channel?: string
  /** Pin to one explicit thread. Omitted = the most recent thread on this grant. */
  conversationId?: string
}

/**
 * Load recent completed Director jobs for this exact project grant.
 * Returns turns oldest-first for model message assembly.
 *
 * Despite living in telegram/, this is channel-agnostic — Telegram was simply
 * the first channel to need it.
 */
export async function loadTelegramThreadHistory(
   
  supabase: { from: (table: string) => any },
  scope: TelegramThreadLoadScope,
): Promise<TelegramThreadTurn[]> {
  const limit = scope.limit ?? TELEGRAM_THREAD_TURN_LIMIT

  let query = supabase
    .from('mcp_jobs')
    .select('id, input, result, completed_at, status')
    .eq('user_id', scope.userId)
    .eq('brand_id', scope.brandId)
    .eq('channel', scope.channel ?? 'telegram')
    .eq('project_access_grant_id', scope.grantId)
    // Errored turns are kept. A failure the owner watched happen is part of
    // the conversation, and hiding it makes "try again" meaningless.
    .in('status', ['done', 'error'])
    .neq('id', scope.excludeJobId)

  if (scope.conversationId) {
    query = query.eq('input->>conversation_id', scope.conversationId)
  }

  const { data, error } = await query
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error || !Array.isArray(data)) {
    if (error) console.error('[telegram-thread] Failed to load history:', error.message)
    return []
  }

  const turns = data
    .map((row: { id: string; input?: unknown; result?: unknown; completed_at?: string | null }) => parseTelegramJobTurn(row))
    .filter((turn: TelegramThreadTurn | null): turn is TelegramThreadTurn => turn !== null)

  // Queried newest-first; reverse for chronological model context.
  return turns.reverse()
}
