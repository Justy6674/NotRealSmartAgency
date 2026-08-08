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
