import assert from 'node:assert/strict'
import test from 'node:test'
import { deskPlatformOptions } from './platform-options.ts'

test('Desk puts Scent Sell publishing channels first and excludes unconnected TikTok', () => {
  assert.deepEqual(
    deskPlatformOptions(['LinkedIn', 'Facebook', 'Instagram', 'YouTube']),
    ['YouTube', 'Instagram', 'Facebook'],
  )
})

test('Desk adds TikTok only once the brand has a real connected TikTok account', () => {
  assert.deepEqual(
    deskPlatformOptions(['Facebook Page', 'TikTok', 'YouTube', 'Instagram']),
    ['YouTube', 'Instagram', 'Facebook', 'TikTok'],
  )
})
