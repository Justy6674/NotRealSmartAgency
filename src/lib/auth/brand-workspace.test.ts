import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BrandWorkspaceAccessError,
  resolveBrandWorkspaceIdentity,
} from './brand-workspace.ts'

const brand = { id: 'brand-1', user_id: 'owner-1' }

test('the brand owner is both actor and workspace owner', () => {
  assert.deepEqual(
    resolveBrandWorkspaceIdentity({ actorUserId: 'owner-1', brand, membership: null }),
    { actorUserId: 'owner-1', workspaceOwnerId: 'owner-1', brandId: 'brand-1' },
  )
})

test('an accepted admin writes into the shared owner workspace', () => {
  assert.deepEqual(
    resolveBrandWorkspaceIdentity({
      actorUserId: 'bec-1',
      brand,
      membership: { owner_id: 'owner-1', role: 'admin', status: 'accepted', brand_ids: ['brand-1'] },
    }),
    { actorUserId: 'bec-1', workspaceOwnerId: 'owner-1', brandId: 'brand-1' },
  )
})

test('an accepted admin with all-brand access writes into the shared owner workspace', () => {
  assert.equal(resolveBrandWorkspaceIdentity({
    actorUserId: 'bec-1',
    brand,
    membership: { owner_id: 'owner-1', role: 'admin', status: 'accepted', brand_ids: null },
  }).workspaceOwnerId, 'owner-1')
})

test('viewer, revoked and wrong-brand memberships cannot mutate the workspace', () => {
  const denied = [
    { owner_id: 'owner-1', role: 'viewer', status: 'accepted', brand_ids: null },
    { owner_id: 'owner-1', role: 'admin', status: 'revoked', brand_ids: null },
    { owner_id: 'owner-1', role: 'admin', status: 'accepted', brand_ids: ['brand-2'] },
  ]

  for (const membership of denied) {
    assert.throws(
      () => resolveBrandWorkspaceIdentity({ actorUserId: 'bec-1', brand, membership }),
      BrandWorkspaceAccessError,
    )
  }
})
