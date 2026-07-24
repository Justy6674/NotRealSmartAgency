import assert from 'node:assert/strict'
import test from 'node:test'
import { assertProjectScope, createExecutionScope } from './execution-scope.ts'

test('scope permits its active project only', () => {
  const scope = createExecutionScope({
    actorId: 'user-1',
    projectId: 'downscale',
    channel: 'mcp',
  })

  assert.doesNotThrow(() => assertProjectScope(scope, 'downscale'))
  assert.throws(
    () => assertProjectScope(scope, 'scent-sell'),
    /outside the active project scope/,
  )
})

test('scope does not grant capabilities unless explicitly supplied', () => {
  const scope = createExecutionScope({
    actorId: 'user-1',
    projectId: 'dotoday',
    channel: 'telegram',
  })

  assert.deepEqual(scope.capabilities, [])
})
