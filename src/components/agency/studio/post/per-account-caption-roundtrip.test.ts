import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { transformSync } from 'esbuild'

/**
 * The per-account caption round trip, run rather than described.
 *
 * THE FAULT. `metadata.captions_by_account_id` holds the words ONE account
 * receives, so two Instagram accounts on one post can be sent different copy.
 * The write leg was sound — the save handler wrote it, the PATCH route
 * deep-merges it, the publisher reads it back per account on the way to the
 * wire. The read leg did not exist. Reopening a saved draft snapped every
 * account back to the master caption, and because autosave PATCHes on a 300ms
 * debounce into a route that MERGES, the override survived in the database and
 * kept going out. The account was still being sent words the owner could no
 * longer see or edit. That is worse than losing them.
 *
 * THE TRAP IN THE FIX. What is stored is the wire body — caption plus the tag
 * block, because that is what the account receives — while the box on the
 * screen holds the caption alone. Hydrate the stored value straight into the
 * box and the tags show twice, and the next keystroke saves them twice, so the
 * block grows every single time the post is opened. `composePublishBody` needs
 * an exact inverse or the round trip cannot be honest.
 *
 * WHY IT IS RUN THIS WAY. Both halves live inside a 1,800-line client component
 * that imports React, lucide and four stores, so `import`ing it here is not
 * possible (tried: it dies on the first .tsx dependency). The two functions are
 * lifted out of the real source and executed, so this test fails if either one
 * changes behaviour — which a source-contract assertion cannot tell you. The
 * wiring around them is held by composer-post-lifecycle.test.ts.
 */

const CREATOR = 'src/components/agency/studio/post/PostCreator.tsx'

/** From `function NAME`, to the brace that closes it. */
function lift(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`)
  assert.ok(start !== -1, `${CREATOR}: ${name} is gone or renamed`)
  const open = source.indexOf('{', start)
  assert.ok(open !== -1, `${CREATOR}: ${name} has no body`)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  assert.fail(`${CREATOR}: ${name} is not brace-balanced`)
}

const creator = readFileSync(join(process.cwd(), CREATOR), 'utf8')

const { composePublishBody, decomposePublishBody } = (() => {
  const module_ = { exports: {} as Record<string, unknown> }
  const lifted = [
    lift(creator, 'composePublishBody'),
    lift(creator, 'decomposePublishBody'),
    'module.exports = { composePublishBody, decomposePublishBody }',
  ].join('\n\n')
  const js = transformSync(lifted, { loader: 'ts', format: 'cjs' }).code
  new Function('module', 'exports', js)(module_, module_.exports)
  return module_.exports as {
    composePublishBody: (caption: string, hashtags: string[]) => string
    decomposePublishBody: (body: string, hashtags: string[]) => string
  }
})()

/**
 * One trip through the three things that actually happen to an override:
 * a press of Save, reopening the post later, and the autosave that fires
 * 300ms after the owner touches anything at all on the reopened post.
 *
 * `boxAfterReload` is what the owner can see and edit. `wire` is what the
 * account is sent. The whole fault was those two disagreeing.
 */
function lifecycle(override: string, hashtags: string[]) {
  const savedBody = composePublishBody(override, hashtags)
  const boxAfterReload = decomposePublishBody(savedBody, hashtags)
  const autosavedBody = composePublishBody(boxAfterReload, hashtags)
  const boxAfterSecondReload = decomposePublishBody(autosavedBody, hashtags)
  return { savedBody, boxAfterReload, autosavedBody, boxAfterSecondReload }
}

test('an account override survives save → reload → autosave', () => {
  const override = 'Two consult spots left in Brisbane this week.'
  const tags = ['weightloss', 'brisbane']

  const trip = lifecycle(override, tags)

  assert.equal(
    trip.boxAfterReload,
    override,
    'reopening the post must put the account\'s own words back in its box. Showing the master here is what left the override live and uneditable.',
  )
  assert.equal(
    trip.autosavedBody,
    trip.savedBody,
    'the autosave that follows a reload must write back exactly what was saved. Anything else means merely opening a post changes what the account receives.',
  )
  assert.equal(trip.boxAfterSecondReload, override, 'the trip must be stable, not merely survivable once')
})

test('the tag block is appended once, not once per open', () => {
  const trip = lifecycle('Two consult spots left in Brisbane this week.', ['weightloss', 'brisbane'])

  assert.equal(
    trip.savedBody,
    'Two consult spots left in Brisbane this week.\n\n#weightloss #brisbane',
    'the stored value is what the account receives — caption then tags',
  )
  // The specific regression: hydrating the wire body into the box, then saving
  // it, doubled the block, and it doubled again on every open after that.
  assert.equal(
    (trip.autosavedBody.match(/#weightloss/g) ?? []).length,
    1,
    'the tag block grew on the round trip. Open the post five times and the account is sent five copies of the tags.',
  )
  // Ten opens, to make a slow leak fail loudly rather than look like rounding.
  let body = trip.savedBody
  for (let open = 0; open < 10; open++) {
    body = composePublishBody(decomposePublishBody(body, ['weightloss', 'brisbane']), ['weightloss', 'brisbane'])
  }
  assert.equal(body, trip.savedBody, 'ten opens must leave the wire body byte-for-byte identical')
})

test('the trip holds for the shapes an owner actually types', () => {
  // No tags at all — the commonest post on the screen.
  assert.equal(lifecycle('Straight to the point.', []).boxAfterReload, 'Straight to the point.')

  // Tags typed with their hash, which is how they come back from the Director.
  const hashed = lifecycle('Book a consult.', ['#weightloss', '#brisbane'])
  assert.equal(hashed.boxAfterReload, 'Book a consult.', 'a leading # on a stored tag must not survive into the box')
  assert.equal(hashed.autosavedBody, hashed.savedBody)

  // Blank entries in the tag list — one stray Enter in the tag box.
  const blanks = lifecycle('Book a consult.', ['weightloss', '  ', 'brisbane'])
  assert.equal(blanks.boxAfterReload, 'Book a consult.')
  assert.equal(blanks.autosavedBody, blanks.savedBody)

  // An override with its own blank lines in it. The suffix match is exact, so
  // paragraphs inside the caption are not mistaken for the tag block.
  const paragraphs = lifecycle('Line one.\n\nLine two.\n\nLine three.', ['brisbane'])
  assert.equal(paragraphs.boxAfterReload, 'Line one.\n\nLine two.\n\nLine three.')
  assert.equal(paragraphs.autosavedBody, paragraphs.savedBody)

  // An empty override — the owner cleared the box but the account is still
  // ticked. It must not come back holding the tags as its entire caption.
  assert.equal(lifecycle('', ['brisbane']).boxAfterReload, '')
})

test('an override with the tags typed into it by hand is still stable', () => {
  // The awkward case, pinned because it is the one that looks like it should
  // break. The owner types the tags into the account's own box as well as
  // leaving them in the tag card, so the save appends a block that is already
  // there and the account receives them twice. That is the WRITE leg's doing
  // and it is unchanged by this fix — what matters here is that opening the
  // post neither eats his words nor adds a third copy.
  const typedByHand = 'Book a consult.\n\n#brisbane'
  const trip = lifecycle(typedByHand, ['brisbane'])
  assert.equal(trip.boxAfterReload, typedByHand, 'the owner\'s own words, including the tags he typed, come back whole')
  assert.equal(trip.autosavedBody, trip.savedBody, 'the words on the wire must not change just because the post was opened')
  assert.equal((trip.autosavedBody.match(/#brisbane/g) ?? []).length, 2, 'twice, as it was before the reload — not three times')
})

test('the composer still calls both halves, so this contract is about live code', () => {
  // Running lifted functions proves they behave. It does not prove they are
  // reached. These two lines are the reach.
  assert.match(
    creator,
    /captions_by_account_id\[account\.id\] = composePublishBody\(|captions_by_account_id: |editCaptions\[account\.id\] = composePublishBody\(/,
    `${CREATOR}: nothing composes a per-account body on the way out any more`,
  )
  assert.match(
    creator,
    /decomposePublishBody\(body, rowTags\)/,
    `${CREATOR}: the hydration no longer undoes the tag block, so the round trip this test proves is not the one the screen runs`,
  )
  assert.match(
    creator,
    /setCaptionsByAccountId\(restored\)/,
    `${CREATOR}: the restored overrides never reach state, so the boxes still show the master`,
  )
})
