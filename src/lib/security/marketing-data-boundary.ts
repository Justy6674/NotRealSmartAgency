export type MarketingInputInspection =
  | { allowed: true }
  | { allowed: false; reason: string }

const PROHIBITED_INPUT_PATTERNS: readonly RegExp[] = [
  /\b(?:date\s+of\s+birth|dob)\b/i,
  /\b(?:medical\s+record|clinical\s+notes?|medication\s+list|health\s+history)\b/i,
  /\b(?:patient|client|customer)\s+(?:named\s+)?[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?61|0)4\d{8}\b|\b0\d{9}\b/,
  /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/,
  /\bnrs_sk_[A-Za-z0-9_-]+\b/i,
  /\b(?:perfume|fragrance)\s+formula\b/i,
]

const REJECTION_REASON =
  'NRS only handles approved marketing information. Use the approved secure system for patient, clinical, personal, customer, secret or private operational information.'

/**
 * A conservative pre-model boundary. It intentionally returns no matched text
 * so callers can record a redacted policy decision rather than sensitive input.
 */
export function inspectMarketingInput(input: string): MarketingInputInspection {
  if (PROHIBITED_INPUT_PATTERNS.some((pattern) => pattern.test(input))) {
    return { allowed: false, reason: REJECTION_REASON }
  }

  return { allowed: true }
}
