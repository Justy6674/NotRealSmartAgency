import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMiniAppAttachmentDirective } from './mini-app-attachment-turn.ts'
import { stripMediaDirective } from './telegram-album.ts'

test('an attached Mini App request keeps the exact media set with this turn only', () => {
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ]
  const message = 'Use these images as reference for a three-slide Scent Sell carousel.'
  const directed = message + buildMiniAppAttachmentDirective(ids)

  for (const id of ids) assert.match(directed, new RegExp(id))
  assert.match(directed, /this exact request/i)
  assert.match(directed, /query_media/i)
  assert.match(directed, /media_ids/i)
  assert.equal(stripMediaDirective(directed), message)
})

test('the attachment directive does not claim creation or publishing work', () => {
  const directive = buildMiniAppAttachmentDirective(['11111111-1111-4111-8111-111111111111'])

  assert.doesNotMatch(directive, /then create the drafts|use manage_posts/i)
  assert.match(directive, /do not claim.*Canva.*Mixpost/i)
})
