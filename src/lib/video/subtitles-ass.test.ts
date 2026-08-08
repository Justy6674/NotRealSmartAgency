import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAss, formatAssTime, styleForFrame, SUBTITLE_FONT_NAME } from './subtitles'
import { escapeFilterPath, FONTS_DIR } from './burn-subtitles'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

const say = (text: string, start = 0): TranscriptionWord[] =>
  text.split(' ').map((word, i) => ({ word, start: start + i * 0.4, end: start + i * 0.4 + 0.3 }))

test('ASS timings are centiseconds with a single-digit hour', () => {
  assert.equal(formatAssTime(0), '0:00:00.00')
  assert.equal(formatAssTime(65.25), '0:01:05.25')
  assert.equal(formatAssTime(3725.5), '1:02:05.50')
  assert.equal(formatAssTime(-1), '0:00:00.00')
})

test('the script canvas matches the video, so pixel numbers mean pixels', () => {
  // libass otherwise scales against a 384x288 default and the captions come
  // out microscopic or enormous. This is the whole reason for writing ASS.
  const ass = buildAss(say('Hey it is Justin.'), 1080, 1920)
  assert.match(ass, /^PlayResX: 1080$/m)
  assert.match(ass, /^PlayResY: 1920$/m)
})

test('captions clear the rails Instagram and TikTok put over the frame', () => {
  const style = styleForFrame(1080, 1920)
  // Instagram lays its caption and engagement rail over ~the bottom 420px.
  assert.ok(style.marginVertical >= 400, `too low, under the rail: ${style.marginVertical}`)
  // And it must not float into the middle of the picture either.
  assert.ok(style.marginVertical <= 520, `too high, floating: ${style.marginVertical}`)
  // TikTok's button rail runs up the right-hand side.
  assert.ok(style.marginSide >= 140, `too wide, under the buttons: ${style.marginSide}`)
  // Big enough to read at arm's length, muted, on a phone.
  assert.ok(style.fontSize >= 56 && style.fontSize <= 72, `unreadable size: ${style.fontSize}`)
})

test('a square or landscape clip is not styled with vertical numbers', () => {
  const portrait = styleForFrame(1080, 1920)
  const landscape = styleForFrame(1920, 1080)
  // No engagement rail on landscape — sitting it 420px up would float it.
  assert.ok(landscape.marginVertical < portrait.marginVertical)
  // But the text stays the same physical size relative to the screen.
  assert.equal(landscape.fontSize, portrait.fontSize)
  const square = styleForFrame(1080, 1080)
  assert.ok(square.marginVertical > 0 && square.marginSide > 0)
})

test('an outline, never a box, and never a stray drop shadow', () => {
  const ass = buildAss(say('Hey it is Justin.'), 1080, 1920)
  const style = ass.split('\n').find((line) => line.startsWith('Style: Caption'))!
  const fields = style.replace('Style: ', '').split(',')
  // Format order: Name,Fontname,Fontsize,Primary,Secondary,Outline,Back,Bold,
  // Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,
  // Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
  assert.equal(fields[1], SUBTITLE_FONT_NAME)
  assert.equal(fields[7], '-1', 'bold')
  assert.equal(fields[15], '1', 'BorderStyle 1 = outline; 3 would blank out a strip of the picture')
  assert.ok(Number(fields[16]) >= 2, 'the outline must be thick enough to hold up over a bright frame')
  assert.equal(fields[17], '0', 'no drop shadow')
  assert.equal(fields[18], '2', 'bottom centre')
})

test('colours are ASS &HAABBGGRR, not RGB written hopefully', () => {
  const ass = buildAss(say('Hey.'), 1080, 1920)
  for (const colour of ass.match(/&H[0-9A-F]{8}/g) ?? []) {
    assert.match(colour, /^&H00[0-9A-F]{6}$/, 'must be opaque')
  }
  // White and black are palindromic in either order, so assert the real risk:
  // that a future edit writes a brand colour as #RRGGBB and gets it reversed.
  assert.ok(!ass.includes('#'), 'an RGB hex here would render as the wrong colour')
})

test('a line break inside a cue cannot corrupt the file', () => {
  const words = [{ word: 'Ghost\nsellers', start: 0, end: 1 }]
  const ass = buildAss(words, 1080, 1920)
  const dialogue = ass.split('\n').filter((line) => line.startsWith('Dialogue:'))
  assert.equal(dialogue.length, 1, 'a raw newline would split this into a broken second line')
  assert.match(dialogue[0], /Ghost\\Nsellers/)
})

test('no speech produces no file, rather than an empty one', () => {
  assert.equal(buildAss([], 1080, 1920), '')
})

test('a path with a colon cannot break out of the filtergraph', () => {
  // ffmpeg parses the filtergraph before touching the filesystem, so an
  // unescaped colon reads as an argument separator and the file is "missing".
  assert.equal(escapeFilterPath('/tmp/a:b/c.ass'), '/tmp/a\\:b/c.ass')
  assert.equal(escapeFilterPath("C:\\fonts\\o'n"), "C\\:/fonts/o\\'n")
})

test('the bundled font is actually there', () => {
  // A server has no fonts of its own. Delete this file and libass does not
  // fail — it renders a video with no captions on it and reports success.
  const path = join(FONTS_DIR, 'Inter-Bold.ttf')
  assert.ok(existsSync(path), `${path} is missing — captions would render blank`)
  const header = readFileSync(path).subarray(0, 4)
  assert.ok(
    header.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) || header.toString('latin1') === 'true',
    'not a TrueType file — a woff2 from a web font package will not load here',
  )
})
