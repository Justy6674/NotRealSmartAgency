import type { ExtractedFact } from './fact-extractor'

const REMEMBER = /^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i

/**
 * Only a deliberate founder instruction becomes immediate long-term memory.
 * Other messages can still inform the current job, but never acquire durable
 * authority merely because a model inferred something from them.
 */
export function extractExplicitFounderLearnings(message: string): ExtractedFact[] {
  const remembered = message.trim().match(REMEMBER)?.[1]?.trim()
  if (!remembered) return []

  return [{
    fact: remembered,
    type: 'brand_rule',
    confidence: 1,
    tags: ['founder-stated', 'explicit-memory'],
  }]
}
