import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlatformOptions, deriveYoutubeTitle } from './sync-draft'

/**
 * Mixpost's own PostOptions classes define these shapes. Sending nothing meant
 * accepting their defaults, which were wrong for what NRS creates: a vertical
 * video went out as a pillarboxed feed post instead of a Reel, and every
 * YouTube draft arrived with an empty title.
 */

test('a vertical video for Instagram is flagged as a Reel', () => {
  assert.deepEqual(buildPlatformOptions('instagram', 'reel', 'caption', null), { type: 'reel' })
})

test('a vertical video for Facebook is flagged as a Reel', () => {
  assert.deepEqual(buildPlatformOptions('facebook', 'reel', 'caption', null), { type: 'reel' })
})

test('a still image stays a normal feed post', () => {
  assert.deepEqual(buildPlatformOptions('instagram', 'single', 'caption', null), { type: 'post' })
})

test('YouTube always gets a non-empty title', () => {
  const options = buildPlatformOptions('youtube', 'video', 'My first bench video\n\nmore text', null)
  assert.equal(options?.title, 'My first bench video')
})

test('an unapproved YouTube draft never defaults to public', () => {
  const options = buildPlatformOptions('youtube', 'video', 'anything', null)
  assert.equal(options?.status, 'private')
  assert.equal(options?.made_for_kids, false)
})

test('an explicit YouTube status is respected', () => {
  const options = buildPlatformOptions('youtube', 'video', 'x', { youtube_status: 'public' })
  assert.equal(options?.status, 'public')
})

test('platforms without options send none', () => {
  assert.equal(buildPlatformOptions('linkedin', 'single', 'x', null), undefined)
})

test('a title is taken from the first line, with hashtags stripped', () => {
  assert.equal(
    deriveYoutubeTitle('#scentsell #fragrance\nOrmonde Jayne Bijou Saffron review', null),
    'Ormonde Jayne Bijou Saffron review',
  )
})

test('an explicit title wins over the caption', () => {
  assert.equal(deriveYoutubeTitle('caption line', { youtube_title: 'Chosen title' }), 'Chosen title')
})

test('a long first line is cut on a word boundary, within YouTube\'s limit', () => {
  const long = 'word '.repeat(60).trim()
  const title = deriveYoutubeTitle(long, null)
  assert.ok(title.length <= 100, `title was ${title.length} chars`)
  assert.ok(!title.endsWith('wor'), 'should not end mid-word')
})

test('an empty caption still yields a usable title', () => {
  assert.equal(deriveYoutubeTitle('   \n  ', null), 'Untitled video')
})

test('a caption of only hashtags still yields a usable title', () => {
  assert.equal(deriveYoutubeTitle('#one #two', null), 'Untitled video')
})
