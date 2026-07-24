export type ExecutionChannel = 'web' | 'mcp' | 'telegram' | 'internal'

export interface ExecutionScope {
  readonly actorId: string
  readonly projectId: string
  readonly channel: ExecutionChannel
  readonly capabilities: readonly string[]
}

export function createExecutionScope(
  input: Omit<ExecutionScope, 'capabilities'> & { capabilities?: readonly string[] },
): ExecutionScope {
  return Object.freeze({
    actorId: input.actorId,
    projectId: input.projectId,
    channel: input.channel,
    capabilities: Object.freeze([...(input.capabilities ?? [])]),
  })
}

export function assertProjectScope(scope: ExecutionScope, projectId: string): void {
  if (scope.projectId !== projectId) {
    throw new Error('Requested project is outside the active project scope.')
  }
}
