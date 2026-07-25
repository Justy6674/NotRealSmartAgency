import type { AgentType } from '@/types/database'

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
 * The AI Gateway consumes this shape for automatic cross-provider failover.
 * Return a fresh array so individual SDK calls cannot mutate shared policy.
 */
export function getGatewayProviderOptions(tier: GatewayModelTier) {
  return {
    gateway: {
      models: [...GATEWAY_FALLBACKS[tier]],
    },
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
