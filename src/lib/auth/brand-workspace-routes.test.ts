import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const conversationsRoute = readFileSync(resolve(process.cwd(), 'src/app/api/conversations/route.ts'), 'utf8')
const chatRoute = readFileSync(resolve(process.cwd(), 'src/app/api/chat/route.ts'), 'utf8')
const messagesRoute = readFileSync(resolve(process.cwd(), 'src/app/api/conversations/[conversationId]/messages/route.ts'), 'utf8')

test('conversation creation stores the workspace owner instead of the signed-in team member', () => {
  assert.match(conversationsRoute, /resolveBrandWorkspaceContext\(supabase, user\.id, brandId\)/)
  assert.match(conversationsRoute, /user_id: workspaceOwnerId/)
  assert.doesNotMatch(conversationsRoute, /user_id: user\.id/)
})

test('chat tools, evidence, spend and memory use workspace ownership while audit retains the actor', () => {
  assert.match(chatRoute, /const \{ workspaceOwnerId, actorUserId/)
  assert.match(chatRoute, /getOrCreateAgentRegistry\(supabase, workspaceOwnerId/)
  assert.match(chatRoute, /prepareDirectorTurn\(\{[\s\S]*?userId: workspaceOwnerId/)
  assert.match(chatRoute, /getToolsForAgent\(agentType, \{[\s\S]*?userId: workspaceOwnerId/)
  assert.match(chatRoute, /user_id: workspaceOwnerId/)
  assert.match(chatRoute, /actorUserId/)
})

test('restoring Desk messages rechecks exact brand membership on the server', () => {
  assert.match(messagesRoute, /resolveBrandWorkspaceContext/)
  assert.match(messagesRoute, /conv\.user_id !== workspace\.workspaceOwnerId/)
  assert.match(messagesRoute, /BrandWorkspaceAccessError/)
})
