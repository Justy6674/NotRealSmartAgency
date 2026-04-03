import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod/v3'
import type { ComplianceFlags } from '@/types/database'

export async function runComplianceFilter(
  content: string,
  flags: ComplianceFlags
): Promise<{ isValid: boolean; flags: string[]; warnings: string[] }> {
  if (!flags.ahpra && !flags.tga) {
    return { isValid: true, flags: [], warnings: [] }
  }

  let systemPrompt = `You are a strict Healthcare Compliance Reviewer in Australia.
Evaluate the provided marketing content against the following regulations:`

  if (flags.ahpra) {
    systemPrompt += `
- AHPRA: No testimonials claiming therapeutic outcomes.
- AHPRA: No misleading or deceptive claims.
- AHPRA: Proper disclaimers required.
- AHPRA: No before/after implying guaranteed results.`
  }

  if (flags.tga) {
    systemPrompt += `
- TGA: No promotion of prescription-only medicines to the public.
- TGA: Must not cross from education into medical device/therapeutic goods promotion without proper approval.`
  }

  systemPrompt += `
Analyse the text and return JSON indicating if it is compliant, along with any specific flags (violations) or warnings (potential risks).`

  try {
    const { object } = await generateObject({
      model: anthropic('claude-3-5-haiku-latest'),
      system: systemPrompt,
      prompt: `Content to evaluate:\n\n${content}`,
      schema: z.object({
        isValid: z.boolean().describe('True if no critical violations are found'),
        flags: z.array(z.string()).describe('List of critical violations. Empty if none.'),
        warnings: z.array(z.string()).describe('List of potential risks or warnings. Empty if none.'),
      }),
    })

    return object
  } catch (error) {
    console.error('Compliance filter error:', error)
    // Fail open if the LLM call fails, but log warning
    return { isValid: true, flags: [], warnings: ['Compliance check failed to run due to an error.'] }
  }
}
