import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Nothing a publisher wants may be awaited before the owner gets an answer.
 *
 * The Mini App route awaited the whole media pipeline before running the
 * Director. That pipeline includes `delivery` — a re-encode of any video over
 * 80 MB, bounded at 240s (`ffmpeg-transcode.ts`) inside a route bounded at
 * 300s. On a 156-second clip it took all 240s, failed, and left the Director
 * with no budget: the invocation died with the job still queued, the recovery
 * cron re-ran it four minutes later, and that run hit the tool-step limit.
 *
 * What the owner saw was "That did not complete. Nothing else changed — try
 * again." for the question "did you hold context - I just uploaded the video".
 * What the Director needed to answer him — thumbnail, transcript, AI
 * description — had finished 14 seconds after the upload.
 *
 * The rule this pins: any pipeline run awaited BEFORE `runDirectorJob` must
 * name its stages and must not include `delivery`. Delivery belongs after the
 * answer, where running out of budget costs a heavier upload instead of a
 * failed reply.
 */

const ROUTE = resolve(
  process.cwd(),
  'src/app/api/telegram/mini-app/message/route.ts',
)

/** Every `runMediaProcessingPipeline({...})` call site, as its argument text. */
function pipelineCallArgs(source: string): string[] {
  const calls: string[] = []
  const needle = 'runMediaProcessingPipeline('

  for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
    let depth = 0
    const open = at + needle.length - 1
    for (let i = open; i < source.length; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')') {
        depth--
        if (depth === 0) {
          calls.push(source.slice(open + 1, i))
          break
        }
      }
    }
  }

  return calls
}

test('the answer is not made to wait for a publish-time transcode', () => {
  const source = readFileSync(ROUTE, 'utf8')

  const directorAt = source.indexOf('runDirectorJob(')
  assert.notEqual(
    directorAt,
    -1,
    'the route no longer calls runDirectorJob — this guardrail needs rewriting, not deleting',
  )

  const beforeAnswer = pipelineCallArgs(source.slice(0, directorAt))
  assert.ok(
    beforeAnswer.length > 0,
    'expected the route to process attachments before answering; if that moved, update this test',
  )

  for (const args of beforeAnswer) {
    assert.match(
      args,
      /runStages\s*:/,
      'a pipeline run awaited before the Director must name its stages, or it silently '
        + 'inherits every stage including the 240s delivery transcode',
    )
    assert.doesNotMatch(
      args,
      /['"]delivery['"]/,
      'delivery is a publish-time re-encode and must not block the owner\'s answer',
    )
  }
})

test('the delivery copy is still made, after the answer', () => {
  const source = readFileSync(ROUTE, 'utf8')
  const directorAt = source.indexOf('runDirectorJob(')

  const afterAnswer = pipelineCallArgs(source.slice(directorAt))
  assert.ok(
    afterAnswer.some((args) => /['"]delivery['"]/.test(args)),
    'moving delivery off the answer path must not drop it — a large video would then '
      + 'publish as the master and fail the platform fetch',
  )
})
