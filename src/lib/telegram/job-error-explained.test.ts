import { test } from 'node:test'
import assert from 'node:assert/strict'
import { explainJobError, canRetry } from './timeline-sources'

/**
 * The red box must say what actually happened.
 *
 * `markJobError` writes an owner-safe sentence into `mcp_jobs.error`, which is
 * right — that column is read straight back to him. The consequence nobody
 * traced is that it lands BEFORE this classifier runs, so every distinct
 * failure arrived here already flattened into "That did not complete." and
 * left through the generic branch. Budget, timeout and step-limit were all
 * tested for and none of them could ever match.
 *
 * The cases below are the real stored shapes, including job 47a4492e from
 * 2026-08-10, where the owner asked "did you hold context - I just uploaded
 * the video" and was told to try again — advice that could not work, because
 * the same request would exhaust the same steps.
 */

/** The row as director-job.ts actually writes it: sentence in error, truth in result. */
function storedFailure(realCause: string) {
  return {
    error: 'That did not complete. Nothing was published — try again.',
    result: {
      diagnostic: {
        scope: 'director-job',
        message: realCause,
        stack: `Error: ${realCause}\n    at S (/var/task/.next/server/chunks/3158.js:292:467)`,
        at: '2026-08-10T07:07:15.943Z',
      },
    },
  }
}

test('the step-limit failure that shipped a useless red box is now named', () => {
  const job = storedFailure('The Director reached its tool-step limit while still gathering information.')

  const text = explainJobError(job.error, job.result)

  assert.doesNotMatch(
    text,
    /did not complete/i,
    'this is the generic fallback — the diagnostic said exactly what went wrong',
  )
  assert.match(text, /steps/i, 'the owner should be told it ran out of steps')
})

test('a spend cap is still a spend cap once it has been made polite', () => {
  const job = storedFailure('Budget exceeded — 10003c / 10000c monthly limit')

  assert.match(explainJobError(job.error, job.result), /spend limit/i)
  assert.equal(
    canRetry(job.error, job.result),
    false,
    'offering a retry against a spend cap is how an evening gets spent pressing a button',
  )
})

test('a transcode overrun says the upload survived', () => {
  const job = storedFailure('ffmpeg transcode timed out after 240000ms')

  const text = explainJobError(job.error, job.result)
  assert.match(text, /video/i)
  assert.match(text, /safe|already uploaded/i, 'he needs to know the file is not lost')
})

test('the diagnostic is matched against, never repeated', () => {
  const job = storedFailure(
    'connect ECONNREFUSED 10.0.0.4:5432 relation "telegram_project_sessions" violates check constraint',
  )

  const text = explainJobError(job.error, job.result)

  for (const leak of ['ECONNREFUSED', '10.0.0.4', 'telegram_project_sessions', '/var/task', 'chunks/3158.js']) {
    assert.ok(!text.includes(leak), `internal detail "${leak}" was read out to the owner`)
  }
})

test('a job with no diagnostic still falls back rather than throwing', () => {
  assert.match(explainJobError('That did not complete.', null), /try again/i)
  assert.match(explainJobError(null, undefined), /try again/i)
  assert.equal(canRetry(null, null), true)
})

test('a timeout is still classified when only the plain error carries it', () => {
  // Older rows, written before diagnostics were stored at all.
  assert.match(explainJobError('Request timed out after 300000ms', null), /took too long/i)
})
