import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const inbox = readFileSync(resolve(process.cwd(), 'src/components/agency/DesktopMediaInbox.tsx'), 'utf8')
const conversation = readFileSync(resolve(process.cwd(), 'src/components/agency/NrsDeskConversation.tsx'), 'utf8')
const chatInput = readFileSync(resolve(process.cwd(), 'src/components/agency/ChatInput.tsx'), 'utf8')
const creator = readFileSync(resolve(process.cwd(), 'src/app/agency/studio/create/page.tsx'), 'utf8')
const reviewPage = readFileSync(resolve(process.cwd(), 'src/app/agency/studio/review/page.tsx'), 'utf8')
const reviewRoom = readFileSync(resolve(process.cwd(), 'src/components/agency/studio/ReviewRoom.tsx'), 'utf8')
const postCreator = readFileSync(resolve(process.cwd(), 'src/components/agency/studio/post/PostCreator.tsx'), 'utf8')

test('the desktop upload page becomes NRS Desk rather than sending people back to MCP', () => {
  assert.match(inbox, /NRS Desk/)
  assert.match(inbox, /NrsDeskConversation/)
  assert.doesNotMatch(inbox, /Copy NRS draft instruction|paste it into Claude or ChatGPT/)
})

test('uploads retain exact media IDs, client retry IDs and explicit selection state', () => {
  assert.match(inbox, /client_upload_id: id/)
  assert.match(inbox, /mediaItemId/)
  assert.match(inbox, /selected:/)
  assert.match(inbox, /aria-pressed/)
})

test('an uploaded video is unmistakable and starts with a Director review, not a draft action', () => {
  assert.match(inbox, /mediaLabel\(item\.fileType\)\} uploaded/)
  assert.match(inbox, /MediaTypeIcon/)
  assert.match(conversation, /Review this first/)
  assert.match(conversation, /Do not create, save or draft anything yet/)
  assert.doesNotMatch(conversation, />Continue</)
  assert.doesNotMatch(conversation, /Open in Creator/)
})

test('Desk chat creates a durable conversation before sending and passes exact context', () => {
  assert.match(conversation, /source: 'nrs_desk'/)
  assert.match(conversation, /ensureConversation/)
  assert.match(conversation, /\/api\/desk\/context/)
  assert.match(conversation, /clientTurnId/)
  assert.match(conversation, /selectedMediaIds/)
})

test('Desk conversation and messages survive refresh through a stable exact URL', () => {
  assert.match(inbox, /useSearchParams/)
  assert.match(conversation, /initialConversationId/)
  assert.match(conversation, /history\.replaceState/)
  assert.match(conversation, /reloadSavedMessages\(initialConversationId\)/)
  assert.match(conversation, /setMessages/)
})

test('a replayed client turn restores its saved assistant answer instead of asking for another retry', () => {
  assert.match(conversation, /JSON\.parse\(error\.message\)/)
  assert.match(conversation, /existingResponse/)
  assert.match(conversation, /DuplicateTurn/)
  assert.match(conversation, /setMessages/)
})

test('a non-idempotent stream drop reloads the saved conversation before asking the owner to act', () => {
  assert.match(conversation, /reloadSavedMessages/)
  assert.match(conversation, /The saved reply is back in this chat/)
  assert.doesNotMatch(conversation, /You can send the instruction again/)
})

test('Desk reuses slash commands but keeps large media in the signed uploader', () => {
  assert.match(conversation, /<ChatInput/)
  assert.match(conversation, /allowAttachments=\{false\}/)
  assert.match(chatInput, /allowAttachments/)
})

test('the Director composer stays visible on desktop and mobile PWA screens', () => {
  assert.match(conversation, /data-testid="nrs-desk-director-composer"/)
  assert.match(conversation, /max-lg:fixed/)
  assert.match(conversation, /lg:h-\[calc\(100dvh-12rem\)\]/)
  assert.match(conversation, /pb-\[env\(safe-area-inset-bottom\)\]/)
})

test('real draft receipts link to the exact Creator and Review work', () => {
  assert.match(conversation, /\/agency\/studio\/create\?conversation=/)
  assert.match(conversation, /\/agency\/studio\/review\?draft=/)
  assert.match(conversation, /Mixpost/)
})

test('Creator and Review restore exact Desk receipts after navigation or refresh', () => {
  assert.match(creator, /searchParams\.get\('draft'\)/)
  assert.match(creator, /searchParams\.get\('media'\)/)
  assert.match(creator, /searchParams\.get\('conversation'\)/)
  assert.match(creator, /searchParams\.get\('output'\)/)
  assert.match(creator, /deskConversationId/)
  assert.match(creator, /deskOutputId/)
  assert.match(postCreator, /\/api\/desk\/results\?conversationId=/)
  assert.match(postCreator, /output\.id === deskOutputId/)
  assert.match(reviewPage, /searchParams\.get\('draft'\)/)
  assert.match(reviewRoom, /initialDraftId/)
})
