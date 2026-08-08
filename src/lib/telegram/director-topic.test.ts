import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDirectorTopicDirective,
  directorTopicAcknowledgement,
  namedProjectIn,
  type DirectorTopicProject,
} from './director-topic'

const PROJECTS: DirectorTopicProject[] = [
  { grantId: 'g1', projectId: 'p1', projectName: 'Scent Sell' },
  { grantId: 'g2', projectId: 'p2', projectName: 'Downscale Weight Loss' },
  { grantId: 'g3', projectId: 'p3', projectName: 'Do Today' },
  { grantId: 'g4', projectId: 'p4', projectName: 'EndorseMe' },
  { grantId: 'g5', projectId: 'p5', projectName: 'TeleCheck' },
  { grantId: 'g6', projectId: 'p6', projectName: 'TeleCheck Clinic' },
]

test('naming a brand in the front door means that brand', () => {
  assert.equal(namedProjectIn('how is Scent Sell doing?', PROJECTS)?.projectName, 'Scent Sell')
  assert.equal(namedProjectIn('write up Downscale for me', PROJECTS)?.projectName, 'Downscale Weight Loss')
})

test('a longer brand is not stolen by a shorter one', () => {
  assert.equal(namedProjectIn('TeleCheck Clinic numbers', PROJECTS)?.projectName, 'TeleCheck Clinic')
})

test('a genuinely cross-brand question names no project', () => {
  assert.equal(namedProjectIn('what should I focus on this week?', PROJECTS), null)
  assert.equal(namedProjectIn('which business is doing best?', PROJECTS), null)
  assert.equal(namedProjectIn('', PROJECTS), null)
})

test('the directive names every project so the answer can span them', () => {
  const directive = buildDirectorTopicDirective(PROJECTS)
  for (const project of PROJECTS) {
    assert.match(directive, new RegExp(project.projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('the directive forbids publishable copy from the front door', () => {
  // A caption written for "the agency" belongs to nobody, and would be filed
  // against whichever project happened to be in technical scope.
  const directive = buildDirectorTopicDirective(PROJECTS)
  assert.match(directive, /Do NOT write a caption/)
  assert.match(directive, /do not create a\ndraft/)
  assert.match(directive, /Never say you are "working on" a single brand/)
})

test('the acknowledgement never names one brand', () => {
  const said = directorTopicAcknowledgement(PROJECTS)
  assert.doesNotMatch(said, /Scent Sell|Downscale|TeleCheck|EndorseMe|Do Today/)
  assert.match(said, /all 6 of your projects/)
})

test('someone with a single project is not told about "all 1"', () => {
  const said = directorTopicAcknowledgement([PROJECTS[0]])
  assert.doesNotMatch(said, /all 1/)
  assert.doesNotMatch(said, /Scent Sell/)
})
