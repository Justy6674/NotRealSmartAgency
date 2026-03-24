import type { AgentType } from '@/types/database'

/**
 * Per-brand, per-department memory namespace.
 * E.g., "nrs-downscale-diary-content"
 */
export function getNamespace(brandSlug: string, agentType: AgentType): string {
  return `nrs-${brandSlug}-${agentType}`
}

/**
 * Global agency namespace — Director sees everything.
 */
export function getGlobalNamespace(): string {
  return 'nrs-agency'
}

/**
 * Brand-wide namespace — shared across departments for one brand.
 */
export function getBrandNamespace(brandSlug: string): string {
  return `nrs-${brandSlug}`
}
