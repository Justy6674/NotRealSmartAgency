import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { readStockCapability } from './capability'

/**
 * The two tabs were offered for months with no supplier behind either of them.
 * These pin the shape of the answer and, just as importantly, pin that the desk
 * asks the server for it rather than reading a server-only credential in the
 * browser — the mistake that would make the tabs permanently dark again.
 */

test('nothing configured means neither tab may be offered', () => {
  const caps = readStockCapability({})
  assert.equal(caps.gifs, false)
  assert.equal(caps.photos, false)
  assert.deepEqual(caps.photoSources, [])
})

test('an empty or whitespace key is not a key', () => {
  const caps = readStockCapability({
    GIPHY_API_KEY: '',
    PEXELS_API_KEY: '   ',
    UNSPLASH_ACCESS_KEY: '\n',
  })
  assert.equal(caps.gifs, false)
  assert.equal(caps.photos, false)
  assert.deepEqual(caps.photoSources, [])
})

test('one photo supplier configured offers that one only', () => {
  const caps = readStockCapability({ UNSPLASH_ACCESS_KEY: 'set' })
  assert.equal(caps.photos, true)
  assert.deepEqual(caps.photoSources, ['unsplash'])
  // The GIF tab is a separate supplier and must not ride in on this one.
  assert.equal(caps.gifs, false)
})

test('both photo suppliers configured offers both, the default first', () => {
  const caps = readStockCapability({ PEXELS_API_KEY: 'set', UNSPLASH_ACCESS_KEY: 'set' })
  assert.deepEqual(caps.photoSources, ['pexels', 'unsplash'])
})

test('the GIF key alone switches on the GIF tab and nothing else', () => {
  const caps = readStockCapability({ GIPHY_API_KEY: 'set' })
  assert.equal(caps.gifs, true)
  assert.equal(caps.photos, false)
})

test('the capability route is behind the sign-in and never cached', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/media/stock/capabilities/route.ts'),
    'utf8',
  )
  assert.match(route, /auth\.getUser\(\)/)
  assert.match(route, /status: 401/)
  // A cached answer would keep the tabs marked "Not set up" after the
  // credentials landed, which is the exact failure this route exists to end.
  assert.match(route, /dynamic = 'force-dynamic'/)
  // Booleans only: a signed-in reader learns what is on, never what to spend.
  assert.doesNotMatch(route, /GIPHY_API_KEY|PEXELS_API_KEY|UNSPLASH_ACCESS_KEY/)
})

test('the search route and the desk agree on what is switched on', () => {
  const search = readFileSync(resolve(process.cwd(), 'src/app/api/media/stock/route.ts'), 'utf8')
  // Same helper, so a tab can never be offered by one and refused by the other.
  assert.match(search, /readStockCapability/)
})

test('the desk asks the server and treats an unknown answer as off', () => {
  const desk = readFileSync(
    resolve(process.cwd(), 'src/components/agency/studio/MediaLibrary.tsx'),
    'utf8',
  )
  assert.match(desk, /\/api\/media\/stock\/capabilities/)
  // A client-side read of a server-only credential compiles to `undefined` and
  // is wrong forever. It must never appear in a client component.
  assert.doesNotMatch(desk, /process\.env\.(GIPHY_API_KEY|PEXELS_API_KEY|UNSPLASH_ACCESS_KEY)/)
  // Unknown is off: `=== true` on both, so a null capability offers nothing.
  assert.match(desk, /externalSources\?\.gifs === true/)
  assert.match(desk, /externalSources\?\.photos === true/)
  // The picker is not mounted when it cannot search, so no skeleton grid runs.
  assert.match(desk, /gifsReady\s*\n?\s*\?\s*<GifPicker/)
  assert.match(desk, /photosReady\s*\n?\s*\?\s*<StockPhotoPicker/)
  assert.match(desk, /Not set up/)
})

test('the photo picker offers a toggle only between suppliers that are live', () => {
  const picker = readFileSync(
    resolve(process.cwd(), 'src/components/agency/studio/media/StockPhotoPicker.tsx'),
    'utf8',
  )
  assert.match(picker, /available\.length > 1/)
  assert.match(picker, /\{available\.map\(/)
})
