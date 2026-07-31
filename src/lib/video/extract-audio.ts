import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { mkdtemp, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Pull the audio track out of a video that lives at a public HTTPS URL.
 *
 * Transcription was gated on the size of the *video*, which is the wrong
 * measurement: the transcriber only ever receives audio. A three-minute clip
 * filmed on a phone is 241MB of mostly pixels and 2.2MB of speech, so every
 * real video the owner shot was refused with "file too large" while the part
 * that mattered would have sailed through.
 *
 * The audio is copied, not re-encoded — no quality decision, no CPU burnt on
 * a transcode, and it finishes in seconds because ffmpeg streams the input.
 */

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

/** Long enough for a slow origin, short enough to fail inside a function timeout. */
const EXTRACT_TIMEOUT_MS = 120_000

export interface ExtractedAudio {
  buffer: Buffer
  /** Suggested filename, so the transcriber can infer the container. */
  fileName: string
  bytes: number
}

/**
 * Extract the audio track to an m4a buffer.
 *
 * Throws rather than returning null: the caller decides whether a failure here
 * is fatal, and a silent empty buffer would be transcribed as silence.
 */
export async function extractAudioFromUrl(videoUrl: string): Promise<ExtractedAudio> {
  const dir = await mkdtemp(join(tmpdir(), 'nrs-audio-'))
  const outputPath = join(dir, 'audio.m4a')

  try {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(videoUrl)
        .inputOptions(['-rw_timeout', '20000000']) // 20s, in microseconds
        .outputOptions([
          '-vn',           // drop video — the whole point
          '-acodec', 'copy', // keep the original stream, do not re-encode
        ])
        .output(outputPath)
        .on('error', reject)
        .on('end', () => resolve())

      command.run()

      setTimeout(() => {
        try { command.kill('SIGKILL') } catch { /* already gone */ }
        reject(new Error(`audio extraction timed out after ${EXTRACT_TIMEOUT_MS}ms`))
      }, EXTRACT_TIMEOUT_MS)
    })

    const buffer = await readFile(outputPath)
    if (!buffer.length) throw new Error('audio extraction produced an empty file')

    return { buffer, fileName: 'audio.m4a', bytes: buffer.length }
  } finally {
    await unlink(outputPath).catch(() => {})
  }
}
