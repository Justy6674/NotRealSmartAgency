/**
 * Server-side video thumbnail extraction via ffmpeg-static.
 *
 * Two entry points:
 * - extractFirstFrame(buffer)    — used when we already have the file in memory
 *                                  (e.g. HeyGen webhook rehost after downloading the CDN file)
 * - extractFirstFrameFromUrl(url) — used by the background media processor to
 *                                   grab a thumb from any video already in Supabase Storage
 *                                   WITHOUT downloading the whole file. ffmpeg streams over
 *                                   HTTPS and decodes just enough bytes for frame 1.
 *
 * Vercel Node runtime requirement: do not import this from Edge routes.
 */

import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { writeFile, readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

const FFMPEG_TIMEOUT_MS = 30_000

/**
 * Extract the first frame (at 1s) from a video buffer.
 * Returns a JPEG buffer suitable for uploading to Supabase Storage.
 *
 * Works by writing the input to a temp file, running ffmpeg, reading the output,
 * then cleaning up. Avoids streaming complexity for webhook-sized videos (<100MB).
 */
export async function extractFirstFrame(videoBuffer: Buffer, fileName = 'video.mp4'): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'nrs-thumb-'))
  const inputPath = join(dir, fileName)
  const outputPath = join(dir, 'thumb.jpg')

  await writeFile(inputPath, videoBuffer)

  try {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .on('error', reject)
        .on('end', () => resolve())
        .screenshots({
          timestamps: ['1'], // 1 second in — skips blank intros on most videos
          filename: 'thumb.jpg',
          folder: dir,
          size: '720x?', // max width 720px, maintain aspect
        })

      setTimeout(() => {
        try { command.kill('SIGKILL') } catch { /* ignore */ }
        reject(new Error(`ffmpeg timeout after ${FFMPEG_TIMEOUT_MS}ms`))
      }, FFMPEG_TIMEOUT_MS)
    })

    const thumbBuffer = await readFile(outputPath)
    return thumbBuffer
  } finally {
    // Best-effort cleanup
    await Promise.all([unlink(inputPath).catch(() => {}), unlink(outputPath).catch(() => {})])
  }
}

/**
 * Extract the first frame from a video at a public HTTPS URL.
 *
 * ffmpeg streams the file over HTTPS and only reads enough bytes to decode
 * the requested frame — tens of KB to a few MB for a typical video, regardless
 * of the total file size. Safe for 500MB uploads on Vercel's serverless runtime.
 *
 * Uses a seek-before-input (`-ss` before `-i`) which is the fast-seek path
 * in ffmpeg — does not scan the whole file looking for keyframes.
 */
export async function extractFirstFrameFromUrl(videoUrl: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'nrs-thumb-'))
  const outputPath = join(dir, 'thumb.jpg')

  try {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg()
        // Fast-seek: move to 1s BEFORE decoding. Order matters — this is the
        // input-side -ss, which streams only the bytes needed around that point.
        .inputOptions(['-ss', '1', '-rw_timeout', '15000000']) // rw_timeout = 15s in microseconds
        .input(videoUrl)
        .outputOptions([
          '-frames:v', '1',
          '-vf', 'scale=720:-1', // cap width at 720, maintain aspect
          '-q:v', '3',           // good quality JPEG
          '-f', 'image2',
        ])
        .output(outputPath)
        .on('error', reject)
        .on('end', () => resolve())

      command.run()

      setTimeout(() => {
        try { command.kill('SIGKILL') } catch { /* ignore */ }
        reject(new Error(`ffmpeg timeout after ${FFMPEG_TIMEOUT_MS}ms`))
      }, FFMPEG_TIMEOUT_MS)
    })

    return await readFile(outputPath)
  } finally {
    await unlink(outputPath).catch(() => {})
  }
}
