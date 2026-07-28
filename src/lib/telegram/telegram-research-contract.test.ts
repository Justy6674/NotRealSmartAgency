import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTelegramResearchContract,
  isTelegramMarketingDeliverableAsk,
  isTelegramProjectInspectionAsk,
  needsTelegramResearchBeforeDeliver,
} from './telegram-research-contract.ts'

test('detects vague owner inspection asks', () => {
  assert.equal(isTelegramProjectInspectionAsk('research what I am doing'), true)
  assert.equal(isTelegramProjectInspectionAsk('what am I doing'), true)
  assert.equal(isTelegramProjectInspectionAsk('what should I post next'), true)
  assert.equal(isTelegramProjectInspectionAsk('Hello'), false)
})

test('caption and media review asks require research before deliver', () => {
  assert.equal(isTelegramMarketingDeliverableAsk('Need a caption and hashtags for this video'), true)
  assert.equal(isTelegramMarketingDeliverableAsk('review my media'), true)
  assert.equal(needsTelegramResearchBeforeDeliver('Need a caption and hashtags for this video'), true)
  assert.equal(needsTelegramResearchBeforeDeliver('Hello'), false)
})

test('research contract mandates tools then delivery, not inventing or paste forms', () => {
  const contract = buildTelegramResearchContract('research what I am doing')
  assert.match(contract, /TELEGRAM RESEARCH-BEFORE-DELIVER CONTRACT/)
  assert.match(contract, /TELEGRAM PROJECT INSPECTION/)
  assert.match(contract, /query_media/)
  assert.match(contract, /browse_page|scan_website/)
  assert.match(contract, /Never invent/)
  assert.match(contract, /paste the product/i)
  assert.match(contract, /90-day goal discovery/i)
  assert.doesNotMatch(contract, /Write the finished caption NOW using the active brand voice/i)
})

test('caption research contract still forbids inventing notes', () => {
  const contract = buildTelegramResearchContract('Need a caption for the new scent')
  assert.match(contract, /web_search/)
  assert.match(contract, /Never invent notes/)
  assert.match(contract, /RESEARCH — call the tools/)
})

test('follow-up inherits research obligation via work message', () => {
  assert.equal(
    needsTelegramResearchBeforeDeliver('try again', 'Need a caption and hashtags for this video'),
    true,
  )
  const contract = buildTelegramResearchContract(
    'try again',
    'Need a caption and hashtags for this video',
  )
  assert.match(contract, /Need a caption and hashtags for this video/)
})
