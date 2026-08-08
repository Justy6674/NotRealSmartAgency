import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  planTighten, remapWords, isWorthTightening, selectFilters,
  MIN_CUT_SECONDS,
} from './tighten'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

/** Words spoken back to back from `start`, no gaps. */
const run = (text: string, start: number): TranscriptionWord[] =>
  text.split(' ').map((word, i) => ({ word, start: start + i * 0.4, end: start + i * 0.4 + 0.35 }))

test('dead air at the front and back is dropped', () => {
  // Four seconds finding the record button, three reaching for the phone.
  const plan = planTighten(run('Hello it is Justin', 4), { durationSeconds: 12 })
  assert.ok(plan.segments[0].start > 3.5 && plan.segments[0].start < 4,
    `should start just before the first word, got ${plan.segments[0].start}`)
  assert.ok(plan.segments[plan.segments.length - 1].end < 6,
    'the trailing dead air must go')
  assert.ok(plan.secondsRemoved > 6)
})

test('a long gap mid-clip becomes a beat, not a hard join', () => {
  const words = [...run('Ghost sellers everywhere', 0), ...run('No structure at all', 6)]
  const plan = planTighten(words, { durationSeconds: 8 })
  assert.equal(plan.cuts, 1)
  assert.equal(plan.segments.length, 2)
  // Speech with every pause deleted sounds like a hostage video.
  const beat = plan.segments[1].start - plan.segments[0].end
  assert.ok(beat > 0, 'a cut must leave the speaker a moment to breathe')
})

test('a cut too short to notice is not made at all', () => {
  // A fifth of a second removed reads as a glitch, not as editing.
  const words = [
    { word: 'One', start: 0, end: 0.4 },
    { word: 'two', start: 0.4 + MIN_CUT_SECONDS * 0.8, end: 1.2 },
  ]
  const plan = planTighten(words, { gapSeconds: 0.1, durationSeconds: 2 })
  assert.equal(plan.cuts, 0, 'a sub-threshold cut is a fault, not an edit')
  assert.equal(plan.segments.length, 1)
})

test('normal conversational pauses are left alone', () => {
  // 0.45s between phrases is how people talk, not dead air.
  const words = [
    { word: 'Fragrance', start: 0, end: 0.5 },
    { word: 'groups', start: 0.95, end: 1.4 },
    { word: 'are', start: 1.85, end: 2.1 },
    { word: 'a', start: 2.5, end: 2.6 },
    { word: 'gamble', start: 3.0, end: 3.6 },
  ]
  const plan = planTighten(words, { durationSeconds: 4 })
  assert.equal(plan.cuts, 0, 'cutting every natural pause would make this unwatchable')
})

test('segments never overlap and always move forward', () => {
  const words = [...run('One', 0), ...run('Two', 5), ...run('Three', 11), ...run('Four', 20)]
  const plan = planTighten(words, { durationSeconds: 25 })
  assert.ok(plan.cuts >= 3)
  for (let i = 0; i < plan.segments.length; i += 1) {
    assert.ok(plan.segments[i].end > plan.segments[i].start, 'a segment must have length')
    if (i > 0) assert.ok(plan.segments[i].start >= plan.segments[i - 1].end, 'segments must not overlap')
  }
})

test('CAPTIONS STAY IN SYNC: word timings move onto the new clock', () => {
  // Without remapping, captions drift further out with every cut — by the end
  // the words on screen belong to a sentence said ten seconds earlier, and
  // checking the first few seconds would say it was fine.
  const words = [...run('Ghost sellers', 0), ...run('No structure', 10)]
  const plan = planTighten(words, { durationSeconds: 12 })
  const moved = remapWords(words, plan.segments)

  assert.equal(moved.length, words.length, 'no spoken word may be lost')
  // "No" was at 10s in the original; after ~9s of dead air is cut it must not
  // still be at 10s in a clip that is now only ~2s long.
  const no = moved.find((w) => w.word === 'No')!
  assert.ok(no.start < 2.5, `caption would appear ${no.start.toFixed(1)}s in, far too late`)
  // And the last word must land inside the tightened clip, not past its end.
  const last = moved[moved.length - 1]
  assert.ok(last.end <= plan.tightenedSeconds + 0.01,
    `last caption ends at ${last.end.toFixed(2)}s but the clip is ${plan.tightenedSeconds.toFixed(2)}s`)
})

test('remapped timings stay in order and keep their spacing within a phrase', () => {
  const words = [...run('One two three', 0), ...run('Four five six', 9)]
  const moved = remapWords(words, planTighten(words, { durationSeconds: 11 }).segments)
  for (let i = 1; i < moved.length; i += 1) {
    assert.ok(moved[i].start >= moved[i - 1].start, 'words must not reorder')
    assert.ok(moved[i].end > moved[i].start, 'a word must have duration')
  }
  // Within one phrase the rhythm is untouched — only the gap between them went.
  const originalSpacing = words[1].start - words[0].start
  assert.ok(Math.abs((moved[1].start - moved[0].start) - originalSpacing) < 0.001)
})

test('a clip with no speech is not edited into nothing', () => {
  const plan = planTighten([], { durationSeconds: 10 })
  assert.equal(plan.segments.length, 0)
  assert.equal(plan.cuts, 0)
  assert.equal(isWorthTightening(plan), false, 'there is nothing here to tighten')
})

test('a tidy clip is left alone rather than re-encoded for nothing', () => {
  const plan = planTighten(run('Already tight and well shot', 0.2), { durationSeconds: 2.4 })
  assert.equal(isWorthTightening(plan), false,
    're-encoding to save under two seconds costs a generation of quality for nothing')
})

test('the filter keeps the picture and sound on the same clock', () => {
  const { video, audio } = selectFilters([{ start: 1, end: 2 }, { start: 5, end: 6.5 }])
  assert.match(video, /between\(t,1\.000,2\.000\)\+between\(t,5\.000,6\.500\)/)
  // Skip the re-stamp and the output freezes for the length of every cut.
  assert.match(video, /setpts=N\/FRAME_RATE\/TB$/)
  assert.match(audio, /asetpts=N\/SR\/TB$/)
  // ffmpeg's silenceremove only touches audio; the sound would race ahead.
  assert.ok(!video.includes('silenceremove') && !audio.includes('silenceremove'))
})
