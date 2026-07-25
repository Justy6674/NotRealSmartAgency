import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRenderedWebsiteScanResult,
  getSafeWebsiteUrl,
  selectSameOriginCrawlUrls,
} from './rendered-website-scan.ts'

test('only accepts public http URLs for a rendered website scan', () => {
  assert.equal(getSafeWebsiteUrl('https://www.scentsell.com.au/').ok, true)
  assert.equal(getSafeWebsiteUrl('http://localhost:3000/').ok, false)
  assert.equal(getSafeWebsiteUrl('http://127.0.0.1/').ok, false)
  assert.equal(getSafeWebsiteUrl('http://169.254.169.254/latest/meta-data/').ok, false)
  assert.equal(getSafeWebsiteUrl('ftp://example.com/').ok, false)
  assert.equal(getSafeWebsiteUrl('https://user:password@example.com/').ok, false)
})

test('keeps the crawl bounded to useful same-origin public pages', () => {
  const urls = selectSameOriginCrawlUrls('https://example.com/', [
    'https://example.com/about',
    'https://example.com/pricing?campaign=one',
    'https://example.com/about',
    'https://other.example.com/landing',
    'https://example.com/logout',
    'https://example.com/privacy',
  ])

  assert.deepEqual(urls, [
    'https://example.com/',
    'https://example.com/about',
    'https://example.com/pricing?campaign=one',
    'https://example.com/privacy',
  ])
})

test('makes rendered evidence explicit without inventing SEO or visitor claims', () => {
  const result = buildRenderedWebsiteScanResult({
    requestedUrl: 'https://www.scentsell.com.au/',
    finalUrl: 'https://www.scentsell.com.au/',
    title: 'ScentSell | Australia’s Fragrance Marketplace',
    description: 'Buy, sell and swap fragrance.',
    canonicalUrl: 'https://www.scentsell.com.au/',
    robots: 'index,follow',
    headings: [{ level: 'h1', text: 'The better way to buy, sell and swap fragrance.' }],
    bodyText: 'Buy, sell and swap authentic fragrance with collectors around Australia.',
    ctas: ['Explore the marketplace', 'List a fragrance'],
    forms: [{ label: 'Email signup', action: '/subscribe', method: 'post' }],
    links: ['https://www.scentsell.com.au/about'],
    structuredDataTypes: ['Organization', 'WebSite'],
    screenshotBase64: null,
    loadMs: 870,
  })

  assert.equal(result.schema_version, 'nrs.rendered_website_scan.v1')
  assert.equal(result.evidence_source, 'rendered_browser')
  assert.equal(result.pages[0]?.headings[0]?.text, 'The better way to buy, sell and swap fragrance.')
  assert.deepEqual(result.unknowns, [
    'Search-engine indexing, rankings, traffic, and visitor behaviour require separate first-party evidence.',
  ])
  assert.equal(result.summary.includes('SEO'), false)
})

test('marks incomplete rendering as limited evidence instead of a completed audit', () => {
  const result = buildRenderedWebsiteScanResult({
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    title: null,
    description: null,
    canonicalUrl: null,
    robots: null,
    headings: [],
    bodyText: '',
    ctas: [],
    forms: [],
    links: [],
    structuredDataTypes: [],
    screenshotBase64: null,
    loadMs: 10_000,
    warnings: ['Timed out waiting for client-rendered content.'],
  })

  assert.equal(result.status, 'partial')
  assert.match(result.warnings.join(' '), /timed out/i)
})
