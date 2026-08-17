import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolvePublishCaption,
  createVersionsFromMaster,
  customisePlatform,
  updateMasterCaption,
  getVersionForPlatform,
  type PostVersions,
} from './post-versions.ts'

/**
 * The fault this file exists to hold shut:
 *
 * A user rewrote the Instagram caption, watched the preview redraw with a
 * "customised" badge under it, pressed Save — and Instagram received the master
 * caption. Nothing read the per-platform text back out. The badge was telling
 * the truth about what was STORED and a lie about what would be SENT.
 *
 * These tests are about one function, resolvePublishCaption, because the
 * one-function part is the fix. Threading the value through the save handler
 * would have repaired that one screen; a single resolver that the preview and
 * the publish path both call makes it impossible for the two to disagree again.
 */

const MASTER = 'Book your consult today.'
const MASTER_TAGS = ['downscale', 'weightloss']

test('a customised platform wins over the master', () => {
  const versions = customisePlatform(
    createVersionsFromMaster(['instagram', 'facebook'], MASTER, MASTER_TAGS),
    'instagram',
    'Swipe up — consults open this week.',
    ['reels', 'downscale'],
  )

  const resolved = resolvePublishCaption(versions, 'instagram', MASTER, MASTER_TAGS)
  assert.equal(resolved.caption, 'Swipe up — consults open this week.')
  assert.deepEqual(resolved.hashtags, ['reels', 'downscale'])
  assert.equal(resolved.isCustomised, true)
})

test('a platform that was never customised falls back to the master', () => {
  const versions = customisePlatform(
    createVersionsFromMaster(['instagram', 'facebook'], MASTER, MASTER_TAGS),
    'instagram',
    'Swipe up — consults open this week.',
    ['reels'],
  )

  const resolved = resolvePublishCaption(versions, 'facebook', MASTER, MASTER_TAGS)
  assert.equal(resolved.caption, MASTER)
  assert.deepEqual(resolved.hashtags, MASTER_TAGS)
  assert.equal(resolved.isCustomised, false)
})

test('editing the master reaches the platforms that were left alone, and no others', () => {
  const versions = updateMasterCaption(
    customisePlatform(
      createVersionsFromMaster(['instagram', 'facebook', 'linkedin'], MASTER, MASTER_TAGS),
      'linkedin',
      'A clinical note for colleagues.',
      ['ahpra'],
    ),
    'Consults open Monday.',
    ['downscale'],
  )

  assert.equal(resolvePublishCaption(versions, 'instagram', 'Consults open Monday.', ['downscale']).caption, 'Consults open Monday.')
  assert.equal(resolvePublishCaption(versions, 'facebook', 'Consults open Monday.', ['downscale']).caption, 'Consults open Monday.')
  assert.equal(resolvePublishCaption(versions, 'linkedin', 'Consults open Monday.', ['downscale']).caption, 'A clinical note for colleagues.')
})

test('a platform with no entry at all resolves to the master, never to undefined', () => {
  // The publish loop runs over the platforms the user ticked, which can move on
  // after the versions object was built. A missing key must read as "not
  // customised", because the alternative is a post with no words in it.
  const versions = createVersionsFromMaster(['instagram'], MASTER, MASTER_TAGS)

  const resolved = resolvePublishCaption(versions, 'tiktok', MASTER, MASTER_TAGS)
  assert.equal(resolved.caption, MASTER)
  assert.deepEqual(resolved.hashtags, MASTER_TAGS)
  assert.equal(resolved.isCustomised, false)
})

test('no versions object at all resolves to the master', () => {
  // MultiPlatformPreview takes `versions` as optional and the save handler can
  // reach the publish loop before the user ever opens the per-platform editor.
  assert.equal(resolvePublishCaption(undefined, 'instagram', MASTER, MASTER_TAGS).caption, MASTER)
  assert.equal(resolvePublishCaption(null, 'instagram', MASTER, MASTER_TAGS).caption, MASTER)
})

test('a customisation the user emptied is not a customisation', () => {
  // Selecting the platform caption and hitting delete flips isCustomised to
  // true with nothing behind it. Honouring that flag literally publishes a
  // blank post to a live account; falling back to the master publishes the
  // words the user can still see on the master tab.
  for (const emptied of ['', '   ', '\n', ' \t\n ']) {
    const versions = customisePlatform(
      createVersionsFromMaster(['instagram'], MASTER, MASTER_TAGS),
      'instagram',
      emptied,
      [],
    )
    const resolved = resolvePublishCaption(versions, 'instagram', MASTER, MASTER_TAGS)
    assert.equal(resolved.caption, MASTER, `an empty customisation (${JSON.stringify(emptied)}) must fall back`)
    assert.deepEqual(resolved.hashtags, MASTER_TAGS)
    assert.equal(resolved.isCustomised, false, 'and it must not report itself as customised')
  }
})

test('a customisation that is only whitespace-padded is still a customisation', () => {
  const versions = customisePlatform(
    createVersionsFromMaster(['twitter'], MASTER, MASTER_TAGS),
    'twitter',
    '  Consults open Monday.  ',
    [],
  )
  const resolved = resolvePublishCaption(versions, 'twitter', MASTER, MASTER_TAGS)
  // Preserved byte for byte — trimming is the publisher's business, not ours,
  // and silently rewriting a user's caption is how the original bug felt.
  assert.equal(resolved.caption, '  Consults open Monday.  ')
  assert.equal(resolved.isCustomised, true)
})

test('hashtags the user deliberately removed stay removed', () => {
  // PlatformVersionEditor carries the current hashtags into customisePlatform,
  // so an empty array on a customised platform is a decision, not an omission.
  // Falling back to the master here would put #weightloss back on a LinkedIn
  // post the user had just stripped it from.
  const versions = customisePlatform(
    createVersionsFromMaster(['linkedin'], MASTER, MASTER_TAGS),
    'linkedin',
    'A clinical note for colleagues.',
    [],
  )
  assert.deepEqual(resolvePublishCaption(versions, 'linkedin', MASTER, MASTER_TAGS).hashtags, [])
})

test('a stale stored caption never publishes ahead of the master', () => {
  // PostCreator only calls updateMasterCaption when more than one platform is
  // ticked (PostCreator.tsx:311). With a single platform the stored copy goes
  // stale the moment the user types, so a resolver that trusted the stored
  // caption on a non-customised version would publish the words they deleted.
  const versions: PostVersions = {
    instagram: { caption: 'The old caption nobody wants.', hashtags: ['old'], isCustomised: false },
  }
  const resolved = resolvePublishCaption(versions, 'instagram', 'The caption on screen.', ['new'])
  assert.equal(resolved.caption, 'The caption on screen.')
  assert.deepEqual(resolved.hashtags, ['new'])
})

test('the resolved hashtags are a copy, so a caller cannot edit the stored post', () => {
  const versions = customisePlatform(
    createVersionsFromMaster(['instagram'], MASTER, MASTER_TAGS),
    'instagram',
    'Custom.',
    ['reels'],
  )

  resolvePublishCaption(versions, 'instagram', MASTER, MASTER_TAGS).hashtags.push('injected')
  assert.deepEqual(versions.instagram?.hashtags, ['reels'], 'the stored version was mutated by a caller')

  resolvePublishCaption(versions, 'facebook', MASTER, MASTER_TAGS).hashtags.push('injected')
  assert.deepEqual(MASTER_TAGS, ['downscale', 'weightloss'], 'the master hashtags were mutated by a caller')
})

test('null hashtags coming back out of the database do not crash the publish loop', () => {
  // versions is stored as JSON. A row written before hashtags existed reads
  // back as null, and the publish loop calls .map on whatever it is handed.
  const versions = { instagram: { caption: 'Custom.', hashtags: null, isCustomised: true } } as unknown as PostVersions
  assert.deepEqual(resolvePublishCaption(versions, 'instagram', MASTER, null).hashtags, [])
  assert.deepEqual(resolvePublishCaption(versions, 'facebook', MASTER, null).hashtags, [])
})

test('the preview helper and the publish resolver cannot disagree', () => {
  // This is the whole point. getVersionForPlatform is what the preview grew up
  // calling; if it kept its own copy of the rule, the badge and the post would
  // drift apart again the first time one of them was fixed alone.
  const base = createVersionsFromMaster(['instagram', 'facebook', 'linkedin'], MASTER, MASTER_TAGS)
  const cases: PostVersions[] = [
    base,
    customisePlatform(base, 'instagram', 'Custom.', ['reels']),
    customisePlatform(base, 'instagram', '   ', []),
    { instagram: { caption: 'Stale.', hashtags: ['stale'], isCustomised: false } },
    {},
  ]

  for (const versions of cases) {
    for (const platform of ['instagram', 'facebook', 'linkedin', 'tiktok'] as const) {
      const preview = getVersionForPlatform(versions, platform, MASTER, MASTER_TAGS)
      const publish = resolvePublishCaption(versions, platform, MASTER, MASTER_TAGS)
      assert.equal(preview.caption, publish.caption, `${platform} previews one caption and publishes another`)
      assert.deepEqual(preview.hashtags, publish.hashtags, `${platform} previews one hashtag set and publishes another`)
      assert.equal(preview.isCustomised, publish.isCustomised, `${platform} badges one thing and publishes another`)
    }
  }
})
