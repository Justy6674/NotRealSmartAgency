import assert from 'node:assert/strict'
import test from 'node:test'
import { describeBrandSync, manualBrandItems } from './brand-sync.ts'

const SCENT_SELL = {
  brand_colours: { background: '#fff9f1', text: '#0e0e0e', accent: '#c28237' },
  tone_of_voice: { keywords: ['fragrance', 'swap'], avoid_words: ['fake', 'luxury'] },
  brand_dna_constraints: {
    typography: { display: 'Fraunces', body: 'Manrope' },
    voice_rules: ['Write the brand as ScentSell — one word.'],
    never_do: ['imply ScentSell sells new retail stock'],
  },
  tagline: "Australia's fragrance marketplace",
  description: "Australia's pre-owned fragrance marketplace.",
  compliance_flags: { ahpra: false, tga: false },
}

test('everything Canva cannot take is collected for the owner', () => {
  // Canva's API has no endpoint for kit colours, fonts, voice or guidelines.
  // Reporting them is the only honest way to close the gap.
  const manual = manualBrandItems(SCENT_SELL)
  assert.equal(manual.colours.accent, '#c28237')
  assert.equal(manual.fonts.display, 'Fraunces')
  assert.ok(manual.voice.some((v) => v.includes('Never use: fake, luxury')))
  assert.ok(manual.voice.some((v) => v.includes('one word')))
  assert.ok(manual.guidelines.some((g) => g.includes('Tagline')))
  assert.ok(manual.guidelines.some((g) => g.includes('new retail stock')))
})

test('a regulated project says so in its guidelines', () => {
  const manual = manualBrandItems({ ...SCENT_SELL, compliance_flags: { ahpra: true, tga: true } })
  const line = manual.guidelines.find((g) => g.includes('REGULATED'))
  assert.ok(line)
  assert.match(line!, /AHPRA \+ TGA/)
  assert.match(line!, /reviewed before it publishes/)
})

test('an empty project reports empty rather than throwing', () => {
  const manual = manualBrandItems({})
  assert.deepEqual(manual.colours, {})
  assert.deepEqual(manual.voice, [])
})

test('the report names what synced and what must be typed', () => {
  const text = describeBrandSync({
    ok: true, project: 'ScentSell', logoAssetId: 'MAHQ55q51kU', folderId: 'FAF123',
    manual: manualBrandItems(SCENT_SELL),
  })
  assert.match(text, /Logo uploaded to Canva/)
  assert.match(text, /Folder ready/)
  assert.match(text, /no way to receive these over its API/)
  assert.match(text, /Fraunces for headings, Manrope for body/)
})

test('a failed sync still hands over the manual list', () => {
  // The list is the part he actually needs, and it does not depend on the
  // connection working.
  const text = describeBrandSync({
    ok: false, project: 'ScentSell', manual: manualBrandItems(SCENT_SELL),
    error: 'Canva is not connected.',
  })
  assert.match(text, /Canva is not connected/)
  assert.match(text, /#c28237/)
})
