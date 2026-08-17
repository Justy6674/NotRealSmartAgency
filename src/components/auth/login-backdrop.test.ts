import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The login page is the one surface every subscriber meets on every session,
 * and its brand and layout must not depend on a decoration succeeding.
 *
 * The fault this locks down: the water-ripple backdrop calls
 * `new THREE.WebGLRenderer()`, which THROWS when a context cannot be created —
 * no GPU, WebGL disabled by policy, a sandboxed or remote browser. The reveal
 * (`setRippleReady(true)`) sat at the END of that init, and the promise was
 * consumed with `.then()` and no `.catch()`. So the rejection went nowhere and
 * the logo stayed at `opacity: 0` forever — while its 480px still occupied the
 * layout, shoving the form to the bottom of an unbranded black page. Nothing
 * logged; it just looked broken.
 *
 * Asserted against the source because the failure only reproduces in a browser
 * that cannot make a WebGL context, which is exactly the environment a unit
 * test does not have.
 */

const source = readFileSync(
  join(process.cwd(), 'src/components/auth/LoginPageClient.tsx'),
  'utf8',
)

test('a backdrop that cannot start is caught rather than left to reject', () => {
  assert.match(
    source,
    /init\(\)[\s\S]{0,200}?\.catch\(/,
    'the WebGL init promise must be caught — an unhandled rejection strands the reveal',
  )
  assert.ok(
    source.includes('setRippleFailed(true)'),
    'the catch must record the failure so the page can reveal itself without the effect',
  )
})

test('the brand reveals even when the backdrop never paints', () => {
  // Every gate that reveals content must accept the failure state. If a new
  // element is gated on `rippleReady` alone it inherits the original bug.
  const gates = source.match(/rippleReady[^,\n]*\?/g) ?? []
  assert.ok(gates.length > 0, 'expected the reveal to still be gated on readiness')
  for (const gate of gates) {
    assert.ok(
      gate.includes('rippleFailed'),
      `a reveal gate ignores the failure state and would stay invisible: ${gate}`,
    )
  }
})

test('the static backdrop covers WebGL failure, not just mobile', () => {
  assert.match(
    source,
    /\(isMobile \|\| rippleFailed\)/,
    'without this the page falls back to flat black instead of the gradient',
  )
})

test('sign-in cannot leave the button stuck on Signing in forever', () => {
  assert.match(
    source,
    /Promise\.race/,
    'signInWithPassword must race a timeout — otherwise a hung gotrue lock never clears loading',
  )
  assert.match(
    source,
    /setLoading\(false\)/,
    'the timeout path must unstick the button',
  )
})
