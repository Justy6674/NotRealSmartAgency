import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaNameFromUrl, postHoldsMedia } from './refresh-draft-media'
import type { MixpostPost } from './client'

/** A post shaped exactly as Mixpost's API returns it. */
const post = (status: string, mediaName: string): MixpostPost => ({
  id: 1, uuid: 'u', status,
  accounts: [{ id: 6, provider: 'facebook_page', name: 'Scent Sell' }],
  versions: [{
    account_id: 0, is_original: true,
    content: [{ body: 'x', media: [{ id: '199', name: mediaName }] as never, url: null, video_thumbs: [] }],
  }],
  tags: [], scheduled_at: null, published_at: null, created_at: '',
})

const NAME = '1786163848117_27373CDF-5D7E-4D23-9CAE-24BE21776791'

test('a draft holding our file is recognised', () => {
  assert.equal(postHoldsMedia(post('draft', NAME), NAME), true)
})

test('the status Mixpost sends is a WORD, not a number', () => {
  // This was typed and compared as a number for a long time. `status === 0`
  // matched nothing ever, so a routine meant to swap the video in every draft
  // found none and reported "nothing to do" — against three real drafts.
  assert.equal(typeof post('draft', NAME).status, 'string')
})

test('a file name survives the extension and the URL around it', () => {
  assert.equal(
    mediaNameFromUrl(`https://x.co/storage/a/b/${NAME}.mov`),
    NAME,
  )
  // Mixpost stores the name without the extension, so ours must match that.
  assert.equal(mediaNameFromUrl(`https://x.co/a/${NAME}.mp4`), NAME)
})

test('an already-captioned copy is matched by its prefix', () => {
  // The captioned file is "<name>.mov_captioned.mp4". Running the swap twice
  // must recognise the draft it already updated rather than treating it as a
  // different clip and uploading a third copy.
  assert.equal(postHoldsMedia(post('draft', `${NAME}.mov_captioned`), NAME), true)
})

test('a different clip is not touched', () => {
  assert.equal(postHoldsMedia(post('draft', '1786061894757_07-08-2026_A'), NAME), false)
})

test('a post with no media at all does not throw', () => {
  const bare = post('draft', NAME)
  bare.versions[0].content[0].media = [] as never
  assert.equal(postHoldsMedia(bare, NAME), false)
})
