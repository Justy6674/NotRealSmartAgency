import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The results desk is not allowed to say four different things with one
 * sentence. These read the source because the fault they guard against is
 * structural — a missing branch, not a wrong value.
 *
 * What went wrong: the desk had one empty state, "nothing is connected", and
 * printed it for a failed read, for an unmeasured business, and for a business
 * that genuinely has nothing. Downscale — accounts connected, posts published —
 * read that it had no accounts. Telling a regulated health brand that is how an
 * owner stops believing every other number on the screen.
 */

const DIR = join(process.cwd(), 'src/components/agency/studio/analytics')
const read = (file: string) => readFileSync(join(DIR, file), 'utf8')

const ROW = read('AnalyticsAccountRow.tsx')
const SHELL = read('reports/PlatformReportShell.tsx')
const OVERVIEW = read('AnalyticsOverview.tsx')
const DESK = read('analytics-desk.ts')

test('an unreadable account row says so instead of "nothing is connected"', () => {
  const failure = ROW.indexOf('accounts.length === 0 && problem')
  const nothing = ROW.indexOf('No connected accounts yet')
  assert.notEqual(failure, -1, 'the row needs a branch for "we could not look"')
  assert.ok(
    failure < nothing,
    'a failed read must be answered before the empty state, or it is drawn as one',
  )
})

test('the "connect an account" button is not offered on a failed read', () => {
  const failureBlock = ROW.slice(
    ROW.indexOf('accounts.length === 0 && problem'),
    ROW.indexOf('No connected accounts yet'),
  )
  assert.equal(
    failureBlock.includes('Connect an account'),
    false,
    'that button promises a fix for a problem we have not established the owner has',
  )
})

test('a report says "not collected" before it says "not connected"', () => {
  const uncollected = SHELL.indexOf('report?.notCollected')
  const unconnected = SHELL.indexOf('No connected {label} account yet')
  assert.notEqual(uncollected, -1, 'the shell needs a branch for "nobody is measuring this"')
  assert.ok(
    uncollected < unconnected,
    'an unmeasured business must never be told its accounts are not connected',
  )
})

test('the unmeasured report offers no connect button', () => {
  const block = SHELL.slice(
    SHELL.indexOf('report?.notCollected'),
    SHELL.indexOf('No connected {label} account yet'),
  )
  assert.equal(block.includes('Connect an account'), false)
})

test('the summary counts "nobody is measuring" apart from "could not read"', () => {
  assert.match(OVERVIEW, /report\?\.notCollected/)
  assert.match(OVERVIEW, /summary\.uncollected/)
  const uncollected = OVERVIEW.indexOf('summary.uncollected > 0')
  const noAccounts = OVERVIEW.indexOf('No accounts connected yet')
  assert.ok(uncollected < noAccounts)
})

test('the accounts hook asks the second question when a business is not linked', () => {
  assert.match(
    DESK,
    /\/api\/studio\/analytics\/accounts\?brandId=/,
    'an unlinked business still has accounts, and the row must be able to find them',
  )
  assert.match(DESK, /resultsCollected/)
})

test('the report is read for the account the row selected', () => {
  const call = SHELL.slice(SHELL.indexOf('useAnalyticsReport({'), SHELL.indexOf('const [openPostId'))
  assert.match(
    call,
    /accountId,/,
    'without this the picker changes one card out of eight — a control that appears to work',
  )
})

test('no owner-facing panel on this desk names a vendor', () => {
  // Comments carry the incident; the strings the owner reads must not.
  const banned = /(Zernio|Mixpost|OAuth)/
  for (const [name, source] of [
    ['AnalyticsAccountRow.tsx', ROW],
    ['PlatformReportShell.tsx', SHELL],
    ['AnalyticsOverview.tsx', OVERVIEW],
  ] as const) {
    const strings = source.match(/(?:>[^<>{}]{12,}<|'[^']{12,}'|"[^"]{12,}")/g) ?? []
    for (const literal of strings) {
      assert.equal(banned.test(literal), false, `${name} shows a vendor name: ${literal}`)
    }
  }
})
