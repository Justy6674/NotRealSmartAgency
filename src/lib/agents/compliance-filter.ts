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
    return result
  }

  // Abe AI is the current legislative source of truth. Only a generic rules
  // question is sent upstream; the marketing content itself never crosses the
  // NRS/Abe boundary, keeping patient or customer text inside NRS.
  let regulatoryContext = ''
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
    if (corpus.warning) result.warnings.push(corpus.warning)
  } catch (error) {
    result.warnings.push(error instanceof Error ? error.message : 'Abe AI regulatory corpus could not be reached.')
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
      schema: z.object({
        isValid: z.boolean().describe('True if no critical violations found'),
        flags: z.array(z.string()).describe('Critical violations. Empty if none.'),
        warnings: z.array(z.string()).describe('Potential risks or warnings. Empty if none.'),
        voiceIssues: z.array(z.string()).describe('Brand voice rule violations. Empty if none.'),
      }),
    })

    // Merge LLM results with local checks
    if (!object.isValid) result.isValid = false
    result.flags.push(...object.flags)
    result.warnings.push(...object.warnings)
    result.brandVoiceIssues.push(...object.voiceIssues)
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
