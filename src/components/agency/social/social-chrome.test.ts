import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  NAV_SECTIONS,
  SOCIAL_TAB_IDS,
  SOCIAL_TABS,
  socialTabIdFromPath,
  visibleChildren,
} from '../shell/nav-sections'

/**
 * The Social department's tab strip, held to the two things that were wrong
 * with it and cannot be allowed back.
 *
 * 1. THE UNION AND THE RENDERED LIST HAVE TO BE THE SAME SET. `SocialTabId`
 *    declared `accounts` and `waiting`; the array the chrome rendered declared
 *    neither. Standing on /agency/social/accounts the panel therefore announced
 *    `aria-labelledby="social-tab-accounts"`, pointing at a button that has
 *    never existed in the document, so a screen reader read a panel with no
 *    name. It was invisible in every other way, which is exactly why it lasted.
 *
 * 2. THE MEASUREMENTS ARE THE CONTRACT. `.mockups/dept-social.html` and
 *    DESIGN.md agree on header 20/26/0, tab strip nested at margin-top 14px,
 *    pane 18px 26px 26px. The chrome shipped 24/12 with a pane that did not
 *    scroll, which is why every child screen grew its own scroller and its own
 *    padding and no two agreed.
 */

const chrome = readFileSync(
  resolve(process.cwd(), 'src/components/agency/social/SocialDepartmentChrome.tsx'),
  'utf8',
)

test('the tab id union is read off the rendered list, so the two cannot drift', () => {
  assert.deepEqual(
    SOCIAL_TABS.map((tab) => tab.id),
    [...SOCIAL_TAB_IDS],
  )
  // No duplicates — two tabs sharing an id would share a DOM id too.
  assert.equal(new Set(SOCIAL_TAB_IDS).size, SOCIAL_TAB_IDS.length)
})

test('every tab has a destination, an icon and plain-language copy', () => {
  for (const tab of SOCIAL_TABS) {
    assert.ok(tab.href.startsWith('/agency/social'), `${tab.id} leaves the department`)
    assert.ok(tab.icon, `${tab.id} has no icon`)
    assert.ok(tab.label.trim().length > 0, `${tab.id} has no label`)
    assert.doesNotMatch(
      tab.label,
      /mixpost|zernio|oauth|\bapi\b|asset/i,
      `${tab.id} names plumbing the owner does not know about`,
    )
  }
})

test('a Social route with no tab of its own answers null rather than a phantom tab', () => {
  // Sidebar destinations under Setup. They are real places; they are not tabs.
  assert.equal(socialTabIdFromPath('/agency/social/accounts'), null)
  assert.equal(socialTabIdFromPath('/agency/social/nowhere'), null)
  assert.equal(socialTabIdFromPath('/agency/engagement'), null)
})

test('every tab route resolves back to its own tab', () => {
  for (const tab of SOCIAL_TABS) {
    assert.equal(socialTabIdFromPath(tab.href), tab.id, `${tab.href} did not resolve to ${tab.id}`)
  }
  // The department opens on the work.
  assert.equal(socialTabIdFromPath('/agency/social'), 'compose')
  assert.equal(socialTabIdFromPath('/agency/social/compose'), 'compose')
})

test('the panel only names a tab that is actually in the strip', () => {
  // The tabpanel labelling is chosen from `activeTab`, which is the nullable
  // result above. A bare template literal here would put the orphan back.
  assert.doesNotMatch(chrome, /aria-labelledby=\{`social-tab-/)
  assert.match(chrome, /departmentTabId\('social', activeTab\)/)
  assert.match(chrome, /'aria-label': 'Social media'/)
})

test('the chrome keeps the locked measurements', () => {
  assert.match(chrome, /px-\[26px\] pt-\[20px\] pb-0/, 'department header is not 20px 26px 0')
  assert.match(chrome, /className="mt-\[14px\]"/, 'tab strip is not nested at margin-top 14px')
  assert.match(
    chrome,
    /overflow-y-auto px-\[26px\] pt-\[18px\] pb-\[26px\]/,
    'the pane is not the 18px 26px 26px scroller',
  )
  assert.doesNotMatch(chrome, /max-w-7xl|container mx-auto/, 'the pane must not be centred')
})

test('the action bar is a department-owned slot, pinned last and empty by default', () => {
  assert.match(chrome, /SOCIAL_ACTION_BAR_ATTR = 'data-social-action-bar'/)
  assert.match(chrome, /export function SocialActionBar/)
  assert.match(chrome, /shrink-0 border-t[^"]*empty:hidden/)
})

test('the sidebar still carries the queue and the reconnect count', () => {
  const social = NAV_SECTIONS.find((section) => section.id === 'social')
  assert.ok(social, 'Social media section is missing')

  const children = visibleChildren(social, false).filter((child) => child.kind === 'link')
  const waiting = children.find((child) => child.id === 'social-waiting')
  const accounts = children.find((child) => child.id === 'social-accounts')

  assert.equal(waiting?.countId, 'social-waiting', 'the approval queue carries no count')
  assert.equal(accounts?.countId, 'social-accounts', 'nothing tells the owner an account dropped out')
})

test('the layout passes the counts the sidebar has always taken', () => {
  const layout = readFileSync(resolve(process.cwd(), 'src/app/agency/layout.tsx'), 'utf8')
  assert.match(layout, /counts=\{counts\}/)
  assert.match(layout, /countsBrandId=/)
  assert.match(layout, /businessSubtitle=\{businessSubtitle\}/)
})

test('no callback drops the owner back into the retired Studio', () => {
  const callbacks = [
    'src/app/api/oauth/meta/callback/route.ts',
    'src/app/api/oauth/twitter/callback/route.ts',
    'src/app/api/oauth/tiktok/callback/route.ts',
    'src/app/api/oauth/youtube/callback/route.ts',
    'src/app/api/oauth/linkedin/callback/route.ts',
    'src/app/api/zernio/callback/route.ts',
  ]
  for (const path of callbacks) {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    assert.doesNotMatch(source, /\/agency\/studio/, `${path} still lands outside the department`)
    assert.match(source, /\/agency\/social\/accounts/, `${path} does not land on Social accounts`)
  }
})
