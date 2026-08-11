import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/media/intake-upload/route.ts'), 'utf8')

test('a public quick-add link is upload-only and cannot invoke content or publishing work', () => {
  assert.match(source, /buildIntakeStoragePath/)
  assert.match(source, /intakeStoragePrefix/)
  assert.match(source, /runMediaProcessingPipeline/)
  assert.doesNotMatch(source, /runDirectorJob/)
  assert.doesNotMatch(source, /publishToSocial/)
  assert.doesNotMatch(source, /syncDraftToMixpost/)
})

test('completion files media under the brand owner and its exact link path', () => {
  assert.match(source, /\.eq\('user_id', link\.owner_user_id\)/)
  assert.match(source, /\.eq\('brand_id', link\.brand_id\)/)
  assert.match(source, /if \(!storagePath\.startsWith\(prefix\)\)/)
  assert.match(source, /actualSize !== fileSize/)
})
