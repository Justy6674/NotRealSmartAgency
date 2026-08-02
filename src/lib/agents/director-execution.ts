import {
  assertProjectCapability,
  type McpPrincipal,
  type ProjectAccessGrant,
} from '@/lib/security/project-access'

export type DirectorExecutionChannel = 'mcp' | 'telegram'

/**
 * Immutable authority for one Director job. It deliberately contains one
 * project grant rather than an owner or a portfolio, so the job runner has no
 * reason to retrieve sibling-project context later in the flow.
 */
export interface DirectorExecutionScope {
  readonly actorUserId: string
  readonly channel: DirectorExecutionChannel
  readonly projectId: string
  readonly projectAccessGrantId: string
  readonly apiKeyId?: string
  readonly policyVersion: 1
  /**
   * Where a Telegram answer is sent back to.
   *
   * Carried on the scope so the job that produces the answer can deliver it
   * itself. Delivery previously lived in a continuation after the webhook had
   * already replied, and when the platform reclaimed that function the answer
   * was written to the database and never sent — the owner saw "working on
   * it" and then silence.
   */
  readonly telegramChatId?: string
  /**
   * Forum topic the request came from, so the answer goes back to it.
   *
   * A group runs a topic per project. Replying without this puts every answer
   * in General, detached from the request and in the one topic that does not
   * say which brand it is about.
   */
  readonly telegramThreadId?: number
  /** Project name, for the line that goes with a delivered album. */
  readonly projectName?: string
}

export interface ScopedDirectorJob {
  user_id: string
  brand_id: string | null
  channel: string | null
  project_access_grant_id: string | null
  api_key_id: string | null
}

export function createMcpDirectorExecution(
  principal: McpPrincipal,
  projectId: string,
): DirectorExecutionScope {
  const grant = assertProjectCapability(principal, projectId, 'director:chat')

  return Object.freeze({
    actorUserId: principal.userId,
    channel: 'mcp',
    projectId,
    projectAccessGrantId: grant.grantId,
    apiKeyId: principal.keyId,
    policyVersion: 1,
  })
}

export function createTelegramDirectorExecution({
  userId,
  grant,
  chatId,
  threadId,
  projectName,
}: {
  userId: string
  grant: ProjectAccessGrant
  chatId?: string
  threadId?: number
  projectName?: string
}): DirectorExecutionScope {
  if (!grant.capabilities.includes('director:chat')) {
    throw new Error('This Telegram project grant does not allow director:chat.')
  }

  return Object.freeze({
    actorUserId: userId,
    channel: 'telegram',
    projectId: grant.projectId,
    projectAccessGrantId: grant.grantId,
    policyVersion: 1,
    ...(chatId !== undefined ? { telegramChatId: chatId } : {}),
    ...(threadId !== undefined ? { telegramThreadId: threadId } : {}),
    ...(projectName !== undefined ? { projectName } : {}),
  })
}

/** A background process must prove it still owns the exact queued job. */
export function matchesDirectorJobScope(
  execution: DirectorExecutionScope,
  job: ScopedDirectorJob,
): boolean {
  return job.user_id === execution.actorUserId
    && job.brand_id === execution.projectId
    && job.channel === execution.channel
    && job.project_access_grant_id === execution.projectAccessGrantId
    && (execution.channel !== 'mcp' || job.api_key_id === execution.apiKeyId)
    && (execution.channel !== 'telegram' || job.api_key_id === null)
}
