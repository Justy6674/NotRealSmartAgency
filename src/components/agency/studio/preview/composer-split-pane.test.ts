import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The composer's split pane, and the X retirement, are both decisions somebody
 * will one day read as a mistake.
 *
 * The split pane breaks the single-column rule DESIGN.md states for every other
 * department screen. It is deliberate — the owner chose Mixpost's shape on
 * 19 August 2026 after weeks of asking — and the previous version of this file
 * enforced the opposite, so "fixing" it back is exactly the change a careful
 * reader would make. This test is the note that stops them.
 *
 * The X rule is the reverse risk: a preview switch is the kind of place a
 * network quietly reappears, one `case` at a time.
 *
 * Source-contract, in the shape of `src/lib/post-versions.contract.test.ts`:
 * these are .tsx components with browser state, so they are read, not executed.
 */

const ROOT = process.cwd()
const LAYOUT = 'src/components/agency/studio/post/ComposerLayout.tsx'
const CREATOR = 'src/components/agency/studio/post/PostCreator.tsx'
const PREVIEW_INDEX = 'src/components/agency/studio/preview/index.tsx'
const PREVIEW_PANE = 'src/components/agency/studio/preview/ComposerPreviewPane.tsx'
const ACTIVITY_PANE = 'src/components/agency/studio/post/activity/ComposerActivityPane.tsx'
const DESIGN = 'DESIGN.md'

function read(relative: string): string {
  const path = join(ROOT, relative)
  assert.ok(existsSync(path), `${relative} has moved or been renamed — this contract is now guarding nothing`)
  return readFileSync(path, 'utf8')
}

/** Comments carry the reasoning, so only code counts — in both directions. */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
}

test('the right pane is 750px and carries both tabs', () => {
  const layout = code(LAYOUT)

  assert.match(
    layout,
    /SIDE_PANE_WIDTH\s*=\s*750/,
    `${LAYOUT}: the pane is no longer Mixpost's 750px. The owner asked for Mixpost's shape specifically — change this only because he asked again.`,
  )
  assert.match(layout, /'preview'/, `${LAYOUT}: the Preview tab is gone`)
  assert.match(layout, /'activity'/, `${LAYOUT}: the Activity tab is gone`)
  assert.match(
    layout,
    /label:\s*'Preview'[\s\S]{0,200}label:\s*'Activity'/,
    `${LAYOUT}: Preview must come before Activity — what it will look like is what the owner opens this for.`,
  )
})

test('the composer hands both panes to the layout', () => {
  const creator = code(CREATOR)

  assert.match(
    creator,
    /<ComposerLayout[\s\S]{0,400}preview=\{/,
    `${CREATOR}: the composer renders no preview pane, so the split pane is an empty column.`,
  )
  assert.match(
    creator,
    /<ComposerLayout[\s\S]{0,400}activity=\{/,
    `${CREATOR}: the composer renders no activity pane.`,
  )
  assert.match(
    creator,
    /captionFor=\{captionForAccountId\}/,
    `${CREATOR}: the preview must be given the same per-account resolver the save handler uses, or the phone can show one caption while another publishes.`,
  )
})

test('the pane survives a phone', () => {
  const layout = code(LAYOUT)

  assert.match(
    layout,
    /matchMedia/,
    `${LAYOUT}: nothing measures the viewport, so a phone gets a 750px pane beside the form.`,
  )
  assert.match(
    layout,
    /localStorage/,
    `${LAYOUT}: the open/closed choice is no longer remembered — the owner reopens the pane every visit.`,
  )
  assert.match(
    layout,
    /aria-modal="true"/,
    `${LAYOUT}: the narrow-width sheet is not a dialog, so a screen reader stays behind it.`,
  )
})

test('the action bar still belongs to the department', () => {
  assert.match(
    code(LAYOUT),
    /<SocialActionBar>\{actionBar\}<\/SocialActionBar>/,
    `${LAYOUT}: the decision is no longer portalled into the department's pinned slot. It was the composer's private property once, and every other Social screen had to invent its own.`,
  )
})

test('X is not previewed anywhere', () => {
  for (const file of [PREVIEW_INDEX, PREVIEW_PANE]) {
    assert.match(
      code(file),
      /RETIRED_COMPOSER_PLATFORMS/,
      `${file} decides for itself which networks are retired. That list is one line in @/lib/social/capabilities — keep it there.`,
    )
  }

  assert.doesNotMatch(
    code(PREVIEW_INDEX),
    /XMockup/,
    `${PREVIEW_INDEX}: an X phone frame is back. The owner does not post to X.`,
  )
  assert.ok(
    !existsSync(join(ROOT, 'src/components/agency/studio/preview/XMockup.tsx')),
    'XMockup.tsx is back on disk',
  )
})

test('the exception is written down where the rule is', () => {
  const design = read(DESIGN)
  assert.match(
    design,
    /composer is the one documented exception/i,
    `${DESIGN}: the single-column rule no longer records that the composer is exempt, so the next reader will "fix" the split pane back.`,
  )
  assert.match(
    design,
    /ComposerLayout\.tsx/,
    `${DESIGN}: the exception no longer points at the file that implements it.`,
  )
})

test('the contract is not vacuously passing', () => {
  const layout = code(LAYOUT)
  assert.ok(layout.length > 2_000, `${LAYOUT} is suspiciously small — is this still the split pane?`)
  assert.ok(
    read(LAYOUT).length > layout.length,
    `${LAYOUT}: comment stripping removed nothing — is it still working?`,
  )
  assert.ok(layout.includes('export function ComposerLayout'), 'comment stripping ate the code')
  assert.ok(
    code(ACTIVITY_PANE).includes('usePostActivity'),
    `${ACTIVITY_PANE}: the activity tab no longer reads the post's own event log.`,
  )
})
