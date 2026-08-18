import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkPublishAllowed, isNonProseOptionKey, outboundTextForReview } from '../agents/publish-gate.ts'
import { buildCaption, outboundContentForReview } from './dispatcher.ts'
import { COMPOSER_FIELDS } from './zernio-platform-data.ts'
import { outboundWordsOf, priorSendDiffers } from './publish-ticked.ts'
import type { PublishRequest } from './types.ts'

/**
 * The gate must read every word that goes out, not just the caption.
 *
 * THE FAULT it pins: `checkPublishAllowed` was handed `buildCaption(req)` —
 * caption, hashtags, sign-off — while the composer had grown six more fields
 * that reach a live account as readable words. The worst case is an X thread:
 * when `threadItems` is present the top-level content is display-only and is
 * NEVER published, so the reviewed text was the only text that did not go out.
 *
 * Downscale Weight Loss, TeleScribe, ManClinic and downscale-derm advertise
 * regulated health services. An unreviewed guaranteed-outcome claim in a first
 * comment is up to $60,000 per offence.
 */

const HEALTH_BRAND = { ahpra: true, tga: false, tga_categories: [] }
const HEALTH_DNA = { never_do: ['guaranteed_outcomes'] }

/** Clean copy. Nothing here would ever be blocked. */
const CLEAN_CAPTION = 'A short note about our weight management clinic, and how to book a chat.'

function req(overrides: Partial<PublishRequest>): PublishRequest {
  return {
    scheduled_post_id: 'post-1',
    brand_id: 'brand-1',
    account_id: 'account-1',
    platform: 'twitter',
    caption: CLEAN_CAPTION,
    media: [],
    ...overrides,
  }
}

// ── The escape itself ───────────────────────────────────────────────────────

test('an X thread is reviewed — the caption on a thread is the text that is NOT published', () => {
  const content = outboundContentForReview(
    req({
      platform: 'twitter',
      platform_options: {
        thread_items: [
          'Our programme works for everyone.',
          'Results are guaranteed within twelve weeks.',
        ],
      },
    }),
  )

  assert.match(content, /Results are guaranteed within twelve weeks\./)
  assert.match(content, /Our programme works for everyone\./)
})

test('a first comment is reviewed on every network that ships one', () => {
  for (const platform of ['instagram', 'facebook', 'youtube', 'linkedin'] as const) {
    const content = outboundContentForReview(
      req({ platform, platform_options: { first_comment: 'Weight loss guaranteed, no exceptions.' } }),
    )
    assert.match(content, /Weight loss guaranteed, no exceptions\./, platform)
  }
})

test('titles are reviewed — Facebook, YouTube and the LinkedIn document title', () => {
  const facebook = outboundContentForReview(
    req({ platform: 'facebook', platform_options: { title: 'Guaranteed 20kg' } }),
  )
  const youtube = outboundContentForReview(
    req({ platform: 'youtube', platform_options: { title: 'Guaranteed 20kg' } }),
  )
  const linkedin = outboundContentForReview(
    req({ platform: 'linkedin', platform_options: { document_title: 'Guaranteed 20kg' } }),
  )

  for (const content of [facebook, youtube, linkedin]) {
    assert.match(content, /Guaranteed 20kg/)
  }
})

// ── The refusal, through the real gate, on both transports ──────────────────

test('ZERNIO TRANSPORT: a health brand is refused for a claim in the thread, not just the caption', async () => {
  const request = req({
    platform: 'twitter',
    platform_options: {
      // Every publisher-only field of the Zernio path at once, so the reviewed
      // text is the whole post rather than the part that happens to be listed.
      first_comment: 'Book now.',
      reply_settings: 'everyone',
      thread_items: ['Step one is a chat.', 'Results are guaranteed.'],
    },
  })

  const gate = await checkPublishAllowed({
    content: outboundContentForReview(request),
    complianceFlags: HEALTH_BRAND,
    brandDNA: HEALTH_DNA,
    label: 'Downscale Weight Loss → twitter',
  })

  assert.equal(gate.allowed, false)
  // Named, not merely blocked: an "unverified" block would also be false here,
  // and would pass while the claim went out.
  assert.match(gate.reason ?? '', /guaranteed/i)

  // And the control: the words the gate USED to be given carry no claim at all,
  // so the old input could never have produced that refusal.
  assert.doesNotMatch(buildCaption(request), /guaranteed/i)
})

test('MIXPOST TRANSPORT: the YouTube title it ships is reviewed too', async () => {
  const request = req({
    platform: 'youtube',
    platform_options: { title: 'Guaranteed results in 12 weeks', privacy: 'public', made_for_kids: false },
    metadata: { source: 'cron/publish-posts', youtube_title: 'Guaranteed results in 12 weeks' },
  })

  const gate = await checkPublishAllowed({
    content: outboundContentForReview(request),
    complianceFlags: HEALTH_BRAND,
    brandDNA: HEALTH_DNA,
    label: 'Downscale Weight Loss → youtube',
  })

  assert.equal(gate.allowed, false)
  assert.match(gate.reason ?? '', /guaranteed/i)
  assert.doesNotMatch(buildCaption(request), /guaranteed/i)
})

// ── Why it is a deny-list, not a list of the seven fields we know about ─────

test('a composer field nobody has thought of yet is reviewed by default', () => {
  const content = outboundContentForReview(
    req({ platform_options: { some_field_added_next_month: 'Results are guaranteed.' } }),
  )

  assert.match(content, /Results are guaranteed\./)
})

test('machinery is left out — ids, links, enums, switches and credentials', () => {
  const content = outboundContentForReview(
    req({
      platform_options: {
        cover_image_url: 'https://example.com/guaranteed-cover.jpg',
        playlist: 'PL123',
        category: '22',
        privacy: 'public',
        reply_settings: 'following',
        commercial_content: 'paid_partnership',
        collaborators: ['someclinic'],
        share_to_feed: true,
        made_for_kids: false,
        account_id: 'acc-9',
        token: 'secret-value',
      },
    }),
  )

  assert.equal(content, CLEAN_CAPTION)
})

test('every composer field that ships is classified — words reviewed, machinery not', () => {
  /** Fields whose value is text a reader sees. Every one of these must be reviewed. */
  const PROSE = new Set(['first_comment', 'title', 'document_title', 'thread_items'])
  /** Fields that only ever carry a yes/no. A switch cannot make a health claim. */
  const SWITCHES = new Set([
    'share_to_feed', 'ai_disclosure', 'allow_comments', 'allow_duet', 'allow_stitch',
    'brand_partnership', 'auto_add_music', 'made_for_kids', 'link_preview', 'sensitive_media',
  ])

  for (const [platform, fields] of Object.entries(COMPOSER_FIELDS)) {
    for (const [key, status] of Object.entries(fields)) {
      if (!status.ships) continue

      if (PROSE.has(key)) {
        const value = key === 'thread_items' ? ['A claim of guarantee.'] : 'A claim of guarantee.'
        const content = outboundContentForReview(
          req({ platform: platform as PublishRequest['platform'], platform_options: { [key]: value } }),
        )
        assert.match(content, /A claim of guarantee\./, `${platform}.${key} escaped the review`)
        assert.equal(isNonProseOptionKey(key), false, `${platform}.${key} is prose and must not be denied`)
        continue
      }

      // Anything else must be machinery on purpose — a denied key or a switch.
      // A new field that is neither fails here AND is reviewed by default, so
      // the only way to lose one is to add it to the deny-list deliberately.
      assert.ok(
        isNonProseOptionKey(key) || SWITCHES.has(key),
        `${platform}.${key} is neither reviewed as words nor known machinery — classify it`,
      )
    }
  }
})

test('a nested shape is walked, so an object-shaped thread does not escape', () => {
  const content = outboundContentForReview(
    req({ platform_options: { thread_items: [{ content: 'Results are guaranteed.' }] } }),
  )

  assert.match(content, /Results are guaranteed\./)
})

test('the extra text is labelled, so a block message names the field to fix', () => {
  const content = outboundTextForReview({
    caption: CLEAN_CAPTION,
    platformOptions: { first_comment: 'Guaranteed.' },
  })

  assert.match(content, /first comment: Guaranteed\./)
})

// ── The wiring, on the one door ─────────────────────────────────────────────

const dispatcher = readFileSync(join(process.cwd(), 'src/lib/publishers/dispatcher.ts'), 'utf8')

test('the gate is given the outbound words, and runs before either transport', () => {
  assert.match(dispatcher, /content: outboundContentForReview\(req\)/)
  // The old input, which reviewed the caption and nothing else.
  assert.doesNotMatch(dispatcher, /content: buildCaption\(req\)/)

  const gateAt = dispatcher.indexOf('checkPublishAllowed({')
  const zernioAt = dispatcher.indexOf('createZernioPost({')
  const mixpostAt = dispatcher.indexOf('createMixpostPost({')

  assert.ok(gateAt > 0 && zernioAt > gateAt, 'the Zernio send must come after the review')
  assert.ok(mixpostAt > gateAt, 'the Mixpost send must come after the review')
})

test('every backend records the words it sent, so a later call can see an edit', () => {
  const recorded = dispatcher.match(/outbound_words: outboundContentForReview\(req\)/g) ?? []
  // Zernio, Mixpost and native. A backend that logs no words cannot be checked
  // for an edit, and publish-ticked then has to assume the worst.
  assert.equal(recorded.length, 3)
})

// ── "Already live" must mean the words that are live ────────────────────────

test('an edit since the last successful send is not reported as already published', () => {
  const live = outboundWordsOf('Book a chat with our clinic.', { first_comment: 'Results are guaranteed.' })
  const fixed = outboundWordsOf('Book a chat with our clinic.', { first_comment: 'Results vary.' })

  // The owner edited the first comment to fix a compliance problem. Saying
  // "already live" here leaves the original claim on the account.
  assert.equal(priorSendDiffers({ words: live }, fixed), true)
  // Unchanged is still idempotent — a second tick must not post twice.
  assert.equal(priorSendDiffers({ words: live }, live), false)
  // No record of what was sent is not evidence that it matches.
  assert.equal(priorSendDiffers({ words: null }, fixed), true)
  // Never published at all: this is not the stale case, it is the send case.
  assert.equal(priorSendDiffers(undefined, fixed), false)
})

test('publish-ticked will not claim a post is live without comparing the words', () => {
  const ticked = readFileSync(join(process.cwd(), 'src/lib/publishers/publish-ticked.ts'), 'utf8')

  assert.match(ticked, /priorSendDiffers\(/)
  assert.match(ticked, /request_payload/)
  // Compared on the recorded words, through the same function the door used.
  assert.match(ticked, /outbound_words/)
  assert.match(ticked, /outboundContentForReview\(\{/)
  // The short-circuit must be guarded by the comparison, not reached before it.
  const staleAt = ticked.indexOf('const stale = ids.filter')
  const shortCircuitAt = ticked.indexOf('remaining.length === 0')
  assert.ok(staleAt > 0 && staleAt < shortCircuitAt)
  // And the honest report exists rather than a cheerful confirmed: true.
  assert.match(ticked, /OWNER_LIVE_WORDING_OLDER/)
  assert.match(ticked, /OWNER_LIVE_WORDING_UNKNOWN/)
})
