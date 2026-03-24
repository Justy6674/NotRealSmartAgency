import type { SupabaseClient } from '@supabase/supabase-js'

interface AuditParams {
  supabase: SupabaseClient
  userId: string
  agentId?: string | null
  taskId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  detail?: Record<string, unknown>
  costCents?: number
}

/**
 * Append an immutable audit log entry.
 * Non-blocking — errors are logged but don't throw.
 */
export async function logAudit({
  supabase,
  userId,
  agentId,
  taskId,
  action,
  entityType,
  entityId,
  detail = {},
  costCents = 0,
}: AuditParams): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    user_id: userId,
    agent_id: agentId ?? null,
    task_id: taskId ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    detail,
    cost_cents: costCents,
  })

  if (error) {
    console.error('[audit] Log failed:', error.message)
  }
}
