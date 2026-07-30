/**
 * Whether a new project looks like a regulated health service.
 *
 * Regulatory flags decide whether content is reviewed before it publishes, and
 * they were optional on project creation. A clinic added without them would
 * advertise with no review at all, silently — the flags are invisible in the
 * interface, so nobody would notice until something published.
 *
 * The owner is not a developer and should not be asked to answer a regulatory
 * question in a form. So this reads the words he already typed and turns the
 * flags on itself, saying that it did.
 *
 * Deliberately biased towards switching them on. A false positive costs an
 * extra review on a fragrance post. A false negative is an unreviewed health
 * claim, at up to $60,000 per offence.
 */

export interface HealthSignal {
  /** True when either regime applies. */
  regulated: boolean
  /** Advertising a regulated health service — practitioners, clinics, care. */
  ahpra: boolean
  /** Therapeutic goods — medicines, devices, therapeutic claims. */
  tga: boolean
  /** The words that triggered it, so the decision can be explained and undone. */
  reasons: string[]
}

/** Practitioner and health-service language. */
const AHPRA_TERMS = [
  'ahpra', 'clinic', 'clinical', 'telehealth', 'patient', 'patients',
  'nurse', 'nursing', 'nurse practitioner', 'doctor', 'gp ', 'general practice',
  'physician', 'psychologist', 'psychology', 'physiotherap', 'pharmacist',
  'dietitian', 'dietician', 'medical', 'medicine', 'healthcare', 'health care',
  'dermatology', 'dermatologist', 'consultation', 'diagnosis', 'diagnose',
  'treatment', 'therapy', 'practitioner', 'medicare', 'bulk bill', 'script',
]

/** Therapeutic goods language. */
const TGA_TERMS = [
  'tga', 'prescription', 'prescribe', 'medication', 'drug', 'pharmaceutical',
  'weight loss', 'weight-loss', 'glp-1', 'glp1', 'ozempic', 'wegovy',
  'mounjaro', 'semaglutide', 'tirzepatide', 'compounded',
  'supplement', 'therapeutic', 'medical device', 'skincare',
  'cosmeceutical', 'injectable', 'peptide',
]

function findTerms(haystack: string, terms: readonly string[]): string[] {
  return terms.filter((term) => haystack.includes(term))
}

/**
 * Read a project's own words for signs it advertises a regulated service.
 *
 * Every field is optional because a project can be created from very little —
 * often just a name and a niche.
 */
export function detectRegulatedHealth(project: {
  name?: string | null
  niche?: string | null
  description?: string | null
  tagline?: string | null
  website_url?: string | null
}): HealthSignal {
  const haystack = [
    project.name,
    project.niche,
    project.description,
    project.tagline,
    project.website_url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const ahpraHits = findTerms(haystack, AHPRA_TERMS)
  const tgaHits = findTerms(haystack, TGA_TERMS)

  return {
    regulated: ahpraHits.length > 0 || tgaHits.length > 0,
    ahpra: ahpraHits.length > 0,
    tga: tgaHits.length > 0,
    reasons: [...new Set([...ahpraHits, ...tgaHits])].map((t) => t.trim()),
  }
}

export interface AppliedFlags {
  compliance_flags: { ahpra: boolean; tga: boolean; tga_categories: string[] }
  /** Present when this function turned a flag on that was not asked for. */
  notice: string | null
}

/**
 * Settle the regulatory flags for a project being created.
 *
 * An explicit choice is respected — if he has said a project is regulated, it
 * stays regulated, and this only ever adds. Turning a flag off is a decision
 * for the project's own settings, where it can be seen.
 */
export function applyHealthFlags(
  project: Parameters<typeof detectRegulatedHealth>[0],
  provided?: { ahpra?: boolean; tga?: boolean; tga_categories?: string[] } | null,
): AppliedFlags {
  const signal = detectRegulatedHealth(project)

  const ahpra = Boolean(provided?.ahpra) || signal.ahpra
  const tga = Boolean(provided?.tga) || signal.tga

  const addedAhpra = ahpra && !provided?.ahpra
  const addedTga = tga && !provided?.tga

  const regimes = [addedAhpra ? 'health service advertising' : null, addedTga ? 'therapeutic goods' : null]
    .filter(Boolean)
    .join(' and ')

  return {
    compliance_flags: {
      ahpra,
      tga,
      tga_categories: provided?.tga_categories ?? [],
    },
    notice: regimes
      ? `This project reads as a regulated one (${signal.reasons.slice(0, 4).join(', ')}), so its content will be reviewed against the ${regimes} rules before it publishes. You can change that in the project's settings.`
      : null,
  }
}
