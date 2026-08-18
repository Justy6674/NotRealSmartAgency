import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AUTH_SESSION_TIMEOUT_MS,
  UploadAbortError,
  UploadTimeoutError,
  getSessionWithTimeout,
} from '@/lib/media/browser-upload'

test('getSessionWithTimeout rejects when the session call hangs', async () => {
  await assert.rejects(
    () =>
      getSessionWithTimeout(
        () => new Promise<{ ok: boolean }>(() => {}),
        20,
      ),
    (err: unknown) => err instanceof UploadTimeoutError,
  )
})

test('getSessionWithTimeout resolves when the session call returns in time', async () => {
  const result = await getSessionWithTimeout(async () => ({ ok: true }), AUTH_SESSION_TIMEOUT_MS)
  assert.equal(result.ok, true)
})

test('UploadAbortError is distinct from generic failures', () => {
  const err = new UploadAbortError()
  assert.equal(err.message, 'Upload cancelled')
  assert.equal(err.name, 'UploadAbortError')
})
