import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWeeklyReport } from './report.ts'
import { gradeLcp, gradeInp, gradeCls, overallVerdict } from './pagespeed.ts'

const site = (over: Partial<Parameters<typeof buildWeeklyReport>[0][number]> = {}) => ({
  brand: 'Downscale',
  url: 'https://downscale.com.au',
  strategy: 'mobile' as const,
  field: { lcp: 1900, inp: 120, cls: 0.03 },
  lab: { performance: 92, seo: 100, accessibility: 95 },
  opportunities: [],
  verdict: 'good' as const,
  ...over,
})

test('Google thresholds are applied at the documented boundaries', () => {
  assert.equal(gradeLcp(2500), 'good')
  assert.equal(gradeLcp(2501), 'needs-work')
  assert.equal(gradeLcp(4001), 'poor')
  assert.equal(gradeInp(200), 'good')
  assert.equal(gradeInp(501), 'poor')
  assert.equal(gradeCls(0.1), 'good')
  assert.equal(gradeCls(0.26), 'poor')
})

test('one failing vital fails the site — Core Web Vitals is not an average', () => {
  assert.equal(overallVerdict({ lcp: 1200, inp: 100, cls: 0.4 }), 'poor')
  assert.equal(overallVerdict({ lcp: 1200, inp: 100, cls: 0.05 }), 'good')
})

test('a quiet but healthy site is reported as ungraded, not as failing', () => {
  const report = buildWeeklyReport([site({ field: null, verdict: 'no-data' })])
  assert.match(report, /too few visitors/)
  assert.doesNotMatch(report, /need attention/)
})

test('a quiet site with a bad test score is still raised', () => {
  // The first real run said "nothing needs doing this week" while ScentSell
  // scored 37/100, because no field data meant no verdict. Traffic arrives
  // long before a fix does, so a weak lab score has to speak for itself.
  const report = buildWeeklyReport([
    site({ brand: 'ScentSell', field: null, verdict: 'no-data', lab: { performance: 37, seo: 90, accessibility: 90 } }),
  ])
  assert.match(report, /1 of 1 sites need attention/)
  assert.match(report, /37\/100/)
  assert.doesNotMatch(report, /Nothing needs doing/)
})

test('a quiet site scoring well is not raised', () => {
  const report = buildWeeklyReport([
    site({ brand: 'Do Today', field: null, verdict: 'no-data', lab: { performance: 96, seo: 100, accessibility: 95 } }),
  ])
  assert.doesNotMatch(report, /need attention/)
})

test('the worst site is listed first', () => {
  const report = buildWeeklyReport([
    site({ brand: 'Fine' }),
    site({ brand: 'Broken', field: { lcp: 6100, inp: 700, cls: 0.4 }, verdict: 'poor' }),
    site({ brand: 'Middling', field: { lcp: 3200, inp: 150, cls: 0.05 }, verdict: 'needs-work' }),
  ])
  assert.ok(report.indexOf('Broken') < report.indexOf('Middling'))
  assert.ok(report.indexOf('Middling') < report.indexOf('Fine'))
  assert.match(report, /2 of 3 sites need attention/)
})

test('desktop numbers never dilute the mobile verdict Google ranks on', () => {
  const report = buildWeeklyReport([
    site({ brand: 'Slow', field: { lcp: 6000, inp: 100, cls: 0.02 }, verdict: 'poor' }),
    site({ brand: 'Slow', strategy: 'desktop', verdict: 'good' }),
  ])
  assert.match(report, /1 of 1 sites need attention/)
})

test('a clean week says so plainly rather than listing nothing', () => {
  assert.match(buildWeeklyReport([site()]), /all 1 graded sites are passing/)
  assert.match(buildWeeklyReport([site()]), /Nothing needs doing this week/)
})
