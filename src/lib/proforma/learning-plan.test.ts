import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_SECTIONS_PER_RUN,
  SCAN_INTERVAL_DAYS,
  SECTION_DEPARTMENT,
  SECTION_NEEDS_OWNER,
  planLearningRun,
  type LearnableProject,
  type LearnableSection,
} from './learning-plan.ts'
import { PROFORMA_SECTIONS } from './sections.ts'

const NOW = new Date('2026-07-30T09:00:00.000Z')

function ago(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function project(id: string, name: string, over: Partial<LearnableProject> = {}): LearnableProject {
  return { id, name, slug: name.toLowerCase(), ...over }
}

function section(
  brand_id: string,
  section_key: string,
  over: Partial<LearnableSection> = {},
): LearnableSection {
  return { brand_id, section_key, review_cadence: 'monthly', ...over }
}

test('a run never exceeds its bound, however much is due', () => {
  // Unbounded, this spends real money on every run across eleven projects.
  const projects = Array.from({ length: 11 }, (_, i) => project(`p${i}`, `Project ${i}`))
  const sections = projects.flatMap((p) =>
    PROFORMA_SECTIONS.map((s) => section(p.id, s.key)),
  )

  const plan = planLearningRun({ projects, sections, now: NOW })

  assert.equal(plan.sections.length, MAX_SECTIONS_PER_RUN)

  // Everything due that was not picked must be reported, so a run that did
  // four of two hundred never reads as a run that finished the work.
  const eligiblePerProject = PROFORMA_SECTIONS.filter((s) => !SECTION_NEEDS_OWNER.has(s.key)).length
  assert.equal(plan.sectionsDeferred, 11 * eligiblePerProject - MAX_SECTIONS_PER_RUN)
})

test('work is spread across projects rather than finishing one first', () => {
  const projects = [project('a', 'Alpha'), project('b', 'Bravo'), project('c', 'Charlie')]
  const sections = projects.flatMap((p) => PROFORMA_SECTIONS.map((s) => section(p.id, s.key)))

  const plan = planLearningRun({ projects, sections, now: NOW })

  const distinct = new Set(plan.sections.map((s) => s.brandId))
  assert.equal(distinct.size, 3, 'every project must get a turn before any gets a second')
})

test('an empty section is done before a merely old one', () => {
  const projects = [project('a', 'Alpha')]
  const sections = [
    section('a', 'kpi_dashboard', { section_data: { a: 1 }, last_reviewed_at: ago(400) }),
    section('a', 'audience', { section_data: {} }),
  ]

  const plan = planLearningRun({ projects, sections, now: NOW })

  assert.equal(plan.sections[0].sectionKey, 'audience')
  assert.equal(plan.sections[0].empty, true)
})

test('a section reviewed inside its cadence is left alone', () => {
  const plan = planLearningRun({
    projects: [project('a', 'Alpha')],
    sections: [section('a', 'audience', { section_data: { x: 1 }, last_reviewed_at: ago(3) })],
    now: NOW,
  })
  assert.equal(plan.sections.length, 0)
  assert.equal(plan.sectionsDeferred, 0)
})

test('a section never reviewed is always due', () => {
  const plan = planLearningRun({
    projects: [project('a', 'Alpha')],
    sections: [section('a', 'audience', { section_data: { x: 1 } })],
    now: NOW,
  })
  assert.equal(plan.sections.length, 1)
})

test('each section goes to the department that does that work', () => {
  const plan = planLearningRun({
    projects: [project('a', 'Alpha')],
    sections: [section('a', 'channel_seo')],
    now: NOW,
  })
  assert.equal(plan.sections[0].department, 'seo')
})

test('every section has a department, so none silently falls to a default', () => {
  for (const s of PROFORMA_SECTIONS) {
    assert.ok(SECTION_DEPARTMENT[s.key], `${s.key} has no department`)
  }
})

test('a site is re-read even when no code repository was ever connected', () => {
  // Sites were only ever read when a repository happened to be linked, so a
  // project with a website and no repo was never looked at again.
  const plan = planLearningRun({
    projects: [project('a', 'Alpha', { website_url: 'https://example.com' })],
    sections: [],
    now: NOW,
  })
  assert.equal(plan.scans.length, 1)
  assert.equal(plan.scans[0].url, 'https://example.com')
})

test('a site read recently is not read again', () => {
  const plan = planLearningRun({
    projects: [
      project('a', 'Alpha', { website_url: 'https://example.com', last_scanned_at: ago(2) }),
    ],
    sections: [],
    now: NOW,
  })
  assert.equal(plan.scans.length, 0)
})

test('a site past the interval is read again', () => {
  const plan = planLearningRun({
    projects: [
      project('a', 'Alpha', {
        website_url: 'https://example.com',
        last_scanned_at: ago(SCAN_INTERVAL_DAYS + 1),
      }),
    ],
    sections: [],
    now: NOW,
  })
  assert.equal(plan.scans.length, 1)
})

test('a project with no website is never queued for a read', () => {
  const plan = planLearningRun({
    projects: [project('a', 'Alpha')],
    sections: [],
    now: NOW,
  })
  assert.equal(plan.scans.length, 0)
})

test('sections belonging to an inactive project are ignored', () => {
  // The section rows outlive deactivation, and paying to rewrite the plan of a
  // retired project is money spent on nothing.
  const plan = planLearningRun({
    projects: [project('a', 'Alpha')],
    sections: [section('retired', 'audience'), section('a', 'audience')],
    now: NOW,
  })
  assert.equal(plan.sections.length, 1)
  assert.equal(plan.sections[0].brandId, 'a')
})

test('two identical runs choose the same work', () => {
  const projects = [project('a', 'Alpha'), project('b', 'Bravo')]
  const sections = projects.flatMap((p) => PROFORMA_SECTIONS.map((s) => section(p.id, s.key)))

  const first = planLearningRun({ projects, sections, now: NOW }).sections.map((s) => s.sectionKey + s.brandId)
  const second = planLearningRun({ projects, sections, now: NOW }).sections.map((s) => s.sectionKey + s.brandId)

  assert.deepEqual(first, second)
})

test('sections recording the owner\'s own choices are never auto-written', () => {
  // Asked to write business goals, a department correctly refuses and asks a
  // question instead — the right answer, and a wasted model call to reach.
  const plan = planLearningRun({
    projects: [project('a', 'Alpha')],
    sections: [
      section('a', 'business_goals'),
      section('a', 'thirty_sixty_ninety'),
      section('a', 'decision_log'),
    ],
    now: NOW,
  })
  assert.equal(plan.sections.length, 0)
})

test('a researchable section is still picked up alongside owner-only ones', () => {
  const plan = planLearningRun({
    projects: [project('a', 'Alpha')],
    sections: [section('a', 'business_goals'), section('a', 'competitors')],
    now: NOW,
  })
  assert.equal(plan.sections.length, 1)
  assert.equal(plan.sections[0].sectionKey, 'competitors')
})

test('every project is served within a fortnight, not just the first four', () => {
  // Sorted by name and capped at four, the run served the same first four
  // projects every night forever — the eleventh would never be touched.
  const projects = Array.from({ length: 11 }, (_, i) => project(`p${i}`, `Project ${String(i).padStart(2, '0')}`))
  const sections = projects.flatMap((p) => PROFORMA_SECTIONS.map((s) => section(p.id, s.key)))

  const served = new Set<string>()
  for (let day = 0; day < 14; day++) {
    const now = new Date(NOW.getTime() + day * 24 * 60 * 60 * 1000)
    for (const job of planLearningRun({ projects, sections, now }).sections) served.add(job.brandId)
  }

  assert.equal(served.size, 11, 'every project must come round')
})

test('two runs on the same day still agree', () => {
  const projects = Array.from({ length: 11 }, (_, i) => project(`p${i}`, `Project ${i}`))
  const sections = projects.flatMap((p) => PROFORMA_SECTIONS.map((s) => section(p.id, s.key)))

  const morning = new Date('2026-07-30T01:00:00.000Z')
  const evening = new Date('2026-07-30T22:00:00.000Z')

  assert.deepEqual(
    planLearningRun({ projects, sections, now: morning }).sections.map((s) => s.brandId + s.sectionKey),
    planLearningRun({ projects, sections, now: evening }).sections.map((s) => s.brandId + s.sectionKey),
  )
})
