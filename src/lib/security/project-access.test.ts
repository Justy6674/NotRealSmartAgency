import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertProjectCapability,
  createMcpPrincipal,
  listGrantedProjectIds,
} from './project-access.ts'

test('an MCP principal lists only the projects explicitly granted to its key', () => {
  const principal = createMcpPrincipal({
    userId: 'owner-1',
    keyId: 'key-1',
    grants: [
      { grantId: 'grant-downscale', projectId: 'downscale', capabilities: ['director:chat'] },
      { grantId: 'grant-dotoday', projectId: 'dotoday', capabilities: ['director:chat', 'draft:post'] },
    ],
  })

  assert.deepEqual(listGrantedProjectIds(principal), ['dotoday', 'downscale'])
})

test('an MCP principal cannot use a project or capability that its key was not granted', () => {
  const principal = createMcpPrincipal({
    userId: 'owner-1',
    keyId: 'key-1',
    grants: [{ grantId: 'grant-dotoday', projectId: 'dotoday', capabilities: ['director:chat'] }],
  })

  assert.throws(
    () => assertProjectCapability(principal, 'scent-sell', 'director:chat'),
    /not granted to this MCP connection/,
  )
  assert.throws(
    () => assertProjectCapability(principal, 'dotoday', 'draft:post'),
    /does not allow draft:post/,
  )
})
