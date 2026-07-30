import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { AVAILABLE_FONTS, headlineSize, prepareLogo, renderSlide, resolveFont } from './slide-renderer.ts'

const SCENT_SELL = {
  name: 'Scent Sell', displayFont: 'Fraunces', bodyFont: 'Manrope',
  colours: { background: '#fff9f1', text: '#0e0e0e', accent: '#c28237' },
}
const UNDERGROUND = {
  name: 'Underground Parfums', displayFont: 'Instrument Serif', bodyFont: 'DM Sans',
  colours: { background: '#faf6ee', text: '#1a1612', accent: '#8f5640' },
}

test('both focus brands have their real typefaces bundled', () => {
  // The image model used its own serif for everything, so a patient app read
  // exactly like a fragrance marketplace.
  for (const f of ['Fraunces', 'Manrope', 'Instrument Serif', 'DM Sans']) {
    assert.ok(AVAILABLE_FONTS.includes(f), `${f} is not bundled`)
  }
})

test('a font we do not ship falls back rather than failing the slide', () => {
  assert.equal(resolveFont('Fraunces', 'Manrope'), 'Fraunces')
  assert.equal(resolveFont('Comic Sans MS', 'Manrope'), 'Manrope')
})

test('headline size steps with length, and coarsely enough to stay consistent', () => {
  assert.ok(headlineSize('Short one') > headlineSize('A considerably longer headline that runs on and on and on'))
  // Two slides of similar length must land on the same size or the set stops
  // reading as one design.
  assert.equal(headlineSize('Got a bottle collecting dust?'), headlineSize('Swap it instead of selling it.'))
})

test('a slide renders at the size asked for', async () => {
  const png = await renderSlide(SCENT_SELL, { headline: 'Got a bottle collecting dust?' }, 540)
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, 540)
  assert.equal(meta.height, 540)
})

test('the brand background is actually painted', async () => {
  const png = await renderSlide(SCENT_SELL, { headline: 'Test' }, 200)
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  // Top-left corner is padding, so it carries the background colour.
  const [r, g, b] = [data[0], data[1], data[2]]
  assert.equal(r, 0xff); assert.equal(g, 0xf9); assert.equal(b, 0xf1)
})

test('two brands do not produce the same slide', async () => {
  // The whole complaint: every project looked identical because only two hex
  // codes ever changed.
  const a = await renderSlide(SCENT_SELL, { headline: 'The same words' }, 300)
  const b = await renderSlide(UNDERGROUND, { headline: 'The same words' }, 300)
  assert.notEqual(a.toString('base64'), b.toString('base64'))
})

test('the same brand and words render identically every time', async () => {
  // A template that varies is not a template.
  const a = await renderSlide(SCENT_SELL, { headline: 'Repeatable', step: '01 / 07' }, 300)
  const b = await renderSlide(SCENT_SELL, { headline: 'Repeatable', step: '01 / 07' }, 300)
  assert.equal(a.toString('base64'), b.toString('base64'))
})

test('a white-backed favicon loses its tile', async () => {
  // Several brand logos are favicons on solid white. Left alone they render as
  // a white box stuck in the corner, which is what the first batch looked like.
  const withTile = await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite([{
    input: await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).png().toBuffer(),
    left: 30, top: 30,
  }]).png().toBuffer()

  const prepared = await prepareLogo(withTile, 40, '#fff9f1')
  const meta = await sharp(prepared).metadata()

  // Trimming the white leaves only the mark, so the result is far smaller
  // than the tile it arrived on.
  assert.ok((meta.width ?? 999) <= 40, 'the white tile must be trimmed away')
})
