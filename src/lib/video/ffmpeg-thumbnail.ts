/**
 * Server-side video thumbnail extraction via ffmpeg-static.
 *
 * Used by the HeyGen webhook when rehosting generated videos.
 * Client-side uploads use the browser canvas path in extract-frames-browser.ts.
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

/**
 * Extract the first frame (at 1s, or 0.1s for very short videos) from a video buffer.
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
      ffmpeg(inputPath)
        .on('error', reject)
        .on('end', () => resolve())
        .screenshots({
          timestamps: ['1'], // 1 second in — skips blank intros on most videos
          filename: 'thumb.jpg',
          folder: dir,
          size: '720x?', // max width 720px, maintain aspect
        })
    })

    const thumbBuffer = await readFile(outputPath)
    return thumbBuffer
  } finally {
    // Best-effort cleanup
    await Promise.all([unlink(inputPath).catch(() => {}), unlink(outputPath).catch(() => {})])
  }
}
