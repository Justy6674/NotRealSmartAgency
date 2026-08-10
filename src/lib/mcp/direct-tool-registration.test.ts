import assert from 'node:assert/strict'
import test from 'node:test'
import { getToolsForAgent } from '@/lib/agents/tools'
import { DIRECT_MCP_TOOLS } from './director-only-tools'

test('every direct MCP allowlist entry is registered by the Director', () => {
  const directorTools = getToolsForAgent('overall', {
    supabase: {} as any,
    userId: 'test-user',
    brandId: '00000000-0000-0000-0000-000000000000',
    conversationId: null,
  })

  const missing = [...DIRECT_MCP_TOOLS].filter((name) => !(name in directorTools))
  assert.deepEqual(missing, [], `MCP allowlist entries missing from Director tools: ${missing.join(', ')}`)
})
