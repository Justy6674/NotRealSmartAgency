import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

/**
 * The screen's own guardrails.
 *
 * These read the source and fail the build on a regression that a unit test
 * cannot see, in the style of `regulatory-invariants.test.ts`. Each one records
 * a way this screen has already failed, or a promise made to the two people who
 * use it. A failure here means a rule was broken, not that an assertion needs
 * loosening.
 */

const root = process.cwd()
const here = 'src/components/agency/studio/posting-schedule'
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/**
 * The source with its comments removed.
 *
 * Comments here deliberately quote the wording being banned — "No times" is
 * named in the note explaining why it is gone. Checking the raw file would make
 * every one of these rules fail on its own explanation, so the checks that are
 * about what reaches the glass, or about what the code does, run over this.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

test('the screen opens on options, not on an empty grid', () => {
  const page = read(`${here}/PostingSchedulePage.tsx`)
  // The rhythm cards must be rendered ABOVE the grid. This is the whole fix:
  // landing on seven empty columns was the failure, and a reorder that put the
  // grid first would quietly restore it.
  const rhythmAt = page.indexOf('<RhythmPicker')
  const gridAt = page.indexOf('<WeeklySlotGrid')
  assert.ok(rhythmAt > 0, 'the rhythm cards must be on the screen')
  assert.ok(gridAt > 0, 'the grid must still be on the screen')
  assert.ok(rhythmAt < gridAt, 'options come before the grid')
})

test('the empty state sells the first click rather than apologising', () => {
  const page = read(`${here}/PostingSchedulePage.tsx`)
  assert.match(page, /Your week is wide open\. Set it in one click\./)
  // "No times" in seven boxes is what the screen used to say to Scent Sell.
  assert.doesNotMatch(code(`${here}/WeeklySlotGrid.tsx`), /No times/)
})

test('nothing on this screen writes a posting time the owner did not ask for', () => {
  // He was explicit: he and Bec create the times. A seed on mount, a default
  // week applied on first load, or any write not behind a press would be the
  // screen doing it behind their back.
  for (const file of ['PostingSchedulePage.tsx', 'RhythmPicker.tsx', 'rhythms.ts']) {
    assert.doesNotMatch(code(`${here}/${file}`), /seed/i, file)
  }

  const page = read(`${here}/PostingSchedulePage.tsx`)
  // Every write goes through one of these two, and both are only reachable from
  // an onClick. The load effect must never reach them.
  const loadEffect = page.slice(page.indexOf('const load = React.useCallback'), page.indexOf('const saveWeek'))
  assert.doesNotMatch(loadEffect, /saveWeek|applyWeek|method: 'PUT'/)
})

test('there is no separate Save button to forget', () => {
  const page = read(`${here}/PostingSchedulePage.tsx`)
  assert.doesNotMatch(page, />\s*Save (my )?(week|times|changes)\s*</)
  // The confirmation is quiet and announced to a screen reader, not a dialog.
  assert.match(page, /aria-live="polite"/)
})

test('the timezone is stated on the screen and read from the stored value', () => {
  const page = read(`${here}/PostingSchedulePage.tsx`)
  assert.match(page, /timezoneLabel\(view\.timezone\)/)

  // Brisbane is correct for this owner and does not observe daylight saving:
  // 9:00am is 9:00am all year. Nothing here may "upgrade" the default to a DST
  // zone, and no DST arithmetic belongs on his own brands.
  assert.doesNotMatch(read(`${here}/rhythms.ts`), /Australia\/Sydney/)
  for (const file of ['PostingSchedulePage.tsx', 'rhythms.ts', 'WeeklySlotGrid.tsx']) {
    assert.doesNotMatch(code(`${here}/${file}`), /\bdaylight\b|\bDST\b/i, file)
  }
})

test('a posting time is one time covering every connected account', () => {
  // The table's unique key includes the platform, so the honest way to offer
  // "one time serves all" is to fan out to a row per connected network in the
  // route — never to write one Facebook row and imply the rest.
  const route = read('src/app/api/posting-schedule/route.ts')
  assert.match(route, /accountsFor\(/)
  assert.match(route, /platforms\.map\(\(platform\) => \(\{/)

  // And the screen has to say so rather than leaving it ambiguous.
  const page = read(`${here}/PostingSchedulePage.tsx`)
  assert.match(page, /every one of them posts to/)

  // The old per-network picker asked the owner a question they do not have —
  // and offered networks the business may never have connected.
  const editor = read(`${here}/SlotEditor.tsx`)
  assert.doesNotMatch(editor, /PLATFORM_OPTIONS/)
})

test('clearing the week names exactly what goes', () => {
  const clear = read(`${here}/ClearWeek.tsx`)
  // A confirmation the owner cannot check is a speed bump, not a confirmation.
  assert.match(clear, /Remove all \{slots\.length\}/)
  assert.match(clear, /byDay\.map/)
  // And it must say what SURVIVES, so nobody learns afterwards that posts
  // already waiting were untouched.
  assert.match(clear, /keep the times they/)
})

test('owner-facing copy carries no plumbing words', () => {
  const banned = /\b(Zernio|Mixpost|OAuth|cron|queue_slot|API key)\b/
  for (const file of [
    'PostingSchedulePage.tsx',
    'RhythmPicker.tsx',
    'WeeklySlotGrid.tsx',
    'SlotEditor.tsx',
    'ClearWeek.tsx',
  ]) {
    const source = read(`${here}/${file}`)
    // Comments explain the machinery and may name it; what reaches the glass
    // may not. Strip block comments before checking.
    const visible = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.doesNotMatch(visible, banned, file)
  }
})

test('the recommendation is refused rather than guessed', () => {
  const rhythms = read(`${here}/rhythms.ts`)
  // The gate is a pure function with tests beside it, and it returns null.
  assert.match(rhythms, /export function audienceRhythm/)
  assert.match(rhythms, /return null/)

  const picker = code(`${here}/RhythmPicker.tsx`)
  // No "not enough data yet" placeholder: an empty promise on the screen is
  // worse than one fewer card.
  assert.doesNotMatch(picker, /not enough (data|history)/i)
  // The card has to say what it was worked out from, so it can be judged.
  assert.match(picker, /Worked out from \$\{audience\.postsCounted\} posts/)
})
