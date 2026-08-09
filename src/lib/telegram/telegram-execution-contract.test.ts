import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTelegramExecutionContract,
  isTelegramCaptionRequest,
  isTelegramExecutionRequest,
} from './telegram-execution-contract.ts'

test('an explicit Telegram task requires completed work rather than a service menu', () => {
  assert.equal(isTelegramExecutionRequest('Scan the site'), true)
  assert.equal(isTelegramExecutionRequest('Build this week’s launch plan'), true)
  assert.equal(isTelegramExecutionRequest('Hello'), false)

  const contract = buildTelegramExecutionContract('Scan the site')
  assert.match(contract, /complete the requested work/i)
  assert.match(contract, /fresh source evidence you gather with tools/i)
  assert.match(contract, /do not send a menu of services/i)
  assert.match(contract, /do not ask a clarifying question/i)
  assert.match(contract, /TELEGRAM RESEARCH-BEFORE-DELIVER CONTRACT/)
})

test('caption and hashtag asks are execution requests with a caption contract', () => {
  assert.equal(isTelegramCaptionRequest('Need a caption and hashtags for this video'), true)
  assert.equal(isTelegramExecutionRequest('Need a caption and hashtags for this video'), true)
  assert.equal(isTelegramExecutionRequest('description for my video + why to look at scent sell'), true)

  const contract = buildTelegramExecutionContract('Need a caption and hashtags for this video')
  assert.match(contract, /TELEGRAM CAPTION CONTRACT/)
  assert.match(contract, /After the research step above, write the finished caption/i)
  assert.match(contract, /free to create and customisable/i)
  assert.match(contract, /call read_proforma before writing/i)
  assert.match(contract, /Do not ask "sales, engagement, or awareness/i)
  assert.match(contract, /Never ask "What result would make the next 90 days a win/i)
  assert.match(contract, /query_media/)
})

test('try again is an execution request that completes the resolved prior ask', () => {
  assert.equal(isTelegramExecutionRequest('try again'), true)
  const contract = buildTelegramExecutionContract(
    'try again',
    'Need a caption and hashtags for this video',
  )
  assert.match(contract, /Need a caption and hashtags for this video/)
  assert.match(contract, /TELEGRAM CAPTION CONTRACT/)
  assert.match(contract, /TELEGRAM RESEARCH-BEFORE-DELIVER CONTRACT/)
})

test('what am I doing is an execution request that forces project inspection research', () => {
  assert.equal(isTelegramExecutionRequest('research what I am doing'), true)
  const contract = buildTelegramExecutionContract('research what I am doing')
  assert.match(contract, /TELEGRAM PROJECT INSPECTION/)
  assert.match(contract, /query_media/)
})
