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
}: {
  userId: string
  grant: ProjectAccessGrant
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
