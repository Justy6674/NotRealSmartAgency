/**
 * Director tool: verify_product
 *
 * Check that a product actually exists before its name goes into copy.
 *
 * Why this exists: a video transcript garbled a fragrance as "Ormond Janes,
 * Bijous, Saffron". The Director tidied that into "Ormonde Jayne Bijou
 * Saffron" — confident, plausible, and not a real product. Ormonde Jayne's
 * saffron fragrance is Ta'If. That fabricated name went into three captions
 * for a fragrance marketplace, where being wrong about a product is the worst
 * possible error.
 *
 * Speech-to-text mangles brand names constantly, and the fix for a mangled
 * name is never to guess a tidier one. This looks it up.
 */

import { tool, generateObject, generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'

const VerdictSchema = z.object({
  verdict: z
    .enum(['exists', 'not_found', 'uncertain'])
    .describe('exists = confirmed real; not_found = no such product; uncertain = cannot tell'),
  canonical_name: z
    .string()
    .nullable()
    .describe('The correct full name if confirmed, else null'),
  closest_real_alternative: z
    .string()
    .nullable()
    .describe('If not_found, the real product the speaker most likely meant, else null'),
  reasoning: z.string().describe('One or two sentences of evidence'),
})

export function createVerifyProductTool() {
  return tool({
    description:
      'Check that a named product really exists BEFORE writing it into a caption, blog, ad or any customer-facing copy. MANDATORY whenever a product name came from a video or audio transcript, because speech-to-text mangles brand names — and a tidied-up guess is how a fabricated product ends up published. Also use whenever you are less than certain of a spelling. If the verdict is not_found or uncertain, do NOT state the name: ask the owner what the product was, or write around it.',
    inputSchema: z.object({
      product_name: z
        .string()
        .describe('The product name as you would write it, e.g. "Ormonde Jayne Bijou Saffron"'),
      category: z
        .string()
        .optional()
        .describe('What kind of product, e.g. "fragrance", "skincare" — narrows the search'),
      heard_as: z
        .string()
        .optional()
        .describe('The raw transcript wording, if this came from speech, e.g. "Ormond Janes Bijous Saffron"'),
    }),
    execute: async ({ product_name, category, heard_as }) => {
      const model = getGatewayModel('fast')
      try {
        // Search first. generateObject cannot call tools, so the lookup and the
        // verdict are separate steps — the point is that the verdict is formed
        // from what was found, never from what the model remembers.
        const { text: findings } = await generateText({
          model: gateway(model),
          providerOptions: getGatewayProviderOptions('fast', { tags: ['verify-product'] }),
          tools: { web_search: gateway.tools.perplexitySearch({ maxResults: 5 }) },
          stopWhen: stepCountIs(3),
          prompt: [
            `Search the web for whether this product exists: "${product_name}"${category ? ` (${category})` : ''}.`,
            heard_as ? `It was heard in a recording as "${heard_as}" — speech-to-text may have mangled it.` : '',
            'Report what you find: whether the brand exists, whether that exact product is one of theirs, and if not, what real product of theirs it most resembles.',
          ]
            .filter(Boolean)
            .join('\n'),
        })

        const { object } = await generateObject({
          model: gateway(model),
          schema: VerdictSchema,
          providerOptions: getGatewayProviderOptions('fast', { tags: ['verify-product'] }),
          prompt: [
            `Product asked about: "${product_name}"`,
            heard_as ? `Heard in a recording as: "${heard_as}"` : '',
            '',
            'Search findings:',
            findings,
            '',
            'Answer "exists" only if the findings confirm that exact product under that brand.',
            'If the brand is real but the product is not one of theirs, answer "not_found" and name the real product most likely meant.',
            'If the findings do not settle it, answer "uncertain". Guessing a tidier-sounding name is the failure this exists to prevent.',
          ]
            .filter(Boolean)
            .join('\n'),
        })

        return {
          ...object,
          safe_to_publish: object.verdict === 'exists',
          next_step:
            object.verdict === 'exists'
              ? `Use exactly "${object.canonical_name ?? product_name}".`
              : 'Do NOT put this name in the copy. Ask the owner which product it was, or write around it without naming the product.',
        }
      } catch (err) {
        // A failed check must never read as a pass.
        return {
          verdict: 'uncertain' as const,
          canonical_name: null,
          closest_real_alternative: null,
          reasoning: `The check could not run: ${err instanceof Error ? err.message : String(err)}`,
          safe_to_publish: false,
          next_step: 'The check did not run, so treat the name as unverified. Ask the owner rather than publishing it.',
        }
      }
    },
  })
}
