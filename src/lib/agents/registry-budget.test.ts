import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spentThisMonth } from './registry'

/**
 * The bug these cover cost a full day of the owner's time.
 *
 * `spent_monthly_cents` was only ever zeroed by a heartbeat that had to fire
 * between 00:00 and 00:59 on the 1st of the month. It did not, so the figure
 * accumulated from April to $100.03 against a $100 cap. Every Director message
 * was then rejected with "Budget exceeded", rendered in the app as "try again"
 * — advice that could not work — while actual spend for the month was $6.36.
 */

const AUG = new Date('2026-08-09T04:00:00.000Z')

test('spend recorded this month counts', () => {
  assert.equal(spentThisMonth(636, '2026-08-08T20:43:00.000Z', AUG), 636)
})

test('spend recorded in an earlier month does not', () => {
  // The exact shape of the failure: months of accumulation presented as one
  // month's spending.
  assert.equal(spentThisMonth(10003, '2026-07-31T23:59:59.000Z', AUG), 0)
  assert.equal(spentThisMonth(10003, '2026-04-02T10:00:00.000Z', AUG), 0)
})

test('the same month last year is not this month', () => {
  // A naive month-number comparison passes everything here and silently keeps
  // a year-old total alive.
  assert.equal(spentThisMonth(10003, '2025-08-09T04:00:00.000Z', AUG), 0)
})

test('an unreadable or missing timestamp keeps the counter', () => {
  // Fail towards the cap, not through it. A row we cannot date must not have
  // its spending forgotten — that would turn a bad timestamp into free spend.
  assert.equal(spentThisMonth(500, null, AUG), 500)
  assert.equal(spentThisMonth(500, 'not a date', AUG), 500)
})

test('the boundary is UTC, not local', () => {
  // 1 August 00:30 UTC is still July in Brisbane (UTC+10) — comparing in local
  // time would resurrect July's total for the first ten hours of every month.
  assert.equal(spentThisMonth(10003, '2026-07-31T20:00:00.000Z', new Date('2026-08-01T00:30:00.000Z')), 0)
})
