import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { NAV_SECTIONS, READY_NAV_SECTION_ID } from './nav-sections'

test('Social media is the first section in the side nav', () => {
  assert.equal(NAV_SECTIONS[0]?.id, 'social')
  assert.equal(NAV_SECTIONS[0]?.label, 'Social media')
  assert.equal(READY_NAV_SECTION_ID, 'social')
})

test('This business stays a divider at the bottom', () => {
  const last = NAV_SECTIONS.at(-1)
  assert.equal(last?.id, 'settings')
  assert.equal(last?.groupLabel, 'This business')
})

test('the sidebar can grey out every section that is not Social', () => {
  const sidebar = readFileSync(
    resolve(process.cwd(), 'src/components/agency/shell/AgencySidebar.tsx'),
    'utf8',
  )
  assert.match(sidebar, /Grey out the rest/)
  assert.match(sidebar, /Show the rest/)
  assert.match(sidebar, /nrs-nav-dim-unready/)
  assert.match(sidebar, /dimUnready && !isReadyNavSection\(section\.id\)/)
})
