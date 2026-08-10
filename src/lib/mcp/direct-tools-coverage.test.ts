import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDirectMcpTool, DIRECT_MCP_TOOLS } from './director-only-tools'

/**
 * What the owner and Bec must be able to do from Claude or Codex, without the
 * web app.
 *
 * The allowlist is deliberately conservative — anything that writes marketing
 * copy or publishes stays behind the Director. But three things he needs every
 * day were behind it for no safety reason, and the result was a plug-in
 * assistant that could start a job and never finish it:
 *
 *   uploading   worked, but nothing read the file afterwards
 *   carousels   every step was Director-only, so none could be built
 *   the brain   invisible, so answers were guessed instead of recalled
 *
 * This pins both directions. Adding a tool that publishes or writes copy to
 * the allowlist should fail here.
 */

test('Bec can put a file in and have it understood', () => {
  assert.equal(isDirectMcpTool('upload_media'), true)
  assert.equal(isDirectMcpTool('query_media'), true, 'reading it back is how analysis is collected')
})

test('a carousel can be built end to end from a plug-in client', () => {
  for (const step of [
    'get_brand_kit',
    'get_brand_template_dataset',
    'generate_design_structured',
    'import_canva_design_to_media',
    'create_carousel_proposal',
    'export_design',
  ]) {
    assert.equal(isDirectMcpTool(step), true, `${step} breaks the carousel chain`)
  }
})

test('the brain is reachable, so answers are recalled rather than invented', () => {
  assert.equal(isDirectMcpTool('search_brain'), true)
})

test('nothing that publishes or writes marketing copy is directly reachable', () => {
  // The whole reason the allowlist exists. A plug-in AI is a messenger.
  for (const forbidden of [
    'publish_to_social',
    'write_blog',
    'write_ads',
    'write_email_campaign',
    'repurpose_content',
    'delegate_to_agent',
    'convene_meeting',
    'send_email',
    'fill_calendar',
    'marketing_audit',
  ]) {
    assert.equal(
      isDirectMcpTool(forbidden),
      false,
      `${forbidden} must stay behind the Director — it publishes, writes copy, or orchestrates`,
    )
  }
})

test('the allowlist stays small enough to reason about', () => {
  // Not a style rule. Every entry is a tool an external client can call
  // without the Director's brand and compliance rules applying, so the set
  // should be readable in one sitting.
  assert.ok(
    DIRECT_MCP_TOOLS.size <= 30,
    `direct MCP surface has grown to ${DIRECT_MCP_TOOLS.size} — review before adding more`,
  )
})
