import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Some regulatory guarantees are decisions about wiring, not behaviour a unit
 * test can exercise: which transport the review uses, and whether every exit
 * to a live account passes the shared gate. Those are the ones most easily
 * undone by a later change that looks harmless, so they are asserted against
 * the source itself.
 */

const root = join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

test('the regulatory review runs on the same transport as every other call', () => {
  // It reached a provider directly while everything else went through the
  // Gateway, which made it the one call with no fallback when a provider was
  // down — and, for a regulated project, an outage stops publishing entirely.
  const source = read('lib/agents/compliance-filter.ts')

  assert.ok(source.includes('gateway('), 'the review must go through the Gateway')
  assert.ok(
    !/from '@ai-sdk\/(anthropic|openai|google)'/.test(source),
    'the review must not reach a provider directly — it loses the fallback chain',
  )
})

test('regulated content keeps its retention and training controls', () => {
  const source = read('lib/agents/compliance-filter.ts')
  assert.ok(
    source.includes('zeroDataRetention'),
    'a health call must not be sent without zero-retention routing',
  )
  assert.ok(
    source.includes('getGatewayRouteProviderOptions'),
    'the shared Gateway policy carries the no-training setting',
  )
})

test('the cost of reviewing regulated content is attributed', () => {
  const source = read('lib/agents/compliance-filter.ts')
  assert.ok(source.includes('estimateGatewayCost'), 'the review must report what it cost')
  assert.ok(source.includes('result.spend'), 'the cost must reach the caller')
})

/* ────────────────────────────────────────────────────────────────────────────
 * THE CHOKEPOINT
 *
 * This section used to be one loop over three hard-coded filenames, asserting
 * each contained the string 'checkPublishAllowed'. It proved those three still
 * called the gate and said nothing whatever about a fourth. blotato_publish,
 * manage_posts' queue/approve actions and the two /api/mixpost/posts/[postId]
 * routes were all added afterwards, all reach a live account, and all passed
 * this file because it never looked at them.
 *
 * Then the scheduled publisher was changed to delegate to the dispatcher, and
 * the literal string legitimately left it. The obvious edit at that point was
 * to drop the cron from the list so the suite went green. That would have been
 * exactly backwards: the list was already the weak part, and shortening it
 * would have permanently removed the only assertion covering the busiest
 * publishing path in the codebase, to accommodate a change that made that path
 * safer. A guard you edit to match the code is not a guard.
 *
 * So the rule is stated the other way round now, the way
 * src/app/api/auth-coverage.test.ts states its own: find every MECHANISM by
 * which this codebase can put words in front of the public, and require each
 * one to reach checkPublishAllowed. A new publisher is caught by the mechanism
 * it must use, not by whether somebody remembered to add it to a list.
 * ──────────────────────────────────────────────────────────────────────────── */

interface Exit {
  readonly name: string
  readonly pattern: RegExp
}

/**
 * Every way this codebase can cause something to appear on a real account.
 *
 * `await` is required on the function-call signals so that the transports which
 * DEFINE them are not mistaken for callers: lib/mixpost/client.ts,
 * lib/zernio/client.ts and lib/blotato/client.ts hold no brand context and
 * decide nothing, and an import line naming the function is not a send.
 */
const LIVE_SEND: readonly Exit[] = [
  { name: 'Mixpost immediate publish (schedule_now: true)', pattern: /schedule_now:\s*true/ },
  { name: 'Mixpost server-side schedule (schedule: true)', pattern: /schedule:\s*true/ },
  { name: 'Mixpost queue (addMixpostPostToQueue)', pattern: /\bawait\s+addMixpostPostToQueue\s*\(/ },
  { name: 'Mixpost approve (approveMixpostPost)', pattern: /\bawait\s+approveMixpostPost\s*\(/ },
  { name: 'Zernio publish (createZernioPost)', pattern: /\bawait\s+createZernioPost\s*\(/ },
  { name: 'Blotato publish (blotatoCreatePost)', pattern: /\bawait\s+blotatoCreatePost\s*\(/ },
  { name: 'a native platform publisher (publisher.publish)', pattern: /\bpublisher\.publish\s*\(/ },
]

/**
 * Publishers that were removed on purpose and must not reappear unnoticed.
 *
 * Ayrshare was a live branch of the scheduled publisher until the cron was
 * routed through the dispatcher. It assembled its caption differently from
 * every other path — hashtags in a separate field rather than in the body, no
 * '#' prefix — so the same stored row reached the public as different words
 * depending on which environment variables happened to be set. It is asserted
 * to match NOTHING rather than deleted, because re-adding it is a new exit to
 * a live account and should have to be argued for here.
 */
const RETIRED: readonly Exit[] = [
  { name: 'Ayrshare publish', pattern: /app\.ayrshare\.com\/api\/post/ },
]

/** The chokepoint, and the one delegation proven below to reach it. */
const GATE = /\bcheckPublishAllowed\s*\(/
const DELEGATE = /\bawait\s+publishToPlatform\s*\(/

/**
 * An exit that reaches the same verdict without importing the gate.
 *
 * Recognised by the markers listed, never by path alone — each marker is a
 * check the shared gate performs, and an entry that quietly loses one fails
 * 'a reviewed inline equivalent is still equivalent'. This list may only shrink.
 */
const INLINE_EQUIVALENT: Record<string, readonly RegExp[]> = {
  'lib/agents/tools/publish-to-social.ts': [
    /validateScentSellProductClaims\s*\(/,
    /runComplianceFilter\s*\(/,
    /if \(!check\.isValid\)/,
    /!check\.checkCompleted && \(complianceFlags\.ahpra \|\| complianceFlags\.tga\)/,
    /COMPLIANCE CHECK ERROR — post NOT published\./,
  ],
}

/**
 * Live exits that have NO regulatory review at all, recorded so that the scan
 * reports the rest honestly instead of being switched off.
 *
 * This is a register of open exposure, not an exemption. Nothing here is
 * asserted to be safe; each entry is asserted to STILL BE A HOLE, so an entry
 * that gains a gate fails as stale and has to be deleted. The list is capped
 * below and can therefore only ever shrink — a NEW ungated publisher cannot be
 * parked here, it fails the scan.
 *
 * Every one of these can put words on a live account for the four projects that
 * advertise regulated health services. Closing them means loading the brand's
 * compliance_flags, brand_dna_constraints and slug and refusing on
 * !gate.allowed before the send — copy app/api/scheduled-posts/publish-now.
 */
const UNGATED_EXITS_KNOWN: Record<string, string> = {
  'lib/agents/tools/blotato.ts':
    'blotato_publish sends the model\'s text verbatim to any connected account, immediately when scheduledAt is omitted. It takes account ids as opaque strings and is never given a brand, so nothing ties the destination to the project whose rules would apply.',
  'lib/agents/tools/manage-posts.ts':
    'The queue and approve actions hand an existing Mixpost draft to Mixpost\'s own publisher, then set the NRS row to scheduled so the cron creates a second copy. The draft was reviewed when it was written; the words can have been edited since.',
  'app/api/mixpost/posts/[postId]/queue/route.ts':
    'Twenty-one lines: authenticate, then queue the post. Authentication answers who is asking, never whether the content passed a review.',
  'app/api/mixpost/posts/[postId]/approve/route.ts':
    'The same shape as the queue route, approving a post into Mixpost\'s publishing queue with no regulatory check.',
}

function sourceFiles(dir: string = root): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

const rel = (path: string) => path.slice(root.length + 1)
const exitsIn = (source: string) => LIVE_SEND.filter((e) => e.pattern.test(source))
const gated = (source: string) => GATE.test(source) || DELEGATE.test(source)

/** Where the regulatory decision is made in a file, or Infinity if nowhere. */
function reviewIndex(path: string, source: string): number {
  const markers = INLINE_EQUIVALENT[path] ?? [GATE, DELEGATE]
  return Math.min(
    ...markers.map((p) => {
      const match = p.exec(source)
      return match ? match.index : Infinity
    }),
  )
}

test('every exit to a live account reaches the shared publishing gate', () => {
  const offenders: string[] = []

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8')
    const exits = exitsIn(source)
    if (exits.length === 0) continue

    const path = rel(file)
    if (gated(source)) continue
    if (INLINE_EQUIVALENT[path]) continue
    if (UNGATED_EXITS_KNOWN[path]) continue

    offenders.push(
      `${path}\n    reaches a live account via ${exits.map((e) => e.name).join(', ')} with no regulatory review.`,
    )
  }

  assert.deepEqual(
    offenders,
    [],
    '\nThese put words in front of the public without passing checkPublishAllowed.\n' +
      'Four projects advertise regulated health services; an unreviewed claim is up\n' +
      `to $60,000 per offence.\n\n${offenders.join('\n\n')}\n\n` +
      'Fix by calling checkPublishAllowed before the send and refusing on\n' +
      '!gate.allowed — copy app/api/scheduled-posts/publish-now/route.ts.\n' +
      'Do not add a path to INLINE_EQUIVALENT or UNGATED_EXITS_KNOWN to make this\n' +
      'go green; both are capped and policed by the tests below.\n',
  )
})

/**
 * The three files the old version named, kept by name on purpose.
 *
 * Delegation counts, because 'the dispatcher exemption is still only a retry'
 * and 'the gate runs before the send' below independently prove that reaching
 * publishToPlatform reaches the review ahead of the platform call. Nothing had
 * to be deleted from this list for the cron's refactor to pass it.
 */
test('every route to a live account passes the shared publishing gate', () => {
  for (const file of [
    'app/api/cron/publish-posts/route.ts',
    'app/api/scheduled-posts/publish-now/route.ts',
    'lib/publishers/dispatcher.ts',
  ]) {
    assert.ok(
      gated(read(file)),
      `${file} publishes without reaching the shared gate, directly or by delegating to publishToPlatform`,
    )
  }
})

test('the scheduled publisher no longer picks its own backend', () => {
  // The fault this pins. This route chose Zernio whenever a matching account
  // existed and fell through to Mixpost otherwise, while
  // /api/scheduled-posts/publish-now had no Zernio code in it at all. The
  // Review panel puts both buttons on the same row, so one stored post landed
  // on the Zernio-connected account under "Schedule" and the Mixpost-connected
  // account under "Publish now" — two separate OAuth connections to two
  // separate services, with nothing asserting they point at the same page.
  const cron = read('app/api/cron/publish-posts/route.ts')

  assert.match(cron, DELEGATE, 'the scheduled publisher must go through the one door')

  for (const [name, pattern] of [
    ['a Zernio send', /\bawait\s+createZernioPost\s*\(/],
    ['a Mixpost send', /\bawait\s+createMixpostPost\s*\(/],
    ['its own Mixpost account matching', /resolveAccountIdsForPlatform\s*\(/],
    ['its own Mixpost media upload', /\bawait\s+uploadMediaFromUrl\s*\(/],
    ['an Ayrshare send', /app\.ayrshare\.com/],
  ] as const) {
    assert.doesNotMatch(
      cron,
      pattern,
      `the scheduled publisher has taken back ${name} — backend choice belongs to selectPublisherBackend, or the two publishing paths drift apart again`,
    )
  }
})

test('the gate runs before the send, not after', () => {
  // A gate called after the platform call is decoration. dispatcher.ts already
  // puts it ahead of rate limiting and media validation for this reason.
  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8')
    const exits = exitsIn(source)
    const path = rel(file)
    if (exits.length === 0) continue
    if (!gated(source) && !INLINE_EQUIVALENT[path]) continue

    const reviewAt = reviewIndex(path, source)
    const sendAt = Math.min(...exits.map((e) => e.pattern.exec(source)!.index))
    assert.ok(
      reviewAt < sendAt,
      `${path} sends before it checks — the review must precede the platform call`,
    )
  }
})

test('a reviewed inline equivalent is still equivalent', () => {
  // An exception that quietly loses one of its checks would go on excusing the
  // file. publish_to_social already drifted once: its incomplete-review branch
  // tested complianceFlags.ahpra only, so DownscaleDerm's TGA claims went out.
  for (const [path, markers] of Object.entries(INLINE_EQUIVALENT)) {
    const source = read(path)
    assert.ok(
      exitsIn(source).length > 0,
      `${path} no longer publishes — delete this entry from INLINE_EQUIVALENT`,
    )
    assert.ok(
      !GATE.test(source),
      `${path} now calls checkPublishAllowed — delete this entry, it needs no excusing`,
    )
    for (const marker of markers) {
      assert.match(
        source,
        marker,
        `${path} lost an inline check the shared gate performs: ${marker}`,
      )
    }
  }
})

test('the register of ungated exits can only shrink', () => {
  // Recording a hole is not closing it. Each entry has to still BE a hole:
  // one that has gained a gate is stale and must be deleted, which is the only
  // direction this list is allowed to move. The cap stops a new ungated
  // publisher being parked here instead of fixed.
  assert.ok(
    Object.keys(UNGATED_EXITS_KNOWN).length <= 4,
    'a new ungated publishing path was added to the register instead of being gated',
  )

  for (const [path, reason] of Object.entries(UNGATED_EXITS_KNOWN)) {
    const source = read(path)
    assert.ok(
      exitsIn(source).length > 0,
      `${path} no longer reaches a live account — delete this entry`,
    )
    assert.ok(
      !gated(source) && !INLINE_EQUIVALENT[path],
      `${path} is gated now — delete this entry so the scan covers it properly`,
    )
    assert.ok(
      reason.length > 40,
      `${path} needs a written reason describing what is exposed`,
    )
  }
})

test('a publish is scoped to the project that asked for it', () => {
  // A review is only worth anything if the words land where they were reviewed.
  //
  // Measured against the live Mixpost workspace on 2026-08-17: nineteen
  // accounts are connected across six projects — six Instagram, seven Facebook
  // Pages, three YouTube, two LinkedIn, one TikTok. `resolveAccountIdsForPlatform`
  // filters by PLATFORM only, so handing it the whole workspace resolves one
  // Instagram post to all six Instagram accounts. A Downscale weight-loss claim,
  // reviewed against Downscale's AHPRA and TGA flags, would then also publish to
  // Scent Sell, Underground Parfums, DoToday, Endorse Me and TeleScribe — none
  // of which carry those flags, and none of which the review ever considered.
  // Passing the gate and then broadcasting is not passing the gate.
  //
  // Two mechanisms in this codebase tie a Mixpost account to a project, and one
  // of them has to run before the platform filter: mapAccountsToBrandsRaw, or
  // the `social_urls.mixpost_account_ids` overrides it honours.
  const dispatcher = read('lib/publishers/dispatcher.ts')

  const scoping = /mapAccountsToBrandsRaw|mixpost_account_ids/.exec(dispatcher)
  assert.ok(
    scoping,
    'the dispatcher resolves Mixpost accounts without narrowing them to the project first — every project connected to that platform would receive the post',
  )

  const resolveAt = /resolveAccountIdsForPlatform\s*\(\s*req\./.exec(dispatcher)
  if (resolveAt) {
    assert.ok(
      scoping.index < resolveAt.index,
      'the project narrowing must happen before the platform filter, or the platform filter is applied to the whole workspace',
    )
  }
})

test('the gate itself still fails closed in both directions', () => {
  const gate = read('lib/agents/publish-gate.ts')
  assert.match(gate, /catch \(error\)[\s\S]{0,600}?allowed: false/, 'a review that threw must block')
  assert.match(
    gate,
    /if \(!check\.isValid\)[\s\S]{0,300}?allowed: false/,
    'a review that found violations must block',
  )
  assert.match(
    gate,
    /if \(!check\.checkCompleted\)[\s\S]{0,300}?allowed: false/,
    'a review that could not run must block',
  )
  assert.equal(
    (gate.match(/return ALLOWED/g) ?? []).length,
    1,
    'there is one early pass and it is the unregulated branch — a second is a new bypass',
  )
  assert.match(
    gate,
    /if \(!flags\.ahpra && !flags\.tga\) return ALLOWED/,
    'and that pass must still be conditioned on the project being unregulated',
  )
})

test('the dispatcher exemption is still only a retry', () => {
  // attempt === 1 is the one documented skip: a retry re-sends content that
  // already passed. Any further condition on that branch is a new bypass, and
  // a named flag to turn the review off is not a condition, it is a door.
  const dispatcher = read('lib/publishers/dispatcher.ts')
  assert.match(dispatcher, GATE, 'the one door must still run the review')
  assert.doesNotMatch(dispatcher, /if \(attempt === 1 && /)
  assert.doesNotMatch(dispatcher, /skipGate|bypassGate|skipCompliance|skipReview/)
})

test('nobody who publishes hand-rolls the regulatory decision', () => {
  // The verdict is reached in publish-gate.ts. Every other copy drifts:
  // publish_to_social's already did, and it is the only exit allowed to keep
  // one, under the markers asserted above.
  const rogue = sourceFiles()
    .filter((file) => {
      const source = readFileSync(file, 'utf8')
      return exitsIn(source).length > 0 && /\brunComplianceFilter\s*\(/.test(source)
    })
    .map(rel)
    .filter((path) => !INLINE_EQUIVALENT[path])

  assert.deepEqual(
    rogue,
    [],
    `\nThese publish AND re-implement the review instead of calling the gate:\n${rogue.join('\n')}\n`,
  )
})

test('the chokepoint scan is not vacuously passing', () => {
  const files = sourceFiles()
  assert.ok(files.length > 600, `expected the whole source tree, found ${files.length}`)

  const exits = files.filter((f) => exitsIn(readFileSync(f, 'utf8')).length > 0)
  assert.ok(exits.length >= 7, `expected every known publishing exit, found ${exits.length}`)
  assert.ok(
    exits.filter((f) => gated(readFileSync(f, 'utf8'))).length >= 2,
    'the gate must be recognised where it is genuinely called',
  )

  // The shape this test exists to catch: a live send, no gate anywhere near it.
  const hole = 'const result = await createMixpostPost({ accounts, versions, schedule_now: true })'
  assert.ok(exitsIn(hole).length > 0, 'the live-send patterns must match the shape they exist to catch')
  assert.equal(gated(hole), false, 'an ungated send must not read as gated')

  // And real gated exits must pass on their own merits — one calling the gate,
  // one reaching it by delegating.
  assert.ok(gated(read('app/api/scheduled-posts/publish-now/route.ts')))
  assert.ok(gated(read('app/api/cron/publish-posts/route.ts')))
})

test('every live-send signal still matches real code', () => {
  // A pattern matching nothing is a renamed API or a typo, and either way it is
  // protecting nothing. Removing a publisher means moving its signal into
  // RETIRED on purpose, in this file, where somebody has to read the reason.
  const sources = sourceFiles().map((f) => readFileSync(f, 'utf8'))

  const unused = LIVE_SEND.filter((e) => !sources.some((s) => e.pattern.test(s))).map((e) => e.name)
  assert.deepEqual(unused, [], `\nThese live-send signals match nothing:\n${unused.join('\n')}\n`)

  const returned = RETIRED.filter((e) => sources.some((s) => e.pattern.test(s))).map((e) => e.name)
  assert.deepEqual(
    returned,
    [],
    `\nA retired publisher is back in the tree without a decision:\n${returned.join('\n')}\n`,
  )
})

test('the outputs library is gated for regulated projects', () => {
  const source = read('lib/agents/tools/save-output.ts')
  assert.ok(
    source.includes('complianceGateForSave'),
    'failed content saved to the library returns later as an example to copy',
  )
})

/**
 * Every writer into the library, not just the one that was remembered.
 *
 * `save_output` gated correctly and `write_blog` did not. It ran
 * `runComplianceFilter` for health brands, wrapped it in a try/catch commented
 * "Non-blocking", stored the verdict in metadata, and then inserted the row
 * unconditionally. So the SAME AHPRA-violating article was refused when the
 * Director saved it and kept when the Director wrote it — and because
 * `query_outputs` is given to every department, the kept copy came back as an
 * example for later work to imitate. That is exactly the contagion save-gate.ts
 * exists to stop, entering through the door nobody checked.
 *
 * A blog article is advertising under the same regime as the social posts. This
 * enumerates the writers rather than trusting that the next one remembers.
 */
test('every tool that writes into the outputs library gates on the review', () => {
  for (const file of [
    'lib/agents/tools/save-output.ts',
    'lib/agents/tools/write-blog.ts',
  ]) {
    const source = read(file)
    assert.ok(
      source.includes('complianceGateForSave'),
      `${file} writes to outputs without gating on the regulatory review`,
    )
    assert.doesNotMatch(
      source,
      /catch\s*\{\s*(\/\/[^\n]*)?\s*\}\s*\n[\s\S]{0,400}?\.from\('outputs'\)\s*\n\s*\.insert/,
      `${file} swallows a failed review and inserts anyway — a review that could not run must block`,
    )
  }
})

test('creating a project settles its regulatory flags', () => {
  const source = read('app/api/brands/route.ts')
  assert.ok(
    source.includes('applyHealthFlags'),
    'a health project created without flags publishes unreviewed, silently',
  )
})

test('the publishing tool blocks on a review that did not complete', () => {
  const source = read('lib/agents/tools/publish-to-social.ts')
  assert.ok(source.includes('checkCompleted'), 'an absent review must not read as a pass')
})
