/**
 * Ask the owner's brain before answering.
 *
 * Every significant failure on 8 August 2026 was already written down in
 * gbrain and unreadable to the Director:
 *
 *   "Scent Sell must never change fragrance names"
 *   "must use properly researched fragrance descriptions, not made-up ones"
 *   "require founder approval before publishing"
 *
 * All three were violated that day, all three were in the brain, and nothing
 * in NRS had ever queried it. The Director had its own three-week-old memory
 * and none of the twelve projects' worth the owner had built.
 *
 * Read only. A marketing agent must never alter the record of what was decided.
 */

import { tool } from 'ai'
import { z } from 'zod'
import { brainConfigured, searchBrain, brainContext } from '@/lib/brain/gbrain'

export function createSearchBrainTool() {
  return tool({
    description:
      "Search the owner's own knowledge brain — every decision, brand rule, spec, correction and"
      + ' constraint he has written down across all of his projects, going back years.'
      + '\n\nUSE THIS BEFORE ANSWERING anything about how a brand should sound, what was decided'
      + ' before, what he has already told you, what is or is not allowed, or why something is'
      + ' done a particular way. His written rule beats your instinct every time, and answering'
      + ' from instinct when the brain already holds the answer is the single most expensive'
      + ' mistake this system makes.'
      + '\n\nCite the slug of anything you use. A fact from the brain with no pointer cannot be'
      + ' told apart from one you invented.',
    inputSchema: z.object({
      question: z
        .string()
        .min(3)
        .describe('What you need to know, in plain words. "Scent Sell naming rules", not keywords.'),
      limit: z.number().int().min(1).max(12).optional()
        .describe('How many pages to pull back. Default 6.'),
    }),
    execute: async ({ question, limit }) => {
      if (!brainConfigured()) {
        // Said plainly rather than pretending the brain is empty — "no results"
        // and "not connected" mean very different things to whoever reads it.
        return { error: "The owner's brain is not connected to this deployment." }
      }

      try {
        const hits = await searchBrain(question, { limit: limit ?? 6 })
        if (hits.length === 0) {
          return {
            found: 0,
            note: 'Nothing in the brain on that. Say so rather than filling the gap from memory.',
          }
        }
        return {
          found: hits.length,
          context: brainContext(hits),
          slugs: hits.map((hit) => hit.slug),
        }
      } catch (error) {
        console.error('[search_brain]', error)
        return { error: "Could not reach the owner's brain just then." }
      }
    },
  })
}
