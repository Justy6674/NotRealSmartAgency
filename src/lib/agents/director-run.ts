import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand } from '@/types/database'
import { logAudit } from './audit'
import {
  buildDirectorCapabilityContext,
  executeDirectorTaskPlan,
  planDirectorTask,
  type CapabilityExecution,
  type DirectorTaskPlanExecution,
} from './task-capability-plan'
import {
  buildDirectorSourcePolicy,
  buildSourcePolicyContext,
  sourceKindForCapability,
  type DirectorSourcePolicy,
} from './source-policy'

export type DirectorRunChannel = 'web' | 'mcp' | 'telegram' | 'mini_app' | 'internal'
export type DirectorRunStatus = 'completed' | 'partial' | 'blocked'

export interface DirectorTurnInput {
  supabase: SupabaseClient
  userId: string
  brand: Brand
  conversationId: string | null
  channel: DirectorRunChannel
  request: string
  agentId?: string | null
  /** A retryable queue job may rejoin its prior evidence run. */
  idempotencyKey?: string
  /**
   * Whether media is already in play for this project. Lets a bare follow-up
   * like "check now" be recognised as a question about a file.
   */
  mediaInThread?: boolean
}

export interface PreparedDirectorTurn {
  runId: string | null
  status: DirectorRunStatus
  policy: DirectorSourcePolicy
  execution: DirectorTaskPlanExecution | null
  context: string
}

function safeSummary(text: string, length = 500): string {
  return text
    .replace(/(?:bearer\s+|access_token[=:]\s*|refresh_token[=:]\s*)[^\s,;]+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length)
}

function evidenceStatus(capability: CapabilityExecution): 'verified' | 'unavailable' | 'missing' {
  if (capability.error) return 'unavailable'
  return capability.evidenceSatisfied ? 'verified' : 'missing'
}

export function statusForEvidence(
  capabilities: readonly CapabilityExecution[],
): { status: DirectorRunStatus; claimStatus: 'verified' | 'limited' | 'blocked' | 'not_applicable' } {
  if (capabilities.length === 0) return { status: 'completed', claimStatus: 'not_applicable' }

  const hardFailure = capabilities.some((capability) =>
    (capability.capability === 'product_identity'
      || capability.capability === 'compliance_review'
      || capability.capability === 'canva_asset')
    && (!capability.evidenceSatisfied || Boolean(capability.error)),
  )
  if (hardFailure) return { status: 'blocked', claimStatus: 'blocked' }

  const incomplete = capabilities.some((capability) => !capability.evidenceSatisfied || Boolean(capability.error))
  return incomplete
    ? { status: 'partial', claimStatus: 'limited' }
    : { status: 'completed', claimStatus: 'verified' }
}

function ledgerUnavailableContext(policy: DirectorSourcePolicy): string {
  return [
    buildSourcePolicyContext(policy),
    '## EVIDENCE LEDGER UNAVAILABLE',
    'The required evidence record could not be created. Do not describe source-backed work as verified, do not create an authoritative claim, and tell the owner that NRS could not verify this run yet.',
  ].join('\n\n')
}

/**
 * The common pre-synthesis authority path for every Director channel.
 *
 * Routes remain responsible for identity and transport. This coordinator owns
 * the evidence contract: plan the required specialist work, run it, persist a
 * compact receipt, and give the Director only truthful completion context.
 */
export async function prepareDirectorTurn(input: DirectorTurnInput): Promise<PreparedDirectorTurn> {
  const plan = planDirectorTask(input.request, {
    brandSlug: input.brand.slug,
    regulated: Boolean(input.brand.compliance_flags?.ahpra || input.brand.compliance_flags?.tga),
    mediaInThread: input.mediaInThread,
  })
  const policy = buildDirectorSourcePolicy(input.brand, plan)

  const { data: run, error: runError } = await input.supabase
    .from('director_runs')
    .insert({
      user_id: input.userId,
      brand_id: input.brand.id,
      conversation_id: input.conversationId,
      channel: input.channel,
      request_summary: safeSummary(input.request),
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
    })
    .select('id')
    .single()

  if (runError || !run) {
    console.error('[director-run] Could not create evidence ledger:', runError?.message)
    await logAudit({
      supabase: input.supabase,
      userId: input.userId,
      agentId: input.agentId,
      action: 'director_evidence_ledger_unavailable',
      entityType: 'director_run',
      detail: { channel: input.channel, diagnosticCode: 'EvidenceLedgerUnavailable' },
    })
    return {
      runId: null,
      status: 'blocked',
      policy,
      execution: null,
      context: ledgerUnavailableContext(policy),
    }
  }

  await logAudit({
    supabase: input.supabase,
    userId: input.userId,
    agentId: input.agentId,
    action: 'director_run_started',
    entityType: 'director_run',
    entityId: run.id,
    detail: {
      channel: input.channel,
      capabilities: plan.requirements.map((requirement) => requirement.capability),
      policyVersion: policy.version,
    },
  })

  const execution = await executeDirectorTaskPlan(plan, {
    supabase: input.supabase,
    userId: input.userId,
    brandId: input.brand.id,
    brand: input.brand,
    conversationId: input.conversationId,
  })
  const settled = statusForEvidence(execution.capabilities)

  const evidenceRows = execution.capabilities.map((capability) => ({
    run_id: run.id,
    user_id: input.userId,
    brand_id: input.brand.id,
    capability: capability.capability,
    source_kind: sourceKindForCapability(capability.capability),
    status: evidenceStatus(capability),
    agent_type: capability.agentType,
    model: capability.model,
    tools_used: capability.toolNames,
    citations: capability.toolNames.map((tool) => ({ kind: 'tool', name: tool })),
    summary: safeSummary(capability.result),
    ...(capability.error
      ? { diagnostic_code: 'SpecialistUnavailable' }
      : !capability.evidenceSatisfied
        ? { diagnostic_code: 'RequiredEvidenceMissing' }
        : {}),
  }))

  if (evidenceRows.length > 0) {
    const { error: evidenceError } = await input.supabase.from('director_evidence').insert(evidenceRows)
    if (evidenceError) {
      console.error('[director-run] Could not persist evidence:', evidenceError.message)
      settled.status = 'blocked'
      settled.claimStatus = 'blocked'
    }
  }

  const { error: completeError } = await input.supabase
    .from('director_runs')
    .update({
      status: settled.status,
      claim_status: settled.claimStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('id', run.id)

  if (completeError) {
    console.error('[director-run] Could not settle evidence ledger:', completeError.message)
    settled.status = 'blocked'
    settled.claimStatus = 'blocked'
  }

  await logAudit({
    supabase: input.supabase,
    userId: input.userId,
    agentId: input.agentId,
    action: 'director_run_evidence_settled',
    entityType: 'director_run',
    entityId: run.id,
    detail: {
      channel: input.channel,
      status: settled.status,
      claimStatus: settled.claimStatus,
      totalCostCents: execution.totalCostCents,
      totalTokens: execution.totalTokens,
      durationMs: execution.durationMs,
      capabilities: execution.capabilities.map((capability) => ({
        capability: capability.capability,
        evidenceSatisfied: capability.evidenceSatisfied,
        toolNames: capability.toolNames,
        error: capability.error,
      })),
    },
    costCents: execution.totalCostCents,
  })

  return {
    runId: run.id,
    status: settled.status,
    policy,
    execution,
    context: [
      buildSourcePolicyContext(policy),
      buildDirectorCapabilityContext(execution),
      settled.claimStatus === 'blocked'
        ? '## CLAIM GATE\nA required source receipt is missing. Do not write named product claims, regulatory conclusions, or say this work is verified. Explain exactly what could not be checked.'
        : settled.claimStatus === 'limited'
          ? '## PARTIAL EVIDENCE\nAnswer only the portions supported by completed receipts. Label missing evidence plainly.'
          : null,
    ].filter(Boolean).join('\n\n'),
  }
}
