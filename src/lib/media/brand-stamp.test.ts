import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { stampLogo, stampPosition } from './brand-stamp.ts'

async function square(size: number, colour: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...colour, alpha: 1 } } })
    .png().toBuffer()
}

test('the mark sits in the corner asked for, inside the margin', () => {
  const at = stampPosition('bottom-right', { width: 1000, height: 1000 }, { width: 100, height: 100 }, 0.05)
  assert.equal(at.left, 850)
  assert.equal(at.top, 850)

  const topLeft = stampPosition('top-left', { width: 1000, height: 1000 }, { width: 100, height: 100 }, 0.05)
  assert.deepEqual(topLeft, { left: 50, top: 50 })
})

test('a logo wider than its frame is pulled back on-frame, never off it', () => {
  const at = stampPosition('bottom-right', { width: 200, height: 200 }, { width: 400, height: 400 }, 0.05)
  assert.equal(at.left, 0)
  assert.equal(at.top, 0)
})

test('an image comes back branded and the same size', async () => {
  const image = await square(1024, { r: 250, g: 245, b: 235 })
  const logo = await square(256, { r: 20, g: 20, b: 20 })

  const out = await stampLogo(image, logo)
  const meta = await sharp(out).metadata()

  assert.equal(meta.width, 1024)
  assert.equal(meta.height, 1024)
  assert.notEqual(out.length, image.length, 'the image must actually change')
})

test('the mark lands in the corner, not across the middle', async () => {
  const image = await square(400, { r: 255, g: 255, b: 255 })
  const logo = await square(200, { r: 0, g: 0, b: 0 })

  const out = await stampLogo(image, logo, { scale: 0.2, margin: 0.05 })
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })

  const px = (x: number, y: number) => data[(y * info.width + x) * info.channels]
  assert.ok(px(200, 200) > 200, 'the centre of the image must be untouched')
  assert.ok(px(340, 340) < 200, 'the bottom-right corner must carry the mark')
})

test('a logo that will not decode costs the image nothing', async () => {
  // An unbranded image is a shortfall. A corrupted one is a broken post.
  const image = await square(256, { r: 10, g: 10, b: 10 })
  const out = await stampLogo(image, Buffer.from('not an image at all'))
  assert.equal(out.length, image.length)
})
