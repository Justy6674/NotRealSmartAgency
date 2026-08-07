import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWeeklyTrafficHtml,
  buildWeeklyTrafficText,
  describeChange,
  orderForReading,
  percentChange,
  type BrandTraffic,
} from './weekly-report'

/** Real numbers from the week this was built. */
const WEEK: BrandTraffic[] = [
  { brand: 'Sniffopotamus', website: 'https://sniffopotamus.com', visitors: 0, pageviews: 0, previousVisitors: 0 },
  {
    brand: 'Scent Sell',
    website: 'https://scentsell.com.au',
    visitors: 591,
    pageviews: 2429,
    previousVisitors: 402,
    topReferrers: [{ label: 'facebook.com', visitors: 210 }],
    topPages: [{ label: '/listings/[id]', visitors: 180 }],
  },
  { brand: 'Downscale Weight Loss', website: 'https://downscale.com.au', visitors: 1661, pageviews: 5297, previousVisitors: 1700 },
  { brand: 'Do Today', website: 'https://www.dotoday.com.au', visitors: null, pageviews: null, previousVisitors: null, note: 'analytics not switched on' },
  { brand: 'TeleScribe', website: 'https://telescribe.com.au', visitors: 122, pageviews: 442, previousVisitors: 60 },
]

test('the busiest site is read first and the unmeasurable ones last', () => {
  const order = orderForReading(WEEK).map((row) => row.brand)
  assert.deepEqual(order, [
    'Downscale Weight Loss',
    'Scent Sell',
    'TeleScribe',
    'Sniffopotamus',
    'Do Today',
  ])
})

test('the change is stated in words, not left as a raw number', () => {
  assert.equal(describeChange(591, 402), 'up 47% on last week')
  assert.equal(describeChange(122, 60), 'up 103% on last week')
  assert.equal(describeChange(400, 800), 'down 50% on last week')
  // 1661 against 1700 is a 2% wobble — reported as steady, not as a fall.
  assert.equal(describeChange(1661, 1700), 'about the same as last week')
})

test('a small wobble is not reported as a change', () => {
  // 3% either way is noise. Calling it "down" makes someone chase nothing.
  assert.equal(describeChange(103, 100), 'about the same as last week')
  assert.equal(describeChange(97, 100), 'about the same as last week')
})

test('a first week with nothing to compare says nothing rather than "up 100%"', () => {
  assert.equal(describeChange(50, null), '')
  assert.equal(describeChange(null, 100), '')
  assert.equal(percentChange(50, 0), null)
  assert.equal(describeChange(50, 0), 'first traffic recorded')
})

test('the text version leads with the total and reads as sentences', () => {
  const text = buildWeeklyTrafficText(WEEK, '7 August 2026')
  assert.match(text, /2,374 visitors across 4 sites/)
  assert.match(text, /Downscale Weight Loss — 1,661 visitors, 5,297 page views/)
  assert.match(text, /Scent Sell — 591 visitors, 2,429 page views, up 47% on last week/)
  assert.match(text, /most came from facebook\.com/)
  assert.match(text, /Do Today — no numbers \(analytics not switched on\)/)
})

test('a site with no numbers is named, not silently dropped', () => {
  const text = buildWeeklyTrafficText(WEEK, '7 August 2026')
  assert.match(text, /Do Today/)
  // Silently omitting it would read as "that brand does not exist".
  assert.equal(text.split('\n').filter((line) => line.startsWith('Do Today')).length, 1)
})

test('the email carries the same numbers as the text', () => {
  const html = buildWeeklyTrafficHtml(WEEK, '7 August 2026')
  assert.match(html, /1,661/)
  assert.match(html, /591/)
  assert.match(html, /up 47% on last week/)
  assert.match(html, /analytics not switched on/)
})

test('a rise is green and a fall is red, so it reads at a glance', () => {
  const html = buildWeeklyTrafficHtml(WEEK, '7 August 2026')
  assert.match(html, /#0a7d33/)
})

test('a brand name cannot inject markup into the email', () => {
  const html = buildWeeklyTrafficHtml(
    [{ brand: '<script>alert(1)</script>', website: null, visitors: 5, pageviews: 5, previousVisitors: null }],
    '7 August 2026',
  )
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})

test('a week where nothing could be read says so instead of showing zero', () => {
  const text = buildWeeklyTrafficText(
    [{ brand: 'Scent Sell', website: null, visitors: null, pageviews: null, previousVisitors: null }],
    '7 August 2026',
  )
  assert.match(text, /No visitor numbers could be read/)
  assert.doesNotMatch(text, /0 visitors across/)
})

test('the speed section only appears when there is speed data', () => {
  assert.doesNotMatch(buildWeeklyTrafficHtml(WEEK, '7 August 2026'), /Site speed/)
  assert.match(buildWeeklyTrafficHtml(WEEK, '7 August 2026', '🟢 Scent Sell'), /Site speed/)
})

/**
 * The first live preview printed "most-read: (direct / none)" — a REFERRER
 * placeholder leaking into the page slot. A placeholder in a report reads as
 * broken data, so nothing at all is better.
 */
test('a placeholder label is left out rather than printed', () => {
  const rows: BrandTraffic[] = [{
    brand: 'Scent Sell',
    website: null,
    visitors: 10,
    pageviews: 20,
    previousVisitors: 10,
    topReferrers: [{ label: '(direct / none)', visitors: 10 }],
    topPages: [{ label: '(unknown page)', visitors: 10 }],
  }]

  const text = buildWeeklyTrafficText(rows, '7 August 2026')
  assert.doesNotMatch(text, /most came from/)
  assert.doesNotMatch(text, /most-read/)
  assert.doesNotMatch(text, /\(direct/)
  assert.doesNotMatch(text, /\(unknown/)

  const html = buildWeeklyTrafficHtml(rows, '7 August 2026')
  assert.doesNotMatch(html, /most-read/)
})

test('a real page and a real referrer are still shown', () => {
  const rows: BrandTraffic[] = [{
    brand: 'Scent Sell',
    website: null,
    visitors: 10,
    pageviews: 20,
    previousVisitors: 10,
    topReferrers: [{ label: 'facebook.com', visitors: 8 }],
    topPages: [{ label: '/listings/[id]', visitors: 6 }],
  }]
  const text = buildWeeklyTrafficText(rows, '7 August 2026')
  assert.match(text, /most came from facebook\.com/)
  assert.match(text, /most-read page: \/listings\/\[id\]/)
})
