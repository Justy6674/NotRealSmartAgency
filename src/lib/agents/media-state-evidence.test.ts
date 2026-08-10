import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planDirectorTask } from './task-capability-plan'
import { isCitableBrainPage } from '@/lib/brain/gbrain'
import { isWithinRecentUploadWindow } from '@/lib/media/recent-upload'

/**
 * 10 August 2026. The owner uploaded a video to Scent Sell, asked after it, and
 * was told it had never arrived.
 *
 *   "WHen IS IT FINISHING PROCESSING"
 *   → "the upload hasn't appeared as an accessible media item yet"
 *   "check now"
 *   → "your new Aican by Kajal video still has not arrived… The newest items
 *      visible are from 8 August. The upload did not complete into the library."
 *
 * All of it was false. The file was the newest row in that library, already
 * transcribed, and query_media returned it first.
 *
 * Two independent faults produced one confident wrong answer, and this file
 * pins both:
 *
 *   1. The evidence gate needed two keyword classes in ONE message, so neither
 *      of those sentences required anything of the Director.
 *   2. The brain answered instead, with transcripts of AI coding sessions in
 *      which an engineer was debugging a different upload failure days before.
 *      It cited their slugs, so a stale dev log read as a verified check.
 */

const SCENT_SELL = { brandSlug: 'scent-sell' }

function requiresMediaEvidence(request: string, mediaInThread: boolean) {
  const plan = planDirectorTask(request, { ...SCENT_SELL, mediaInThread })
  return plan.requirements.some(
    (r) => r.capability === 'video_evidence' && (r.requiredAnyToolNames ?? []).includes('query_media'),
  )
}

test('the two messages that got a fabricated answer now demand a real check', () => {
  for (const asked of ['WHen IS IT FINISHING PROCESSING', 'check now', 'check video']) {
    assert.equal(
      requiresMediaEvidence(asked, true),
      true,
      `"${asked}" let the Director answer about the library without looking at it`,
    )
  }
})

test('a media question stands on its own, with no thread to lean on', () => {
  // Naming the thing is enough; this must not depend on the caller knowing
  // there is media about.
  assert.equal(requiresMediaEvidence('has my video uploaded yet', false), true)
  assert.equal(requiresMediaEvidence('did the clip come through', false), true)
  assert.equal(requiresMediaEvidence('is that file processed', false), true)
})

test('ordinary conversation is not made to pay for a specialist', () => {
  // The cost of getting this wrong is a video department call on every message.
  for (const asked of [
    'write me three hooks for Instagram',
    'what did we decide about pricing',
    'who are our competitors in Australia',
    'make the caption shorter',
  ]) {
    assert.equal(
      requiresMediaEvidence(asked, true),
      false,
      `"${asked}" is not about media and must not trigger media evidence`,
    )
  }
})

test('the requirement tells the Director the exact thing it got wrong', () => {
  const plan = planDirectorTask('check now', { ...SCENT_SELL, mediaInThread: true })
  const requirement = plan.requirements.find((r) => r.capability === 'video_evidence')

  assert.ok(requirement, 'expected a video_evidence requirement')
  assert.match(
    requirement.summary,
    /never state that a file is missing/i,
    'the summary must forbid the specific claim that was invented',
  )
})

test('the brain stops handing back dev transcripts as evidence', () => {
  // The two pages the Director actually quoted at the owner.
  assert.equal(
    isCitableBrainPage({ slug: 'transcripts/claude-code/justy6674-notrealsmartagency/2026-08-04-37d26522-b01', type: 'transcript' }),
    false,
  )
  assert.equal(
    isCitableBrainPage({ slug: 'graphify-out/2026-08-10/graph_report', type: 'note' }),
    false,
  )
  assert.equal(isCitableBrainPage({ slug: 'src/lib/media/process-pipeline.ts', type: 'code' }), false)
})

test('real knowledge is untouched', () => {
  for (const page of [
    { slug: 'reference/nrs-video-pipeline-architecture', type: 'concept' },
    { slug: 'decisions/2026-04-06-nrs-own-tech-first', type: 'decision' },
    { slug: 'wiki/entities/scentsell', type: 'entity' },
    { slug: 'sessions/2026-07-25-1416-scent-australia', type: 'session' },
  ]) {
    assert.equal(isCitableBrainPage(page), true, `${page.slug} is the owner's own knowledge`)
  }
})

test('the recent-upload window brackets the real timings', () => {
  const now = Date.parse('2026-08-10T07:30:00Z')
  // His upload, 28 minutes before he asked "check now".
  assert.equal(isWithinRecentUploadWindow('2026-08-10T07:02:06.500Z', now), true)
  // The 8 August items the Director mistook for the newest.
  assert.equal(isWithinRecentUploadWindow('2026-08-08T10:27:09.000Z', now), false)
  assert.equal(isWithinRecentUploadWindow(null, now), false)
  assert.equal(isWithinRecentUploadWindow('not a date', now), false)
})
