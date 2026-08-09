import assert from 'node:assert/strict'
import test from 'node:test'
import { nextMaintenanceStatus } from './maintenance'

test('memory maintenance resumes when it fills its bounded batch', () => {
  assert.equal(nextMaintenanceStatus(25, 25), 'partial')
  assert.equal(nextMaintenanceStatus(4, 25), 'completed')
})
