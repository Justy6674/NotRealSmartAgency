/**
 * Burnt-in captions for social video.
 *
 * Most social video is watched with the sound off, so captions are not a
 * finishing touch — they are whether the video works at all. Relying on the
 * platform is not an option: TikTok and Instagram generate captions in their
 * own apps and expose no way to ask for them through an API, so a video
 * uploaded by a scheduler arrives with none.
 *
 * The timings needed to make them were already in every Deepgram response and
 * were being thrown away. This turns them into subtitle cues.
 *
 * Pure. Given words and timings, it produces SRT text — no ffmpeg, no network,
 * so the line-breaking rules that decide whether captions are readable can
 * actually be tested.
 */

import type { TranscriptionWord } from '@/lib/transcription/transcribe'

/**
 * Two lines at a time, short ones.
 *
 * Social video is watched on a phone held in one hand. Long lines get cropped
 * by the platform's own UI — the caption bar, the username, the buttons — so
 * a cue that reads fine on a laptop is half-hidden on the device it is for.
 */
export const MAX_CHARS_PER_CUE = 42
/** Below this, a cue flashes past before it can be read. */
export const MIN_CUE_SECONDS = 1.0
/** Above this, a cue sits on screen long after the speaker moved on. */
export const MAX_CUE_SECONDS = 5.0

export interface SubtitleCue {
  index: number
  start: number
  end: number
  text: string
}

/** SRT wants HH:MM:SS,mmm. */
export function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = Math.floor(safe % 60)
  const millis = Math.round((safe - Math.floor(safe)) * 1000)
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`
}

/**
 * Group words into readable cues.
 *
 * Breaks on sentence endings first, because a caption that splits mid-sentence
 * reads as two half-thoughts. Otherwise on length, and on any gap in speech —
 * a pause is where a human would break, and following it keeps the captions in
 * step with how the sentence was actually said.
 */
export function buildCues(
  words: readonly TranscriptionWord[],
  {
    maxChars = MAX_CHARS_PER_CUE,
    maxSeconds = MAX_CUE_SECONDS,
    gapSeconds = 0.6,
  }: { maxChars?: number; maxSeconds?: number; gapSeconds?: number } = {},
): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  let current: TranscriptionWord[] = []

  const flush = () => {
    if (current.length === 0) return
    const text = current.map((w) => w.word).join(' ').trim()
    if (!text) { current = []; return }

    const start = current[0].start
    // Hold a very short cue on screen a moment longer, or it flashes past.
    const end = Math.max(current[current.length - 1].end, start + MIN_CUE_SECONDS)
    cues.push({ index: cues.length + 1, start, end, text })
    current = []
  }

  for (const [position, word] of words.entries()) {
    const previous = current[current.length - 1]
    const gap = previous ? word.start - previous.end : 0
    const wouldBe = [...current.map((w) => w.word), word.word].join(' ')
    const span = current.length > 0 ? word.end - current[0].start : 0

    // A pause, an over-long line, or an over-long cue all end the current one.
    if (current.length > 0 && (gap >= gapSeconds || wouldBe.length > maxChars || span > maxSeconds)) {
      flush()
    }

    current.push(word)

    // End of a sentence is the most natural break there is.
    if (/[.!?]$/.test(word.word) && position < words.length - 1) flush()
  }

  flush()
  return cues
}

/** The cues as an SRT file. */
export function buildSrt(words: readonly TranscriptionWord[]): string {
  const cues = buildCues(words)
  if (cues.length === 0) return ''

  return cues
    .map((cue) => `${cue.index}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`)
    .join('\n')
}

/**
 * Whether captions can be made for this clip at all.
 *
 * Said plainly so a caller reports "no speech was detected" rather than
 * quietly producing an empty subtitle track and calling it done.
 */
export function canCaption(words: readonly TranscriptionWord[] | undefined): boolean {
  return Array.isArray(words) && words.length > 0
}

/**
 * ── WHERE ON SCREEN, AND IN WHAT ─────────────────────────────────────────────
 *
 * Both of these are measurements, not taste, because both have a wrong answer
 * that is invisible on a laptop and obvious on a phone.
 *
 * WHERE. The bottom of a Reel is not ours. Instagram and Facebook lay their own
 * caption and engagement rail over roughly the bottom 420px of a 1080×1920
 * frame, and TikTok puts the handle and description bottom-left with a button
 * rail up the right. Text placed at a comfortable-looking 80px from the bottom
 * sits underneath all of it. So the caption band is ~420px up from the bottom,
 * in a centred column narrow enough to clear the right-hand rail — the same
 * safe rectangle every social team draws on their templates.
 *
 * IN WHAT. White, bold, with a thick black OUTLINE and no box. A box is the
 * obvious way to guarantee contrast and it is why burnt-in captions usually
 * look like a DVD: it blanks out a strip of the picture whether the picture
 * needed it or not. An outline gives the same legibility over a bright sky or
 * a dark room and covers nothing. Sentence case, not caps — caps are a look,
 * lowercase is faster to read, and this is text nobody chose to read.
 *
 * Everything is expressed as a fraction of the frame so a square or landscape
 * clip is not captioned with numbers derived from a vertical one.
 */

/** Of the short edge. Large enough to read at arm's length on a phone. */
const FONT_SIZE_RATIO = 0.059
/** Of the height, on portrait: clears Instagram's caption and engagement rail. */
const PORTRAIT_BOTTOM_RATIO = 0.219
/** Landscape and square have no such rail; sit the text just off the edge. */
const OTHER_BOTTOM_RATIO = 0.08
/** Of the width, each side: clears TikTok's right-hand button rail. */
const SIDE_MARGIN_RATIO = 0.139
/** Of the short edge. Thick enough to hold up over a bright, busy frame. */
const OUTLINE_RATIO = 0.0037

/** The font shipped with the app. Servers have no fonts of their own. */
export const SUBTITLE_FONT_NAME = 'Inter'

export interface SubtitleStyle {
  fontSize: number
  marginVertical: number
  marginSide: number
  outline: number
}

/** The style for a given frame, in real pixels. */
export function styleForFrame(width: number, height: number): SubtitleStyle {
  const shortEdge = Math.min(width, height)
  const portrait = height > width
  return {
    fontSize: Math.round(shortEdge * FONT_SIZE_RATIO),
    marginVertical: Math.round(height * (portrait ? PORTRAIT_BOTTOM_RATIO : OTHER_BOTTOM_RATIO)),
    marginSide: Math.round(width * SIDE_MARGIN_RATIO),
    outline: Math.max(2, Math.round(shortEdge * OUTLINE_RATIO)),
  }
}

/** ASS wants H:MM:SS.cc — centiseconds, and a single-digit hour. */
export function formatAssTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = Math.floor(safe % 60)
  const centis = Math.round((safe - Math.floor(safe)) * 100)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${hours}:${pad(minutes)}:${pad(secs)}.${pad(Math.min(99, centis))}`
}

/**
 * The cues as an ASS subtitle file, styled and positioned for this frame.
 *
 * ASS rather than SRT because SRT carries no styling, so ffmpeg would fall
 * back to libass's defaults — and those are sized against a 384×288 script
 * canvas from the 2000s. Captions burnt that way come out either microscopic
 * or enormous, depending on the clip, which is exactly the kind of fault that
 * looks fine in a test and is humiliating in public. PlayResX/PlayResY are
 * written explicitly so every number above means the pixels it says.
 */
export function buildAss(
  words: readonly TranscriptionWord[],
  width: number,
  height: number,
): string {
  const cues = buildCues(words)
  if (cues.length === 0) return ''

  const style = styleForFrame(width, height)

  // ASS colours are &HAABBGGRR — alpha first, then BLUE, green, red. Written
  // as if it were RGB you get the right white and a blue-tinted outline.
  const white = '&H00FFFFFF'
  const black = '&H00000000'

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${Math.round(width)}`,
    `PlayResY: ${Math.round(height)}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,'
      + ' Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline,'
      + ' Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // BorderStyle 1 = outline, not a box. Shadow 0 — an outline this thick does
    // the work, and a drop shadow on top reads as amateur.
    // Alignment 2 = bottom centre.
    `Style: Caption,${SUBTITLE_FONT_NAME},${style.fontSize},${white},${white},${black},${black},`
      + `-1,0,0,0,100,100,0,0,1,${style.outline},0,2,`
      + `${style.marginSide},${style.marginSide},${style.marginVertical},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n')

  const events = cues.map((cue) =>
    `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Caption,,0,0,0,,`
      // A literal newline would end the event line and corrupt the file.
      + cue.text.replace(/\r?\n/g, '\\N'))

  return `${header}\n${events.join('\n')}\n`
}
