import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { ownerReceiptLine } from '@/lib/publishers/receipts'

const helper = readFileSync(join(process.cwd(), 'src/lib/studio/owner-facing-accounts.ts'), 'utf8')
const mcp = readFileSync(join(process.cwd(), 'src/lib/mcp/server.ts'), 'utf8')
const board = readFileSync(join(process.cwd(), 'src/app/api/macro/board/route.ts'), 'utf8')
const brief = readFileSync(join(process.cwd(), 'src/lib/projects/load-brief.ts'), 'utf8')
const posts = readFileSync(join(process.cwd(), 'src/app/api/scheduled-posts/route.ts'), 'utf8')
const table = readFileSync(join(process.cwd(), 'src/components/agency/studio/posts/PostsTable.tsx'), 'utf8')

test('leftover board reads use the shared owner-facing loader', () => {
  assert.match(helper, /fetchZernioAccounts/)
  assert.match(helper, /ownerFacingAccounts/)
  assert.match(helper, /brandIsPublisherLinked/)
  assert.match(mcp, /loadOwnerFacingBoardAccounts/)
  assert.match(board, /loadOwnerFacingBoardAccounts/)
  assert.match(brief, /loadOwnerFacingBoardAccounts/)
  assert.doesNotMatch(
    mcp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''),
    /fetchMixpostAccounts\(\)/,
  )
  assert.doesNotMatch(
    board.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''),
    /fetchMixpostAccounts\(\)/,
  )
  assert.doesNotMatch(
    brief.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''),
    /fetchMixpostAccounts\(\)/,
  )
})

test('post list attaches publisher receipts and the table renders them', () => {
  assert.match(posts, /publisher_runs/)
  assert.match(posts, /receipts/)
  assert.match(table, /ownerReceiptLine/)
})

test('receipt copy never names a vendor', () => {
  const line = ownerReceiptLine({
    scheduled_post_id: 'p1',
    account_id: 'a1',
    platform: 'instagram',
    status: 'success',
    external_permalink: 'https://example.com/p',
    created_at: new Date().toISOString(),
  })
  assert.match(line, /On Instagram/)
  assert.doesNotMatch(line, /zernio|mixpost|oauth/i)
  assert.equal(
    ownerReceiptLine({
      scheduled_post_id: 'p1',
      account_id: 'a1',
      platform: 'facebook',
      status: 'failed',
      external_permalink: null,
      created_at: new Date().toISOString(),
    }),
    'Didn’t send on Facebook',
  )
})
