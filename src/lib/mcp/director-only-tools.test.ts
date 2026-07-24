import assert from 'node:assert/strict'
import test from 'node:test'
import { getDirectMcpToolEntries, isDirectorOnlyMcpTool } from './director-only-tools.ts'

test('keeps publish_to_social outside the direct MCP surface', () => {
  assert.equal(isDirectorOnlyMcpTool('publish_to_social'), true)
})

test('keeps Blotato publishing outside the direct MCP surface', () => {
  assert.equal(isDirectorOnlyMcpTool('blotato_publish'), true)
})

test('keeps outbound email outside the direct MCP surface', () => {
  assert.equal(isDirectorOnlyMcpTool('send_email'), true)
})

test('keeps review-queue changes outside the direct MCP surface', () => {
  assert.equal(isDirectorOnlyMcpTool('manage_posts'), true)
})

test('keeps external media generation and configuration inside the Director flow', () => {
  for (const name of [
    'create_multi_scene_video',
    'generate_photo_avatar',
    'generate_from_template',
    'upload_talking_photo',
    'blotato_create_visual',
    'register_webhook',
    'create_mixpost_template',
    'manage_tags',
    'manage_media_tags',
  ]) {
    assert.equal(isDirectorOnlyMcpTool(name), true)
  }
})

test('keeps new, unreviewed tools Director-only by default', () => {
  assert.equal(isDirectorOnlyMcpTool('future_external_tool'), true)
})

test('registers only explicit direct-MCP tool names', () => {
  const entries = getDirectMcpToolEntries({
    query_calendar: {},
    scan_website: {},
    publish_to_social: {},
    send_email: {},
    future_external_tool: {},
  })

  assert.deepEqual(entries.map(([name]) => name), ['query_calendar', 'scan_website'])
})

test('keeps read-only calendar queries available to MCP clients', () => {
  assert.equal(isDirectorOnlyMcpTool('query_calendar'), false)
})
