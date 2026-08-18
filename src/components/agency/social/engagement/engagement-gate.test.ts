import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { checkPublishAllowed } from '../../../../lib/agents/publish-gate.ts'
import { reviewOutboundWords } from '../../../../lib/agents/tools/zernio-reply.ts'

/**
 * A reply is publishing.
 *
 * `regulatory-invariants.test.ts` guards the exits that put a POST in front of
 * the public. This file guards the other four, which did not exist when that
 * one was written: a public reply under a comment, a private reply that opens a
 * direct message, a reply to a mention, and a reply under a customer review.
 *
 * For the four businesses that advertise regulated health services, every one
 * of those is advertising copy with the same AHPRA and TGA obligations as a
 * paid ad — a reply under a review is a testimonial published by the practice
 * itself. The gate is not a formality on this desk; it is most of the reason
 * the desk can exist at all.
 *
 * Two kinds of assertion below, deliberately:
 *   1. BEHAVIOUR — a reply that breaches the rules is refused, and the refusal
 *      cannot be turned into permission to send.
 *   2. WIRING — every reply path in the source reaches the shared review, found
 *      by the mechanism each one must use rather than by a list of filenames a
 *      later change can quietly leave out of date.
 */

const HEALTH_BRAND = {
  brandName: 'Downscale',
  brandSlug: 'downscale',
  complianceFlags: { ahpra: true, tga: false, tga_categories: [] as string[] },
  brandDNA: { never_do: ['guaranteed_outcomes'] },
}

const UNREGULATED_BRAND = {
  brandName: 'Scent Sell',
  brandSlug: 'scent-sell',
  complianceFlags: { ahpra: false, tga: false, tga_categories: [] as string[] },
  brandDNA: null,
}

/* ── 1. Behaviour ──────────────────────────────────────────────────────── */

test('a reply that breaches the health advertising rules is refused before it leaves', async () => {
  // The words a clinic must never publish, typed into the box under a comment.
  // The local rule check reaches this verdict without the model, which is why
  // this can be asserted rather than described.
  const review = await reviewOutboundWords({
    content: 'Yes — results are guaranteed with our program, you will lose 20kg.',
    brand: HEALTH_BRAND,
    label: 'a public reply to a comment',
  })

  assert.equal(review.allowed, false)
  assert.ok(review.allowed === false && /AHPRA/.test(review.reason))
  assert.ok(review.allowed === false && /guaranteed/i.test(review.reason))
  // The refusal carries no approval, so the reply wrapper cannot be called
  // with it — there is nothing to pass.
  assert.ok(!('approval' in review))
})

test('a refused reply cannot be turned into an approval', async () => {
  // The proof object is only obtainable from an allowed verdict. Forging one is
  // possible in any language; the point is that it would be an unmistakable
  // decision to bypass the review rather than an omission.
  const blocked = { allowed: false, reason: 'AHPRA review blocked this.', warnings: [] }
  await assert.rejects(
    async () =>
      reviewOutboundWords({
        content: 'anything at all',
        brand: HEALTH_BRAND,
        label: 'a reply',
        check: async () => blocked,
      }).then((result) => {
        if (result.allowed) return result.approval
        // Mirrors what every caller does with a refusal: stop.
        throw new Error(result.reason)
      }),
    /AHPRA/,
  )
})

test('an ordinary reply for an unregulated business goes through', async () => {
  const review = await reviewOutboundWords({
    content: 'Thanks for the kind words — glad you liked it.',
    brand: UNREGULATED_BRAND,
    label: 'a public reply to a comment',
  })

  assert.equal(review.allowed, true)
  assert.ok(review.allowed === true && review.approval.checkedWith === 'publish-gate')
})

test('an empty reply is refused rather than sent as a blank message', async () => {
  const review = await reviewOutboundWords({
    content: '   ',
    brand: UNREGULATED_BRAND,
    label: 'a reply',
  })
  assert.equal(review.allowed, false)
})

test('the shared gate is the one being used, not a private copy', async () => {
  // If these two ever disagree, the desk is reviewing content against different
  // rules from the composer, which is worse than not reviewing it at all
  // because it looks reviewed.
  const gate = await checkPublishAllowed({
    content: 'Results are guaranteed.',
    complianceFlags: HEALTH_BRAND.complianceFlags,
    brandDNA: HEALTH_BRAND.brandDNA,
    brandSlug: HEALTH_BRAND.brandSlug,
  })
  const review = await reviewOutboundWords({
    content: 'Results are guaranteed.',
    brand: HEALTH_BRAND,
    label: 'a reply',
  })

  assert.equal(gate.allowed, false)
  assert.equal(review.allowed, false)
})

/* ── 2. Wiring ─────────────────────────────────────────────────────────── */

const SRC = join(process.cwd(), 'src')

/**
 * Every mechanism by which this codebase can put words under somebody else's
 * comment, message, mention or review.
 *
 * Stated as mechanisms rather than filenames on purpose: a fifth reply surface
 * added next month is caught by the wrapper it has to call, not by whether
 * somebody remembered to add its path to a list. These names come from
 * `lib/zernio/engagement.ts`, and each of those functions requires an approval
 * that only the shared review can produce.
 */
const REPLY_EXITS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'a public reply under a post or comment', pattern: /\bawait\s+replyToZernioPost\s*\(/ },
  { name: 'a private reply to a commenter', pattern: /\bawait\s+sendZernioPrivateReply\s*\(/ },
  { name: 'a direct message', pattern: /\bawait\s+sendZernioMessage\s*\(/ },
  { name: 'a reply to a mention', pattern: /\bawait\s+replyToZernioMention\s*\(/ },
  { name: 'a reply under a customer review', pattern: /\bawait\s+replyToZernioReview\s*\(/ },
]

/** The review, or the shared helper proven above to run it. */
const REVIEWED = /\b(checkPublishAllowed|reviewOutboundWords)\s*\(/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

test('every reply that reaches a real person passes the advertising review', () => {
  const offenders: string[] = []

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    // The module that DEFINES the wrappers holds no brand context and decides
    // nothing, so its own definitions are not sends.
    if (file.endsWith(join('lib', 'zernio', 'engagement.ts'))) continue

    const exits = REPLY_EXITS.filter((exit) => exit.pattern.test(source))
    if (exits.length === 0) continue
    if (REVIEWED.test(source)) continue

    offenders.push(
      `${file.slice(SRC.length + 1)}\n    sends ${exits.map((e) => e.name).join(', ')} with no review.`,
    )
  }

  assert.deepEqual(
    offenders,
    [],
    '\nThese put words in front of a real person without the advertising review.\n' +
      'Four businesses advertise regulated health services; an unreviewed claim is\n' +
      `up to $60,000 per offence.\n\n${offenders.join('\n\n')}\n\n` +
      'Fix by calling reviewOutboundWords() and passing its approval to the send.\n',
  )
})

test('the scan is not vacuously passing', () => {
  // A guard that matches nothing reads as coverage and is worse than absent.
  const files = sourceFiles(SRC)
  const senders = files.filter((file) => {
    if (file.endsWith(join('lib', 'zernio', 'engagement.ts'))) return false
    const source = readFileSync(file, 'utf8')
    return REPLY_EXITS.some((exit) => exit.pattern.test(source))
  })

  assert.ok(
    senders.length >= 4,
    `expected the desk's reply paths to be found; found ${senders.length}`,
  )
})

test('the desk never posts to a social network from the browser', () => {
  // A component that could reach a network directly would be a way around the
  // review — the whole point of routing every send through our own endpoint.
  const desk = join(SRC, 'components', 'agency', 'social', 'engagement')
  for (const file of sourceFiles(desk)) {
    if (/\.test\.tsx?$/.test(file)) continue
    const source = readFileSync(file, 'utf8')
    assert.ok(
      !/fetch\(\s*['"`]https?:/.test(source),
      `${file.slice(SRC.length + 1)} reaches an outside address directly`,
    )
  }
})

test('automated outbound is not wired for a regulated business', () => {
  // Upstream offers workflows, sequences and comment automations that reply on
  // their own. They are deliberately absent: automated advertising for a
  // regulated health service would run behind a third party's rules engine
  // instead of in front of this one.
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    assert.ok(
      !/\bzernio\.(workflows|sequences|commentautomations)\b/i.test(source),
      `${file.slice(SRC.length + 1)} wires automated outbound, which must stay behind the review`,
    )
  }
})
