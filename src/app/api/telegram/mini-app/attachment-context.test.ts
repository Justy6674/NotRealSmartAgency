import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

test('the Mini App sends all completed attachments as one Director request', () => {
  const page = read('src/app/telegram/page.tsx')

  assert.match(page, /const mediaItemIds = outcomes\.flatMap/)
  assert.match(page, /pendingAttachmentEventId \?\? crypto\.randomUUID\(\)/)
  assert.match(page, /submitMessage\(request, clientEventId, mediaItemIds\)/)
  assert.match(page, /setPendingAttachmentEventId\(null\)/)
  assert.match(page, /media_item_ids: mediaItemIds/)
})

test('the Mini App message route verifies attached media and persists the one-turn directive', () => {
  const route = read('src/app/api/telegram/mini-app/message/route.ts')

  assert.match(route, /buildMiniAppAttachmentDirective/)
  assert.match(route, /\.eq\('user_id', context\.actorUserId\)/)
  assert.match(route, /\.eq\('brand_id', grant\.projectId\)/)
  assert.match(route, /message \+ buildMiniAppAttachmentDirective\(mediaItemIds\)/)
  assert.match(route, /message: messageWithMedia/)
  assert.match(route, /runMediaProcessingPipeline/)
})

test('the Mini App timeline hides internal attachment instructions but preserves the media link', () => {
  const source = read('src/lib/telegram/timeline-sources.ts')

  assert.match(source, /stripMediaDirective\(row\.input\.message\)/)
  assert.match(source, /mediaIds: mediaItemIds/)
})

test('query_media returns every file in an exact current attachment set', () => {
  const queryMedia = read('src/lib/agents/tools/query-media.ts')

  assert.match(queryMedia, /const effectiveLimit = mediaIds\?\.length \?\? limit/)
  assert.match(queryMedia, /query\.limit\(effectiveLimit\)/)
})

test('filing a Mini App file never starts a separate proposal without the owner request', () => {
  const upload = read('src/app/api/telegram/mini-app/upload/route.ts')

  assert.doesNotMatch(upload, /proposeAndStore/)
  assert.doesNotMatch(upload, /startVideoBrief/)
})
