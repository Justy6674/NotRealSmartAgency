import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requestAbeAi, type AbeAiRequest } from '@/lib/abeai/full-client'

const DOCUMENT_TYPES = [
  'ai_use_policy',
  'ai_governance_framework',
  'ai_risk_management_policy',
  'ai_incident_response_plan',
  'ai_data_governance_policy',
  'ai_vendor_management_policy',
  'ai_clinical_governance_policy',
  'ai_workforce_training_policy',
  'ai_monitoring_and_audit_policy',
  'ai_change_management_policy',
  'ai_consent_and_disclosure_policy',
  'ai_privacy_impact_assessment_template',
  'ai_use_case_register',
  'ai_workforce_training_register',
] as const

export const ABEAI_OPERATION_NAMES = [
  'ask_oracle',
  'query_np_endorsement_corpus',
  'search_regulatory_corpus',
  'run_triage',
  'run_assessment',
  'generate_governance_documents',
  'scan_website',
  'scan_socials',
  'scan_seo_competitive',
  'scan_site_deep',
  'run_privacy_data_review',
  'run_accreditation',
  'run_solve',
  'list_tasks',
  'list_memory',
] as const

export type AbeAiOperation = (typeof ABEAI_OPERATION_NAMES)[number]

const ABEAI_WRITE_OPERATIONS = new Set<AbeAiOperation>([
  // Abe persists an audited agent-output row for these operations; several
  // can also create governance documents, organisation memory or tasks.
  'ask_oracle',
  'run_triage',
  'run_assessment',
  'generate_governance_documents',
  'scan_website',
  'scan_socials',
  'scan_seo_competitive',
  'scan_site_deep',
  'run_privacy_data_review',
  'run_accreditation',
  'run_solve',
])

export function isAbeAiWriteOperation(operation: AbeAiOperation): boolean {
  return ABEAI_WRITE_OPERATIONS.has(operation)
}

const question = z.string().trim().min(1).max(2000)
const url = z.string().url()
const corpusScope = z.enum(['all_healthcare', 'nursing_standards', 'np_endorsement'])
const role = z.enum(['all', 'rn', 'en', 'np', 'midwife', 'ain'])
const jurisdiction = z.enum(['all', 'federal', 'nsw', 'vic', 'qld', 'wa', 'sa', 'nt', 'act', 'tas'])
const sourceCategory = z.enum([
  'acsqhc', 'ahpra', 'aged_care', 'ndis', 'privacy', 'medicare', 'workforce',
  'tga', 'college', 'ai_specific', 'clinical_care_standard', 'digital_health',
  'state_legislation', 'accreditation_tools', 'weight_loss', 'aesthetics',
  'mental_health', 'indigenous_health', 'child_health', 'business_employment',
  'private_health_funds', 'immunisation', 'cannabis_peptides_alt',
  'disability_royal_commission', 'medication', 'pain_opioids', 'telehealth',
  'state_health_policy', 'aod', 'womens_sexual_health', 'radiology', 'pathology',
  'indemnity', 'disability_ndis', 'allied_health', 'palliative_eol_vad', 'cancer',
  'privacy_cyber_adm', 'public_health_outbreak', 'veterans_dva', 'workers_comp_rtw',
  'ctp_motor_accident',
])
const orgType = z.enum([
  'hospital', 'gp', 'allied_health', 'community', 'telehealth', 'aged_care', 'ndis',
  'cosmetic', 'pharmacy', 'dental', 'mental_health', 'aboriginal_health',
  'medical_imaging', 'digital_health',
])
const accreditationStandard = z.enum([
  'racgp_6th_ed',
  'nsqhs_2nd_ed',
  'nsqpch',
  'ndis_practice',
  'aged_care_qs',
])
const solveContext = z.object({
  policy_id: z.string().trim().max(120).optional(),
  standard_set: z.string().trim().max(120).optional(),
  register_id: z.string().trim().max(120).optional(),
  attached_file_url: url.optional(),
}).strict()

const abeActionSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('ask_oracle'), question }),
  z.object({
    operation: z.literal('query_np_endorsement_corpus'),
    question,
    jurisdictions: z.array(jurisdiction).max(10).optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  z.object({
    operation: z.literal('search_regulatory_corpus'),
    question,
    scope: corpusScope.optional(),
    roles: z.array(role).max(6).optional(),
    jurisdictions: z.array(jurisdiction).max(10).optional(),
    source_categories: z.array(sourceCategory).max(44).optional(),
    org_types: z.array(orgType).max(14).optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  z.object({ operation: z.literal('run_triage'), message: z.string().trim().min(1).max(4000), context_area: z.string().trim().max(120).optional() }),
  z.object({ operation: z.literal('run_assessment'), assessment_type: z.enum(['free_5min', 'full_paid']), responses: z.record(z.unknown()), free_text: z.string().trim().max(2000).optional() }),
  z.object({ operation: z.literal('generate_governance_documents'), document_types: z.array(z.enum(DOCUMENT_TYPES)).min(1).max(DOCUMENT_TYPES.length).optional() }),
  z.object({ operation: z.literal('scan_website'), url_override: url.optional() }),
  z.object({ operation: z.literal('scan_socials'), profile_urls: z.array(url).min(1).max(10) }),
  z.object({ operation: z.literal('scan_seo_competitive'), own_url: url.optional(), competitor_urls: z.array(url).max(5).optional() }),
  z.object({ operation: z.literal('scan_site_deep'), url_override: url.optional() }),
  z.object({ operation: z.literal('run_privacy_data_review'), trigger_source: z.enum(['manual', 'site_scan', 'social_scan', 'solve', 'scheduled']).optional(), problem_id: z.string().uuid().optional(), project_id: z.string().uuid().optional() }),
  z.object({ operation: z.literal('run_accreditation'), standard_set: accreditationStandard }),
  z.object({ operation: z.literal('run_solve'), prompt: z.string().trim().min(1).max(4000), context: solveContext.optional(), solve_thread_id: z.string().uuid().optional() }),
  z.object({ operation: z.literal('list_tasks'), status: z.string().trim().max(100).optional(), problem_id: z.string().uuid().optional(), project_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).optional() }),
  z.object({ operation: z.literal('list_memory'), keys: z.string().trim().max(1000).optional(), source_type: z.enum(['user_input', 'oracle_answer', 'website_scan', 'document_ingest', 'system_inferred', 'social_scan']).optional() }),
])

type AbeAiAction = z.infer<typeof abeActionSchema>

const abeToolInputSchema = z.union([
  abeActionSchema,
  z.object({ operation: z.literal('execute_approved_abe_action'), approval_id: z.string().uuid() }),
])

type AbeAiToolInput = z.infer<typeof abeToolInputSchema>

export interface AbeAiToolContext {
  supabase: SupabaseClient
  userId: string
  agentRegistryId: string | null
  taskId?: string | null
}

function withOptional(body: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  return value === undefined ? body : { ...body, [key]: value }
}

/** Maps every currently shipped Abe MCP capability to the underlying HTTP API. */
export function toAbeAiRequest(input: AbeAiAction): AbeAiRequest {
  switch (input.operation) {
    case 'ask_oracle':
      return { path: '/api/agents/oracle', method: 'POST', body: { question: input.question } }
    case 'query_np_endorsement_corpus': {
      let body: Record<string, unknown> = { question: input.question, scope: 'np_endorsement', roles: ['np'] }
      body = withOptional(body, 'jurisdictions', input.jurisdictions)
      body = withOptional(body, 'limit', input.limit)
      return { path: '/api/corpus/search', method: 'POST', body }
    }
    case 'search_regulatory_corpus': {
      let body: Record<string, unknown> = { question: input.question }
      body = withOptional(body, 'scope', input.scope)
      body = withOptional(body, 'roles', input.roles)
      body = withOptional(body, 'jurisdictions', input.jurisdictions)
      body = withOptional(body, 'source_categories', input.source_categories)
      body = withOptional(body, 'org_types', input.org_types)
      body = withOptional(body, 'limit', input.limit)
      return { path: '/api/corpus/search', method: 'POST', body }
    }
    case 'run_triage':
      return { path: '/api/agents/triage', method: 'POST', body: withOptional({ message: input.message }, 'context_area', input.context_area) }
    case 'run_assessment':
      return { path: '/api/agents/assess', method: 'POST', body: withOptional({ assessment_type: input.assessment_type, responses: input.responses }, 'free_text', input.free_text) }
    case 'generate_governance_documents':
      return { path: '/api/agents/governance/generate', method: 'POST', body: input.document_types ? { document_types: input.document_types } : {} }
    case 'scan_website':
      return { path: '/api/agents/site-intelligence', method: 'POST', body: input.url_override ? { url_override: input.url_override } : {} }
    case 'scan_socials':
      return { path: '/api/agents/social-intelligence', method: 'POST', body: { profile_urls: input.profile_urls } }
    case 'scan_seo_competitive': {
      let body: Record<string, unknown> = {}
      body = withOptional(body, 'own_url', input.own_url)
      body = withOptional(body, 'competitor_urls', input.competitor_urls)
      return { path: '/api/agents/seo-competitive-scan', method: 'POST', body }
    }
    case 'scan_site_deep':
      return { path: '/api/agents/site-deep-scan', method: 'POST', body: input.url_override ? { url_override: input.url_override } : {} }
    case 'run_privacy_data_review': {
      let body: Record<string, unknown> = {}
      body = withOptional(body, 'trigger_source', input.trigger_source)
      body = withOptional(body, 'problem_id', input.problem_id)
      body = withOptional(body, 'project_id', input.project_id)
      return { path: '/api/agents/privacy-data', method: 'POST', body }
    }
    case 'run_accreditation':
      return { path: '/api/agents/accreditation', method: 'POST', body: { standard_set: input.standard_set } }
    case 'run_solve': {
      let body: Record<string, unknown> = { prompt: input.prompt }
      body = withOptional(body, 'context', input.context)
      body = withOptional(body, 'solve_thread_id', input.solve_thread_id)
      return { path: '/api/solve', method: 'POST', body }
    }
    case 'list_tasks':
      return {
        path: '/api/tasks/list',
        method: 'GET',
        query: {
          status: input.status,
          problem_id: input.problem_id,
          project_id: input.project_id,
          limit: input.limit === undefined ? undefined : String(input.limit),
        },
      }
    case 'list_memory':
      return { path: '/api/memory/list', method: 'GET', query: { keys: input.keys, source_type: input.source_type } }
  }
}

function approvalDescription(input: AbeAiAction): string {
  const labels: Record<AbeAiOperation, string> = {
    ask_oracle: 'ask Abe Oracle for a cited answer',
    query_np_endorsement_corpus: 'search Abe’s NP endorsement corpus',
    search_regulatory_corpus: 'search Abe’s regulatory corpus',
    run_triage: 'run Abe’s workflow triage',
    run_assessment: 'run Abe’s AI-readiness assessment',
    generate_governance_documents: 'generate Abe governance documents',
    scan_website: 'run Abe website reconnaissance',
    scan_socials: 'run Abe social reconnaissance',
    scan_seo_competitive: 'run Abe SEO competitive scan',
    scan_site_deep: 'run Abe security and accessibility scan',
    run_privacy_data_review: 'run Abe privacy and data review',
    run_accreditation: 'run Abe accreditation assessment',
    run_solve: 'run Abe’s full Solve workflow',
    list_tasks: 'read Abe tasks',
    list_memory: 'read Abe organisation memory',
  }
  return `Abe AI will ${labels[input.operation]}. This acts in the Abe organisation linked to the configured API key and may create audited records, tasks, documents or organisation memory.`
}

async function queueAbeActionForApproval(ctx: AbeAiToolContext, input: AbeAiAction) {
  const { data, error } = await ctx.supabase
    .from('approval_queue')
    .insert({
      user_id: ctx.userId,
      agent_id: ctx.agentRegistryId,
      task_id: ctx.taskId ?? null,
      action_type: 'abe_ai_action',
      payload: {
        description: approvalDescription(input),
        abe_ai: { input },
      },
      status: 'pending',
    })
    .select('id, status')
    .single()

  if (error || !data) {
    return { executed: false, approvalRequested: false, error: error?.message ?? 'Could not request Abe approval.' }
  }

  return {
    executed: false,
    approvalRequested: true,
    approvalId: data.id,
    message: 'Abe action is ready for approval. Once approved, execute this exact approval record; do not recreate the action.',
  }
}

async function executeApprovedAbeAction(ctx: AbeAiToolContext, approvalId: string) {
  const { data, error } = await ctx.supabase
    .from('approval_queue')
    .select('id, status, action_type, payload')
    .eq('id', approvalId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (error || !data) return { executed: false, error: error?.message ?? 'Abe approval record was not found.' }
  if (data.action_type !== 'abe_ai_action') return { executed: false, approvalId, error: 'Approval record is not an Abe action.' }
  if (data.status !== 'approved') return { executed: false, approvalId, status: data.status, message: 'Abe action still requires explicit approval.' }

  const payload = data.payload as Record<string, unknown> | null
  const abePayload = payload?.abe_ai
  const pendingInput = abePayload && typeof abePayload === 'object'
    ? (abePayload as Record<string, unknown>).input
    : undefined
  const parsed = abeActionSchema.safeParse(pendingInput)
  if (!parsed.success || !isAbeAiWriteOperation(parsed.data.operation)) {
    return { executed: false, approvalId, error: 'Approval record does not contain a valid Abe state-changing action.' }
  }

  const previousExecution = abePayload && typeof abePayload === 'object'
    ? (abePayload as Record<string, unknown>).execution
    : undefined
  if (previousExecution && typeof previousExecution === 'object') {
    const state = (previousExecution as Record<string, unknown>).status
    if (state === 'completed') return { executed: false, approvalId, message: 'This approved Abe action has already executed.' }
    if (state === 'running') return { executed: false, approvalId, message: 'This approved Abe action is already running.' }
  }

  const startedPayload = {
    ...(payload ?? {}),
    abe_ai: {
      ...(abePayload as Record<string, unknown>),
      execution: { status: 'running', started_at: new Date().toISOString() },
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
    const result = await requestAbeAi(toAbeAiRequest(parsed.data))
    const completedPayload = {
      ...startedPayload,
      abe_ai: {
        ...startedPayload.abe_ai,
        execution: { status: 'completed', started_at: new Date().toISOString(), completed_at: new Date().toISOString() },
      },
    }
    await ctx.supabase.from('approval_queue').update({ payload: completedPayload }).eq('id', approvalId).eq('user_id', ctx.userId)
    return { executed: true, approvalId, operation: parsed.data.operation, result }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const failedPayload = {
      ...startedPayload,
      abe_ai: {
        ...startedPayload.abe_ai,
        execution: { status: 'failed', started_at: new Date().toISOString(), failed_at: new Date().toISOString(), error: detail },
      },
    }
    await ctx.supabase.from('approval_queue').update({ payload: failedPayload }).eq('id', approvalId).eq('user_id', ctx.userId)
    return { executed: false, approvalId, operation: parsed.data.operation, error: detail }
  }
}

/**
 * The Director’s complete Abe AI bridge. It deliberately stays out of the
 * direct MCP allowlist: external assistants hand intent to the Director,
 * which retains project scope, compliance and approval control.
 */
export function createAbeAiTool(ctx: AbeAiToolContext) {
  return tool({
    description: `Use Abe AI as NRS's Australian healthcare governance and regulatory intelligence engine. It exposes every shipped Abe capability: cited Oracle answers; NP and general regulatory corpus retrieval; workflow triage; readiness assessment; governance-document generation; website, social, SEO and security scans; privacy/data review; accreditation assessment; the full Solve orchestrator; and Abe task/memory reads. Never send patient, customer or other personally identifying health information. Abe actions that write Abe organisation state are code-gated into NRS approval before execution.`,
    inputSchema: abeToolInputSchema,
    execute: async (input: AbeAiToolInput) => {
      if (input.operation === 'execute_approved_abe_action') {
        return executeApprovedAbeAction(ctx, input.approval_id)
      }

      if (isAbeAiWriteOperation(input.operation)) {
        return queueAbeActionForApproval(ctx, input)
      }

      try {
        const result = await requestAbeAi(toAbeAiRequest(input))
        return { executed: true, operation: input.operation, result }
      } catch (error) {
        return { executed: false, operation: input.operation, error: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}
