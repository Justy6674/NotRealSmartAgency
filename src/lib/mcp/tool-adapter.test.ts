import assert from 'node:assert/strict'
import { test } from 'node:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v3'
import { createSearchBrainTool } from '@/lib/agents/tools/search-brain'

test('MCP can register search_brain with the required brand scope', () => {
  const server = new McpServer({ name: 'nrs-test', version: '1.0.0' })
  const searchBrain = createSearchBrainTool() as {
    inputSchema?: { shape?: Record<string, unknown> }
  }

  assert.ok(searchBrain.inputSchema?.shape, 'search_brain must expose an object schema')

  assert.doesNotThrow(() => {
    server.registerTool('search_brain', {
      description: 'Search the owner knowledge brain.',
      inputSchema: {
        brand_id: z.string(),
        ...searchBrain.inputSchema!.shape,
      },
    }, async () => ({ content: [{ type: 'text', text: 'ok' }] }))
  })
})
