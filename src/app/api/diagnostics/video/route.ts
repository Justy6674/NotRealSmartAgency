/**
 * Can this deployment actually do video?
 *
 * Built because it could not, for months, and nobody knew. `ffmpeg-static`
 * resolves its path at runtime so Next never shipped the binary, and the only
 * evidence was
 *
 *   spawn /var/task/.next/server/chunks/ffmpeg ENOENT
 *
 * buried in a metadata field on one media row. Every local test passed. Every
 * local run worked. Not one thumbnail, delivery copy or caption had ever
 * succeeded in production.
 *
 * The owner should never be asked to open a console, so this is the other half
 * of that rule: a deployment that can be asked, from a terminal, whether it is
 * actually capable of the thing it claims. It does not read the config or
 * check a file exists — it runs ffmpeg and renders a real frame with the real
 * font, because "the file is present" is not the same as "it works".
 *
 * Guarded by the same secret as the cron routes. It is a probe, not a page.
 */

import { NextResponse } from 'next/server'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { execFile } from 'node:child_process'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { buildAss } from '@/lib/video/subtitles'
import { FONTS_DIR } from '@/lib/video/burn-subtitles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const run = promisify(execFile)

interface Check {
  ok: boolean
  detail: string
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const checks: Record<string, Check> = {}

  // 1. Is the binary there, and will it run? A path is not a program: the
  //    executable bit can be lost in packaging, which fails identically.
  checks.ffmpeg = await (async (): Promise<Check> => {
    if (!ffmpegPath) return { ok: false, detail: 'ffmpeg-static resolved no path' }
    try {
      const { stdout } = await run(ffmpegPath, ['-hide_banner', '-version'])
      return { ok: true, detail: stdout.split('\n')[0] ?? 'ran' }
    } catch (error) {
      return { ok: false, detail: `${ffmpegPath}: ${error instanceof Error ? error.message : String(error)}` }
    }
  })()

  // 2. Is libass compiled in? Without it the subtitles filter does not exist
  //    and captioning fails at the filtergraph rather than at the file.
  checks.libass = await (async (): Promise<Check> => {
    if (!ffmpegPath) return { ok: false, detail: 'no ffmpeg' }
    try {
      const { stdout } = await run(ffmpegPath, ['-hide_banner', '-filters'])
      const has = stdout.includes(' subtitles ')
      return { ok: has, detail: has ? 'subtitles filter present' : 'no subtitles filter — libass missing' }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    }
  })()

  // 3. Burn a caption onto a generated frame with the shipped font.
  //
  //    The one that matters. libass given a font it cannot find does not
  //    error — it renders a video with no captions on it and reports success,
  //    so nothing short of looking at the output proves anything. A blank
  //    frame and a captioned one differ in size by a wide margin.
  checks.captions = await (async (): Promise<Check> => {
    if (!ffmpegPath || !checks.ffmpeg.ok) return { ok: false, detail: 'skipped — no ffmpeg' }
    const dir = await mkdtemp(join(tmpdir(), 'nrs-probe-'))
    try {
      ffmpeg.setFfmpegPath(ffmpegPath)
      const assPath = join(dir, 'probe.ass')
      const words = 'the quick brown fox'.split(' ')
        .map((word, i) => ({ word, start: i * 0.3, end: i * 0.3 + 0.25 }))
      await readFile(assPath).catch(() => undefined)
      const { writeFile } = await import('node:fs/promises')
      await writeFile(assPath, buildAss(words, 720, 1280), 'utf8')

      const plain = join(dir, 'plain.png')
      const burnt = join(dir, 'burnt.png')
      await run(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'color=black:s=720x1280:d=1', '-frames:v', '1', '-update', '1', '-y', plain,
      ])
      await run(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
        '-i', 'color=black:s=720x1280:d=1',
        '-vf', `subtitles=filename='${assPath}':fontsdir='${FONTS_DIR}'`,
        '-frames:v', '1', '-update', '1', '-y', burnt,
      ])

      const [before, after] = await Promise.all([readFile(plain), readFile(burnt)])
      const grew = after.byteLength - before.byteLength
      return grew > 500
        ? { ok: true, detail: `caption rendered (+${grew} bytes over a blank frame)` }
        : { ok: false, detail: `frame is blank (+${grew} bytes) — the font did not load` }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })()

  const ok = Object.values(checks).every((check) => check.ok)
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 })
}
