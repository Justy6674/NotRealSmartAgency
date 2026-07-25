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

const GATEWAY_FALLBACKS: Record<GatewayModelTier, readonly string[]> = {
  fast: ['google/gemini-3-flash', 'openai/gpt-5.4-nano'],
  agency: ['openai/gpt-5.4', 'google/gemini-3-flash'],
  frontier: ['anthropic/claude-sonnet-5', 'openai/gpt-5.4'],
  code: ['anthropic/claude-sonnet-5', 'openai/gpt-5.4'],
}

interface GatewayModelPricing {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/**
 * USD per token from the Gateway model catalogue, refreshed 2026-07-25.
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
      fallbacks: [GATEWAY_MODELS.agency, 'openai/gpt-5.4'],
    }
  }

  return {
    tier: 'agency',
    model: GATEWAY_MODELS.agency,
    fallbacks: GATEWAY_FALLBACKS.agency,
  }
}
