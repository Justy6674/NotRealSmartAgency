/**
 * Burn the captions into the picture.
 *
 * This has to happen here because there is nowhere else it can. Mixpost is a
 * scheduler with a media library — it publishes the file it is handed and has
 * no subtitle feature at all. TikTok and Instagram will caption a video, but
 * only for someone tapping through their own app; upload the same file through
 * an API and it arrives bare. So a video scheduled from here goes out silent
 * and wordless unless the words are already in the frame.
 *
 * Burnt in, not a sidecar file. A .srt alongside the video is the technically
 * tidy answer and it is useless: no social platform reads one.
 *
 * Vercel Node runtime only — ffmpeg-static is a native binary.
 */

import { ffmpegBinary } from './ffmpeg-path'
import ffmpeg from 'fluent-ffmpeg'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAss, canCaption } from './subtitles'
import { DELIVERY_MAX_BYTES } from './ffmpeg-transcode'
import { bitrateForDuration, AUDIO_BITRATE_KBPS } from './bitrate'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

const ffmpegPath = ffmpegBinary()
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

/**
 * Where the bundled font lives.
 *
 * A server has no fonts installed. Ask libass for a family it cannot find and
 * it does not fail — it silently substitutes whatever it can, or renders
 * nothing, and the first anyone knows is a published video with no captions on
 * it. So the font ships with the app and libass is pointed straight at it.
 */
export const FONTS_DIR = join(process.cwd(), 'assets', 'fonts')

/** Re-encoding a long clip is slow; fail before the platform's own patience does. */
const BURN_TIMEOUT_MS = 240_000

export interface BurnResult {
  buffer: Buffer
  bytes: number
  cueCount: number
}

/**
 * Frame size and length, in one probe.
 *
 * Both are needed and both cost a round trip to the file, which for a 300 MB
 * clip in storage is not free. The length matters as much as the size: it is
 * the only thing that decides whether a capped encode lands under the limit.
 */
export function probeVideo(input: string): Promise<{
  width: number
  height: number
  seconds: number
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (error, data) => {
      if (error) return reject(error)
      const stream = data.streams.find((s) => s.codec_type === 'video')
      const width = Number(stream?.width)
      const height = Number(stream?.height)
      if (!width || !height) return reject(new Error('no video stream to caption'))
      resolve({ width, height, seconds: Number(data.format?.duration) || 0 })
    })
  })
}

/**
 * Escape a path for use inside an ffmpeg filtergraph.
 *
 * A filtergraph is parsed before the filesystem is touched, so a colon in a
 * path splits it into arguments and a backslash escapes the next character.
 * Windows paths and anything with a drive letter break this in ways that read
 * as "file not found" when the file is right there.
 */
export function escapeFilterPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

/**
 * The frame the output will actually have, after the delivery downscale.
 *
 * Long edge capped at 1080, never upscaled, both sides even.
 */
export function scaledFrame(width: number, height: number): { width: number; height: number } {
  if (width <= 1080) return { width: even(width), height: even(height) }
  const scale = 1080 / width
  return { width: 1080, height: even(Math.round(height * scale)) }
}

const even = (n: number) => (n % 2 === 0 ? n : n - 1)

/**
 * Burn captions from the transcript's word timings into a copy of the video.
 *
 * The master is never touched. This produces a new file; the original stays in
 * the library, so a caption that came out wrong costs a re-render and not the
 * footage.
 */
export async function burnSubtitlesFromUrl(
  url: string,
  words: readonly TranscriptionWord[],
): Promise<BurnResult> {
  if (!canCaption(words)) {
    throw new Error('there is no speech in this clip to caption')
  }

  const source = await probeVideo(url)
  // The geometry has to describe the OUTPUT frame, since that is what libass
  // draws into and what the caption margins were measured against.
  const { width, height } = scaledFrame(source.width, source.height)
  const ass = buildAss(words, width, height)
  if (!ass) throw new Error('there is no speech in this clip to caption')

  // A flat ceiling cannot know how long the clip runs. 4500 kbps is right for
  // thirty seconds and produced 93 MB from two and a half minutes — over the
  // limit, and back to the fetch failure this was meant to prevent.
  const rate = bitrateForDuration(source.seconds, DELIVERY_MAX_BYTES)

  const dir = await mkdtemp(join(tmpdir(), 'nrs-captions-'))
  const assPath = join(dir, 'captions.ass')
  const outputPath = join(dir, 'captioned.mp4')

  try {
    await writeFile(assPath, ass, 'utf8')

    await new Promise<void>((resolve, reject) => {
      // Scale FIRST, then caption, so the caption is measured against the
      // frame it will actually be shown at. Captioning a 4K frame and then
      // shrinking it makes the words a third of the size they were designed to
      // be. Never upscales; -2 keeps the other side even, which H.264 needs.
      const filter = "scale='min(1080,iw)':-2,"
        + `subtitles=filename='${escapeFilterPath(assPath)}'`
        + `:fontsdir='${escapeFilterPath(FONTS_DIR)}'`

      const command = ffmpeg(url)
        .videoCodec('libx264')
        // Re-encoded rather than copied: the size budget above counts the
        // audio, and a copied track carries whatever bitrate the phone chose,
        // which on some handsets is most of the budget on its own.
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          // Delivery-grade, not archive-grade.
          //
          // This copy is the one that PUBLISHES — it outranks the delivery
          // copy precisely because it carries work the owner asked for. At
          // crf 21 with no ceiling a one-minute phone clip came out at 103 MB,
          // which is the exact size Instagram's fetch gives up on with "error
          // code 2207082" long after the draft looked fine. The master is
          // untouched in the library; this one has a platform to satisfy.
          `-b:v ${rate.videoKbps}k`,
          `-maxrate ${rate.videoKbps}k`,
          `-bufsize ${rate.videoKbps * 2}k`,
          `-b:a ${AUDIO_BITRATE_KBPS}k`,
          '-pix_fmt yuv420p',
          `-vf ${filter}`,
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
        reject(new Error(`captioning timed out after ${BURN_TIMEOUT_MS}ms`))
      }, BURN_TIMEOUT_MS)
    })

    const buffer = await readFile(outputPath)
    if (!rate.fits) {
      console.warn(
        `[captions] ${Math.round(source.seconds)}s is too long to fit under`
        + ` ${DELIVERY_MAX_BYTES / 1048576} MB at a watchable bitrate — ${(buffer.byteLength / 1048576).toFixed(1)} MB`,
      )
    }
    return {
      buffer,
      bytes: buffer.byteLength,
      cueCount: ass.split('\n').filter((line) => line.startsWith('Dialogue:')).length,
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
