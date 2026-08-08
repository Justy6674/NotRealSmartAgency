import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCues, buildSrt, canCaption, formatSrtTime, MAX_CHARS_PER_CUE } from './subtitles'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

const say = (text: string, start: number, gap = 0.25): TranscriptionWord[] =>
  text.split(' ').map((word, i) => ({
    word,
    start: start + i * (0.3 + gap),
    end: start + i * (0.3 + gap) + 0.3,
  }))

test('SRT timestamps are in the format the format demands', () => {
  assert.equal(formatSrtTime(0), '00:00:00,000')
  assert.equal(formatSrtTime(3.5), '00:00:03,500')
  assert.equal(formatSrtTime(65.25), '00:01:05,250')
  assert.equal(formatSrtTime(3725.125), '01:02:05,125')
  // A negative timing would produce an unplayable file.
  assert.equal(formatSrtTime(-5), '00:00:00,000')
})

test('a sentence ending breaks the cue, so half-thoughts do not appear alone', () => {
  const words = [...say('Hey it is Justin.', 0), ...say('We are a marketplace.', 3)]
  const cues = buildCues(words)
  assert.ok(cues.length >= 2)
  assert.match(cues[0].text, /Justin\.$/)
})

test('no cue is too long to read on a phone', () => {
  const cues = buildCues(say('this is a long run of words with no punctuation at all in it anywhere', 0))
  for (const cue of cues) {
    assert.ok(cue.text.length <= MAX_CHARS_PER_CUE + 12, `too long to read: "${cue.text}"`)
  }
})

test('a pause in speech ends the cue, matching how it was said', () => {
  const words = [
    { word: 'Ghost', start: 0, end: 0.4 },
    { word: 'sellers', start: 0.4, end: 0.9 },
    // Two seconds of silence — a human would break here.
    { word: 'No', start: 2.9, end: 3.2 },
    { word: 'structure', start: 3.2, end: 3.8 },
  ]
  const cues = buildCues(words)
  assert.equal(cues.length, 2)
  assert.equal(cues[0].text, 'Ghost sellers')
  assert.equal(cues[1].text, 'No structure')
})

test('a one-word cue is held long enough to be read', () => {
  // 0.2s on screen is a flash, not a caption.
  const cues = buildCues([{ word: 'Stop.', start: 1, end: 1.2 }])
  assert.ok(cues[0].end - cues[0].start >= 1, 'a very short cue must be held longer')
})

test('cues never overlap and always move forward', () => {
  const words = [...say('Hey it is Justin.', 0), ...say('Fragrance groups are a gamble.', 4)]
  const cues = buildCues(words)
  for (let i = 1; i < cues.length; i += 1) {
    assert.ok(cues[i].start >= cues[i - 1].start, 'cues must move forward')
    assert.ok(cues[i].end > cues[i].start, 'a cue must have duration')
  }
})

test('the SRT is well-formed and numbered from one', () => {
  const srt = buildSrt(say('Hey it is Justin here.', 0))
  assert.match(srt, /^1\n00:00:00,000 --> /)
  assert.match(srt, /-->/)
  // Every cue: number, timing, text, blank line.
  for (const block of srt.trim().split('\n\n')) {
    const [index, timing, ...text] = block.split('\n')
    assert.match(index, /^\d+$/)
    assert.match(timing, /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/)
    assert.ok(text.join(' ').trim().length > 0, 'a cue must have words')
  }
})

test('a clip with no speech produces nothing, and says so', () => {
  assert.equal(buildSrt([]), '')
  assert.equal(canCaption([]), false)
  assert.equal(canCaption(undefined), false)
  // An empty subtitle track presented as done is worse than an honest no.
  assert.equal(canCaption(say('there are words here', 0)), true)
})
