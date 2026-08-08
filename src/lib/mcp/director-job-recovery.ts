import type { DirectorExecutionScope } from '@/lib/agents/director-execution'
import type { DirectorJobInput } from './director-job'

export const DIRECTOR_JOB_QUEUE_GRACE_MS = 2 * 60 * 1000
export const DIRECTOR_JOB_RUNNING_GRACE_MS = 10 * 60 * 1000

type JsonRecord = Record<string, unknown>

export interface RecoverableDirectorJobRow {
  id: string
  user_id: string
  brand_id: string | null
  channel: string | null
  api_key_id: string | null
  project_access_grant_id: string | null
  policy_version: number | null
  status: string
  input: unknown
  created_at: string
  started_at: string | null
}

export interface RecoveredDirectorJob {
  execution: DirectorExecutionScope
  input: DirectorJobInput
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function optionalThreadId(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined
}

/**
 * Rebuild the immutable execution scope from a server-created mcp_jobs row.
 * Telegram delivery details are deliberately persisted inside job input so a
 * job reclaimed after a Vercel interruption still returns to the same chat.
 */
export function recoverDirectorJob(row: RecoverableDirectorJobRow): RecoveredDirectorJob | null {
  const input = asRecord(row.input)
  const brandId = nonEmptyString(row.brand_id)
  const grantId = nonEmptyString(row.project_access_grant_id)
  const message = nonEmptyString(input?.message)
  const inputBrandId = nonEmptyString(input?.brand_id)

  if (!input || !brandId || !grantId || !message || inputBrandId !== brandId) return null
  if (row.channel !== 'mcp' && row.channel !== 'telegram') return null

  const base = {
    actorUserId: row.user_id,
    projectId: brandId,
    projectAccessGrantId: grantId,
    policyVersion: 1 as const,
  }

  if (row.channel === 'mcp') {
    const execution: DirectorExecutionScope = Object.freeze({
      ...base,
      channel: 'mcp',
      ...(row.api_key_id ? { apiKeyId: row.api_key_id } : {}),
    })
    return {
      execution,
      input: {
        brand_id: brandId,
        message,
        ...(nonEmptyString(input.conversation_id) ? { conversation_id: input.conversation_id as string } : {}),
      },
    }
  }

  const delivery = asRecord(input.delivery)
  const chatId = nonEmptyString(delivery?.telegram_chat_id)
  if (!chatId) return null

  const execution: DirectorExecutionScope = Object.freeze({
    ...base,
    channel: 'telegram',
    telegramChatId: chatId,
    ...(optionalThreadId(delivery?.telegram_thread_id) !== undefined
      ? { telegramThreadId: optionalThreadId(delivery?.telegram_thread_id) }
      : {}),
    ...(nonEmptyString(delivery?.project_name) ? { projectName: delivery?.project_name as string } : {}),
    deliverText: delivery?.deliver_text !== false,
  })

  return {
    execution,
    input: {
      brand_id: brandId,
      message,
      ...(nonEmptyString(input.conversation_id) ? { conversation_id: input.conversation_id as string } : {}),
    },
  }
}

export function isQueuedLongEnough(row: Pick<RecoverableDirectorJobRow, 'status' | 'created_at'>, now = Date.now()) {
  return row.status === 'queued' && now - new Date(row.created_at).getTime() >= DIRECTOR_JOB_QUEUE_GRACE_MS
}

export function isRunningTooLong(row: Pick<RecoverableDirectorJobRow, 'status' | 'started_at'>, now = Date.now()) {
  return row.status === 'running'
    && !!row.started_at
    && now - new Date(row.started_at).getTime() >= DIRECTOR_JOB_RUNNING_GRACE_MS
}

export function withRecoveryAttempt(input: unknown, now = new Date()): JsonRecord {
  const source = asRecord(input) ?? {}
  const existingRecovery = asRecord(source.recovery)
  const attempts = typeof existingRecovery?.attempts === 'number' && Number.isSafeInteger(existingRecovery.attempts)
    ? existingRecovery.attempts + 1
    : 1

  return {
    ...source,
    recovery: {
      attempts,
      last_recovered_at: now.toISOString(),
    },
  }
}
