import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The two buttons on this screen that ask the Director for something, and the
 * rule they both broke: a button that promises a fill must fill.
 *
 * 1. SUGGEST, above the tag input. It called `sendToDirector`, which does
 *    nothing but dispatch a window event, and there was no reply handler and no
 *    call to `onChange`. The tags arrived as prose in the chat panel and the
 *    owner read them off and retyped them one at a time — under a button
 *    positioned directly above the box, which reads as "fill this box".
 *
 * 2. THE FOURTH MEDIA BUTTON, labelled "AI Generate" beside Library, Upload and
 *    Canva — three buttons that put a picture on the post instantly. It asked
 *    for the picture to be filed in the Library and stopped, so the owner had to
 *    know to go and look for it.
 *
 * Both delegate to the Director, and both must: it holds the brand look, the
 * health rules and the spend. What was missing was the return leg. Every fill
 * the Director makes on this screen arrives through the desk-actions effect, so
 * that effect is the only place that can honestly say the answer landed — which
 * is why "asked" and "landed" are separate states here and why nothing sets
 * "landed" at the moment of pressing.
 *
 * A .tsx component full of browser state, so it is read rather than executed,
 * in the shape of composer-post-lifecycle.test.ts.
 */

const CREATOR = 'src/components/agency/studio/post/PostCreator.tsx'
const TAGS = 'src/components/agency/studio/post/HashtagSection.tsx'

const creator = readFileSync(join(process.cwd(), CREATOR), 'utf8')
const tagCard = readFileSync(join(process.cwd(), TAGS), 'utf8')

/** Source with comments stripped — a fault described in prose must not read as a fix. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
}

const creatorCode = code(creator)
const tagCode = code(tagCard)

test('the tag card no longer owns a dead end to the chat panel', () => {
  assert.doesNotMatch(
    tagCode,
    /sendToDirector/,
    `${TAGS}: the card still fires a message at the chat panel itself. It has no way of hearing an answer, which is how the tags ended up as text for the owner to retype.`,
  )
  assert.doesNotMatch(
    tagCode,
    /Return just the hashtags/i,
    `${TAGS}: "return just the hashtags" is an instruction to write them out in the chat — it asks for exactly the behaviour that made the button useless.`,
  )
})

test('Suggest is not drawn at all unless something can receive the answer', () => {
  // A control that cannot work must not be offered. The button renders only
  // when the composer hands the card a request handler.
  assert.match(
    tagCode,
    /suggest\?:\s*HashtagSuggestState/,
    `${TAGS}: the Suggest state is no longer a prop, so the card is deciding for itself whether a loop exists`,
  )
  assert.match(
    tagCode,
    /\{suggest && \(\s*<button/,
    `${TAGS}: the Suggest button renders unconditionally again. Without a handler it is a button that cannot do the thing it names.`,
  )
  assert.match(
    creatorCode,
    /suggest=\{\{[\s\S]{0,200}onAsk: askDirectorForHashtags/,
    `${CREATOR}: the composer no longer hands the tag card its request handler, so the button disappears`,
  )
})

test('Suggest asks for the tags to be put on the post, not written out in chat', () => {
  const ask = creatorCode.slice(creatorCode.indexOf('const askDirectorForHashtags'))
  assert.ok(ask.length > 0, `${CREATOR}: askDirectorForHashtags is gone or renamed`)
  const body = ask.slice(0, ask.indexOf('}, [caption])') + 1)
  assert.match(
    body,
    /put them straight onto it/i,
    `${CREATOR}: the prompt no longer asks for the tags to be put on the post. The wording is the whole mechanism — asked for a list, the Director writes a list.`,
  )
  assert.match(
    body,
    /setHashtagRequest\(\{ askedAt: clockLabel\(\), filledAt: null \}\)/,
    `${CREATOR}: pressing Suggest must record that it was asked and NOT that it was answered`,
  )
})

test('the picture button says it is a request, and asks for the picture to land on the post', () => {
  assert.doesNotMatch(
    creatorCode,
    /label=\{?'AI Generate'/,
    `${CREATOR}: "AI Generate" sits beside three buttons that add a picture instantly and promises the same thing. It cannot deliver that; the picture has to be made first.`,
  )
  assert.match(
    creatorCode,
    /'Ask for a picture'/,
    `${CREATOR}: the fourth media button must name itself as a request`,
  )
  assert.match(
    creatorCode,
    /put it straight onto the post I am looking at/i,
    `${CREATOR}: the picture is asked for and then filed away out of sight. Ask for it to be put on the post — the Director has hands on this screen.`,
  )
  assert.match(
    creatorCode,
    /setImageRequest\(\{ askedAt: clockLabel\(\), filledAt: null \}\)/,
    `${CREATOR}: pressing the picture button must record that it was asked and NOT that it was answered`,
  )
})

test('"landed" is only ever said by the effect that watches the post change', () => {
  const from = creatorCode.indexOf('const applied = applyDeskActionsToCompose')
  assert.ok(from !== -1, `${CREATOR}: the desk-fill effect is gone or renamed — re-point this contract at wherever fills are applied now`)
  const effect = creatorCode.slice(from, creatorCode.indexOf('setCaptionEditorKey', from))

  assert.match(
    effect,
    /tagsChanged && directorRequestsRef\.current\.hashtags/,
    `${CREATOR}: nothing notices the tags arriving, so Suggest can never report anything back and the owner is left watching an unchanged box.`,
  )
  assert.match(
    effect,
    /mediaArrived && directorRequestsRef\.current\.image/,
    `${CREATOR}: nothing notices the picture arriving on the post`,
  )
  // Measured against what was on the screen a moment ago, so a fill that
  // changed nothing is not announced as a fill.
  assert.match(
    effect,
    /const before = composeStateRef\.current/,
    `${CREATOR}: the arrival check no longer compares against what was on the screen, so it can announce a fill that did not change anything`,
  )

  // The only two places filledAt may be set. Anywhere else is a guess.
  const filledAtSites = creatorCode.match(/filledAt: clockLabel\(\)/g) ?? []
  assert.equal(
    filledAtSites.length,
    2,
    `${CREATOR}: "landed" is claimed in ${filledAtSites.length} places. It may be claimed only where the post is seen to change — one for the tags, one for the picture — or the screen goes back to saying something happened when it did not.`,
  )
})

test('both requests are read back onto the glass', () => {
  // Bec works from buttons. State the composer keeps but never draws is state
  // that does not exist for her.
  assert.match(
    creatorCode,
    /askedAt: hashtagRequest\?\.askedAt \?\? null/,
    `${CREATOR}: the tag card is no longer told when the request was made, so its note cannot say anything true`,
  )
  assert.match(
    tagCode,
    /suggest\?\.askedAt && \(/,
    `${TAGS}: the card keeps the request state and never shows it`,
  )
  assert.match(
    creatorCode,
    /\{imageRequest && \(/,
    `${CREATOR}: the picture request is tracked and never drawn`,
  )
  // Waiting must read as waiting, not as done.
  assert.match(
    tagCard,
    /nothing has changed here yet/i,
    `${TAGS}: the waiting note no longer says that the box is unchanged, which is the one thing the owner needs to know while he waits`,
  )
  assert.match(
    creator,
    /nothing has been added yet/i,
    `${CREATOR}: the waiting note no longer says the post is unchanged`,
  )
})

test('this contract is not vacuously passing', () => {
  assert.ok(creatorCode.includes('export function PostCreator'), 'comment stripping ate the composer')
  assert.ok(tagCode.includes('export function HashtagSection'), 'comment stripping ate the tag card')
  assert.ok(creator.length > 10_000, `${CREATOR} is suspiciously small — is this still the composer?`)
})
