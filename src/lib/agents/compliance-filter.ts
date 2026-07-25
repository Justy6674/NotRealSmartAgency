/**
 * Guardian Agent — validates ALL output against:
 * 1. AHPRA/TGA regulatory compliance (healthcare brands)
 * 2. Brand DNA constraints (voice rules, banned words, never-do list)
 *
 * This is Layer 1 in the four-layer architecture.
 * Every piece of content passes through this before being saved or published.
 */

import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod/v3'
import type { ComplianceFlags, BrandDNAConstraints } from '@/types/database'
import { buildAbeRegulatoryContext, searchAbeRegulatoryCorpus } from '@/lib/abeai/regulatory-corpus'

export interface GuardianResult {
  isValid: boolean
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

  try {
    const { object } = await generateObject({
      model: anthropic('claude-3-5-haiku-latest'),
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

    return result
  } catch (error) {
    console.error('Guardian check error:', error)
    return result // Return local check results even if LLM fails
  }
}
