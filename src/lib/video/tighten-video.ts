/**
 * Run the tighten plan against the actual file.
 *
 * One ffmpeg pass. The alternative everyone reaches for — cut each kept
 * stretch to its own file, then concat — writes a dozen temp files and drifts
 * out of sync at every join because the audio and video keyframes do not land
 * in the same place.
 *
 * Vercel Node runtime only — ffmpeg-static is a native binary.
 */

import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planTighten, remapWords, selectFilters, isWorthTightening, type TightenPlan } from './tighten'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

const TIGHTEN_TIMEOUT_MS = 240_000

export interface TightenResult {
  buffer: Buffer
  bytes: number
  plan: TightenPlan
  /** The word timings moved onto the tightened clip's clock. */
  words: TranscriptionWord[]
}

/** How long the clip runs, so trailing dead air can be found and dropped. */
export function probeDuration(input: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (error, data) => {
      if (error) return reject(error)
      const seconds = Number(data.format?.duration)
      if (!Number.isFinite(seconds) || seconds <= 0) return reject(new Error('could not read the clip length'))
      resolve(seconds)
    })
  })
}

export async function tightenFromUrl(
  url: string,
  words: readonly TranscriptionWord[],
): Promise<TightenResult> {
  const durationSeconds = await probeDuration(url)
  const plan = planTighten(words, { durationSeconds })

  if (!isWorthTightening(plan)) {
    throw new Error('there is not enough dead air in this clip to be worth re-encoding')
  }

  const dir = await mkdtemp(join(tmpdir(), 'nrs-tighten-'))
  const outputPath = join(dir, 'tightened.mp4')

  try {
    const { video, audio } = selectFilters(plan.segments)

    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(url)
        .videoCodec('libx264')
        // Dropping frames means the video must be re-encoded; the audio is
        // being cut in the same pass so it cannot be copied either.
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          '-crf 21',
          '-pix_fmt yuv420p',
          `-vf ${video}`,
          `-af ${audio}`,
          '-b:a 128k',
          '-movflags +faststart',
        ])
        .on('error', reject)
        .on('end', () => resolve())
        .save(outputPath)

      setTimeout(() => {
        try {
          command.kill('SIGKILL')
        } catch {
          /* already gone */
        }
        reject(new Error(`tightening timed out after ${TIGHTEN_TIMEOUT_MS}ms`))
      }, TIGHTEN_TIMEOUT_MS)
    })

    const buffer = await readFile(outputPath)
    return {
      buffer,
      bytes: buffer.byteLength,
      plan,
      // Captions burnt after this MUST use these, not the originals, or they
      // drift further out of sync with every cut.
      words: remapWords(words, plan.segments),
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
