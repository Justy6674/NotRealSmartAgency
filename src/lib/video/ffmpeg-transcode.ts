/**
 * Make a video small enough for a social platform to actually accept.
 *
 * A phone shoots 1080×1920 H.264 at ~10 Mbps, which is a perfectly legal file
 * and roughly twice what Instagram wants. Nothing rejects it for format — the
 * failure comes later and looks unrelated: Instagram does not receive an
 * upload, it FETCHES the URL and transcodes its end, and a 300 MB pull fails
 * with "Media upload has failed with error code 2207082" after the caption,
 * the draft and the Mixpost sync have all reported success.
 *
 * So the original is never the file that gets published. It stays untouched in
 * the library as the master, and this produces a delivery copy beside it.
 *
 * Vercel Node runtime only — ffmpeg-static is a native binary.
 */

import { ffmpegBinary } from './ffmpeg-path'
import ffmpeg from 'fluent-ffmpeg'
import { readFile, unlink, mkdtemp, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ffmpegPath = ffmpegBinary()
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

/**
 * Above this, a platform fetch is at risk. Meta's hard ceiling is far higher,
 * but the fetch — not the ceiling — is what fails in practice.
 */
export const DELIVERY_MAX_BYTES = 80 * 1024 * 1024

/** Comfortably inside every platform's guidance for 1080p vertical video. */
const TARGET_VIDEO_BITRATE = '4500k'
const TARGET_AUDIO_BITRATE = '128k'

/** Long enough for a few minutes of 1080p, short enough to fail before the platform does. */
const TRANSCODE_TIMEOUT_MS = 240_000

export interface TranscodeResult {
  buffer: Buffer
  bytes: number
}

/**
 * Decide whether a video needs a delivery copy at all.
 *
 * Re-encoding costs time and loses a generation of quality, so a file that is
 * already small enough is left exactly as it is.
 */
export function needsDeliveryCopy(fileType: string | null, sizeBytes: number | null): boolean {
  if (!fileType?.startsWith('video/')) return false
  return (sizeBytes ?? 0) > DELIVERY_MAX_BYTES
}

/**
 * Stream the source from its URL and write a platform-ready MP4.
 *
 * Streamed rather than downloaded: the master can be 300 MB and holding that
 * in memory on top of the encode is how a serverless function dies.
 *
 * `faststart` moves the index to the front of the file so a platform can begin
 * processing without pulling the whole thing first — the single most useful
 * flag here, given the failure is a fetch that gives up.
 */
export async function transcodeForDeliveryFromUrl(url: string): Promise<TranscodeResult> {
  const dir = await mkdtemp(join(tmpdir(), 'nrs-delivery-'))
  const outputPath = join(dir, 'delivery.mp4')

  try {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(url)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          `-b:v ${TARGET_VIDEO_BITRATE}`,
          `-maxrate ${TARGET_VIDEO_BITRATE}`,
          '-bufsize 9000k',
          '-pix_fmt yuv420p',
          // Never upscale, and keep it within 1080 on the long edge. -2 keeps
          // the other dimension even, which H.264 requires.
          "-vf scale='min(1080,iw)':-2",
          '-r 30',
          `-b:a ${TARGET_AUDIO_BITRATE}`,
          '-ar 44100',
          '-ac 2',
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
        reject(new Error(`ffmpeg transcode timed out after ${TRANSCODE_TIMEOUT_MS}ms`))
      }, TRANSCODE_TIMEOUT_MS)
    })

    const buffer = await readFile(outputPath)
    return { buffer, bytes: buffer.byteLength }
  } finally {
    await unlink(outputPath).catch(() => {})
    await rmdir(dir).catch(() => {})
  }
}
