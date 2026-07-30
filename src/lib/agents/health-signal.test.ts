import assert from 'node:assert/strict'
import test from 'node:test'
import { applyHealthFlags, detectRegulatedHealth } from './health-signal.ts'

test('a weight loss clinic is recognised as regulated under both regimes', () => {
  const signal = detectRegulatedHealth({
    name: 'Downscale Weight Loss',
    niche: 'Telehealth weight loss clinic',
    description: 'Nurse practitioner led weight loss with prescription medication.',
  })
  assert.equal(signal.regulated, true)
  assert.equal(signal.ahpra, true)
  assert.equal(signal.tga, true)
})

test('a skincare project is recognised as therapeutic goods', () => {
  const signal = detectRegulatedHealth({ name: 'DownscaleDerm', niche: 'Medical skincare' })
  assert.equal(signal.tga, true)
})

test('a fragrance marketplace is not treated as a health service', () => {
  const signal = detectRegulatedHealth({
    name: 'Scent Sell',
    niche: 'Fragrance marketplace',
    description: 'Buy, sell and swap fragrance in Australia.',
  })
  assert.equal(signal.regulated, false)
  assert.equal(signal.ahpra, false)
  assert.equal(signal.tga, false)
})

test('creating a health project without flags cannot silently skip review', () => {
  // The gap this closes: compliance_flags was optional, so a clinic added with
  // none published everything unreviewed and nothing said so.
  const applied = applyHealthFlags(
    { name: 'TeleCheck Clinic', niche: 'Telehealth consultations for patients' },
    undefined,
  )
  assert.equal(applied.compliance_flags.ahpra, true)
  assert.ok(applied.notice, 'turning a flag on silently is the bug, not the fix')
  assert.match(applied.notice!, /reviewed/i)
})

test('an explicit choice is never overridden downwards', () => {
  const applied = applyHealthFlags(
    { name: 'Downscale', niche: 'weight loss clinic' },
    { ahpra: true, tga: true, tga_categories: ['prescription'] },
  )
  assert.equal(applied.compliance_flags.ahpra, true)
  assert.equal(applied.compliance_flags.tga, true)
  assert.deepEqual(applied.compliance_flags.tga_categories, ['prescription'])
  assert.equal(applied.notice, null, 'nothing was added, so there is nothing to announce')
})

test('an unregulated project is left alone and told nothing', () => {
  const applied = applyHealthFlags({ name: 'Sniffopotamus', niche: 'Fragrance discovery' }, undefined)
  assert.equal(applied.compliance_flags.ahpra, false)
  assert.equal(applied.compliance_flags.tga, false)
  assert.equal(applied.notice, null)
})

test('a project created from almost nothing still gets read', () => {
  const applied = applyHealthFlags({ name: 'Brisbane Skin Clinic' }, undefined)
  assert.equal(applied.compliance_flags.ahpra, true)
})
