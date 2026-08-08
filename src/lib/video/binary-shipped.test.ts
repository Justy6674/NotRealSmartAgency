import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

/**
 * Everything video depends on a native binary that Next cannot see.
 *
 * `ffmpeg-static` resolves its path at runtime, so nothing imports the binary
 * and the dependency tracer never learns it exists. It is simply absent from
 * the deployed function, and the only symptom is
 *
 *   spawn /var/task/.next/server/chunks/ffmpeg ENOENT
 *
 * buried in a metadata field. On this machine node_modules is right there, so
 * every test passed and every local run worked, while in production not one
 * thumbnail, delivery copy, caption or trim had ever succeeded.
 */
const ROUTES_THAT_RUN_FFMPEG = [
  '/api/media/process',
  '/api/telegram/mini-app/upload',
  '/api/telegram/mini-app/message',
  '/api/webhooks/telegram',
  '/api/chat',
  '/api/mcp',
]

test('the ffmpeg binary is shipped with every route that spawns it', () => {
  const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
  const traced = config.slice(
    config.indexOf('outputFileTracingIncludes'),
    config.indexOf('transpilePackages'),
  )
  assert.ok(traced.length > 0, 'outputFileTracingIncludes is gone — nothing native ships')

  for (const route of ROUTES_THAT_RUN_FFMPEG) {
    const line = traced.split('\n').find((row) => row.includes(`'${route}'`))
    assert.ok(line, `${route} runs ffmpeg but is not traced at all`)
    assert.ok(
      line.includes('ffmpeg-static'),
      `${route} spawns ffmpeg but does not ship it — it will fail with ENOENT in production`,
    )
  }
})

test('the subtitle font ships with anything that can burn captions', () => {
  const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
  for (const route of ['/api/telegram/mini-app/message', '/api/chat', '/api/mcp']) {
    const line = config.split('\n').find((row) => row.includes(`'${route}'`))
    assert.ok(line?.includes('assets/fonts'), `${route} would render captions with no font`)
  }
})

test('the binary this asserts about actually exists', () => {
  // Otherwise the two tests above are checking a config entry for a file that
  // is not there, and passing means nothing.
  assert.ok(ffmpegPath, 'ffmpeg-static resolved no path at all')
  assert.ok(existsSync(ffmpegPath!), `${ffmpegPath} is missing from node_modules`)
  assert.match(ffmpegPath!, /ffmpeg-static/, 'the traced path must match the resolved one')
})
