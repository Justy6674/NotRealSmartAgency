import type { AgentType } from '@/types/database'
import { AGENT_LABELS } from '@/types/database'

// ---------------------------------------------------------------------------
// Agent registry
//
// At runtime, we track which agents are "active" via a simple in-memory set.
// Ruflo MCP handles actual agent spawning during dev sessions.
// This module ensures the agent_configs row exists in Supabase (it should
// via migrations) and is a no-op at runtime — the real spawning happens
// when Ruflo MCP is connected via Claude Code.
// ---------------------------------------------------------------------------

const activeAgents = new Set<string>()

/**
 * Ensure an agent is registered. Currently a lightweight check —
 * Ruflo MCP does the heavy lifting during dev sessions.
 */
export async function ensureAgent(agentType: AgentType): Promise<void> {
  const agentId = `nrs-${agentType}`

  if (activeAgents.has(agentId)) return

  // Mark as active in our runtime registry
  activeAgents.add(agentId)

  console.log(
    `[ruflo/agent] Agent registered: ${agentId} (${AGENT_LABELS[agentType]})`
  )
}

/**
 * Get the agent ID for a given type.
 */
export function getAgentId(agentType: AgentType): string {
  return `nrs-${agentType}`
}
