import assert from 'node:assert/strict'
import test from 'node:test'
import { toScopedMcpPrincipal } from './api-key.ts'

test('only active MCP project grants become an authenticated MCP principal', () => {
  const principal = toScopedMcpPrincipal(
    { id: 'key-1', user_id: 'user-1' },
    [
      {
        id: 'grant-dotoday',
        brand_id: 'dotoday',
        channel: 'mcp',
        status: 'active',
        revoked_at: null,
        expires_at: null,
        capabilities: ['director:chat', 'draft:post'],
      },
      {
        id: 'grant-downscale-web',
        brand_id: 'downscale',
        channel: 'web',
        status: 'active',
        revoked_at: null,
        expires_at: null,
        capabilities: ['director:chat'],
      },
    ],
  )

  assert.deepEqual(principal, {
    userId: 'user-1',
    keyId: 'key-1',
    grants: [{
      grantId: 'grant-dotoday',
      projectId: 'dotoday',
      capabilities: ['director:chat', 'draft:post'],
    }],
  })
})

test('a key with no live scoped grants is not authenticated for MCP', () => {
  const principal = toScopedMcpPrincipal(
    { id: 'key-1', user_id: 'user-1' },
    [{
      id: 'grant-revoked',
      brand_id: 'scent-sell',
      channel: 'mcp',
      status: 'revoked',
      revoked_at: '2026-07-24T00:00:00.000Z',
      expires_at: null,
      capabilities: ['director:chat'],
    }],
  )

  assert.equal(principal, null)
})
