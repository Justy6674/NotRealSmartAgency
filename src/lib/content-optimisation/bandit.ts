/**
 * Multi-Armed Bandit content optimisation using Thompson Sampling.
 *
 * Each "arm" represents a content combination (content_type x platform x time_slot).
 * The bandit learns which combinations drive above-median engagement and
 * shifts the content mix toward winners automatically.
 *
 * Storage: brand_proforma_sections where section_key = 'content_optimisation'.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface BanditArm {
  key: string                  // e.g. "educational:instagram:morning"
  content_type: string         // educational, promotional, behind_the_scenes, social_proof, engagement
  platform: string             // instagram, facebook, linkedin, etc.
  time_slot: string            // morning, midday, afternoon, evening
  alpha: number                // successes + 1 (prior)
  beta: number                 // failures + 1 (prior)
  total_impressions: number
  total_successes: number      // engagement above brand's median
  last_updated: string         // ISO date
}

export interface BanditState {
  brand_id: string
  arms: BanditArm[]
  median_engagement: number    // rolling median, updated periodically
  last_calibrated: string
}

// ── Constants ────────────────────────────────────────────────────────────────

export const CONTENT_TYPES = [
  'educational',
  'promotional',
  'behind_the_scenes',
  'social_proof',
  'engagement',
] as const

export const TIME_SLOTS = {
  morning:   { label: 'Morning',   hours: [6, 7, 8, 9, 10] },
  midday:    { label: 'Midday',    hours: [11, 12, 13] },
  afternoon: { label: 'Afternoon', hours: [14, 15, 16, 17] },
  evening:   { label: 'Evening',   hours: [18, 19, 20, 21] },
} as const

export type TimeSlotKey = keyof typeof TIME_SLOTS

const SECTION_KEY = 'content_optimisation'
const MIN_IMPRESSIONS_FOR_BANDIT = 20

// ── Thompson Sampling Core ───────────────────────────────────────────────────

/**
 * Sample from a Beta(alpha, beta) distribution using the Joehnk method.
 * Simple, correct, no external dependencies.
 */
export function sampleFromBeta(alpha: number, beta: number): number {
  // Edge cases
  if (alpha <= 0) alpha = 1
  if (beta <= 0) beta = 1

  // Generate gamma variates via Ahrens-Dieter method, then normalise
  const gammaA = sampleGamma(alpha)
  const gammaB = sampleGamma(beta)
  return gammaA / (gammaA + gammaB)
}

/** Sample from Gamma(shape, 1) using Marsaglia and Tsang's method */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    // Boost: Gamma(shape) = Gamma(shape+1) * U^(1/shape)
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape)
  }

  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x: number
    let v: number

    do {
      x = randn()
      v = 1 + c * x
    } while (v <= 0)

    v = v * v * v
    const u = Math.random()

    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

/** Standard normal via Box-Muller */
function randn(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// ── Arm Selection ────────────────────────────────────────────────────────────

/**
 * Sample every arm using Thompson Sampling and return the top N.
 * Each arm draws from its Beta(alpha, beta) posterior — arms with
 * more observed success are more likely to be sampled high, but
 * under-explored arms still get a fair chance (exploration).
 */
export function selectBestArms(
  state: BanditState,
  count: number,
  filters?: { platforms?: string[]; contentTypes?: string[] },
): BanditArm[] {
  let candidates = state.arms

  if (filters?.platforms?.length) {
    const platformSet = new Set(filters.platforms)
    candidates = candidates.filter(a => platformSet.has(a.platform))
  }
  if (filters?.contentTypes?.length) {
    const typeSet = new Set(filters.contentTypes)
    candidates = candidates.filter(a => typeSet.has(a.content_type))
  }

  if (candidates.length === 0) return []

  // Sample each arm
  const sampled = candidates.map(arm => ({
    arm,
    sample: sampleFromBeta(arm.alpha, arm.beta),
  }))

  // Sort descending by sampled value, take top N
  sampled.sort((a, b) => b.sample - a.sample)
  return sampled.slice(0, count).map(s => s.arm)
}

// ── Outcome Recording ────────────────────────────────────────────────────────

/**
 * Record an observed outcome for a specific arm.
 * If engaged (above median), increment alpha. Otherwise increment beta.
 */
export function recordOutcome(
  state: BanditState,
  armKey: string,
  engaged: boolean,
): void {
  const arm = state.arms.find(a => a.key === armKey)
  if (!arm) return

  arm.total_impressions++
  if (engaged) {
    arm.alpha++
    arm.total_successes++
  } else {
    arm.beta++
  }
  arm.last_updated = new Date().toISOString()
}

// ── State Initialisation ─────────────────────────────────────────────────────

/**
 * Build arm key from components.
 */
export function armKey(contentType: string, platform: string, timeSlot: string): string {
  return `${contentType}:${platform}:${timeSlot}`
}

/**
 * Determine time slot from an AEST hour (0-23).
 */
export function getTimeSlot(aestHour: number): TimeSlotKey {
  if (aestHour >= 6 && aestHour < 11) return 'morning'
  if (aestHour >= 11 && aestHour < 14) return 'midday'
  if (aestHour >= 14 && aestHour < 18) return 'afternoon'
  return 'evening'
}

/**
 * Create a fresh bandit state with uniform priors (alpha=1, beta=1)
 * for every content_type x platform x time_slot combination.
 */
export function initializeState(brandId: string, platforms: string[]): BanditState {
  const arms: BanditArm[] = []
  const now = new Date().toISOString()
  const timeSlotKeys: TimeSlotKey[] = ['morning', 'midday', 'afternoon', 'evening']

  for (const contentType of CONTENT_TYPES) {
    for (const platform of platforms) {
      for (const timeSlot of timeSlotKeys) {
        arms.push({
          key: armKey(contentType, platform, timeSlot),
          content_type: contentType,
          platform,
          time_slot: timeSlot,
          alpha: 1,
          beta: 1,
          total_impressions: 0,
          total_successes: 0,
          last_updated: now,
        })
      }
    }
  }

  return {
    brand_id: brandId,
    arms,
    median_engagement: 0,
    last_calibrated: now,
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * Load bandit state from brand_proforma_sections.
 * Returns null if no state exists yet.
 */
export async function loadState(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BanditState | null> {
  const { data, error } = await supabase
    .from('brand_proforma_sections')
    .select('content')
    .eq('brand_id', brandId)
    .eq('section_key', SECTION_KEY)
    .maybeSingle()

  if (error || !data?.content) return null

  try {
    const state = data.content as unknown as BanditState
    // Validate it has the expected shape
    if (!state.arms || !Array.isArray(state.arms)) return null
    return state
  } catch {
    return null
  }
}

/**
 * Save bandit state to brand_proforma_sections (upsert).
 */
export async function saveState(
  supabase: SupabaseClient,
  brandId: string,
  state: BanditState,
): Promise<void> {
  await supabase
    .from('brand_proforma_sections')
    .upsert(
      {
        brand_id: brandId,
        section_key: SECTION_KEY,
        content: state as unknown as Record<string, unknown>,
        rag_status: 'green',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id,section_key' },
    )
}

// ── Helpers for Integration ──────────────────────────────────────────────────

/**
 * Check whether the bandit has enough data to make informed decisions.
 */
export function hasEnoughData(state: BanditState): boolean {
  const totalImpressions = state.arms.reduce((sum, a) => sum + a.total_impressions, 0)
  return totalImpressions >= MIN_IMPRESSIONS_FOR_BANDIT
}

/**
 * Compute the median of an array of numbers.
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}
