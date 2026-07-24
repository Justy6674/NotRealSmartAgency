import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

test('every MCP entrypoint receives a scoped principal and checks a capability', () => {
  const server = read('src/lib/mcp/server.ts')
  const director = read('src/lib/mcp/director-chat.ts')
  const runner = read('src/lib/mcp/director-job.ts')
  const draft = read('src/lib/mcp/draft-post-tool.ts')
  const adapter = read('src/lib/mcp/tool-adapter.ts')
  const poll = read('src/lib/mcp/director-job-tool.ts')

  assert.match(server, /createNRSMcpServer\(principal: McpPrincipal\)/)
  assert.match(server, /listGrantedProjectIds\(principal\)/)
  assert.match(director, /createMcpDirectorExecution\(principal, brand_id\)/)
  assert.match(director, /project_access_grant_id: execution\.projectAccessGrantId/)
  assert.match(director, /channel: execution\.channel/)
  assert.match(runner, /A mention of another brand NEVER changes this job's project scope/)
  assert.match(draft, /assertProjectCapability\(principal, brand_id, 'draft:post'\)/)
  assert.match(adapter, /assertProjectCapability\(principal, brandId, 'direct:utility'\)/)
  assert.match(poll, /\.eq\('api_key_id', principal.keyId\)/)
})
