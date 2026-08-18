import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { accountIdsForPlatform } from './account-targets'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

test('social compose is the only route that renders the composer', () => {
  const canonical = read('src/app/agency/social/compose/page.tsx')
  assert.match(canonical, /<ComposeScreen/)

  for (const route of [
    'src/app/agency/social/page.tsx',
    'src/app/agency/studio/create/page.tsx',
    'src/app/agency/studio/post/page.tsx',
  ]) {
    const source = read(route)
    assert.match(source, /redirect\(['"]\/agency\/social\/compose['"]\)/, route)
    assert.doesNotMatch(source, /ComposeScreen/, route)
  }
})

test('account targets are partitioned by canonical platform', () => {
  const accounts = [
    { id: 'ig-1', platform: 'instagram' },
    { id: 'fb-1', platform: 'facebook_page' },
    { id: 'ig-2', platform: 'instagram' },
    { id: 'yt-1', platform: 'youtube' },
  ]

  assert.deepEqual(
    accountIdsForPlatform(['ig-1', 'fb-1', 'ig-2', 'missing'], accounts, 'instagram'),
    ['ig-1', 'ig-2'],
  )
  assert.deepEqual(
    accountIdsForPlatform(['ig-1', 'fb-1', 'ig-2'], accounts, 'facebook'),
    ['fb-1'],
  )
})

test('composer stores only platform-correct account targets on each row', () => {
  const creator = read('src/components/agency/studio/post/PostCreator.tsx')
  assert.match(creator, /accountIdsForPlatform\(/)
  assert.doesNotMatch(creator, /account_ids:\s*selectedAccountIds/)
})

test('calendar has no bulk approval action and uses configured posting slots', () => {
  const actions = read('src/components/agency/studio/CalendarActions.tsx')
  assert.doesNotMatch(actions, /Approve all drafts|handleApproveAll|CheckCheck/)

  const fill = read('src/lib/agents/tools/fill-calendar.ts')
  assert.match(fill, /\.from\(['"]posting_schedule_slots['"]\)/)
  assert.match(fill, /queueSlotId:\s*post\.queue_slot_id/)
  assert.doesNotMatch(fill, /AEST_OFFSET_HOURS|WEEKDAY_SLOTS|WEEKEND_SLOTS/)
})
