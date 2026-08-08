/**
 * Where ffmpeg actually is, as opposed to where the package thinks it is.
 *
 * `ffmpeg-static` locates its binary with `path.join(__dirname, 'ffmpeg')`.
 * That is correct until a bundler gets hold of it: webpack inlines the module
 * into `.next/server/chunks/`, `__dirname` becomes the chunk directory, and
 * the package confidently reports
 *
 *   /var/task/.next/server/chunks/ffmpeg
 *
 * which has never existed. Tracing the real binary into the deployment does
 * not help on its own — the file lands under `node_modules/ffmpeg-static/`
 * and the code goes on looking in the chunks folder. That is why the first fix
 * for this changed nothing, and why the production probe exists: it spawns the
 * thing rather than believing a config file.
 *
 * `serverExternalPackages` keeps the module unbundled so `__dirname` stays
 * true. This is the belt to that braces — if the binary is not where the
 * package says, look where it is actually shipped, and say so loudly if it is
 * nowhere.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'

/** Every place the binary plausibly lands, best first. */
function candidates(): string[] {
  const root = process.cwd()
  return [
    process.env.FFMPEG_BIN,
    ffmpegStatic ?? undefined,
    join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    // Vercel runs functions from /var/task; the traced copy lands beside it.
    join('/var/task', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  ].filter((path): path is string => typeof path === 'string' && path.length > 0)
}

let resolved: string | null | undefined

/** The first candidate that is actually on disk, or null. */
export function ffmpegBinary(): string | null {
  if (resolved !== undefined) return resolved
  resolved = candidates().find((path) => existsSync(path)) ?? null
  if (!resolved) {
    console.error(`[ffmpeg] not found. Looked in: ${candidates().join(', ')}`)
  } else if (resolved !== ffmpegStatic) {
    console.warn(`[ffmpeg] ffmpeg-static reported ${ffmpegStatic}; using ${resolved}`)
  }
  return resolved
}

/**
 * Fail here rather than three layers down.
 *
 * A missing binary surfaced as "spawn … ENOENT" inside a metadata field on one
 * media row, which is how it went unnoticed for months. This says what is
 * wrong in words, at the point of use.
 */
export function requireFfmpeg(): string {
  const path = ffmpegBinary()
  if (!path) throw new Error('ffmpeg is not available in this deployment')
  return path
}
