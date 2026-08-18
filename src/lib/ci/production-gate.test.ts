import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A red Quality check used to deploy anyway. These two Vercel hooks are the
 * reason it cannot: ignoreCommand skips a commit Quality already failed, and
 * the production build command runs the suite itself so a race with GitHub
 * does not sneak a red SHA onto the live site.
 */
test('production cannot ship while Quality is red', () => {
  const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
  assert.equal(vercel.ignoreCommand, 'node scripts/vercel-ignored-build.mjs')
  assert.equal(vercel.buildCommand, 'node scripts/vercel-production-build.mjs')

  const ignored = readFileSync(resolve(process.cwd(), 'scripts/vercel-ignored-build.mjs'), 'utf8')
  assert.match(ignored, /conclusion === 'failure'/)
  assert.match(ignored, /process\.exit\(0\)/)

  const build = readFileSync(resolve(process.cwd(), 'scripts/vercel-production-build.mjs'), 'utf8')
  assert.match(build, /VERCEL_ENV === 'production'/)
  assert.match(build, /\['test'\]/)
  assert.match(build, /ci-placeholder\.supabase\.co/)
  assert.match(build, /\['run', 'build'\]/)
})
