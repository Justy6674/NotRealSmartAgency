import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType, AgentRegistryEntry } from '@/types/database'

/**
 * Get or create an agent registry entry for a user + agent type.
 * Creates with defaults if not found.
 */
export async function getOrCreateAgentRegistry(
  supabase: SupabaseClient,
  userId: string,
  agentType: AgentType
): Promise<AgentRegistryEntry | null> {
  // Try to find existing
  const { data, error } = await supabase
    .from('agent_registry')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_type', agentType)
    .single()

  if (data) return data as AgentRegistryEntry

  if (error && error.code !== 'PGRST116') {
    console.error('[registry] Lookup error:', error.message)
    return null
  }

  // Create with defaults
  const { data: created, error: createError } = await supabase
    .from('agent_registry')
    .insert({
      user_id: userId,
      agent_type: agentType,
      role: agentType === 'overall' ? 'director' : 'head',
      department: agentType,
      model: 'anthropic/claude-sonnet-4',
      status: 'idle',
      is_active: true,
      budget_monthly_cents: agentType === 'overall' ? 10000 : 5000,
    })
    .select('*')
    .single()

  if (createError) {
    console.error('[registry] Create error:', createError.message)
    return null
  }

  return created as AgentRegistryEntry
}

/**
 * Update agent status (idle, working, paused, terminated).
 */
export async function updateAgentStatus(
  supabase: SupabaseClient,
  registryId: string,
  status: AgentRegistryEntry['status']
): Promise<void> {
  await supabase
    .from('agent_registry')
    .update({ status })
    .eq('id', registryId)
}

/**
 * Record spend against an agent's monthly budget.
 */
export async function recordAgentSpend(
  supabase: SupabaseClient,
  registryId: string,
  costCents: number
): Promise<void> {
  // Use RPC or raw SQL for atomic increment
  const { data } = await supabase
    .from('agent_registry')
    .select('spent_monthly_cents')
    .eq('id', registryId)
    .single()

  if (data) {
    await supabase
      .from('agent_registry')
      .update({
        spent_monthly_cents: data.spent_monthly_cents + costCents,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq('id', registryId)
  }
}

/**
 * Check if agent has budget remaining.
 */
export async function checkBudget(
  supabase: SupabaseClient,
  registryId: string
): Promise<{ allowed: boolean; remaining: number; spent: number; limit: number }> {
  const { data } = await supabase
    .from('agent_registry')
    .select('budget_monthly_cents, spent_monthly_cents')
    .eq('id', registryId)
    .single()

  if (!data) {
    return { allowed: true, remaining: 0, spent: 0, limit: 0 }
  }

  const limit = data.budget_monthly_cents
  const spent = data.spent_monthly_cents

  // If budget is 0, no limit enforced
  if (limit === 0) {
    return { allowed: true, remaining: Infinity, spent, limit }
  }

  return {
    allowed: spent < limit,
    remaining: Math.max(0, limit - spent),
    spent,
    limit,
  }
}
