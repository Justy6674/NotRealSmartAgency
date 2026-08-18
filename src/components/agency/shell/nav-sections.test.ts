import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  defaultNavOffIds,
  NAV_SECTIONS,
  parseNavOffIds,
  READY_NAV_SECTION_ID,
  serializeNavOffIds,
  toggleNavOff,
} from './nav-sections'

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

test('every section starts Off except Social', () => {
  const off = defaultNavOffIds()
  assert.equal(off.has('social'), false)
  assert.equal(off.has('dashboard'), true)
  assert.equal(off.has('settings'), true)
  assert.equal(off.size, NAV_SECTIONS.length - 1)
})

test('On and Off are a click on that section, not one switch for the rest', () => {
  const started = defaultNavOffIds()
  const dashboardOn = toggleNavOff(started, 'dashboard')
  assert.equal(dashboardOn.has('dashboard'), false)
  assert.equal(dashboardOn.has('blogging'), true)
  const dashboardOffAgain = toggleNavOff(dashboardOn, 'dashboard')
  assert.equal(dashboardOffAgain.has('dashboard'), true)
  const socialOff = toggleNavOff(started, 'social')
  assert.equal(socialOff.has('social'), true)
})

test('a stored list of Off sections is what comes back, junk dropped', () => {
  const stored = parseNavOffIds(serializeNavOffIds(new Set(['dashboard', 'blogging'])))
  assert.deepEqual([...stored].sort(), ['blogging', 'dashboard'])
  assert.equal(parseNavOffIds('["not-a-room"]').has('dashboard'), false)
  assert.equal(parseNavOffIds('not-json').has('dashboard'), true)
  assert.equal(parseNavOffIds(null, '0').size, 0)
})

test('each side-nav row has its own On and Off control', () => {
  const sidebar = readFileSync(
    resolve(process.cwd(), 'src/components/agency/shell/AgencySidebar.tsx'),
    'utf8',
  )
  assert.match(sidebar, /Turn \$\{section\.label\} on/)
  assert.match(sidebar, /\{dimmed \? 'Off' : 'On'\}/)
  assert.doesNotMatch(sidebar, /Grey out the rest/)
  assert.doesNotMatch(sidebar, /Show the rest/)
})
