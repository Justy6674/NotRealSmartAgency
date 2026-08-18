import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { CONNECTABLE_PLATFORMS, presentationFor } from './PlatformMark'

/**
 * The accounts screen, held to the four things that were wrong with it.
 *
 * 1. HEALTH WAS A CONSTANT. Every account was stamped `active` and drawn with a
 *    green tick. Measured live on 2026-08-18: ten accounts, eight healthy, two
 *    in warning, and the desk said everything was fine.
 * 2. AN UNHEALTHY ACCOUNT SORTED WHEREVER IT HAPPENED TO LAND, so the one card
 *    that needed doing something about could be the fourteenth.
 * 3. THE EMPTY SCREEN READ AS A FAULT. Twelve of fourteen businesses land here
 *    with nothing connected; it is their first real look at the product.
 * 4. TWO LISTS OF PLATFORMS. The chooser's list and the grid's list were
 *    written separately, so dropping X from one would leave it offered by the
 *    other.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

/**
 * Comments in this folder deliberately quote the bug they exist to prevent —
 * `status: 'active'`, "not an error state" — so a check that reads the raw file
 * fails on the explanation rather than on the code. What the owner sees is the
 * code, so that is what these assertions read.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

const page = read('src/components/agency/studio/accounts/AccountsPage.tsx')
const card = read('src/components/agency/studio/accounts/AccountCard.tsx')
const empty = read('src/components/agency/studio/accounts/AccountsEmptyState.tsx')

test('X is not offered as something to connect', () => {
  const slugs = CONNECTABLE_PLATFORMS.map((p) => p.slug)
  assert.ok(!slugs.includes('twitter'), 'X is being offered on the connect chooser')
  assert.ok(!slugs.includes('x'), 'X is being offered on the connect chooser')
  assert.ok(slugs.includes('instagram') && slugs.includes('facebook'), 'the list is not the real one')
})

test('an account already connected to X still draws with its own name and mark', () => {
  // Not offering a platform is not the same as pretending its accounts are not
  // there. A grey unnamed disc on a working account is how an owner ends up
  // removing something that still posts.
  const x = presentationFor('twitter')
  assert.equal(x.label, 'X')
  assert.ok(x.colour.startsWith('oklch('), 'marks are oklch — DESIGN.md forbids hex in new UI code')
  assert.ok(x.monogram.length > 0)
})

test('the same platform spelt three ways lands on one mark', () => {
  // One publisher stores `facebook_page`, the other `FACEBOOK`; Google Business
  // arrives under any of three names. A miss here draws a real account as
  // unrecognised.
  assert.equal(presentationFor('facebook_page').label, presentationFor('FACEBOOK').label)
  assert.equal(presentationFor('google_business').label, presentationFor('googlebusiness').label)
})

test('every mark is either a glyph or a letter — never an empty disc', () => {
  for (const platform of CONNECTABLE_PLATFORMS) {
    const mark = presentationFor(platform.slug)
    assert.ok(mark.glyph || mark.monogram.trim().length > 0, `${platform.slug} draws nothing`)
    assert.ok(mark.colour.startsWith('oklch('), `${platform.slug} is not an oklch colour`)
  }
})

test('an unrecognised platform still gets a named, removable card', () => {
  const unknown = presentationFor('someplatform')
  assert.equal(unknown.label, 'Someplatform')
  assert.equal(unknown.monogram, 'S')
})

test('the grid puts what needs doing first', () => {
  const order = /HEALTH_ORDER[\s\S]*?\{([\s\S]*?)\}/.exec(page)?.[1] ?? ''
  const rank = (word: string) => Number(new RegExp(`${word}:\\s*(\\d)`).exec(order)?.[1] ?? NaN)
  assert.ok(rank('reconnect') < rank('attention'), 'a dead connection sorts below an expiring one')
  assert.ok(rank('attention') < rank('unknown'))
  assert.ok(rank('unknown') < rank('connected'), 'a working account outranks an unmeasured one')
  assert.match(page, /\.sort\(\(a, b\) => HEALTH_ORDER/, 'the order is declared but never applied')
})

test('nothing on this screen claims an account is fine without measuring it', () => {
  // The literal that caused the fault. `status: 'active'` written anywhere in
  // this folder is the bug returning.
  assert.doesNotMatch(code(card), /status:\s*'active'/)
  assert.doesNotMatch(code(page), /status:\s*'active'/)
  // And the four states must all still be distinguishable on the card.
  for (const health of ['reconnect', 'attention', 'connected', 'unknown']) {
    assert.ok(card.includes(health), `the card no longer distinguishes ${health}`)
  }
})

test('an account that will stop posting is visibly a different card, not a well one with a note', () => {
  // Fill, border and left accent all move with health. A dot on an otherwise
  // identical card is what nobody spotted for a month.
  assert.match(card, /background: tone\.wash/)
  assert.match(card, /borderColor: tone\.line/)
  assert.match(card, /borderLeftColor: wellEnough \? platform\.colour : tone\.edge/)
})

test('the empty state invites rather than reporting a fault', () => {
  assert.doesNotMatch(
    code(empty),
    /\berror\b|\bfailed\b|\bproblem\b|\bwarning\b|not connected yet/i,
  )
  assert.doesNotMatch(code(empty), /--stop|--warn|--care/, 'the empty state is painted as an alarm')
  assert.match(empty, /Connect an account/)
  // It has to say what happens next, not just offer a button.
  assert.match(empty, /schedule/i)
})

test('the screen never names the plumbing to the owner', () => {
  const strings = [
    ...code(page).matchAll(/'([^'\n]{12,})'/g),
    ...code(empty).matchAll(/'([^'\n]{12,})'/g),
  ]
    .map((m) => m[1])
    .filter((s) => !s.includes('/') && !s.includes('var(--'))
  for (const line of strings) {
    assert.doesNotMatch(line, /mixpost|zernio|oauth|token/i, `owner-facing string names plumbing: ${line}`)
  }
})
