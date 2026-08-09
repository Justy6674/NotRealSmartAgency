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

test('requires the catalogue before ScentSell captions make a product claim', () => {
  const plan = planDirectorTask('Write an Instagram caption for a fragrance bottle product.', {
    brandSlug: 'scent-sell',
  })
  assert.deepEqual(plan.requirements.map((item) => item.capability), [
    'caption_hashtag_analysis',
    'product_identity',
  ])
  assert.deepEqual(plan.requirements[1]?.requiredAnyToolNames, ['verify_product'])
})

test('treats a Canva template carousel as a real three-design deliverable', () => {
  const plan = planDirectorTask(
    'Use the same templates we have set in Canva and do a carousel of three slides about sensible secondhand fragrance pricing.',
  )
  const requirement = plan.requirements.find((item) => item.capability === 'canva_asset')

  assert.ok(requirement)
  assert.equal(requirement.agentType, 'brand')
  assert.deepEqual(requirement.requiredAllToolNames, [
    'list_brand_templates',
    'get_brand_template_dataset',
    'generate_design_structured',
  ])
  assert.equal(requirement.minimumCanvaDesigns, 3)
  assert.equal(requirement.maxSteps, 8)
  assert.equal(requirement.timeoutMs, 180_000)
})

test('keeps a normal image request on the image-generation path', () => {
  const plan = planDirectorTask('Create an image for a Scent Sell Instagram post.')
  const requirement = plan.requirements.find((item) => item.capability === 'canva_asset')

  assert.ok(requirement)
  assert.deepEqual(requirement.requiredAnyToolNames, ['generate_image', 'generate_design_structured'])
  assert.equal(requirement.requiredAllToolNames, undefined)
  assert.equal(requirement.minimumCanvaDesigns, undefined)
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
