import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { formatFileSize } from '@/lib/media/format-file-size'
import { isBillingPausedError } from '@/lib/publishers/billing-pause'
import { publisherTransportOf } from '@/lib/publishers/transport'

const root = process.cwd()
const chrome = readFileSync(join(root, 'src/components/agency/social/SocialDepartmentChrome.tsx'), 'utf8')
const card = readFileSync(join(root, 'src/components/agency/studio/MediaLibraryCard.tsx'), 'utf8')
const review = readFileSync(join(root, 'src/components/agency/studio/ReviewRoom.tsx'), 'utf8')
const draft = readFileSync(join(root, 'src/lib/posts/create-draft.ts'), 'utf8')
const webhook = readFileSync(join(root, 'src/app/api/webhooks/zernio/route.ts'), 'utf8')
const connect = readFileSync(join(root, 'src/app/api/zernio/connect/route.ts'), 'utf8')
const bar = readFileSync(join(root, 'src/components/agency/studio/post/CreatorActionBar.tsx'), 'utf8')
const processRoute = readFileSync(join(root, 'src/app/api/media/process/route.ts'), 'utf8')
const socialRead = readFileSync(join(root, 'src/lib/studio/social-read-source.ts'), 'utf8')
const navCounts = readFileSync(join(root, 'src/app/api/social/nav-counts/route.ts'), 'utf8')
const shellLayout = readFileSync(join(root, 'src/app/agency/layout.tsx'), 'utf8')

/**
 * "Waiting on you" counts THIS brand's own rows, never a global approvals feed.
 * Where it is counted moved in S2 — the department chrome used to fetch
 * `/api/scheduled-posts?status=draft,failed` itself and badge the Posts tab
 * with it, which put a queue number in the one place the owner only sees while
 * already inside the department. The queue is an attention badge in the sidebar
 * now, counted server-side for the brand.
 *
 * WHAT it counts changed on 2026-08-19, and this test changed with it. Three
 * places were each answering "what is waiting on you" privately: the layout's
 * first paint and the nav-counts route both said `status IN ('draft','failed')`
 * — 68 rows for Scent Sell — while the screen behind the badge and the Posts
 * tab beside it both showed the 17 an assistant had written and nobody had
 * approved. Pinning `['draft', 'failed']` here was pinning the disagreement.
 * The predicate now lives once, in `@/lib/posts/desk-status`, and what these
 * assertions defend is that nobody restates it. The arithmetic itself is
 * covered by `src/lib/posts/desk-status.test.ts`.
 */
test('waiting badge counts this brand through the shared predicate, not a global feed', () => {
  for (const source of [navCounts, shellLayout]) {
    assert.match(source, /'scheduled_posts'/)
    assert.match(source, /\.eq\('brand_id', brandId\)/)
    assert.match(source, /countWaitingOnYou/)
    assert.doesNotMatch(source, /\['draft', 'failed'\]/)
    assert.doesNotMatch(source, /\/api\/approvals/)
  }
  // The chrome must not grow a second, disagreeing count of the same queue.
  assert.doesNotMatch(chrome, /\/api\/approvals/)
  assert.doesNotMatch(chrome, /scheduled-posts\?/)
})

test('ReviewRoom shows the queue the badge promises and hides vendor chrome when linked', () => {
  assert.match(review, /isWaitingOnYou/)
  assert.doesNotMatch(review, /status=draft,failed/)
  assert.match(review, /hideVendorChrome/)
})

test('video tiles use thumbnail_url as an img, not a video element', () => {
  assert.match(card, /item\.thumbnail_url/)
  assert.match(card, /<img/)
  assert.doesNotMatch(card, /<video/)
})

test('quarantine is decode-failed and hides Generate / Post', () => {
  assert.match(card, /decodeFailed/)
  assert.match(card, /This file didn’t save/)
  assert.match(card, /!decodeFailed && onCreatePost/)
})

test('regenerate thumb hits the thumbnail stage only', () => {
  assert.match(processRoute, /runStages/)
  assert.match(card, /onRegenerateThumb/)
})

test('formatFileSize never prints 0KB', () => {
  assert.equal(formatFileSize(null), '')
  assert.equal(formatFileSize(67), '67 B')
  assert.notEqual(formatFileSize(67), '0KB')
})

test('linked brands skip Mixpost draft sync unless the backup toggle is on', () => {
  assert.match(draft, /publisherTransportOf/)
  assert.match(draft, /=== 'zernio'\) return base/)
})

test('webhook hears post.partial and inserts inbox as backlog', () => {
  assert.match(webhook, /post\.partial/)
  assert.match(webhook, /backlog/)
  assert.doesNotMatch(webhook, /ilike/)
  assert.doesNotMatch(webhook, /assigned_agent_id:\s*'overall'/)
})

test('connect requires a linked profile even when the map is empty', () => {
  assert.match(connect, /This business isn’t set up to connect accounts yet/)
  assert.doesNotMatch(connect, /createZernioProfile/)
})

test('Post now and Schedule confirm before sending', () => {
  assert.match(bar, /Post this now to the ticked accounts/)
  assert.match(bar, /Schedule this post to the ticked accounts/)
})

test('canonicalSocialPlatform stays in social-read-source', () => {
  assert.match(socialRead, /export function canonicalSocialPlatform/)
})

test('402 is billing-paused, not a Mixpost hop', () => {
  assert.equal(isBillingPausedError({ status: 402 }), true)
  assert.equal(isBillingPausedError({ message: 'PAYMENT_REQUIRED' }), true)
  assert.equal(isBillingPausedError({ status: 429 }), false)
})

test('missing transport key defaults to zernio when a profile is set', () => {
  assert.equal(publisherTransportOf({ zernio_profile_id: 'abc' }), 'zernio')
  assert.equal(publisherTransportOf({ zernio_profile_id: 'abc', publisher_transport: 'mixpost' }), 'mixpost')
  assert.equal(publisherTransportOf({}), 'mixpost')
})
