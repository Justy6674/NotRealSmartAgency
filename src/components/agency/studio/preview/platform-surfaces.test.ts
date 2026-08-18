import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The preview pane showed a dark-mode fiction of a post that publishes to a
 * white feed, and the owner screenshotted it.
 *
 * Every frame in this folder was built in April against a dark desk, so every
 * one of them painted a near-black ground: `oklch(0.08 0.005 240)` on Facebook
 * and LinkedIn, `oklch(0.04 0 0)` on Threads, and — worse — NOTHING at all on
 * Instagram, which was therefore transparent and inherited the dark screen
 * PhoneFrame hard-coded behind it. The desk is cream paper now and the networks
 * were always light, so the pane was answering the one question it exists to
 * answer — does my post look right — with a picture of a phone nobody has.
 *
 * Two things make this regress rather than stay fixed, and this file guards
 * both:
 *
 *  1. A frame that says nothing about its ground gets whatever the substrate
 *     happens to be. That is how Instagram broke without a single wrong line in
 *     InstagramMockup.tsx. So every frame must state its ground OUT LOUD.
 *  2. "Make it consistent" is the obvious next edit, and it is wrong: TikTok is
 *     genuinely black. A rule of "all light" would be as false as the old "all
 *     dark", so the expectation is per platform and written down below.
 *
 * Source-contract, in the shape of `src/lib/post-versions.contract.test.ts`:
 * these are .tsx components with browser state, so they are read, not executed.
 */

const ROOT = process.cwd()
const DIR = 'src/components/agency/studio/preview'
const FRAME = `${DIR}/PhoneFrame.tsx`

/**
 * What each network's feed actually is, and how light its ground must be.
 *
 * `light` is the claim "a person opening this app sees a pale screen". The
 * threshold is oklch lightness, which is perceptual, so 0.9 means genuinely
 * paper-white rather than merely lighter than it was — a mid-grey would sail
 * past a looser bar while still misdescribing every one of these products.
 */
const SURFACES: Record<string, { light: boolean; why: string }> = {
  FacebookMockup: { light: true, why: 'the feed is #f0f2f5 with white cards' },
  InstagramMockup: { light: true, why: 'the feed is white with #dbdbdb hairlines' },
  LinkedInMockup: { light: true, why: 'the feed is the warm off-white #f4f2ee' },
  BlueskyMockup: { light: true, why: 'white; Bluesky ships dark but does not default to it' },
  MastodonMockup: { light: true, why: "Mastodon's light theme — see the note in the component" },
  PinterestMockup: { light: true, why: 'white; Pinterest has no dark web theme at all' },
  ThreadsMockup: { light: true, why: 'white, the Instagram palette' },
  YouTubeMockup: { light: true, why: 'the watch page is white — this frame is not Shorts' },
  GoogleBusinessMockup: { light: true, why: 'white, and it always was' },
  TikTokMockup: { light: false, why: 'full-bleed video on black, and there is no light variant' },
}

function read(relative: string): string {
  const path = join(ROOT, relative)
  assert.ok(existsSync(path), `${relative} has moved or been renamed — this contract is now guarding nothing`)
  return readFileSync(path, 'utf8')
}

/**
 * Comments carry the reasoning here, and the reasoning quotes the platforms'
 * published hex values so the oklch conversions stay checkable by hand. Those
 * quotes must not read as hex in the code, and a colour merely NAMED in a TODO
 * must not read as a colour that was used. Only code counts, in both directions.
 */
function code(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
}

const mockups = () =>
  readdirSync(join(ROOT, DIR))
    .filter((f) => f.endsWith('Mockup.tsx'))
    .map((f) => f.replace(/\.tsx$/, ''))

/** The oklch lightness of a literal, or null if it is not an oklch literal. */
function lightness(literal: string): number | null {
  const m = literal.match(/oklch\(\s*([0-9.]+)/)
  return m ? Number(m[1]) : null
}

/**
 * The ground a mockup hands PhoneFrame, resolved through the named constant it
 * is almost always written as. Reading `screen={FEED}` and stopping there would
 * let a frame declare a ground and still paint it black.
 */
function declaredScreen(name: string): string {
  const source = code(`${DIR}/${name}.tsx`)

  const prop = source.match(/<PhoneFrame[^>]*\sscreen=\{([^}]+)\}/)
  assert.ok(
    prop,
    `${name}: no screen= on its PhoneFrame, so it inherits whatever the frame happens to paint. That is exactly how InstagramMockup rendered near-black without a wrong line in it — state the ground.`,
  )

  const expression = prop[1].trim()
  if (expression.startsWith("'") || expression.startsWith('"')) return expression.slice(1, -1)

  const constant = source.match(new RegExp(`const\\s+${expression}\\s*=\\s*['"]([^'"]+)['"]`))
  assert.ok(
    constant,
    `${name}: screen={${expression}} does not resolve to a literal in this file, so nothing here can check what colour it is.`,
  )
  return constant[1]
}

test('every platform frame states its own ground', () => {
  const found = mockups()
  assert.ok(found.length >= 10, `only ${found.length} mockups found in ${DIR} — has the folder moved?`)

  for (const name of found) {
    assert.ok(
      name in SURFACES,
      `${name} is a new platform frame with no entry in SURFACES. Decide what the real product looks like and write it down here — do not let it default.`,
    )
    const screen = declaredScreen(name)
    assert.match(
      screen,
      /^oklch\(/,
      `${name}: the ground is "${screen}", which is not an oklch literal. DESIGN.md is oklch-only.`,
    )
  }
})

test('the light networks are light and TikTok is not', () => {
  for (const name of mockups()) {
    const { light, why } = SURFACES[name]
    const screen = declaredScreen(name)
    const L = lightness(screen)
    assert.ok(L !== null, `${name}: could not read a lightness out of "${screen}"`)

    if (light) {
      assert.ok(
        L >= 0.9,
        `${name}: ground is ${screen} (L ${L}), which is not a light surface — ${why}. This is the April bug: the preview shows a dark-mode fiction of a post that publishes to a pale feed.`,
      )
    } else {
      assert.ok(
        L <= 0.3,
        `${name}: ground is ${screen} (L ${L}). Do NOT repaint this one for consistency — ${why}. Making it light would be the same class of error as the dark frames it sits beside.`,
      )
    }
  }
})

test('the frame no longer hard-codes a dark screen behind everything', () => {
  const frame = code(FRAME)

  assert.match(
    frame,
    /screen\s*=\s*'oklch\(1 0 0\)'/,
    `${FRAME}: the screen substrate must default to white. A frame that forgets to declare its ground should fail towards the common case, not towards the near-black this replaced.`,
  )
  assert.match(
    frame,
    /background:\s*screen/,
    `${FRAME}: the screen element is not painted from the prop, so what a mockup declares is ignored.`,
  )

  // The bezel is a phone and stays dark; the SCREEN must not be. Anything dark
  // left in this file has to be bezel furniture, so pin the count rather than
  // banning dark outright.
  const screenBlock = frame.slice(frame.indexOf('Screen content'))
  assert.doesNotMatch(
    screenBlock,
    /background:\s*'oklch\(0\.[0-2]/,
    `${FRAME}: a dark literal is back on the screen element. That is the leak — every transparent child inherits it.`,
  )
})

test('the frames imitate the platforms, not our chrome', () => {
  // These are pictures of somebody else's product. Retinting them from the
  // selected business would make the pane agree with the desk around it and
  // disagree with the phone the post lands on, which is the only screen that
  // decides whether the owner was shown the truth.
  for (const name of mockups()) {
    const source = code(`${DIR}/${name}.tsx`)
    assert.doesNotMatch(
      source,
      /--brand|--care|--panel|--ink\b/,
      `${name} reaches for a house token. A platform frame takes its colours from that platform — a Facebook preview in our brand hue is a prettier lie.`,
    )
  }
})

test('no hex anywhere in the frames', () => {
  // DESIGN.md: oklch only, never hex in new UI code. GoogleBusinessMockup was
  // the exception — a bare `#fff` plus the four Google logo hues — and it is
  // the file most likely to grow one back, because brand guidelines are
  // published in hex.
  for (const name of [...mockups(), 'PhoneFrame']) {
    const source = code(`${DIR}/${name}.tsx`)
      // `#${tag}` is a hashtag being rendered, not a colour.
      .replace(/`#\$\{[^`]*`/g, '')
      .replace(/\/\^#\//g, '')

    const hex = source.match(/#[0-9a-fA-F]{3,8}\b/)
    assert.equal(
      hex,
      null,
      `${name}: ${hex?.[0]} is a hex colour in code. DESIGN.md is oklch-only — convert it and leave the hex in a comment so the conversion stays checkable.`,
    )
  }
})

test('the contract is not vacuously passing', () => {
  // Every assertion above is a regex over text. If comment stripping ate the
  // code, or a path went stale, this file would go green over the bug it exists
  // to catch.
  const frame = code(FRAME)
  assert.ok(frame.includes('export function PhoneFrame'), 'comment stripping ate the code')
  assert.ok(read(FRAME).length > frame.length, `${FRAME}: comment stripping removed nothing — is it still working?`)

  for (const name of mockups()) {
    const source = code(`${DIR}/${name}.tsx`)
    assert.ok(source.includes('<PhoneFrame'), `${name} no longer renders a phone frame`)
    assert.ok(source.length > 800, `${name} is suspiciously small — is this still a platform frame?`)
  }

  // Both halves of the lightness rule must still be able to fail.
  assert.equal(lightness('oklch(0.08 0.005 240)'), 0.08, 'the lightness reader no longer parses the old dark ground')
  assert.equal(lightness('oklch(1 0 0)'), 1, 'the lightness reader no longer parses white')
  assert.equal(lightness('#f0f2f5'), null, 'the lightness reader must not accept a hex value as oklch')

  // The shape the screen check exists to catch: a frame with no ground at all,
  // which is what InstagramMockup was.
  assert.doesNotMatch('<PhoneFrame aspect={aspect}>', /<PhoneFrame[^>]*\sscreen=\{/, 'the missing-ground pattern no longer matches the bug')
  assert.match('<PhoneFrame aspect={aspect} screen={FEED}>', /<PhoneFrame[^>]*\sscreen=\{([^}]+)\}/, 'the declared-ground pattern stopped matching')

  // And that SURFACES is a real expectation rather than an empty object that
  // makes the per-platform loops iterate over nothing.
  assert.ok(Object.values(SURFACES).some((s) => s.light), 'SURFACES claims no network is light')
  assert.ok(Object.values(SURFACES).some((s) => !s.light), 'SURFACES claims every network is light — TikTok is not')
})
