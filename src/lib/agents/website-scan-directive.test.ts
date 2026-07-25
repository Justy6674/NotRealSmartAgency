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
    evidence_source: 'rendered_browser',
    status: 'completed',
    ctas: ['Start today'],
    forms: [],
    pages: [{ finalUrl: 'https://www.dotoday.com.au/' }],
    unknowns: ['Search-engine indexing requires separate evidence.'],
  })

  assert.match(directive, /overrides any conflicting stored brand context/i)
  assert.match(directive, /Do Today — AI Weight-Loss Companion for Australians/)
  assert.match(directive, /Do not use Markdown/i)
})

test('a partial rendered audit cannot be used to claim an SEO or indexing problem', () => {
  const directive = buildWebsiteScanGroundingDirective({
    url: 'https://www.scentsell.com.au',
    title: 'ScentSell | Australia’s Fragrance Marketplace',
    description: 'Australia',
    headings: [],
    bodyText: '',
    evidence_source: 'rendered_browser',
    status: 'partial',
    warnings: ['Timed out waiting for client-rendered content.'],
    ctas: [],
    forms: [],
    pages: [{ finalUrl: 'https://www.scentsell.com.au/' }],
    unknowns: ['Search-engine indexing requires separate evidence.'],
  })

  assert.match(directive, /limited rendered evidence/i)
  assert.match(directive, /Do not turn unavailable evidence into an SEO, indexing, JavaScript, traffic, conversion, or visitor-behaviour claim/i)
  assert.match(directive, /Timed out waiting for client-rendered content/i)
})
