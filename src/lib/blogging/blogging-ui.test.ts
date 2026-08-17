import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ui = readFileSync(
  resolve(process.cwd(), 'src/components/agency/blogging/BloggingDepartment.tsx'),
  'utf8',
)

test('blogging is a copy-paste handover, never a website publisher', () => {
  assert.match(ui, /Copy the text/)
  assert.match(ui, /put this on my site/)
  assert.match(ui, /What to write next/)
  assert.doesNotMatch(ui, /publish(?:ed)? (?:it |this )?to (?:your |their )?website/i)
  assert.doesNotMatch(ui, /Mixpost|Zernio|OAuth|AbeAI|Abe AI/)
})

test('health checklist is gated on the business, not shown as generic chrome', () => {
  assert.match(ui, /healthcare/)
  assert.match(ui, /Checked before you publish/)
})
