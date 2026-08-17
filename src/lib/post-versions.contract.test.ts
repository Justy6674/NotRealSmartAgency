import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The per-platform caption was written and read by nothing.
 *
 * A user rewrote the Instagram caption, saw the preview redraw with a
 * "customised" badge under it, pressed Save — and Instagram received the master
 * caption. Both halves of the screen were sincere: the preview read the
 * per-platform version, the save handler read the master, and neither knew the
 * other existed.
 *
 * The obvious fix was to thread the per-platform value through the save
 * handler. That repairs this screen and leaves the class of bug intact: the
 * next surface to grow a Save button starts from the master again, because
 * nothing says it must not. So the rule lives in ONE function,
 * resolvePublishCaption, and this file's job is to keep both surfaces calling
 * it. A future edit that quietly stops calling it fails the build here.
 *
 * Source-contract, in the shape of src/lib/errors/no-raw-errors.test.ts:
 * these are .tsx components with browser state and network calls, so they are
 * read rather than executed.
 */

const ROOT = process.cwd()

const SHARED = 'src/lib/post-versions.ts'
const CREATOR = 'src/components/agency/studio/post/PostCreator.tsx'
const PREVIEW = 'src/components/agency/studio/preview/MultiPlatformPreview.tsx'

/**
 * Comments are stripped before anything is matched. House style is to record
 * the fault in a comment above the fix, so the file that correctly explains
 * "the badge read versions[platform].isCustomised straight off the stored
 * object" would otherwise be failed for saying so — and, worse, a file that
 * merely mentions resolvePublishCaption in a TODO would read as having called
 * it. Only code counts, in both directions.
 */
function read(relative: string): string {
  const path = join(ROOT, relative)
  assert.ok(existsSync(path), `${relative} has moved or been renamed — this contract is now guarding nothing`)
  return (
    readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments and JSDoc, including {/* … */} in JSX
      .replace(/(^|[^:])\/\/[^\n]*/gm, '$1') // line comments, sparing the // in https://
  )
}

/**
 * PostCreator.handleSave is where the master caption used to win. Slice it out
 * so an unrelated resolvePublishCaption call elsewhere in an 800-line component
 * cannot make this file pass.
 */
function saveHandler(source: string): string {
  const start = source.indexOf('const handleSave')
  assert.ok(
    start !== -1,
    `${CREATOR}: the save handler is gone or renamed. Whatever replaced it must still resolve the per-platform caption — update this contract deliberately, do not delete it.`,
  )
  // The next declaration at component scope. Everything inside the handler is
  // indented further than two spaces, so this does not cut the handler short.
  const end = source.indexOf('\n  const ', start + 1)
  return source.slice(start, end === -1 ? source.length : end)
}

test('the rule lives in one function, and the old preview helper defers to it', () => {
  const shared = read(SHARED)
  assert.match(
    shared,
    /export function resolvePublishCaption\s*\(/,
    'resolvePublishCaption is the single resolver both surfaces call',
  )

  // getVersionForPlatform is what the preview grew up calling. If it keeps its
  // own copy of the rule, the two drift apart the first time one is fixed alone
  // — which is how the caption and the badge came to disagree in the first place.
  const helper = shared.slice(shared.indexOf('export function getVersionForPlatform'))
  assert.match(
    helper,
    /resolvePublishCaption\s*\(/,
    'getVersionForPlatform must delegate to resolvePublishCaption, not re-decide',
  )
})

test('both composer surfaces import the shared resolver', () => {
  for (const file of [CREATOR, PREVIEW]) {
    assert.match(
      read(file),
      /import\s*\{[^}]*\bresolvePublishCaption\b[^}]*\}\s*from\s*'@\/lib\/post-versions'/,
      `${file} must take the caption rule from @/lib/post-versions rather than deciding for itself`,
    )
  }
})

const RESOLVE = /resolvePublishCaption\s*\(([\s\S]*?)\)/g
const WRITE = /fetch\(\s*'\/api\/scheduled-posts'/g
/** Iterating the ticked platforms, in either shape the component has used. */
const FAN_OUT = /for\s*\(\s*const\s+\w*[Pp]latform\w*\s+of|selectedPlatforms\s*\.\s*map\s*\(/g

const offsets = (re: RegExp, region: string) => [...region.matchAll(re)].map((m) => m.index!)

/**
 * Every row this region writes, paired with the point after which its caption
 * must have been resolved: whichever came later, the previous row or the start
 * of the loop it is being written inside.
 */
function writeSegments(region: string): { write: number; from: number }[] {
  const writes = offsets(WRITE, region)
  const loops = offsets(FAN_OUT, region)
  let previous = 0
  return writes.map((write) => {
    const enclosingLoop = loops.filter((l) => l < write).pop() ?? 0
    const segment = { write, from: Math.max(previous, enclosingLoop) }
    previous = write
    return segment
  })
}

test('the save handler resolves the caption per platform before it writes', () => {
  const handler = saveHandler(read(CREATOR))

  assert.match(
    handler,
    /resolvePublishCaption\s*\(/,
    `${CREATOR}: handleSave sends whatever caption it was holding. That is the bug — the per-platform rewrite the user watched appear on screen never reaches the platform.`,
  )

  const segments = writeSegments(handler)
  assert.ok(
    segments.length > 0,
    `${CREATOR}: handleSave no longer writes to /api/scheduled-posts — re-point this contract at wherever it writes now`,
  )

  // One resolution per row, INSIDE the loop that writes it. A call hoisted just
  // above the loop is the original bug wearing a new function name — it reads
  // as fixed, and every platform still receives one shared caption.
  //
  // handleSave writes twice: the edit-mode PATCH and the per-platform POST. A
  // fix that reaches only one of them is how a customised caption would survive
  // on a new post and vanish the moment the user edited it.
  const resolves = offsets(RESOLVE, handler)
  for (const { write, from } of segments) {
    assert.ok(
      resolves.some((r) => r >= from && r < write),
      `${CREATOR}: the row written at offset ${write} of handleSave has no resolvePublishCaption of its own after offset ${from}. Resolve inside the loop, once per platform — a call hoisted above it gives every platform the same caption.`,
    )
  }

  // And each resolution must be told which platform it is for.
  for (const [, args] of handler.matchAll(RESOLVE)) {
    assert.match(
      args,
      /platform/i,
      `${CREATOR}: resolvePublishCaption was given no platform — every platform would get the same caption again. Arguments were: ${args.trim()}`,
    )
  }
})

test('the save handler no longer posts the master caption under the caption key', () => {
  const handler = saveHandler(read(CREATOR))

  // `caption,` is the shorthand that sent the master. It cannot be the resolved
  // value: a `const { caption } = resolvePublishCaption(..., caption, ...)` in
  // the same scope reads its own binding before it is initialised.
  assert.doesNotMatch(
    handler,
    /^\s*caption,\s*$/m,
    `${CREATOR}: the request body still carries the master caption in shorthand. Send the resolved one.`,
  )
  assert.doesNotMatch(
    handler,
    /caption:\s*caption\b/,
    `${CREATOR}: the request body still carries the master caption. Send the resolved one.`,
  )
})

test('the preview renders what the save handler will send', () => {
  const preview = read(PREVIEW)

  assert.match(
    preview,
    /resolvePublishCaption\s*\(/,
    `${PREVIEW}: the preview must show the caption the publish path resolves, not one it works out separately`,
  )

  const args = preview.match(/resolvePublishCaption\s*\(([\s\S]*?)\)/)
  assert.ok(args, `${PREVIEW}: could not read the arguments to resolvePublishCaption`)
  assert.match(args[1], /\bplatform\b/, `${PREVIEW}: each phone frame must resolve for its own platform`)
})

test('the customised badge reports the resolution, not the stored flag', () => {
  // This is the original fault in miniature. A customisation the user emptied
  // still carries isCustomised: true, so a badge read straight off the stored
  // object says "customised" while the master caption is what publishes. The
  // badge has to come from the same verdict as the words above it.
  const preview = read(PREVIEW)
  assert.doesNotMatch(
    preview,
    /versions\s*\??\.?\s*\[[^\]]*\]\s*\??\.\s*isCustomised/,
    `${PREVIEW}: the badge is read straight off the stored versions object. Use the isCustomised that resolvePublishCaption returned.`,
  )
})

test('neither surface keeps its own copy of the rule', () => {
  // A ternary on isCustomised is the rule, hand-rolled. Three copies of it is
  // how the editor, the preview and the save handler came to disagree about
  // what an emptied caption means.
  for (const file of [CREATOR, PREVIEW]) {
    assert.doesNotMatch(
      read(file),
      /isCustomised\s*(\?[^.?]|\)\s*\?)/,
      `${file} decides for itself whether a platform is customised. That decision belongs in resolvePublishCaption.`,
    )
  }
})

test('the contract is not vacuously passing', () => {
  // Every assertion above is a regex over text. If a path went stale or a
  // pattern stopped matching the shape it exists to catch, this file would go
  // green over the very bug it was written for.
  const creator = read(CREATOR)
  assert.ok(creator.length > 10_000, `${CREATOR} is suspiciously small — is this still the composer?`)
  assert.ok(read(PREVIEW).includes('PlatformMockupPreview'), `${PREVIEW} is no longer the phone-frame preview`)

  // Comment stripping must remove comments and nothing else. If it ate the
  // code as well, every doesNotMatch above would pass on an empty string.
  const stripped = readFileSync(join(ROOT, PREVIEW), 'utf8').length - read(PREVIEW).length
  assert.ok(stripped > 0, `${PREVIEW}: comment stripping removed nothing — is it still working?`)
  assert.ok(read(PREVIEW).includes('export function MultiPlatformPreview'), 'comment stripping ate the code')

  const handler = saveHandler(creator)
  assert.ok(handler.length > 200, 'the save-handler slice came back empty')
  assert.ok(handler.length < creator.length, 'the save-handler slice is the whole file, so it proves nothing')

  // A slice that cut the handler short would go green while the row it stopped
  // reading still posted the master caption. Every write in the component has
  // to be inside the region this contract inspects.
  assert.equal(
    offsets(WRITE, handler).length,
    offsets(WRITE, creator).length,
    `${CREATOR}: a row is written to /api/scheduled-posts outside handleSave, where nothing above checks it. Either move it in or widen this contract deliberately.`,
  )
  assert.ok(offsets(WRITE, handler).length >= 2, `${CREATOR}: expected both the edit PATCH and the per-platform POST inside handleSave`)

  // The shapes these patterns exist to catch, and must still catch.
  const masterShorthand = "        body: JSON.stringify({\n          platform,\n          caption,\n          hashtags,\n        })"
  assert.match(masterShorthand, /^\s*caption,\s*$/m, 'the master-shorthand pattern no longer matches the bug')

  const handRolled = 'const text = versions[platform]?.isCustomised ? versions[platform].caption : masterCaption'
  assert.match(handRolled, /isCustomised\s*(\?[^.?]|\)\s*\?)/, 'the hand-rolled-rule pattern no longer matches the bug')
  assert.match(handRolled, /versions\s*\??\.?\s*\[[^\]]*\]\s*\??\.\s*isCustomised/, 'the raw-flag pattern no longer matches the bug')

  // And optional chaining, which is how the badge reads it today.
  assert.match(
    '{versions?.[platform]?.isCustomised && <span>customised</span>}',
    /versions\s*\??\.?\s*\[[^\]]*\]\s*\??\.\s*isCustomised/,
    'the raw-flag pattern misses the optional-chained read',
  )

  // The shape the per-write check exists to catch, and the one it must not
  // mistake for it. Both resolve; only the second resolves per platform.
  const hoisted = `
    const publish = resolvePublishCaption(versions, selectedPlatforms[0], caption, hashtags)
    for (const platform of selectedPlatforms) {
      await fetch('/api/scheduled-posts', { method: 'POST', body: publish.caption })
    }
  `
  const perPlatform = `
    for (const platform of selectedPlatforms) {
      const publish = resolvePublishCaption(versions, platform, caption, hashtags)
      await fetch('/api/scheduled-posts', { method: 'POST', body: publish.caption })
    }
  `
  const satisfied = (region: string) => {
    const resolves = offsets(RESOLVE, region)
    return writeSegments(region).every(({ write, from }) => resolves.some((r) => r >= from && r < write))
  }
  assert.equal(writeSegments(hoisted).length, 1, 'the write pattern no longer finds the row')
  assert.equal(satisfied(hoisted), false, 'a resolution hoisted above the loop must not read as fixed')
  assert.equal(satisfied(perPlatform), true, 'a resolution inside the loop must read as fixed')
})
