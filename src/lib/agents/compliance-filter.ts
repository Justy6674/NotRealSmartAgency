/**
 * Guardian Agent — validates ALL output against:
 * 1. AHPRA/TGA regulatory compliance (healthcare brands)
 * 2. Brand DNA constraints (voice rules, banned words, never-do list)
 *
 * This is Layer 1 in the four-layer architecture.
 * Every piece of content passes through this before being saved or published.
 */

import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { ComplianceFlags, BrandDNAConstraints } from '@/types/database'
import { buildAbeRegulatoryContext, searchAbeRegulatoryCorpus } from '@/lib/abeai/regulatory-corpus'
import {
  estimateGatewayCost,
  getGatewayRouteProviderOptions,
  resolveAgentModelRoute,
} from '@/lib/ai/model-routing'
import { userSafeError } from '@/lib/errors/user-safe'

/**
 * Whether the review actually had the current Australian rules in front of it.
 *
 * FAULT (15–17 Aug 2026). Abe AI, which serves the AHPRA/TGA corpus, returned
 * HTTP 500 on every call for two days: it had switched retrieval to RPCs whose
 * migration was never applied to its production database. This file caught
 * that, pushed a sentence into `warnings`, and carried on reviewing regulated
 * health copy against nothing but the model's own training — with
 * `regulatoryCitations: []` and a `regulatoryCorpusVersion` of null, which no
 * caller reads. Every caller either logged the warning to the console or
 * dropped it. So for two days every review for the four regulated projects ran
 * ungrounded and came back in a shape indistinguishable from a healthy one.
 *
 * Blocking four brands because an upstream service is down is the wrong trade.
 * Being unable to TELL is worse than either outcome. So the state is recorded
 * as a field rather than a warning, because the warning is precisely the thing
 * that got dropped.
 *
 * - `not_required` — the project advertises nothing regulated; no rules apply.
 * - `grounded`     — current corpus text reached the reviewing model, and what
 *                    it read is on the record (version + citations).
 * - `partial`      — the rules reached the model, but the record of which ones,
 *                    which edition, or how they were labelled is incomplete.
 * - `ungrounded`   — no legislative text reached the model at all. The verdict
 *                    is the model's general knowledge, and nothing more.
 */
export type RegulatoryGrounding = 'not_required' | 'grounded' | 'partial' | 'ungrounded'

export interface GuardianResult {
  isValid: boolean
  /**
   * False when the regulatory review did not actually run — an LLM timeout,
   * rate limit or schema failure. `isValid` is initialised true so that a clean
   * pass needs no assignment, which means a swallowed error is indistinguishable
   * from a pass unless callers read this flag. Any caller publishing for a brand
   * with `ahpra` or `tga` set must treat `false` as a block: an unreviewed
   * health claim carries a penalty of up to $60,000 per offence.
   */
  checkCompleted: boolean
  flags: string[]        // critical violations (block content)
  warnings: string[]     // potential risks (flag but allow)
  brandVoiceIssues: string[]  // brand DNA drift detected
  regulatoryCitations: Array<{
    chunk_id: number
    source: string
    source_category: string
    jurisdiction: string
    corpus_version: string
    section: string | null
  }>
  regulatoryCorpusVersion: string | null
  /**
   * Whether the current rules were actually in front of the reviewer.
   *
   * Required, not optional: a result that never stated its own grounding is the
   * exact shape that hid the outage. Anything other than `grounded` or
   * `not_required` means the verdict is worth less than it looks, and a
   * regulated project should not treat it as a sign-off.
   */
  regulatoryGrounding: RegulatoryGrounding
  /**
   * The same fact in a sentence that can be read aloud to the owner, or null
   * when grounding is full. Also pushed into `warnings`, and duplicated here on
   * purpose: `warnings` is a list callers log and forget, and this one is not a
   * risk found IN the content, it is a statement about the review itself.
   */
  regulatoryGroundingNote: string | null
  /**
   * What the review cost, present only when it actually ran. Every other model
   * call in NRS is attributed; this one was invisible, so the cost of checking
   * regulated content never appeared against the work that required it.
   */
  spend?: {
    model: string
    inputTokens: number
    outputTokens: number
    costUsd: number
  }
}

/**
 * Run the full Guardian check — compliance + brand voice.
 */
export async function runComplianceFilter(
  content: string,
  flags: ComplianceFlags,
  brandDNA?: BrandDNAConstraints
): Promise<GuardianResult> {
  const result: GuardianResult = {
    isValid: true,
    checkCompleted: false,
    flags: [],
    warnings: [],
    brandVoiceIssues: [],
    regulatoryCitations: [],
    regulatoryCorpusVersion: null,
    // Initialised to the honest answer for a review that has not read anything
    // yet, matching `checkCompleted: false` above. Every path below states it
    // explicitly; an unset value must never be able to read as grounded.
    regulatoryGrounding: 'ungrounded',
    regulatoryGroundingNote: null,
  }

  // ── Fast local checks (no LLM call needed) ────────────────────────────────

  // Check banned words
  if (brandDNA?.banned_words?.length) {
    const contentLower = content.toLowerCase()
    for (const word of brandDNA.banned_words) {
      if (contentLower.includes(word.toLowerCase())) {
        result.brandVoiceIssues.push(`Contains banned word: "${word}"`)
      }
    }
  }

  // Check never-do list for obvious patterns
  if (brandDNA?.never_do?.length) {
    const contentLower = content.toLowerCase()
    const patternChecks: Record<string, string[]> = {
      before_after_images: ['before and after', 'before & after', 'before/after'],
      testimonials_in_ads: ['testimonial', 'patient said', 'client said', 'review:', '"i lost'],
      guaranteed_outcomes: ['guaranteed', 'guarantee', '100% effective', 'proven cure', 'will cure'],
      exclamation_marks: [],  // handled below
    }

    for (const rule of brandDNA.never_do) {
      const patterns = patternChecks[rule]
      if (patterns) {
        for (const pattern of patterns) {
          if (contentLower.includes(pattern)) {
            result.brandVoiceIssues.push(`Violates "never do" rule: ${rule.replace(/_/g, ' ')} — found "${pattern}"`)
          }
        }
      }
    }

    // Exclamation mark check for clinical content
    if (brandDNA.never_do.includes('exclamation_marks') && content.includes('!')) {
      result.brandVoiceIssues.push('Contains exclamation marks (banned by brand DNA)')
    }
  }

  // If brand voice issues found, mark as invalid
  if (result.brandVoiceIssues.length > 0) {
    result.isValid = false
  }

  // ── LLM compliance check (only for regulated brands) ──────────────────────

  if (!flags.ahpra && !flags.tga) {
    // No regulatory review is required for this brand, so the check is complete
    // by definition. Leaving the flag false here would block unregulated brands
    // for a review they never needed.
    result.checkCompleted = true
    // Distinct from `ungrounded` on purpose. A fragrance caption is not missing
    // its legislation; there is none to miss, and reporting it as ungrounded
    // would make the signal meaningless by firing on most of the work.
    result.regulatoryGrounding = 'not_required'
    return result
  }

  // The owner's own regulators, so these are the words to use — not "corpus",
  // "Abe AI" or "the grounding call", none of which mean anything to him.
  const regime = [flags.ahpra ? 'AHPRA' : null, flags.tga ? 'TGA' : null].filter(Boolean).join(' and ')

  // Abe AI is the current legislative source of truth. Only a generic rules
  // question is sent upstream; the marketing content itself never crosses the
  // NRS/Abe boundary, keeping patient or customer text inside NRS.
  let regulatoryContext = ''
  /** Set when no legislative text reached the model, phrased to be read aloud. */
  let ungroundedBecause: string | null = null
  /** Set when the rules DID reach the model but the record of them is thin. */
  const recordGaps: string[] = []
  /** Abe AI's own note, kept out of the owner's list unless nothing supersedes it. */
  let corpusWarning: string | null = null

  try {
    const corpus = await searchAbeRegulatoryCorpus(
      `Australian healthcare advertising rules for ${flags.ahpra ? 'AHPRA-regulated services' : ''}${flags.ahpra && flags.tga ? ' and ' : ''}${flags.tga ? 'TGA-regulated therapeutic goods' : ''}. Focus on prohibited claims, testimonials, before-and-after material, required evidence and public advertising restrictions.`,
    )
    result.regulatoryCitations = corpus.citations.map(({ chunk_id, source, source_category, jurisdiction, corpus_version, section }) => ({
      chunk_id,
      source,
      source_category,
      jurisdiction,
      corpus_version,
      section,
    }))
    result.regulatoryCorpusVersion = corpus.corpusVersion
    regulatoryContext = buildAbeRegulatoryContext(corpus)
    corpusWarning = corpus.warning ?? null

    if (!regulatoryContext) {
      // Grounding is decided by what actually reached the model, never by the
      // status word. buildAbeRegulatoryContext() is the only thing that puts
      // rules into the prompt, so an empty string here means the review is
      // ungrounded however healthy the HTTP call looked.
      //
      // `no_grounding` is the quiet one, and it is the failure mode Abe AI's
      // own fix moves TOWARDS: a retrieval matching nothing answers HTTP 200
      // with an empty array, so it reads as success at every layer above it.
      // Applying its fail-closed rights migration on its own would turn today's
      // loud 500 into exactly this. Both land here, and both are ungrounded.
      ungroundedBecause = corpus.status === 'unconfigured'
        ? 'this workspace is not connected to the legislation library at all'
        : 'the legislation library answered but held no matching AHPRA or TGA material'
    } else {
      // The rules arrived. What is missing now is the ability to evidence WHICH
      // rules — and these are the two fields the outputs library stores against
      // saved work (`regulatory_citations`, `regulatory_corpus_version`), so an
      // empty one means a saved piece can never show what it was checked
      // against. That is a weaker result, not a failed one.
      if (corpus.verification === 'unknown') {
        recordGaps.push('the library did not state whether that material is verified')
      }
      if (!corpus.corpusVersion) {
        recordGaps.push('the edition of the rules it read was not recorded')
      }
      if (corpus.citations.length === 0) {
        recordGaps.push('the individual rules it relied on were not recorded')
      }
    }
  } catch (error) {
    // Abe AI's 500 body is genuinely worth reading — it is our own service —
    // but it is read from the log, not aloud. This line previously pushed
    // `error.message` straight into a warning the owner sees.
    ungroundedBecause = userSafeError(
      'compliance.corpus',
      error,
      'the legislation library could not be reached',
    )
  }

  if (corpusWarning) console.warn(`[compliance.corpus] ${corpusWarning}`)

  if (ungroundedBecause) {
    result.regulatoryGrounding = 'ungrounded'
    result.regulatoryGroundingNote =
      `This ${regime} check ran WITHOUT the current Australian advertising rules — ${ungroundedBecause}. ` +
      'It fell back on what the reviewing model already knew, which can be out of date and cannot be evidenced. ' +
      'Treat it as a first opinion rather than a compliance sign-off: have a person read anything making a health claim before it goes out.'
  } else if (recordGaps.length > 0) {
    result.regulatoryGrounding = 'partial'
    result.regulatoryGroundingNote =
      `This ${regime} check did read the current Australian advertising rules, but ${recordGaps.join(', and ')}. ` +
      'The finding itself stands; the paper trail behind it does not, so do not rely on it as evidence of what was checked.'
  } else {
    result.regulatoryGrounding = 'grounded'
  }

  if (result.regulatoryGroundingNote) {
    result.warnings.push(result.regulatoryGroundingNote)
  } else if (corpusWarning) {
    // Only reachable on an otherwise fully grounded review, where the note is
    // null and this would otherwise reach nobody but the log.
    result.warnings.push(corpusWarning)
  }

  let systemPrompt = `You are a strict Healthcare Compliance Reviewer and Brand Guardian in Australia.
Evaluate the provided marketing content against the following regulations:`

  if (flags.ahpra) {
    systemPrompt += `
- AHPRA: No testimonials claiming therapeutic outcomes.
- AHPRA: No misleading or deceptive claims.
- AHPRA: Proper disclaimers required.
- AHPRA: No before/after implying guaranteed results.
- AHPRA: Reddit posts are now publicly visible — all content is subject to AHPRA scrutiny.`
  }

  if (flags.tga) {
    systemPrompt += `
- TGA: No promotion of prescription-only medicines to the public.
- TGA: Must not cross from education into medical device/therapeutic goods promotion without proper approval.`
  }

  if (regulatoryContext) {
    systemPrompt += `\n\nCurrent Abe AI regulatory corpus evidence (treat these sources as the authority and cite the source name when flagging an issue):\n${regulatoryContext}`
  }

  // Add brand DNA voice rules to the LLM check
  if (brandDNA?.voice_rules?.length) {
    systemPrompt += `\n\nBrand Voice Rules (must follow):`
    for (const rule of brandDNA.voice_rules) {
      systemPrompt += `\n- ${rule}`
    }
  }

  systemPrompt += `
Analyse the text and return JSON indicating if it is compliant with regulations AND brand voice rules.`

  const regulated = Boolean(flags.ahpra || flags.tga)
  const modelRoute = resolveAgentModelRoute({
    agentType: 'compliance',
    input: content,
    isHealthBrand: regulated,
    taskCapability: 'compliance_review',
  })
  const model = modelRoute.model

  const reviewSchema = z.object({
    isValid: z.boolean().describe('True if no critical violations found'),
    flags: z.array(z.string()).describe('Critical violations. Empty if none.'),
    warnings: z.array(z.string()).describe('Potential risks or warnings. Empty if none.'),
    voiceIssues: z.array(z.string()).describe('Brand voice rule violations. Empty if none.'),
  })

  try {
    const { object, usage } = await generateObject({
      model: gateway(model),
      // The review reached a provider directly while every other model call in
      // NRS went through the Gateway. That made it the one call with no
      // fallback when a provider was down — for regulated work, an outage
      // stops publishing entirely — and, worse, the only health call sent
      // without the no-training and zero-retention controls the rest carry.
      providerOptions: getGatewayRouteProviderOptions(modelRoute, {
        tags: ['compliance-review', regulated ? 'regulated' : 'unregulated'],
        zeroDataRetention: regulated,
      }),
      system: systemPrompt,
      prompt: `Content to evaluate:\n\n${content}`,
      // Some Gateway/provider combinations wrap the requested object in
      // `{ content: ... }`. Accept that transport envelope, then unwrap it
      // below. The actual review shape remains just as strict; rejecting a
      // real regulatory verdict because of the envelope is a false outage.
      schema: z.union([reviewSchema, z.object({ content: reviewSchema })]),
    })

    const review = 'content' in object ? object.content : object

    // Merge LLM results with local checks
    if (!review.isValid) result.isValid = false
    result.flags.push(...review.flags)
    result.warnings.push(...review.warnings)
    result.brandVoiceIssues.push(...review.voiceIssues)
    result.checkCompleted = true

    const cost = estimateGatewayCost(model, usage ?? {})
    result.spend = {
      model,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      costUsd: cost.usd,
    }

    return result
  } catch (error) {
    // Deliberately not marking the result valid or invalid here. The local
    // checks already applied still stand, but the regulatory review did not
    // run, and only the caller knows whether this brand may publish without
    // one. `checkCompleted` stays false so that decision is explicit.
    console.error('Guardian check error:', error)
    result.warnings.push('Regulatory review did not complete — the compliance model could not be reached.')
    return result
  }
}
