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
}): TelegramThreadTurn | null {
  const input = row.input && typeof row.input === 'object' ? row.input as Record<string, unknown> : null
  const result = row.result && typeof row.result === 'object' ? row.result as Record<string, unknown> : null
  const userMessage = typeof input?.message === 'string' ? input.message.trim() : ''
  const assistantResponse = typeof result?.response === 'string' ? result.response.trim() : ''
  if (!userMessage || !assistantResponse || !row.completed_at) return null

  return {
    jobId: row.id,
    userMessage,
    assistantResponse,
    completedAt: row.completed_at,
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
    messages.push({ role: 'user', content: turn.userMessage })
    messages.push({ role: 'assistant', content: turn.assistantResponse })
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client query builder
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
    .eq('status', 'done')
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
