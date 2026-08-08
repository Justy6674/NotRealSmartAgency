/**
 * Cut the dead air out of a talking-head clip.
 *
 * The reason a phone video sits unposted is almost never the content. It is
 * that the first four seconds are someone finding the record button, there are
 * two-second gaps between every thought, and the last three seconds are an arm
 * reaching for the phone. Trimming that by hand is ten minutes in an editor
 * nobody opens, so the clip is never posted at all. Scheduled and slightly
 * rough beats polished and a fortnight late.
 *
 * The usual tools for this — auto-editor, and the many ffmpeg wrappers around
 * it — work by measuring loudness and guessing where the speech is. We do not
 * have to guess. Deepgram already gives us the start and end of every word,
 * and we already store them for captions. A gap between two words IS silence,
 * exactly, with no threshold to tune and nothing to get wrong on a windy
 * balcony or a quiet room.
 *
 * Pure. Given words, it produces a cut plan — so the rules that decide whether
 * an edit looks deliberate or looks broken can actually be tested.
 */

import type { TranscriptionWord } from '@/lib/transcription/transcribe'

/** A gap longer than this is dead air worth cutting. */
export const DEFAULT_GAP_SECONDS = 0.7
/**
 * What a cut gap is shortened TO, rather than removed entirely.
 *
 * Speech with every pause deleted is exhausting and sounds like a hostage
 * video. Leaving a beat is what makes it read as an edit rather than a fault.
 */
export const DEFAULT_KEPT_PAUSE_SECONDS = 0.22
/**
 * Below this, a cut is not worth making.
 *
 * Removing a fifth of a second reads as a glitch in the footage, not as
 * editing — the speaker's head jumps and nothing was gained.
 */
export const MIN_CUT_SECONDS = 0.35
/** A word's timing is the sound, not the mouth opening. Breathe around it. */
export const EDGE_PADDING_SECONDS = 0.12

export interface KeptSegment {
  start: number
  end: number
}

export interface TightenPlan {
  segments: KeptSegment[]
  originalSeconds: number
  tightenedSeconds: number
  secondsRemoved: number
  cuts: number
}

export interface TightenOptions {
  gapSeconds?: number
  keptPauseSeconds?: number
  /** Total clip length. Trailing dead air cannot be found without it. */
  durationSeconds?: number
}

/**
 * Work out which stretches of the clip to keep.
 *
 * Everything before the first word and after the last is dropped except a
 * moment of lead-in, because a clip that starts exactly on the first syllable
 * feels clipped.
 */
export function planTighten(
  words: readonly TranscriptionWord[],
  {
    gapSeconds = DEFAULT_GAP_SECONDS,
    keptPauseSeconds = DEFAULT_KEPT_PAUSE_SECONDS,
    durationSeconds,
  }: TightenOptions = {},
): TightenPlan {
  const spoken = words.filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end))
  const originalSeconds = Math.max(
    durationSeconds ?? 0,
    spoken.length > 0 ? spoken[spoken.length - 1].end : 0,
  )

  if (spoken.length === 0) {
    return { segments: [], originalSeconds, tightenedSeconds: 0, secondsRemoved: originalSeconds, cuts: 0 }
  }

  const segments: KeptSegment[] = []
  let segmentStart = Math.max(0, spoken[0].start - EDGE_PADDING_SECONDS)
  let cuts = 0

  for (let i = 1; i < spoken.length; i += 1) {
    const gap = spoken[i].start - spoken[i - 1].end
    if (gap <= gapSeconds) continue

    // Keep a beat on each side of the cut rather than butting the words up.
    const keepBefore = spoken[i - 1].end + keptPauseSeconds / 2
    const keepAfter = spoken[i].start - keptPauseSeconds / 2
    if (keepAfter - keepBefore < MIN_CUT_SECONDS) continue

    segments.push({ start: segmentStart, end: keepBefore })
    segmentStart = keepAfter
    cuts += 1
  }

  const lastWordEnd = spoken[spoken.length - 1].end
  segments.push({
    start: segmentStart,
    end: durationSeconds
      ? Math.min(durationSeconds, lastWordEnd + EDGE_PADDING_SECONDS)
      : lastWordEnd + EDGE_PADDING_SECONDS,
  })

  const tightenedSeconds = segments.reduce((total, s) => total + (s.end - s.start), 0)
  return {
    segments,
    originalSeconds,
    tightenedSeconds,
    secondsRemoved: Math.max(0, originalSeconds - tightenedSeconds),
    cuts,
  }
}

/**
 * Move the word timings onto the tightened clip's clock.
 *
 * Without this, captions burnt after a tighten drift further out of sync with
 * every cut — by the end of the clip the words on screen belong to a sentence
 * said ten seconds earlier. The failure grows silently through the video, so
 * checking the first few seconds would say it was fine.
 *
 * A word inside a removed stretch is dropped: it is not in the clip any more.
 */
export function remapWords(
  words: readonly TranscriptionWord[],
  segments: readonly KeptSegment[],
): TranscriptionWord[] {
  const remapped: TranscriptionWord[] = []
  // How much kept time precedes each segment — a word's new time is its offset
  // into its own segment, plus everything kept before it.
  let elapsed = 0

  for (const segment of segments) {
    for (const word of words) {
      // A word must sit within the segment to survive it. Its own start is the
      // anchor; a word straddling a cut boundary is clamped rather than lost.
      if (word.start < segment.start || word.start >= segment.end) continue
      const start = elapsed + (word.start - segment.start)
      const end = elapsed + (Math.min(word.end, segment.end) - segment.start)
      remapped.push({ ...word, start, end: Math.max(end, start + 0.01) })
    }
    elapsed += segment.end - segment.start
  }

  return remapped
}

/**
 * Whether the edit is worth making.
 *
 * Re-encoding a video to save a second is a minute of compute and a generation
 * of quality for a change nobody would notice.
 */
export function isWorthTightening(plan: TightenPlan): boolean {
  return plan.cuts > 0 && plan.secondsRemoved >= 1.5
}

/**
 * The ffmpeg filter expression that keeps only these stretches.
 *
 * One pass, no intermediate files. `select` drops the frames outside the kept
 * stretches and `setpts` re-stamps what is left onto a continuous clock — skip
 * the re-stamp and the output carries the original timestamps, which players
 * show as a video that freezes for the length of every cut.
 *
 * ffmpeg's own `silenceremove` filter is not an option here: it only works on
 * audio and leaves the video untouched, so the sound races ahead of the
 * picture.
 */
export function selectFilters(segments: readonly KeptSegment[]): { video: string; audio: string } {
  const round = (n: number) => n.toFixed(3)
  const expression = segments
    .map((s) => `between(t,${round(s.start)},${round(s.end)})`)
    .join('+')

  return {
    video: `select='${expression}',setpts=N/FRAME_RATE/TB`,
    audio: `aselect='${expression}',asetpts=N/SR/TB`,
  }
}
