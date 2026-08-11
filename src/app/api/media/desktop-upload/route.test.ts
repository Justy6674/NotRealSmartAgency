import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/media/desktop-upload/route.ts'), 'utf8')

test('the desktop inbox requires a signed-in writer and cannot become a broad public drop link', () => {
  assert.match(source, /createClient\(\)/)
  assert.match(source, /supabase\.auth\.getUser\(\)/)
  assert.match(source, /canWriteDesktopInboxBrand/)
  assert.match(source, /isDesktopInboxBrandSlug/)
  assert.doesNotMatch(source, /media_intake_links/)
  assert.doesNotMatch(source, /Bearer nrs_drop_/)
})

test('the desktop inbox files every completed object under the selected brand owner and uploader-bound path', () => {
  assert.match(source, /buildDesktopInboxStoragePath/)
  assert.match(source, /desktopInboxStoragePrefix/)
  assert.match(source, /if \(!storagePath\.startsWith\(prefix\)\)/)
  assert.match(source, /user_id: brand\.user_id/)
  assert.match(source, /brand_id: brand\.id/)
  assert.match(source, /mediaError\?\.code === '23505'/)
  assert.match(source, /concurrentlyFiled/)
})

test('the desktop inbox only starts media enrichment and never directs or publishes a post', () => {
  assert.match(source, /runMediaProcessingPipeline/)
  assert.doesNotMatch(source, /runDirectorJob/)
  assert.doesNotMatch(source, /publishToSocial/)
  assert.doesNotMatch(source, /syncDraftToMixpost/)
})
