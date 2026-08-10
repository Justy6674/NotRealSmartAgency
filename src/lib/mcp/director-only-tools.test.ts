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
    'blotato_create_visual',
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

test('keeps the complete Abe gateway inside the Director flow', () => {
  assert.equal(isDirectorOnlyMcpTool('use_abe_ai'), true)
})

test('keeps PICO clinical evidence work inside the Director flow', () => {
  assert.equal(isDirectorOnlyMcpTool('use_pico_search'), true)
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

test('lets a client move finished artwork into the library without the Director', () => {
  // Uploading to the owner's own library and exporting a design produce no
  // public effect and no marketing copy, so the Director round trip was pure
  // latency on the one step every carousel needs.
  for (const name of ['upload_media', 'export_design', 'get_export_formats', 'search_designs', 'list_brand_templates']) {
    assert.equal(isDirectorOnlyMcpTool(name), false)
  }
})

test('still routes anything that writes copy or publishes through the Director', () => {
  for (const name of ['write_blog', 'draft_post_copy', 'publish_to_social', 'repurpose_content', 'create_video']) {
    assert.equal(isDirectorOnlyMcpTool(name), true)
  }
})
