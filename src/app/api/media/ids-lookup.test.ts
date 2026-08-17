import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/media/route.ts'), 'utf8')
const posts = readFileSync(resolve(process.cwd(), 'src/components/agency/studio/posts/PostsTable.tsx'), 'utf8')

test('GET /api/media honours ?ids= so a Posts row can load its own still', () => {
  assert.match(route, /searchParams\.get\('ids'\)/)
  assert.match(route, /\.in\('id', idList\)/)
  assert.match(posts, /\/api\/media\?ids=/)
  assert.match(posts, /MediaTile/)
})
