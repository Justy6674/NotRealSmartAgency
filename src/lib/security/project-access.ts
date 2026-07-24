export type ProjectCapability =
  | 'director:chat'
  | 'draft:post'
  | 'direct:read'
  | 'direct:utility'
  | 'publish:request'

export interface ProjectAccessGrant {
  readonly grantId: string
  readonly projectId: string
  readonly capabilities: readonly ProjectCapability[]
}

export interface McpPrincipal {
  readonly userId: string
  readonly keyId: string
  readonly grants: readonly ProjectAccessGrant[]
}

export function createMcpPrincipal(input: {
  userId: string
  keyId: string
  grants: readonly ProjectAccessGrant[]
}): McpPrincipal {
  return Object.freeze({
    userId: input.userId,
    keyId: input.keyId,
    grants: Object.freeze(input.grants.map((grant) => Object.freeze({
      grantId: grant.grantId,
      projectId: grant.projectId,
      capabilities: Object.freeze([...grant.capabilities]),
    }))),
  })
}

export function listGrantedProjectIds(principal: McpPrincipal): string[] {
  return [...new Set(principal.grants.map((grant) => grant.projectId))].sort()
}

export function assertProjectCapability(
  principal: McpPrincipal,
  projectId: string,
  capability: ProjectCapability,
): ProjectAccessGrant {
  const grant = principal.grants.find((candidate) => candidate.projectId === projectId)
  if (!grant) {
    throw new Error('Requested project is not granted to this MCP connection.')
  }

  if (!grant.capabilities.includes(capability)) {
    throw new Error(`This MCP connection does not allow ${capability} for the requested project.`)
  }

  return grant
}
