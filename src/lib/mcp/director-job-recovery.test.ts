import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIRECTOR_JOB_QUEUE_GRACE_MS,
  DIRECTOR_JOB_RUNNING_GRACE_MS,
  isQueuedLongEnough,
  isRunningTooLong,
  recoverDirectorJob,
  withRecoveryAttempt,
} from './director-job-recovery.ts'

const base = {
  id: 'job-1',
  user_id: 'user-1',
  brand_id: 'brand-1',
  api_key_id: null,
  project_access_grant_id: 'grant-1',
  policy_version: 1,
  status: 'queued',
  created_at: '2026-08-09T00:00:00.000Z',
  started_at: null,
}

test('recovers the same Telegram delivery target from persisted job input', () => {
  const recovered = recoverDirectorJob({
    ...base,
    channel: 'telegram',
    input: {
      brand_id: 'brand-1',
      message: 'Review this video',
      delivery: {
        telegram_chat_id: '123',
        telegram_thread_id: 99,
        project_name: 'NRS',
        deliver_text: false,
      },
    },
  })
  assert.equal(recovered?.execution.channel, 'telegram')
  assert.equal(recovered?.execution.telegramChatId, '123')
  assert.equal(recovered?.execution.telegramThreadId, 99)
  assert.equal(recovered?.execution.deliverText, false)
})

test('refuses to recover Telegram work without an authenticated delivery target', () => {
  const recovered = recoverDirectorJob({
    ...base,
    channel: 'telegram',
    input: { brand_id: 'brand-1', message: 'Review this video' },
  })
  assert.equal(recovered, null)
})

test('uses independent grace periods for queued and running work', () => {
  const now = Date.parse('2026-08-09T00:20:00.000Z')
  assert.equal(isQueuedLongEnough({ status: 'queued', created_at: new Date(now - DIRECTOR_JOB_QUEUE_GRACE_MS).toISOString() }, now), true)
  assert.equal(isRunningTooLong({ status: 'running', started_at: new Date(now - DIRECTOR_JOB_RUNNING_GRACE_MS).toISOString() }, now), true)
})

test('increments recovery metadata without touching the owner request', () => {
  const input = withRecoveryAttempt({ brand_id: 'brand-1', message: 'Draft this', recovery: { attempts: 2 } }, new Date('2026-08-09T00:00:00.000Z'))
  assert.equal(input.message, 'Draft this')
  assert.deepEqual(input.recovery, { attempts: 3, last_recovered_at: '2026-08-09T00:00:00.000Z' })
})
