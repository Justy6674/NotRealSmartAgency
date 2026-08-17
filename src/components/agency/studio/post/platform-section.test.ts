import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 2026-08-18: the dock app showed a charcoal desk with hardcoded amber
 * "Director" pills, the Director still named Black Health Intelligence
 * while the work column said Scent Sell, and Compose "Where to publish?"
 * was empty even though four accounts are connected.
 *
 * The Mixpost-style picker (tick all / none / avatars) is the owner-facing
 * control. Accents must come from --brand, never Tailwind amber.
 */

const picker = readFileSync(
  join(process.cwd(), 'src/components/agency/studio/post/PlatformSection.tsx'),
  'utf8',
)
const card = readFileSync(
  join(process.cwd(), 'src/components/agency/studio/post/StudioCard.tsx'),
  'utf8',
)
const creator = readFileSync(
  join(process.cwd(), 'src/components/agency/studio/post/PostCreator.tsx'),
  'utf8',
)
const layout = readFileSync(
  join(process.cwd(), 'src/app/agency/layout.tsx'),
  'utf8',
)
const rail = readFileSync(
  join(process.cwd(), 'src/components/agency/shell/DirectorRailConnected.tsx'),
  'utf8',
)

test('compose shows connected accounts with tick all / none, not faded platform pills', () => {
  assert.match(picker, /Tick all/)
  assert.match(picker, /None/)
  assert.match(picker, /of \{total\} ticked/)
  assert.match(picker, /useSocialAccounts/)
  assert.match(picker, /canonicalSocialPlatform/)
  assert.doesNotMatch(picker, /opacity-25/)
})

test('compose picker never names a publisher vendor', () => {
  assert.doesNotMatch(picker, /Mixpost|Zernio|OAuth/)
})

test('Director assist pills retint from the selected business, not amber', () => {
  assert.match(card, /var\(--brand-wash\)/)
  assert.match(card, /var\(--brand-deep\)/)
  assert.doesNotMatch(card, /amber-500|amber-400/)
})

test('the creator wires one-or-all account ticks into the save', () => {
  assert.match(creator, /selectedAccountIds/)
  assert.match(creator, /account_ids: selectedAccountIds/)
  assert.match(creator, /brandName=\{brandName\}/)
})

test('the shell paints the selected business colour even in an installed app', () => {
  assert.match(layout, /BrandThemeSync/)
  assert.match(layout, /bg-\[var\(--bg\)\]/)
})

test('the Director names the selected business, not the first row in the table', () => {
  assert.match(rail, /brands\.find\(\(row\) => row\.id === activeBrandId\)/)
})
