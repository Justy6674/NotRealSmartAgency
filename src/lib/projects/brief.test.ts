import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProjectBrief,
  findStaleSections,
  renderProjectBrief,
  type BriefProjectInput,
  type BriefSectionInput,
  type BuildBriefInput,
} from './brief.ts'
import type { BoardDecision, BoardProject } from '../macro/board.ts'

const NOW = new Date('2026-07-30T09:00:00.000Z')

function ago(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function section(over: Partial<BriefSectionInput> & { section_key: string }): BriefSectionInput {
  return { section_title: over.section_key, ...over }
}

function risk(over: Partial<BoardDecision> & { urgency: BoardDecision['urgency'] }): BoardDecision {
  return {
    id: 'r',
    projectId: 'p1',
    projectName: 'Downscale',
    kind: 'publishing_stopped',
    headline: 'something',
    detail: 'detail',
    suggestedAction: 'do the thing',
    weight: 1,
    ...over,
  }
}

function boardRow(over: Partial<BoardProject> = {}): BoardProject {
  return {
    id: 'p1', name: 'Downscale', slug: 'downscale', logoUrl: null, regulated: true,
    accountCount: 3, needsReconnecting: [], scheduledThisWeek: 0, publishedThisWeek: 0,
    failed: 0, unreviewedRegulated: 0, draftsWaiting: 0, awaitingApproval: 0,
    state: 'quiet', suggestedAction: 'x', ...over,
  }
}

const PROJECT: BriefProjectInput = {
  id: 'p1',
  name: 'Downscale',
  slug: 'downscale',
  website_url: 'https://downscale.com.au',
  logo_url: 'https://example.com/logo.png',
  brand_colours: { primary: '#B68A71' },
  compliance_flags: { ahpra: true, tga: true },
  tone_of_voice: { keywords: ['warm', 'clinical'], avoid_words: ['miracle'] },
  content_pillars: ['education'],
}

function build(over: Partial<BuildBriefInput> = {}) {
  return buildProjectBrief({
    project: PROJECT,
    sections: [],
    risks: [],
    board: null,
    now: NOW,
    ...over,
  })
}

test('a section never reviewed counts as out of date, not as new', () => {
  // Six of 252 sections in the portfolio have ever been reviewed. Treating
  // "never" as "not yet due" reports everything healthy forever.
  const stale = findStaleSections([section({ section_key: 'audience' })], NOW)
  assert.equal(stale.length, 1)
  assert.equal(stale[0].daysOverdue, null)
})

test('a section reviewed within its cadence is not stale', () => {
  const stale = findStaleSections(
    [section({ section_key: 'audience', review_cadence: 'monthly', last_reviewed_at: ago(10) })],
    NOW,
  )
  assert.equal(stale.length, 0)
})

test('a section past its cadence is stale by the days it is over', () => {
  const stale = findStaleSections(
    [section({ section_key: 'audience', review_cadence: 'weekly', last_reviewed_at: ago(20) })],
    NOW,
  )
  assert.equal(stale[0].daysOverdue, 13)
})

test('never-reviewed sections sort above merely overdue ones', () => {
  const stale = findStaleSections(
    [
      section({ section_key: 'old', review_cadence: 'weekly', last_reviewed_at: ago(200) }),
      section({ section_key: 'never' }),
    ],
    NOW,
  )
  assert.equal(stale[0].key, 'never')
})

test('the contract names what it does not have, so nothing is invented', () => {
  const brief = build({
    project: { id: 'p2', name: 'Sniffopotamus', slug: 'sniff' },
  })
  assert.deepEqual(
    brief.contract.missing.sort(),
    ['brand colours', 'content pillars', 'logo', 'voice keywords', 'website'].sort(),
  )
  assert.equal(brief.contract.colours, null)
  assert.match(renderProjectBrief(brief), /rather than inventing them/i)
})

test('a complete contract reports nothing missing', () => {
  const brief = build()
  assert.deepEqual(brief.contract.missing, [])
  assert.equal(brief.contract.colours?.primary, '#B68A71')
})

test('a regulated project says so in one line', () => {
  const brief = build()
  assert.equal(brief.project.regulated, true)
  assert.match(brief.summary, /reviewed first/i)
  assert.match(renderProjectBrief(brief), /Rules apply/)
})

test('an unregulated project is not told rules apply', () => {
  const brief = build({ project: { ...PROJECT, compliance_flags: { ahpra: false, tga: false } } })
  assert.equal(brief.project.regulated, false)
  assert.equal(brief.project.regime, null)
  assert.ok(!renderProjectBrief(brief).includes('Rules apply'))
})

test('three next actions come back, most consequential first', () => {
  const brief = build({
    risks: [
      risk({ urgency: 'waiting', suggestedAction: 'schedule the drafts' }),
      risk({ urgency: 'regulated', suggestedAction: 'check the scheduled posts' }),
      risk({ urgency: 'blocked', suggestedAction: 'reconnect the account' }),
    ],
  })
  assert.equal(brief.nextActions.length, 3)
  assert.equal(brief.nextActions[0], 'check the scheduled posts')
  assert.equal(brief.nextActions[1], 'reconnect the account')
})

test('a project with nothing wrong still gets something to do', () => {
  const brief = build({
    sections: [section({ section_key: 'audience', section_title: 'Audience' })],
    board: boardRow(),
  })
  assert.ok(brief.nextActions.length > 0, 'a brief with no suggestion is not a brief')
})

test('a project with no stale sections and no risks is not invented work', () => {
  const brief = build({
    sections: [
      section({ section_key: 'audience', review_cadence: 'monthly', last_reviewed_at: ago(1) }),
    ],
    board: boardRow({ scheduledThisWeek: 5, state: 'steady' }),
  })
  assert.deepEqual(brief.nextActions, [])
  assert.match(brief.summary, /Nothing is stuck/)
})

test('the rendered brief carries the exact colours and forbids substitution', () => {
  const text = renderProjectBrief(build())
  assert.match(text, /#B68A71/)
  assert.match(text, /never substitute/i)
})

test('avoid-words and never-do rules reach the reader', () => {
  const brief = build({
    project: {
      ...PROJECT,
      brand_dna_constraints: { voice_rules: ['Lead with the person'], never_do: ['Name a drug'] },
    },
  })
  const text = renderProjectBrief(brief)
  assert.match(text, /miracle/)
  assert.match(text, /Name a drug/)
  assert.match(text, /Lead with the person/)
})

test('waiting items never fill every slot on a busy project', () => {
  // Uncapped, a project with many drafts pushed out the gaps and stale work,
  // which is the reason a brief exists rather than a queue.
  const brief = build({
    risks: [
      risk({ id: 'w1', urgency: 'waiting', suggestedAction: 'schedule drafts' }),
      risk({ id: 'w2', urgency: 'waiting', suggestedAction: 'approve things' }),
      risk({ id: 'w3', urgency: 'waiting', suggestedAction: 'more waiting' }),
    ],
    project: { id: 'p2', name: 'Sniffopotamus', slug: 'sniff' },
  })
  const waiting = brief.nextActions.filter((a) => a.includes('waiting') || a.includes('schedule drafts') || a.includes('approve things'))
  assert.equal(waiting.length, 1, 'at most one waiting item may take a slot')
  assert.ok(brief.nextActions.some((a) => /no brand colours|not recorded|never been filled/i.test(a)),
    'the freed slots must go to the gaps')
})

test('the same suggestion is never listed twice', () => {
  // An empty week is raised by the board as a risk and was also added as a
  // fallback, so it appeared in slots one and three of the real brief.
  const brief = build({
    risks: [risk({ kind: 'nothing_planned', urgency: 'waiting', suggestedAction: 'plan a week for Downscale' })],
    board: boardRow({ scheduledThisWeek: 0 }),
  })
  assert.equal(new Set(brief.nextActions).size, brief.nextActions.length)
  assert.equal(brief.nextActions.filter((a) => /nothing going out|plan a week/i.test(a)).length, 1)
})
