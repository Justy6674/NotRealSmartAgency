import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Two faults in one screen, both of the same shape: the composer wrote
 * something down and then never read it back.
 *
 * 1. ACTIVITY. `ComposerActivityPane` is handed `editDraftId`. On a new post
 *    that was null from the first keystroke to the last — handleSave emptied the
 *    form and left — so the column that exists to show what has happened to this
 *    post told the owner to "save this post first" about a post he had just
 *    saved, and the comment box beside it was never usable at all. The tab was
 *    dead for the commonest journey through the composer.
 *
 * 2. PER-ACCOUNT CAPTIONS. `metadata.captions_by_account_id` was written by the
 *    save handler, deep-merged by the PATCH route and read per account by the
 *    publisher — and read back by nothing. Reopening a draft snapped every
 *    account to the master caption while the account kept receiving the words
 *    the owner could no longer see. Invisible and live is the worst of the three
 *    places those words could be.
 *
 * Source-contract, in the shape of post-versions.contract.test.ts: this is a
 * .tsx component full of browser state and network calls, so it is read rather
 * than executed.
 */

const CREATOR = 'src/components/agency/studio/post/PostCreator.tsx'

/** Comments are stripped: house style records the fault above the fix, and a
 *  fault described in prose must not read as a fix. */
function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
}

const creator = read(CREATOR)

function saveHandler(source: string): string {
  const start = source.indexOf('const handleSave')
  assert.ok(start !== -1, `${CREATOR}: the save handler is gone or renamed`)
  const end = source.indexOf('\n  const ', start + 1)
  return source.slice(start, end === -1 ? source.length : end)
}

test('a new post keeps the row it just made, so Activity has something to show', () => {
  const handler = saveHandler(creator)

  assert.match(
    handler,
    /setEditDraftId\(createdIds\[0\]/,
    `${CREATOR}: handleSave throws away the id of the row it just created. The composer then has no post to show a history for, which is the whole reason Activity was empty on every new post.`,
  )
  assert.match(
    handler,
    /setBornHere\(true\)/,
    `${CREATOR}: a post created here must be marked as such, or pressing Update on it navigates away as though it had been opened from Review.`,
  )
  // Adopting only makes sense for one row. Three ticked networks are three
  // rows, and editing one of them while the other two drift is worse than
  // clearing the form.
  assert.match(
    handler,
    /createdIds\.length === 1/,
    `${CREATOR}: the composer edits one row. Adopting an id when several were created points every later save at one of them and leaves the rest behind.`,
  )

  assert.match(
    creator,
    /<ComposerActivityPane\s+scheduledPostId=\{editDraftId\}/,
    `${CREATOR}: the Activity pane must be given the id of the post on screen`,
  )
})

test('a post born on this screen stays on it when saved again', () => {
  const handler = saveHandler(creator)
  const stay = handler.indexOf('if (bornHere')
  assert.ok(stay !== -1, `${CREATOR}: the edit branch no longer distinguishes a post made here from one opened from Review`)
  const leave = handler.indexOf('onDone?.()')
  assert.ok(leave !== -1, `${CREATOR}: the edit branch no longer returns to where the owner came from`)
  assert.ok(
    stay < leave,
    `${CREATOR}: the stay-put check must come before onDone, or a post made here still navigates away and takes its history with it.`,
  )
})

test('autosave never decides when a post goes out, or whether it is still a draft', () => {
  const handler = saveHandler(creator)
  // A press says both; typing says neither. Sending status:'draft' and
  // scheduled_at:now on every keystroke unscheduled a post scheduled for
  // Friday and moved it to this instant, silently.
  const from = handler.indexOf('id: editDraftId,')
  const to = handler.indexOf('post_type: postType,', from)
  assert.ok(from !== -1 && to > from, `${CREATOR}: could not find the edit PATCH body — re-point this contract at wherever it writes now`)
  const patchBody = handler.slice(from, to)
  assert.match(
    patchBody,
    /status: persistStatus/,
    `${CREATOR}: a pressed Save no longer says what the post's status is`,
  )
  assert.match(
    patchBody,
    /isAutosave/,
    `${CREATOR}: the edit PATCH sends status and scheduled_at whether a person pressed Save or merely typed. Typing a word must not reschedule or unschedule the post.`,
  )
  assert.match(
    patchBody,
    /scheduled_at:/,
    `${CREATOR}: a pressed Save no longer says when the post goes out`,
  )
})

test('the per-account captions are read back, not only written', () => {
  assert.match(
    creator,
    /meta\.captions_by_account_id/,
    `${CREATOR}: nothing reads metadata.captions_by_account_id back. Reopen a draft and every account snaps to the master caption while the account keeps receiving the override.`,
  )
  assert.match(
    creator,
    /setCaptionsByAccountId\(restored\)/,
    `${CREATOR}: the restored overrides are never put into state`,
  )
  assert.match(
    creator,
    /meta\.account_ids/,
    `${CREATOR}: the accounts the row was saved for are not restored, so the boxes have nothing to hang the restored words on`,
  )
  // The stored value is what the ACCOUNT receives — caption plus tag block.
  // Hydrating it whole shows the tags twice and saves them twice on the next
  // keystroke, growing the block every time the post is opened.
  assert.match(
    creator,
    /decomposePublishBody\(body, rowTags\)/,
    `${CREATOR}: the stored body is hydrated without removing the tag block composePublishBody added`,
  )
  assert.match(
    creator,
    /function decomposePublishBody/,
    `${CREATOR}: composePublishBody has no inverse, so the round trip cannot be honest`,
  )
})

test('an override edited while editing is written, not just announced as saved', () => {
  const handler = saveHandler(creator)
  const edit = handler.slice(0, handler.indexOf('New post mode') === -1 ? handler.length : handler.indexOf('New post mode'))
  assert.match(
    edit,
    /captions_by_account_id: editCaptions/,
    `${CREATOR}: the edit PATCH does not carry the per-account words, so an override typed while editing is announced as "Saved" and never leaves the browser.`,
  )
  assert.match(
    edit,
    /account_ids: editAccountIds/,
    `${CREATOR}: the edit PATCH does not carry the accounts its captions are keyed to`,
  )
})

test('this contract is not vacuously passing', () => {
  assert.ok(creator.length > 10_000, `${CREATOR} is suspiciously small — is this still the composer?`)
  const handler = saveHandler(creator)
  assert.ok(handler.length > 200 && handler.length < creator.length, 'the save-handler slice proves nothing')
  assert.ok(read(CREATOR).includes('export function PostCreator'), 'comment stripping ate the code')
})
