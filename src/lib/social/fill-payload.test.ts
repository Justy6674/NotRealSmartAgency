import assert from 'node:assert/strict'
import test from 'node:test'
import { fillPayloadToDeskActions, stillNeededOnDesk } from './fill-payload.ts'
import { applyDeskActionsToCompose } from './apply-desk-actions.ts'

const MEDIA_A = '11111111-1111-4111-8111-111111111111'
const MEDIA_B = '22222222-2222-4222-8222-222222222222'

test('Director fill becomes caption, media, accounts, title, first comment, privacy and time', () => {
  const actions = fillPayloadToDeskActions({
    caption: 'Warm woods, no guesswork.',
    hashtags: ['ScentSell'],
    platforms: ['instagram', 'youtube'],
    media_ids: [MEDIA_A],
    account_ids: ['acct_ig'],
    title: 'How to spot a fake bottle',
    first_comment: 'Which one are you wearing?',
    youtube_privacy: 'unlisted',
    scheduled_at: '2026-08-19T09:00:00.000Z',
  })

  const types = actions.map((action) => action.type)
  assert.deepEqual(
    types.filter((type) => type === 'set_platforms' || type === 'set_master_caption' || type === 'set_hashtags' || type === 'add_media' || type === 'set_schedule'),
    ['set_platforms', 'set_master_caption', 'set_hashtags', 'add_media', 'set_schedule'],
  )
  assert.ok(actions.some((action) => action.type === 'set_first_comment'))
  assert.ok(actions.some((action) => action.type === 'set_platform_title' && action.targetId === 'youtube'))
  assert.ok(actions.some((action) => action.type === 'set_platform_options' && action.targetId === 'youtube'))
})

test('a Director fill lands on the Compose patch the buttons also use', () => {
  const actions = fillPayloadToDeskActions({
    caption: 'Warm woods, no guesswork.',
    hashtags: ['ScentSell'],
    platforms: ['instagram', 'tiktok'],
    media_ids: [MEDIA_A],
    first_comment: 'Drop your favourite.',
    tiktok_privacy: 'friends',
  })
  const patch = applyDeskActionsToCompose(actions, {
    brandId: '33333333-3333-4333-8333-333333333333',
    caption: '',
    hashtags: [],
    selectedPlatforms: [],
    selectedMediaIds: [],
    selectedAccountIds: [],
    versions: {},
    platformOptions: {},
    mediaById: new Map([
      [MEDIA_A, { mediaItemId: MEDIA_A, position: 0, type: 'video' }],
    ]),
  })

  assert.equal(patch.caption, 'Warm woods, no guesswork.')
  assert.deepEqual(patch.hashtags, ['ScentSell'])
  assert.deepEqual(patch.selectedPlatforms, ['instagram', 'tiktok'])
  assert.deepEqual(patch.selectedMediaIds, [MEDIA_A])
  assert.equal(patch.platformOptions.instagram?.first_comment, 'Drop your favourite.')
  assert.equal(patch.platformOptions.tiktok?.privacy, 'friends')
  assert.ok(patch.inverseActions.length > 0)
})

test('replacing media removes the old file before adding the new one', () => {
  const actions = fillPayloadToDeskActions(
    { media_ids: [MEDIA_B], platforms: ['instagram'] },
    { mediaIds: [MEDIA_A] },
  )
  assert.deepEqual(
    actions.filter((action) => action.type === 'remove_media' || action.type === 'add_media'),
    [
      { type: 'remove_media', mediaItemId: MEDIA_A },
      { type: 'add_media', mediaItemId: MEDIA_B },
    ],
  )
})

test('still-needed asks in plain language, never a vendor name', () => {
  const needed = stillNeededOnDesk({
    platforms: [],
    caption: '',
    mediaIds: [],
    accountIds: [],
  }).join(' ')
  assert.match(needed, /Instagram/)
  assert.doesNotMatch(needed, /Mixpost|Zernio|department/i)
})
