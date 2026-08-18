import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
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
  // Per NETWORK, not per post. Sending every ticked id on every row told the
  // Instagram row to publish to the LinkedIn account too, because
  // publish-ticked.ts walks metadata.account_ids literally.
  //
  // The partition itself is `accountIdsForPlatform`, unit-tested in
  // social/safety-slice.test.ts. The composer must CALL it rather than keep a
  // second copy of the rule, and must never fall back to the whole ticked set.
  assert.match(creator, /accountIdsForPlatform\(/)
  assert.match(creator, /account_ids: rowAccountIds/)
  assert.match(creator, /rowAccounts = selectedAccounts\.filter/)
  assert.doesNotMatch(creator, /account_ids: selectedAccountIds/)
  assert.match(creator, /brandName=\{brandName\}/)
})

test('two accounts on one network can carry different words, all the way to the wire', () => {
  // The composer stores per-account words, and `captionForAccount` in
  // transport.ts reads exactly this key on the way out. Without the row below
  // a second Instagram account can only ever repeat the first one's post.
  assert.match(creator, /captionsByAccountId/)
  assert.match(creator, /captions_by_account_id: rowCaptions/)
  assert.match(creator, /captionsByAccountId=\{captionsByAccountId\}/)
})

test('the composer asks the publisher which route this business is on, never guesses', () => {
  // THE HONESTY GAP: the composer decided with brandIsPublisherLinked (true
  // whenever a profile exists) while the publisher decides with
  // publisherTransportOf, which honours the owner's explicit override. One
  // function now answers for both, server-side.
  // The import is gone; the only survivor is the incident note explaining why.
  assert.doesNotMatch(creator, /import .*brandIsPublisherLinked/)
  assert.doesNotMatch(creator, /brandIsPublisherLinked\(data\./)
  assert.match(creator, /\/api\/social\/validate/)
  const route = readFileSync(
    join(process.cwd(), 'src/app/api/social/validate/route.ts'),
    'utf8',
  )
  assert.match(route, /publisherTransportOf/)
  assert.match(route, /auth\.getUser\(\)/)
})

test('LinkedIn refuses a second account on the same post', () => {
  const strip = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/AccountSelectorStrip.tsx'),
    'utf8',
  )
  assert.match(strip, /ONE_ACCOUNT_ONLY = new Set\(\['linkedin'\]\)/)
  assert.match(strip, /export function blockedReason/)
  // Tick all must obey the same rule, or the block is reachable around.
  assert.match(picker, /blockedReason\(entry, chosen, entries\)/)
  // One set, not two. The picker's seeding used to keep its own copy, which is
  // how a network can end up blocked in the strip and seeded by the page load.
  assert.match(picker, /ONE_ACCOUNT_ONLY/)
  assert.doesNotMatch(picker, /new Set\(\['twitter', 'linkedin'\]\)/)
})

/**
 * 2026-08-19: "We dont use X". Removed from the composer surface only —
 * the publishers, the sign-in callbacks and the database enums keep it, so a
 * post already out on X still reads back in lists and analytics.
 *
 * These assertions are the coverage that used to describe X's controls. They
 * were kept and inverted rather than deleted, because the failure they guard
 * against is X quietly reappearing one file at a time.
 */
test('X is not offered anywhere on the composer surface', () => {
  const strip = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/AccountSelectorStrip.tsx'),
    'utf8',
  )
  const options = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/PlatformOptions.tsx'),
    'utf8',
  )
  const versions = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/PlatformVersionEditor.tsx'),
    'utf8',
  )
  const hashtags = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/HashtagSection.tsx'),
    'utf8',
  )

  for (const [name, source] of Object.entries({ picker, strip, options, versions, hashtags })) {
    assert.doesNotMatch(source, /twitter/i, `${name} must not name X`)
    // The lucide icon is the other way it comes back — an icon map entry is
    // enough to put a badge on an avatar even with no platform row.
    assert.doesNotMatch(source, /\bTwitter\b/, `${name} must not import the X icon`)
  }
})

test('the thread composer is gone — it existed only for X', () => {
  assert.equal(
    existsSync(join(process.cwd(), 'src/components/agency/studio/post/ThreadComposer.tsx')),
    false,
    'ThreadComposer.tsx must not come back',
  )
  const versions = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/PlatformVersionEditor.tsx'),
    'utf8',
  )
  // Its other half — the first comment for Meta, LinkedIn and YouTube — had to
  // survive the removal. Deleting the file without this is a silent regression
  // on four networks that are still very much in use.
  assert.match(versions, /<FirstComment/)
  const options = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/PlatformOptions.tsx'),
    'utf8',
  )
  assert.match(options, /export function FirstComment/)
  assert.match(options, /FIRST_COMMENT_PLATFORMS/)
})

test('which networks the composer offers is one edit, not six lists', () => {
  const capabilities = readFileSync(
    join(process.cwd(), 'src/lib/social/capabilities.ts'),
    'utf8',
  )
  assert.match(capabilities, /RETIRED_COMPOSER_PLATFORMS = \['twitter'\] as const/)
  assert.match(capabilities, /export const COMPOSER_PLATFORMS/)
  assert.match(capabilities, /export function isComposerPlatform/)
  // Every surface asks that question rather than answering it locally.
  assert.match(picker, /isComposerPlatform/)
  const strip = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/AccountSelectorStrip.tsx'),
    'utf8',
  )
  assert.match(strip, /isComposerPlatform/)
})

test('this was a surface removal, not a data migration', () => {
  // Anything already published to X must still render. The delivery side keeps
  // the network, so the capability lookup an existing X target does cannot
  // return undefined and throw on the way to a list or a chart.
  const capabilities = readFileSync(
    join(process.cwd(), 'src/lib/social/capabilities.ts'),
    'utf8',
  )
  assert.match(capabilities, /\btwitter: \{/)
  const model = readFileSync(join(process.cwd(), 'src/lib/social/model.ts'), 'utf8')
  assert.match(model, /'twitter'/)
  assert.equal(
    existsSync(join(process.cwd(), 'src/lib/publishers/twitter.ts')),
    true,
    'the publisher stays — retiring the composer control does not unpublish anything',
  )
})

test('character counts are right-aligned mono tabular numerals, not a ring', () => {
  const count = readFileSync(
    join(process.cwd(), 'src/components/agency/studio/post/PlatformCharacterRing.tsx'),
    'utf8',
  )
  assert.match(count, /font-mono/)
  assert.match(count, /tabular-nums/)
  assert.match(count, /text-right/)
  assert.doesNotMatch(count, /<svg|<circle|strokeDasharray/)
})

test('the shell paints the selected business colour even in an installed app', () => {
  assert.match(layout, /BrandThemeSync/)
  assert.match(layout, /bg-\[var\(--bg\)\]/)
})

test('the Director names the selected business, not the first row in the table', () => {
  assert.match(rail, /brands\.find\(\(row\) => row\.id === activeBrandId\)/)
})
