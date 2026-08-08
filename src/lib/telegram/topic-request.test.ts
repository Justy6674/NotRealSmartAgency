import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isTopicSetupRequest,
  selectTopicProjects,
  wantsDirectorTopic,
  type SelectableProject,
} from './topic-request'

/** His seven switched-on projects, named exactly as the brand table holds them. */
const AVAILABLE: SelectableProject[] = [
  { grantId: 'g1', projectId: 'p1', projectName: 'Scent Sell' },
  { grantId: 'g2', projectId: 'p2', projectName: 'Downscale Weight Loss' },
  { grantId: 'g3', projectId: 'p3', projectName: 'Do Today' },
  { grantId: 'g4', projectId: 'p4', projectName: 'EndorseMe' },
  { grantId: 'g5', projectId: 'p5', projectName: 'TeleScribe' },
  { grantId: 'g6', projectId: 'p6', projectName: 'TeleCheck' },
  { grantId: 'g7', projectId: 'p7', projectName: 'TeleCheck Clinic' },
]

test('the phrasing that actually got missed is recognised', () => {
  // He asked the Director in prose; it fell through to the model, which said
  // it could not rename topics — untrue, and it sent him off doing it by hand.
  assert.ok(isTopicSetupRequest('set up topics'))
  assert.ok(isTopicSetupRequest('Rename the topics exactly that way'))
  assert.ok(isTopicSetupRequest('can you make the topics for me'))
  assert.ok(isTopicSetupRequest('organise topics please'))
  assert.ok(isTopicSetupRequest('create topics — Director, Downscale'))
  assert.ok(isTopicSetupRequest('add a topic for Scent Sell'))
})

test('ordinary talk about a topic is not a setup command', () => {
  assert.equal(isTopicSetupRequest('what topics should we cover in the blog'), false)
  assert.equal(isTopicSetupRequest('write a post about trending topics'), false)
  assert.equal(isTopicSetupRequest(undefined), false)
  assert.equal(isTopicSetupRequest(''), false)
})

test('the four he named are chosen, and nothing else', () => {
  const result = selectTopicProjects(
    'set up topics - Director, Downscale, Scent Sell, Endorse Me, Do Today',
    AVAILABLE,
  )
  assert.deepEqual(result.selected.map((p) => p.projectName), [
    'Downscale Weight Loss',
    'Scent Sell',
    'EndorseMe',
    'Do Today',
  ])
  assert.equal(result.usedEverything, false)
})

test('spelling and spacing do not have to match the brand record', () => {
  // He writes "Endorse Me"; the record says "EndorseMe". Both are his brand.
  const result = selectTopicProjects('topics for endorse me and scentsell', AVAILABLE)
  assert.deepEqual(result.selected.map((p) => p.projectName).sort(), ['EndorseMe', 'Scent Sell'])
})

test('a partial name still finds the brand', () => {
  const result = selectTopicProjects('set up topics for Downscale', AVAILABLE)
  assert.deepEqual(result.selected.map((p) => p.projectName), ['Downscale Weight Loss'])
})

test('naming nothing sets up everything, as before', () => {
  const result = selectTopicProjects('set up topics', AVAILABLE)
  assert.equal(result.usedEverything, true)
  assert.equal(result.selected.length, AVAILABLE.length)
})

test('the order he typed is the order they are created in', () => {
  const result = selectTopicProjects('topics: Do Today, Scent Sell, Downscale', AVAILABLE)
  assert.deepEqual(result.selected.map((p) => p.projectName), [
    'Do Today',
    'Scent Sell',
    'Downscale Weight Loss',
  ])
})

test('a brand he cannot reach is reported, not silently skipped', () => {
  // Sniffopotamus is a real brand but switched OFF in Telegram, so it is not
  // in `available`. Ignoring it silently reads as the command half-working.
  const result = selectTopicProjects('topics for Scent Sell and Sniffopotamus', AVAILABLE)
  assert.deepEqual(result.selected.map((p) => p.projectName), ['Scent Sell'])
  assert.ok(result.unknown.includes('Sniffopotamus'))
})

test('instruction words are never mistaken for a missing brand', () => {
  const result = selectTopicProjects('Set up topics for Scent Sell please', AVAILABLE)
  assert.deepEqual(result.unknown, [])
})

test('the Director front door is asked for by name', () => {
  assert.equal(wantsDirectorTopic('set up topics - Director, Downscale'), true)
  assert.equal(wantsDirectorTopic('set up topics for Downscale'), false)
})
