import type { AgentType } from '@/types/database'
import type { GatewayProviderOptions } from '@ai-sdk/gateway'

export type GatewayModelTier = 'fast' | 'agency' | 'frontier' | 'code'
export type ResolvedGatewayModelTier = GatewayModelTier | 'custom'

export interface GatewayModelRoute {
  tier: ResolvedGatewayModelTier
  model: string
  fallbacks: readonly string[]
}

export interface AgentModelRouteInput {
  agentType: AgentType | string
  input: string
  isHealthBrand?: boolean
  registeredModel?: string | null
  /**
   * A concrete task capability takes precedence over a broad department
   * default. It keeps task-specific policy visible without pretending an
   * unmeasured model is universally "best".
   */
  taskCapability?: string | null
}

export interface GatewayRequestOptions {
  user?: string
  tags?: readonly string[]
  zeroDataRetention?: boolean
}

/**
 * One source of truth for the NRS Gateway model policy. Keep model choices
 * here, not scattered through tools, so an upgrade is testable and auditable.
 */
export const GATEWAY_MODELS: Record<GatewayModelTier, string> = {
  fast: 'anthropic/claude-haiku-4.5',
  agency: 'anthropic/claude-sonnet-5',
  frontier: 'anthropic/claude-opus-5',
  code: 'openai/gpt-5.3-codex',
}

/**
 * Where a tier goes when its first choice is unavailable.
 *
 * Checked against `GET https://ai-gateway.vercel.sh/v1/models` on 2026-08-09
 * rather than written from memory — the Gateway's own guidance is that model
 * IDs recalled from memory are stale by default, and every ID and price below
 * was read from that response.
 *
 * The Anthropic primaries were already current: sonnet-5 and opus-5 are the
 * newest that exist. The OpenAI fallbacks were two generations behind, and the
 * replacements are both newer AND cheaper — gpt-5.6-terra is $2/$12 per
 * million against gpt-5.4's $2.50/$15, so this is not a trade.
 *
 * gpt-5.3-codex stays the `code` primary: it is genuinely the newest codex in
 * the catalogue, ahead of 5.2-codex and 5.1-codex-max.
 */
const GATEWAY_FALLBACKS: Record<GatewayModelTier, readonly string[]> = {
  fast: ['google/gemini-3-flash', 'openai/gpt-5.6-luna'],
  agency: ['openai/gpt-5.6-terra', 'google/gemini-3-flash'],
  frontier: ['anthropic/claude-sonnet-5', 'openai/gpt-5.6-terra'],
  code: ['anthropic/claude-sonnet-5', 'openai/gpt-5.6-terra'],
}

/**
 * Which tier each department runs on, and why.
 *
 * `agentType` was accepted by the router and never read — one reference in the
 * whole file, the type declaration. So all fourteen agents ran the same model
 * whether they were writing an Instagram caption, reading a competitor's site
 * or scoring a health claim against AHPRA. The tools were specialised from the
 * start; the models never were.
 *
 * Only departments with a REAL reason to differ appear here. Everything absent
 * falls through to `agency` (Sonnet 5), which is the right default for writing
 * and judgement — this is a list of exceptions, not a config file to fill in.
 *
 *   compliance → frontier. It reads copy against AHPRA and TGA advertising
 *     rules for the health brands. It is the one place where being wrong is a
 *     regulatory matter rather than a bad caption, and the cost difference is
 *     cents on a check that runs once per draft.
 *
 *   competitor / website → fast. Both chew through whole pages of scraped
 *     HTML, where the work is extraction rather than craft. Haiku is a fifth
 *     of Sonnet's price on input, which is where nearly all of their tokens go.
 *
 *   analytics → fast. Reads numbers out of structured query results. There is
 *     no prose to get right.
 *
 *   automation → code. It reasons about integrations, payloads and failures,
 *     which is engineering work, and gpt-5.3-codex is the current best codex
 *     in the catalogue.
 */
const TIER_BY_AGENT: Partial<Record<AgentType, GatewayModelTier>> = {
  compliance: 'frontier',
  competitor: 'fast',
  website: 'fast',
  analytics: 'fast',
  automation: 'code',
}

/**
 * Task policy is intentionally smaller than the department policy. These are
 * the workflows whose evidence shape materially changes the model needed for
 * the synthesis, regardless of which channel submitted the job.
 */
const TIER_BY_TASK_CAPABILITY: Record<string, GatewayModelTier> = {
  website_evidence: 'fast',
  competitor_research: 'agency',
  current_research: 'agency',
  video_evidence: 'agency',
  canva_asset: 'agency',
  caption_hashtag_analysis: 'agency',
  compliance_review: 'frontier',
}

interface GatewayModelPricing {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/**
 * USD per token, read from `GET /v1/models` on the Gateway on 2026-08-09.
 *
 * Every existing figure was re-checked against that response and all seven
 * matched exactly, so this table is verified rather than merely old. The base
 * (sub-272k-token) tier is used; the Gateway charges roughly double above that
 * threshold, which no NRS call approaches.
 *
 * Unknown custom registry models are conservatively budgeted as Opus 5.
 */
const GATEWAY_MODEL_PRICING: Record<string, GatewayModelPricing> = {
  'anthropic/claude-haiku-4.5': { input: 0.000001, output: 0.000005, cacheRead: 0.0000001, cacheWrite: 0.00000125 },
  'anthropic/claude-sonnet-5': { input: 0.000002, output: 0.00001, cacheRead: 0.0000002, cacheWrite: 0.0000025 },
  'anthropic/claude-opus-5': { input: 0.000005, output: 0.000025, cacheRead: 0.0000005, cacheWrite: 0.00000625 },
  'openai/gpt-5.3-codex': { input: 0.00000175, output: 0.000014, cacheRead: 0.000000175 },
  'openai/gpt-5.4': { input: 0.0000025, output: 0.000015, cacheRead: 0.00000025 },
  'openai/gpt-5.4-nano': { input: 0.0000002, output: 0.00000125, cacheRead: 0.00000002 },
  'google/gemini-3-flash': { input: 0.0000005, output: 0.000003, cacheRead: 0.00000005 },
  'openai/gpt-5.6-terra': { input: 0.000002, output: 0.000012, cacheRead: 0.0000002, cacheWrite: 0.0000025 },
  'openai/gpt-5.6-luna': { input: 0.0000002, output: 0.0000012, cacheRead: 0.00000002, cacheWrite: 0.00000025 },
}

export interface GatewayUsageForCosting {
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  inputTokenDetails?: {
    noCacheTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
}

export interface GatewayCostEstimate {
  usd: number
  budgetCents: number
  pricingModel: string
  cacheReadTokens: number
  cacheWriteTokens: number
}

const LEGACY_MODEL_IDS = new Set([
  'anthropic/claude-sonnet-4',
  'anthropic/claude-sonnet-4-20250514',
  'anthropic/claude-haiku-4-5-20251001',
  'openai/gpt-4.1',
  'google/gemini-2.5-flash',
])

const MANAGED_DEFAULT_MODEL_IDS = new Set([
  ...LEGACY_MODEL_IDS,
  GATEWAY_MODELS.agency,
])

const CODE_WORK_PATTERN = /\b(?:source code|codebase|coding|repository|repo|github|pull request|pr\b|typescript|javascript|next\.js|supabase|api route|schema migration|authentication bug|runtime error|test suite|lint(?:ing)?|build failure|refactor)\b/i
const HIGH_STAKES_HEALTH_PATTERN = /\b(?:ahpra|tga|regulat(?:ion|ory)|accreditation|clinical evidence|clinical research|governance|privacy(?: impact)?|data protection|risk assessment|legal review|compliance review|patient safety)\b/i

export function getGatewayModel(tier: GatewayModelTier): string {
  return GATEWAY_MODELS[tier]
}

export function getGatewayFallbackModels(tier: GatewayModelTier): readonly string[] {
  return GATEWAY_FALLBACKS[tier]
}

/**
 * One current Gateway policy for every text request. Caching is provider-aware
 * (not response caching), no-training applies across all brands, and regulated
 * requests retain their stricter ZDR routing requirement.
 */
function createGatewayProviderOptions(
  fallbacks: readonly string[],
  request: GatewayRequestOptions = {},
) {
  const gateway = {
    models: [...fallbacks],
    caching: 'auto',
    disallowPromptTraining: true,
    ...(request.user ? { user: request.user } : {}),
    ...(request.tags?.length ? { tags: [...request.tags] } : {}),
    ...(request.zeroDataRetention ? { zeroDataRetention: true } : {}),
  } satisfies GatewayProviderOptions

  return {
    gateway,
  }
}

export function getGatewayProviderOptions(
  tier: GatewayModelTier,
  request?: GatewayRequestOptions,
) {
  return createGatewayProviderOptions(GATEWAY_FALLBACKS[tier], request)
}

export function getGatewayRouteProviderOptions(
  route: GatewayModelRoute,
  request?: GatewayRequestOptions,
) {
  return createGatewayProviderOptions(route.fallbacks, request)
}

/**
 * Estimate the actual Gateway request, rather than applying one old rate to
 * every model. Budget charges round up to a whole cent; the usage record keeps
 * the precise estimate for reporting.
 */
export function estimateGatewayCost(
  modelId: string,
  usage: GatewayUsageForCosting,
): GatewayCostEstimate {
  const pricingModel = GATEWAY_MODEL_PRICING[modelId]
    ? modelId
    : GATEWAY_MODELS.frontier
  const pricing = GATEWAY_MODEL_PRICING[pricingModel]
  const inputTokens = usage.inputTokenDetails?.noCacheTokens
    ?? usage.inputTokens
    ?? 0
  const cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens
    ?? usage.cachedInputTokens
    ?? 0
  const cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const usd = Number((
    inputTokens * pricing.input
    + cacheReadTokens * (pricing.cacheRead ?? pricing.input)
    + cacheWriteTokens * (pricing.cacheWrite ?? pricing.input)
    + outputTokens * pricing.output
  ).toFixed(9))

  return {
    usd,
    budgetCents: usd > 0 ? Math.ceil(usd * 100) : 0,
    pricingModel,
    cacheReadTokens,
    cacheWriteTokens,
  }
}

export function isCodeWork(input: string): boolean {
  return CODE_WORK_PATTERN.test(input)
}

export function isHighStakesHealthcareWork(input: string, isHealthBrand = false): boolean {
  return isHealthBrand && HIGH_STAKES_HEALTH_PATTERN.test(input)
}

/**
 * Routes only the work that merits a frontier or code-specialised model away
 * from the efficient Sonnet 5 default. Explicit, non-legacy registry choices
 * still win for ordinary agency work.
 */
export function resolveAgentModelRoute(input: AgentModelRouteInput): GatewayModelRoute {
  const registeredModel = input.registeredModel?.trim()
  const byDepartment = TIER_BY_AGENT[input.agentType as AgentType]
  const byTaskCapability = input.taskCapability
    ? TIER_BY_TASK_CAPABILITY[input.taskCapability]
    : undefined

  if (isCodeWork(input.input)) {
    return {
      tier: 'code',
      model: GATEWAY_MODELS.code,
      fallbacks: GATEWAY_FALLBACKS.code,
    }
  }

  if (isHighStakesHealthcareWork(input.input, input.isHealthBrand)) {
    return {
      tier: 'frontier',
      model: GATEWAY_MODELS.frontier,
      fallbacks: GATEWAY_FALLBACKS.frontier,
    }
  }

  if (registeredModel && !MANAGED_DEFAULT_MODEL_IDS.has(registeredModel)) {
    return {
      tier: 'custom',
      model: registeredModel,
      // Kept in step with GATEWAY_FALLBACKS above. This branch is unreachable
      // while every agent uses a managed default, which is exactly why it went
      // stale unnoticed when the others were upgraded.
      fallbacks: [GATEWAY_MODELS.agency, 'openai/gpt-5.6-terra'],
    }
  }

  if (byTaskCapability) {
    return {
      tier: byTaskCapability,
      model: GATEWAY_MODELS[byTaskCapability],
      fallbacks: GATEWAY_FALLBACKS[byTaskCapability],
    }
  }

  // The department's own tier, when it has a reason to differ from the default.
  if (byDepartment) {
    return {
      tier: byDepartment,
      model: GATEWAY_MODELS[byDepartment],
      fallbacks: GATEWAY_FALLBACKS[byDepartment],
    }
  }

  return {
    tier: 'agency',
    model: GATEWAY_MODELS.agency,
    fallbacks: GATEWAY_FALLBACKS.agency,
  }
}
