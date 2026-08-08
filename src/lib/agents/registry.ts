import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType, AgentRegistryEntry } from '@/types/database'
import { getGatewayModel } from '@/lib/ai/model-routing'

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
      model: getGatewayModel('agency'),
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
    .select('spent_monthly_cents, updated_at')
    .eq('id', registryId)
    .single()

  if (data) {
    await supabase
      .from('agent_registry')
      .update({
        // Added to this month's figure, not to an all-time running total.
        // Without this the first spend of a new month lands on top of the last
        // one and the counter never comes down, which is how a $6 month
        // presented itself as $100.03.
        spent_monthly_cents: spentThisMonth(data.spent_monthly_cents, data.updated_at) + costCents,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq('id', registryId)
  }
}

/**
 * Check if agent has budget remaining.
 */
/**
 * The counter, or zero if it belongs to a previous month.
 *
 * Compared in UTC deliberately: the spend rows are UTC, and mixing zones here
 * would reset a day early or late depending on the season, which is a worse
 * bug than the one being fixed because it would only appear twice a year.
 *
 * Exported for the test — the whole failure was that nothing checked this.
 */
export function spentThisMonth(
  storedCents: number,
  updatedAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!updatedAt) return storedCents

  const last = new Date(updatedAt)
  if (Number.isNaN(last.getTime())) return storedCents

  const sameMonth = last.getUTCFullYear() === now.getUTCFullYear()
    && last.getUTCMonth() === now.getUTCMonth()

  return sameMonth ? storedCents : 0
}

export async function checkBudget(
  supabase: SupabaseClient,
  registryId: string
): Promise<{ allowed: boolean; remaining: number; spent: number; limit: number }> {
  const { data } = await supabase
    .from('agent_registry')
    .select('budget_monthly_cents, spent_monthly_cents, updated_at')
    .eq('id', registryId)
    .single()

  if (!data) {
    return { allowed: true, remaining: 0, spent: 0, limit: 0 }
  }

  const limit = data.budget_monthly_cents

  // A "monthly" counter that only resets if a cron happens to fire between
  // 00:00 and 00:59 on the 1st is not monthly — it is cumulative with a
  // lottery attached. It never won: the Director's counter climbed from April
  // to $100.03 against a $100 cap and locked the owner out of his own product
  // for a day, on total spend of $6.36 for the month. He was told he had hit a
  // monthly limit. He had hit four months of arithmetic.
  //
  // Resolved on read instead. The last write to this row is the last time it
  // spent anything, so a row last touched in an earlier month has, by
  // definition, spent nothing this month.
  const spent = spentThisMonth(data.spent_monthly_cents, data.updated_at)

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
