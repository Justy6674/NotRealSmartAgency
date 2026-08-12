import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('Desk conversation creation records versioned server-owned context', () => {
  const route = source('src/app/api/conversations/route.ts')
  assert.match(route, /source: z\.literal\('nrs_desk'\)/)
  assert.match(route, /createDeskConversationMetadata\(buildDeskContext/)
  assert.match(route, /actorUserId: user\.id/)
})

test('Desk context mutation verifies the conversation and every selected media row', () => {
  const route = source('src/app/api/desk/context/route.ts')
  assert.match(route, /resolveBrandWorkspaceContext/)
  assert.match(route, /\.from\('media_items'\)/)
  assert.match(route, /mediaRows\.length !== mediaItemIds\.length/)
  assert.match(route, /user_id.*workspaceOwnerId/)
  assert.match(route, /brand_id.*conversation\.brand_id/)
  assert.match(route, /DESK_CREATIVE_STATES/)
})

test('web Director turns load exact Desk context and use a client turn idempotency key', () => {
  const route = source('src/app/api/chat/route.ts')
  assert.match(route, /clientTurnId: z\.string\(\)\.uuid\(\)/)
  assert.match(route, /readDeskContext/)
  assert.match(route, /buildDeskDirectorContext/)
  assert.match(route, /idempotencyKey: clientTurnId/)
  assert.match(route, /client_turn_id: clientTurnId/)
  assert.match(route, /directorTurn\?\.duplicate/)
  assert.match(route, /DuplicateTurn/)
})

test('Desk creation is structurally staged before it can create a Mixpost draft', () => {
  const route = source('src/app/api/chat/route.ts')
  const proposal = source('src/lib/agents/tools/propose-post.ts')
  assert.match(route, /deskContext\s*\?\s*null\s*:\s*await prepareDirectorTurn/)
  assert.match(route, /buildDeskCreativeDirectorPrompt\(deskContext\.state\)/)
  assert.match(route, /restrictDeskTools\(allTools, deskContext\.state\)/)
  assert.match(proposal, /ai_description/)
})

test('desktop upload retries reuse the client upload id and return the exact media id', () => {
  const route = source('src/app/api/media/desktop-upload/route.ts')
  assert.match(route, /client_upload_id/)
  assert.match(route, /uploadId: clientUploadId/)
  assert.match(route, /media_item_id/)
})

test('Director-created drafts retain their Desk conversation receipt', () => {
  const tools = source('src/lib/agents/tools/index.ts')
  const managePosts = source('src/lib/agents/tools/manage-posts.ts')
  assert.match(tools, /createManagePostsTool\([\s\S]*?ctx\.conversationId/)
  assert.match(managePosts, /desk_conversation_id: conversationId/)
})

test('Desk result read-back returns real outputs and drafts then stores typed references', () => {
  const route = source('src/app/api/desk/results/route.ts')
  assert.match(route, /\.from\('outputs'\)/)
  assert.match(route, /\.from\('scheduled_posts'\)/)
  assert.match(route, /desk_conversation_id/)
  assert.match(route, /\.eq\('status', 'draft'\)/)
  assert.match(route, /resultRefs/)
  assert.match(route, /createDeskConversationMetadata/)
})
