import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMcpDirectorExecution,
  createTelegramDirectorExecution,
  matchesDirectorJobScope,
} from './director-execution.ts'

const grant = {
  grantId: 'grant-dotoday',
  projectId: 'do-today',
  capabilities: ['director:chat'] as const,
}

test('MCP Director work carries its key, grant, project and channel identity', () => {
  const execution = createMcpDirectorExecution(
    { userId: 'owner', keyId: 'key-1', grants: [grant] },
    'do-today',
  )

  assert.deepEqual(execution, {
    actorUserId: 'owner',
    channel: 'mcp',
    projectId: 'do-today',
    projectAccessGrantId: 'grant-dotoday',
    apiKeyId: 'key-1',
    policyVersion: 1,
  })
})

test('Telegram work is project-explicit and cannot acquire an MCP key identity', () => {
  const execution = createTelegramDirectorExecution({ userId: 'owner', grant })

  assert.equal(execution.channel, 'telegram')
  assert.equal(execution.projectId, 'do-today')
  assert.equal('apiKeyId' in execution, false)
  assert.throws(
    () => createTelegramDirectorExecution({
      userId: 'owner',
      grant: { ...grant, capabilities: [] },
    }),
    /does not allow director:chat/i,
  )
})

test('a queued Director job must match the exact channel and scope that created it', () => {
  const execution = createTelegramDirectorExecution({ userId: 'owner', grant })

  assert.equal(matchesDirectorJobScope(execution, {
    user_id: 'owner',
    brand_id: 'do-today',
    channel: 'telegram',
    project_access_grant_id: 'grant-dotoday',
    api_key_id: null,
  }), true)
  assert.equal(matchesDirectorJobScope(execution, {
    user_id: 'owner',
    brand_id: 'do-today',
    channel: 'mcp',
    project_access_grant_id: 'grant-dotoday',
    api_key_id: null,
  }), false)
})
