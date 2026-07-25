import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('a Telegram website scan is performed before the Director writes its response', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/mcp/director-job.ts'), 'utf8')

  assert.match(source, /isWebsiteScanRequest\(message\)/)
  assert.match(source, /scanWebsiteCore\(supabase, userId, brand_id, websiteUrl, 'messaging'\)/)
  assert.match(source, /websiteScanDirective \? null : buildRoutingContext/)
  assert.match(source, /buildWebsiteScanGroundingDirective\(websiteScan\)/)
})
