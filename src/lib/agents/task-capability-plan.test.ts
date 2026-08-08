import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDirectorCapabilityContext, planDirectorTask } from './task-capability-plan.ts'

test('plans website evidence and current research before a Google/GEO audit', () => {
  const plan = planDirectorTask('Audit our website elements map and current Google GEO visibility.')
  assert.deepEqual(plan.requirements.map((item) => item.capability), ['website_evidence', 'current_research'])
  assert.equal(plan.requirements[0]?.agentType, 'website')
  assert.equal(plan.requirements[1]?.agentType, 'seo')
})

test('plans distinct competitor, video, and caption work without asking every department', () => {
  const plan = planDirectorTask('Review this video, compare the competitor, then write captions and hashtags.')
  assert.deepEqual(plan.requirements.map((item) => item.capability), [
    'competitor_research',
    'video_evidence',
    'caption_hashtag_analysis',
  ])
})

test('keeps ordinary conversation out of the expensive specialist path', () => {
  assert.equal(planDirectorTask('Thanks, make that a little friendlier.').requirements.length, 0)
})

test('marks missing specialist evidence explicitly in Director context', () => {
  const context = buildDirectorCapabilityContext({
    plan: planDirectorTask('Audit our website'),
    totalCostCents: 0,
    totalTokens: 0,
    durationMs: 0,
    capabilities: [{
      capability: 'website_evidence',
      agentType: 'website',
      model: 'anthropic/claude-haiku-4.5',
      toolNames: [],
      evidenceSatisfied: false,
      result: 'General review only.',
    }],
  })
  assert.match(context ?? '', /WITHOUT THE REQUIRED EVIDENCE/)
  assert.match(context ?? '', /Tools actually used: none/)
})
