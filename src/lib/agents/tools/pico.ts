import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPicoSearchResult, submitPicoSearch, type PicoSearchRequest } from '@/lib/pico/client'

export const PICO_SEARCH_OPERATION_NAMES = [
  'search_clinical_evidence',
  'get_clinical_evidence_result',
] as const

export type PicoSearchOperation = (typeof PICO_SEARCH_OPERATION_NAMES)[number]

const PICO_SEARCH_WRITE_OPERATIONS = new Set<PicoSearchOperation>([
  // A search creates a metered asynchronous evidence job in PICO.
  'search_clinical_evidence',
])

export function isPicoSearchWriteOperation(operation: PicoSearchOperation): boolean {
  return PICO_SEARCH_WRITE_OPERATIONS.has(operation)
}

const clinicalEvidenceSearchSchema = z.object({
  operation: z.literal('search_clinical_evidence'),
  question: z.string().trim().min(5).max(4000),
  mode: z.enum(['clinician', 'plain', 'both']).optional(),
  department_hint: z.array(z.string().trim().min(1).max(100)).max(24).optional(),
})

const picoSearchActionSchema = z.discriminatedUnion('operation', [
  clinicalEvidenceSearchSchema,
  z.object({ operation: z.literal('get_clinical_evidence_result'), job_id: z.string().uuid() }),
])

type PicoSearchAction = z.infer<typeof picoSearchActionSchema>

const picoToolInputSchema = z.union([
  picoSearchActionSchema,
  z.object({ operation: z.literal('execute_approved_pico_search'), approval_id: z.string().uuid() }),
])

type PicoSearchToolInput = z.infer<typeof picoToolInputSchema>

export interface PicoSearchToolContext {
  supabase: SupabaseClient
  userId: string
  agentRegistryId: string | null
  taskId?: string | null
}

/** PICO's v1 contract accepts this exact body; NRS owns the client label. */
export function toPicoSearchRequest(input: z.infer<typeof clinicalEvidenceSearchSchema>): PicoSearchRequest {
  return {
    question: input.question,
    ...(input.mode === undefined ? {} : { mode: input.mode }),
    ...(input.department_hint === undefined ? {} : { department_hint: input.department_hint }),
    client_name: 'notrealsmart',
  }
}

function approvalDescription(input: z.infer<typeof clinicalEvidenceSearchSchema>): string {
  const mode = input.mode ?? 'clinician'
  return `PICO Search will run a ${mode} clinical-evidence search and create a metered evidence job. It returns source-grounded literature, not diagnosis, treatment, prescribing or patient-specific advice.`
}

async function queuePicoSearchForApproval(
  ctx: PicoSearchToolContext,
  input: z.infer<typeof clinicalEvidenceSearchSchema>,
) {
  const { data, error } = await ctx.supabase
    .from('approval_queue')
    .insert({
      user_id: ctx.userId,
      agent_id: ctx.agentRegistryId,
      task_id: ctx.taskId ?? null,
      action_type: 'pico_search',
      payload: {
        description: approvalDescription(input),
        pico_search: { input },
      },
      status: 'pending',
    })
    .select('id, status')
    .single()

  if (error || !data) {
    return { executed: false, approvalRequested: false, error: error?.message ?? 'Could not request PICO Search approval.' }
  }

  return {
    executed: false,
    approvalRequested: true,
    approvalId: data.id,
    message: 'PICO Search is ready for approval. Once approved, execute this exact approval record; do not recreate the search.',
  }
}

async function executeApprovedPicoSearch(ctx: PicoSearchToolContext, approvalId: string) {
  const { data, error } = await ctx.supabase
    .from('approval_queue')
    .select('id, status, action_type, payload')
    .eq('id', approvalId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (error || !data) return { executed: false, error: error?.message ?? 'PICO Search approval record was not found.' }
  if (data.action_type !== 'pico_search') return { executed: false, approvalId, error: 'Approval record is not a PICO Search action.' }
  if (data.status !== 'approved') return { executed: false, approvalId, status: data.status, message: 'PICO Search still requires explicit approval.' }

  const payload = data.payload as Record<string, unknown> | null
  const picoPayload = payload?.pico_search
  const pendingInput = picoPayload && typeof picoPayload === 'object'
    ? (picoPayload as Record<string, unknown>).input
    : undefined
  const parsed = clinicalEvidenceSearchSchema.safeParse(pendingInput)
  if (!parsed.success) {
    return { executed: false, approvalId, error: 'Approval record does not contain a valid PICO Search action.' }
  }

  const previousExecution = picoPayload && typeof picoPayload === 'object'
    ? (picoPayload as Record<string, unknown>).execution
    : undefined
  if (previousExecution && typeof previousExecution === 'object') {
    const state = (previousExecution as Record<string, unknown>).status
    if (state === 'completed') return { executed: false, approvalId, message: 'This approved PICO Search has already executed.' }
    if (state === 'running') return { executed: false, approvalId, message: 'This approved PICO Search is already running.' }
  }

  const startedAt = new Date().toISOString()
  const startedPayload = {
    ...(payload ?? {}),
    pico_search: {
      ...(picoPayload as Record<string, unknown>),
      execution: { status: 'running', started_at: startedAt },
    },
  }
  const { error: claimError } = await ctx.supabase
    .from('approval_queue')
    .update({ payload: startedPayload })
    .eq('id', approvalId)
    .eq('user_id', ctx.userId)
    .eq('status', 'approved')
  if (claimError) return { executed: false, approvalId, error: claimError.message }

  try {
    const result = await submitPicoSearch(toPicoSearchRequest(parsed.data))
    const completedPayload = {
      ...startedPayload,
      pico_search: {
        ...startedPayload.pico_search,
        execution: { status: 'completed', started_at: startedAt, completed_at: new Date().toISOString(), job_id: result.job_id },
      },
    }
    await ctx.supabase.from('approval_queue').update({ payload: completedPayload }).eq('id', approvalId).eq('user_id', ctx.userId)
    return { executed: true, approvalId, operation: parsed.data.operation, result }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const failedPayload = {
      ...startedPayload,
      pico_search: {
        ...startedPayload.pico_search,
        execution: { status: 'failed', started_at: startedAt, failed_at: new Date().toISOString(), error: detail },
      },
    }
    await ctx.supabase.from('approval_queue').update({ payload: failedPayload }).eq('id', approvalId).eq('user_id', ctx.userId)
    return { executed: false, approvalId, operation: parsed.data.operation, error: detail }
  }
}

/**
 * Director-only PICO bridge. PICO returns evidence and citations; it is not
 * a diagnostic, treatment, prescribing or patient-specific advice system.
 */
export function createPicoSearchTool(ctx: PicoSearchToolContext) {
  return tool({
    description: `Use PICO Search for source-grounded clinical literature and evidence retrieval. It can start a clinical evidence search and poll its canonical pico.v1 result. Never use it for diagnosis, treatment, prescribing, clinical decision-making or patient-specific advice. Never send patient, customer, clinician or other personally identifying health information. Starting a search creates a metered PICO job, so NRS requires approval before it runs.`,
    inputSchema: picoToolInputSchema,
    execute: async (input: PicoSearchToolInput) => {
      if (input.operation === 'execute_approved_pico_search') {
        return executeApprovedPicoSearch(ctx, input.approval_id)
      }

      if (input.operation === 'search_clinical_evidence') {
        return queuePicoSearchForApproval(ctx, input)
      }

      try {
        const result = await getPicoSearchResult(input.job_id)
        return { executed: true, operation: input.operation, result }
      } catch (error) {
        return { executed: false, operation: input.operation, error: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}
