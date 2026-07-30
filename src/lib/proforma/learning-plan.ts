/**
 * What the nightly learning run should work on.
 *
 * The 21 strategic sections per project were seeded once from the brand record
 * and never touched again: 105 of 252 are empty and 6 have ever been reviewed.
 * A red label was shown where work should have been done.
 *
 * This decides what to do tonight. It is deliberately small and deliberately
 * fair: a bounded number of sections per run, spread across projects rather
 * than finishing one before starting another, so every project improves
 * instead of the alphabetically-first one being perfect and the rest empty.
 *
 * Kept separate from the route so the bounds can be tested — an unbounded
 * version of this spends real money on every run across eleven projects.
 */

import { CADENCE_DAYS, PROFORMA_SECTIONS, type ReviewCadence } from './sections'

/** Sections rewritten per run. Small on purpose: each one is a model call. */
export const MAX_SECTIONS_PER_RUN = 4

/** Websites re-read per run. */
export const MAX_SCANS_PER_RUN = 2

/** A site is re-read no more often than this. */
export const SCAN_INTERVAL_DAYS = 14

/**
 * Which department owns each section.
 *
 * A section written by the department that actually does that work reads like
 * that department, which is the point of having thirteen of them.
 */
export const SECTION_DEPARTMENT: Record<string, string> = {
  executive_snapshot: 'strategy',
  client_profile: 'brand',
  brand_fundamentals: 'brand',
  audience: 'brand',
  market_context: 'competitor',
  compliance_profile: 'compliance',
  business_goals: 'strategy',
  funnel_map: 'website',
  channel_website: 'website',
  channel_seo: 'seo',
  channel_social: 'content',
  channel_paid: 'paid_ads',
  channel_email: 'email',
  content_creative: 'content',
  competitors: 'competitor',
  kpi_dashboard: 'analytics',
  gaps_opportunities: 'strategy',
  wins_losses: 'analytics',
  risk_register: 'compliance',
  decision_log: 'strategy',
  thirty_sixty_ninety: 'strategy',
}

const SECTION_TITLE = new Map(PROFORMA_SECTIONS.map((s) => [s.key as string, s.title as string]))

/**
 * Sections that record the owner's own choices and cannot be researched.
 *
 * Asked to fill these, a department correctly refuses and asks a question
 * instead — which is the right answer, and a waste of a model call to reach.
 * They stay empty until he answers, and the brief already reports them as
 * never filled in, so nothing is hidden by skipping them.
 */
export const SECTION_NEEDS_OWNER: ReadonlySet<string> = new Set([
  'business_goals',
  'thirty_sixty_ninety',
  'decision_log',
])

export interface LearnableProject {
  id: string
  name: string
  slug: string
  website_url?: string | null
  /** When the site was last read, from the scan history. */
  last_scanned_at?: string | null
}

export interface LearnableSection {
  brand_id: string
  section_key: string
  section_title?: string | null
  section_data?: Record<string, unknown> | null
  review_cadence?: string | null
  last_reviewed_at?: string | null
}

export interface SectionJob {
  brandId: string
  projectName: string
  sectionKey: string
  sectionTitle: string
  department: string
  /** True when there is nothing there at all, as opposed to something old. */
  empty: boolean
}

export interface ScanJob {
  brandId: string
  projectName: string
  url: string
}

export interface LearningPlan {
  sections: SectionJob[]
  scans: ScanJob[]
  /** How many were eligible but not picked, so a run never looks complete when it isn't. */
  sectionsDeferred: number
  scansDeferred: number
}

function ageInDays(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000))
}

function isDue(section: LearnableSection, now: Date): boolean {
  const allowed = CADENCE_DAYS[(section.review_cadence ?? 'monthly') as ReviewCadence] ?? 30
  const age = ageInDays(section.last_reviewed_at, now)
  // Never reviewed is always due — that is most of them.
  return age === null || age > allowed
}

/** Whole days since the epoch — the rotation counter, stable within a day. */
function dayNumber(now: Date): number {
  return Math.floor(now.getTime() / (24 * 60 * 60 * 1000))
}

function isEmpty(section: LearnableSection): boolean {
  return !section.section_data || Object.keys(section.section_data).length === 0
}

/**
 * Choose tonight's work.
 *
 * Empty sections come before merely old ones: a project with nothing written
 * is worse off than one whose plan is a month behind. Within that, the run
 * takes one section per project before taking a second from any project.
 */
export function planLearningRun(input: {
  projects: readonly LearnableProject[]
  sections: readonly LearnableSection[]
  now: Date
  maxSections?: number
  maxScans?: number
}): LearningPlan {
  const { projects, sections, now } = input
  const maxSections = input.maxSections ?? MAX_SECTIONS_PER_RUN
  const maxScans = input.maxScans ?? MAX_SCANS_PER_RUN

  const projectById = new Map(projects.map((p) => [p.id, p]))

  const due = sections
    .filter((s) => projectById.has(s.brand_id))
    .filter((s) => isDue(s, now))
    .filter((s) => !SECTION_NEEDS_OWNER.has(s.section_key))
    .map((s) => ({
      section: s,
      empty: isEmpty(s),
      age: ageInDays(s.last_reviewed_at, now),
    }))

  // Empty first, then the oldest, then by key so the order never shuffles.
  due.sort((a, b) => {
    if (a.empty !== b.empty) return a.empty ? -1 : 1
    if (a.age === null && b.age === null) return a.section.section_key.localeCompare(b.section.section_key)
    if (a.age === null) return -1
    if (b.age === null) return 1
    if (b.age !== a.age) return b.age - a.age
    return a.section.section_key.localeCompare(b.section.section_key)
  })

  // Round-robin by project so one project cannot take the whole run.
  const byProject = new Map<string, typeof due>()
  for (const entry of due) {
    const list = byProject.get(entry.section.brand_id) ?? []
    list.push(entry)
    byProject.set(entry.section.brand_id, list)
  }

  const sorted = [...byProject.keys()].sort((a, b) =>
    (projectById.get(a)?.name ?? '').localeCompare(projectById.get(b)?.name ?? ''),
  )

  // Start at a different project each day. Sorted by name and capped at four,
  // the run served the same first four projects every night forever — the
  // eleventh project would never have been touched. Rotating by the day means
  // every project comes round, while two runs on the same day still agree.
  const offset = sorted.length > 0 ? dayNumber(now) % sorted.length : 0
  const order = [...sorted.slice(offset), ...sorted.slice(0, offset)]

  const picked: SectionJob[] = []
  let round = 0
  while (picked.length < maxSections) {
    let tookAny = false
    for (const projectId of order) {
      if (picked.length >= maxSections) break
      const entry = byProject.get(projectId)?.[round]
      if (!entry) continue
      tookAny = true
      const project = projectById.get(projectId)!
      picked.push({
        brandId: projectId,
        projectName: project.name,
        sectionKey: entry.section.section_key,
        sectionTitle:
          entry.section.section_title ?? SECTION_TITLE.get(entry.section.section_key) ?? entry.section.section_key,
        department: SECTION_DEPARTMENT[entry.section.section_key] ?? 'strategy',
        empty: entry.empty,
      })
    }
    if (!tookAny) break
    round++
  }

  // A project with a website is re-read even when no code repository was ever
  // connected — the site is the thing customers see, and it was only ever read
  // when a repository happened to be linked.
  const scanCandidates = projects
    .filter((p) => Boolean(p.website_url))
    .map((p) => ({ project: p, age: ageInDays(p.last_scanned_at, now) }))
    .filter((c) => c.age === null || c.age >= SCAN_INTERVAL_DAYS)
    .sort((a, b) => {
      if (a.age === null && b.age === null) return a.project.name.localeCompare(b.project.name)
      if (a.age === null) return -1
      if (b.age === null) return 1
      return b.age - a.age
    })

  const scans: ScanJob[] = scanCandidates
    .slice(0, maxScans)
    .map((c) => ({ brandId: c.project.id, projectName: c.project.name, url: c.project.website_url! }))

  return {
    sections: picked,
    scans,
    sectionsDeferred: Math.max(0, due.length - picked.length),
    scansDeferred: Math.max(0, scanCandidates.length - scans.length),
  }
}
