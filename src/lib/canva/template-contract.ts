/**
 * A Canva account can contain templates from several businesses.  Canva's
 * Connect API does not return a brand-kit owner for each template, so a title
 * match is not safe evidence of ownership.  NRS therefore keeps an explicit
 * per-brand allowlist in brand_dna_constraints.canva_template_contract.
 */

export interface CanvaTemplateContractEntry {
  id: string
  title: string
  role?: string
}

export interface CanvaTemplateContract {
  owner: string
  templates: CanvaTemplateContractEntry[]
  /** A brand can choose to prohibit a blank, improvised Canva canvas. */
  requireTemplateForSocialVisuals: boolean
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readEntry(value: unknown): CanvaTemplateContractEntry | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim() || typeof value.title !== 'string' || !value.title.trim()) {
    return null
  }

  return {
    id: value.id.trim(),
    title: value.title.trim(),
    ...(typeof value.role === 'string' && value.role.trim() ? { role: value.role.trim() } : {}),
  }
}

/** Read only a complete, explicit allowlist. Invalid/incomplete data is fail-closed. */
export function readCanvaTemplateContract(brandDna: unknown): CanvaTemplateContract | null {
  if (!isRecord(brandDna) || !isRecord(brandDna.canva_template_contract)) return null

  const raw = brandDna.canva_template_contract
  if (typeof raw.owner !== 'string' || !raw.owner.trim() || !Array.isArray(raw.templates)) return null

  const templates = raw.templates
    .map(readEntry)
    .filter((entry): entry is CanvaTemplateContractEntry => entry !== null)
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index)

  if (!templates.length) return null

  return {
    owner: raw.owner.trim(),
    templates,
    requireTemplateForSocialVisuals: raw.require_template_for_social_visuals === true,
  }
}

export function isCanvaTemplateAllowed(contract: CanvaTemplateContract | null, templateId: string): boolean {
  return Boolean(contract?.templates.some((template) => template.id === templateId))
}

/** Keep only the provider records the active NRS brand explicitly owns. */
export function filterCanvaTemplatesForBrand<T extends { id?: unknown }>(
  templates: readonly T[],
  contract: CanvaTemplateContract | null,
): T[] {
  if (!contract) return []
  const allowed = new Set(contract.templates.map((template) => template.id))
  return templates.filter((template) => typeof template.id === 'string' && allowed.has(template.id))
}
