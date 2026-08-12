import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDeskCreativeDirectorPrompt,
  deskCreativeStateForMessage,
  isExplicitMixpostDraftApproval,
  restrictDeskTools,
} from './creative-flow.ts'

test('Desk keeps the first turn at shared-understanding, not creation', () => {
  assert.equal(deskCreativeStateForMessage('collecting', 'Make posts from this video'), 'awaiting_direction')
  assert.equal(deskCreativeStateForMessage('awaiting_direction', 'Yes, that is the message'), 'proposal_ready')
})

test('a draft requires an unambiguous current instruction that names both Mixpost and drafts', () => {
  assert.equal(isExplicitMixpostDraftApproval('looks good'), false)
  assert.equal(isExplicitMixpostDraftApproval('yes'), false)
  assert.equal(isExplicitMixpostDraftApproval('yes, save these as Mixpost drafts'), true)
  assert.equal(deskCreativeStateForMessage('proposal_ready', 'yes, save these as Mixpost drafts'), 'draft_approved')
})

test('Desk removes draft, delegation, and processing tools until the correct owner stage', () => {
  const tools = {
    query_media: 'read',
    propose_post_from_media: 'proposal',
    manage_posts: 'draft',
    process_media: 'unsafe',
    delegate_to_agent: 'unsafe',
    convene_meeting: 'unsafe',
  }

  assert.deepEqual(Object.keys(restrictDeskTools(tools, 'awaiting_direction')), ['query_media'])
  assert.deepEqual(Object.keys(restrictDeskTools(tools, 'proposal_ready')), ['query_media', 'propose_post_from_media'])
  assert.deepEqual(Object.keys(restrictDeskTools(tools, 'draft_approved')), ['query_media', 'manage_posts'])
})

test('the Director prompt makes the current stage and the no-save boundary explicit', () => {
  assert.match(buildDeskCreativeDirectorPrompt('awaiting_direction'), /Do not create a post, output, draft, schedule or publish/i)
  assert.match(buildDeskCreativeDirectorPrompt('proposal_ready'), /Say exactly: “yes, save these as Mixpost drafts”/i)
  assert.match(buildDeskCreativeDirectorPrompt('draft_approved'), /create_draft/i)
})
