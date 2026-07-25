import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWebsiteScanGroundingDirective,
  isWebsiteScanRequest,
  resolveWebsiteScanUrl,
} from './website-scan-directive.ts'

test('recognises a short request to scan the selected project website', () => {
  assert.equal(isWebsiteScanRequest('Scan the site'), true)
  assert.equal(isWebsiteScanRequest('Can you audit our homepage?'), true)
  assert.equal(isWebsiteScanRequest('Write an Instagram post'), false)
  assert.equal(resolveWebsiteScanUrl('Scan the site', 'https://www.dotoday.com.au'), 'https://www.dotoday.com.au')
  assert.equal(resolveWebsiteScanUrl('Scan https://example.com/landing', null), 'https://example.com/landing')
})

test('fresh scan evidence explicitly overrides stale brand memory', () => {
  const directive = buildWebsiteScanGroundingDirective({
    url: 'https://www.dotoday.com.au',
    title: 'Do Today — AI Weight-Loss Companion for Australians',
    description: 'The Australian AI companion for the reasons in between.',
    headings: [{ level: 'h2', text: 'You talk. Abraham does the rest.' }],
    bodyText: 'Do Today is for Australians.',
  })

  assert.match(directive, /overrides any conflicting stored brand context/i)
  assert.match(directive, /Do Today — AI Weight-Loss Companion for Australians/)
  assert.match(directive, /Do not use Markdown/i)
})
