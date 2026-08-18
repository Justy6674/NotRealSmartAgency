import assert from 'node:assert/strict'
import test from 'node:test'
import { SOCIAL_PLATFORM_CAPABILITIES } from './capabilities.ts'
import { reduceSocialCommand } from './reducer.ts'
import type { SocialPostDocumentV1 } from './model.ts'

const ids = {
  brand: '33333333-3333-4333-8333-333333333333',
  user: '11111111-1111-4111-8111-111111111111',
  composition: '55555555-5555-4555-8555-555555555555',
  mediaA: '66666666-6666-4666-8666-666666666666',
}

function document(): SocialPostDocumentV1 {
  return {
    schemaVersion: 1,
    compositionId: ids.composition,
    brandId: ids.brand,
    ownerUserId: ids.user,
    conversationId: null,
    revision: 0,
    lifecycle: 'editing',
    masterCaption: 'old caption',
    hashtags: [],
    contentType: 'feed',
    media: [],
    targets: [],
    schedule: { mode: 'draft', timezone: 'Australia/Sydney' },
    compliance: { allowed: true, captionHash: 'abc', checkedAt: '2026-08-18T00:00:00.000Z', warnings: [] },
    updatedAt: '2026-08-18T00:00:00.000Z',
  }
}

const context = {
  capabilities: SOCIAL_PLATFORM_CAPABILITIES,
  now: '2026-08-18T00:00:10.000Z',
  mediaById: new Map([
    [ids.mediaA, { mediaItemId: ids.mediaA, position: 0, type: 'image' as const }],
  ]),
}

test('rewriting the caption clears a previous compliance pass', () => {
  const next = reduceSocialCommand(
    document(),
    { type: 'set_master_caption', caption: 'new caption' },
    context,
  ).document
  assert.equal(next.compliance.allowed, undefined)
  assert.equal(next.compliance.captionHash, undefined)
})

test('hashtags keep brand casing', () => {
  const next = reduceSocialCommand(
    document(),
    { type: 'set_hashtags', hashtags: ['#DownscaleWeightLoss', 'bare'] },
    context,
  ).document
  assert.deepEqual(next.hashtags, ['DownscaleWeightLoss', 'bare'])
})

test('restore_media refuses media this business does not own', () => {
  assert.throws(
    () => reduceSocialCommand(
      document(),
      { type: 'restore_media', media: [{ mediaItemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', position: 0, type: 'image' }] },
      context,
    ),
    (error: unknown) => (error as { code?: string }).code === 'MEDIA_NOT_AVAILABLE',
  )
})

test('replace_platform_options uses the same allowlist as set_platform_options', () => {
  const withInstagram = reduceSocialCommand(
    document(),
    { type: 'set_platforms', platforms: ['instagram'] },
    context,
  ).document
  assert.throws(
    () => reduceSocialCommand(
      withInstagram,
      { type: 'replace_platform_options', targetId: 'instagram', options: { trialReel: true } },
      context,
    ),
    (error: unknown) => (error as { code?: string }).code === 'UNSUPPORTED_OPTION',
  )
})
