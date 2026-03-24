import { tool } from 'ai'
import { z } from 'zod/v3'

/**
 * Slide deck generation — produces structured slide content.
 * Outputs JSON that can be rendered into a presentation.
 * Future: integrate with Gamma API for actual deck generation.
 */
export function createGenerateSlidesTool() {
  return tool({
    description:
      'Generate a slide deck / presentation. Produces structured slides with titles, bullet points, and speaker notes. Use for strategy presentations, campaign pitches, brand guidelines, and performance reports.',
    inputSchema: z.object({
      topic: z.string().describe('What the presentation is about'),
      slideCount: z.number().min(3).max(20).default(8).describe('Number of slides (3-20)'),
      style: z.enum(['professional', 'minimal', 'bold', 'corporate']).default('professional'),
      includeNotes: z.boolean().default(true).describe('Include speaker notes per slide'),
    }),
    execute: async ({ topic, slideCount, style, includeNotes }) => {
      // Generate slide structure (the LLM will fill this based on context)
      return {
        generated: true,
        format: 'slide_deck',
        topic,
        slideCount,
        style,
        includeNotes,
        instructions: `Generate a ${slideCount}-slide presentation about "${topic}" in ${style} style. For each slide provide:
1. **Slide title** (short, punchy)
2. **Key points** (3-5 bullet points max)
3. **Visual suggestion** (what image or chart would work)
${includeNotes ? '4. **Speaker notes** (what to say, not what to show)' : ''}

Format as markdown with --- separating slides. Use Australian English. Keep slides scannable — no paragraphs, just key points.`,
        message: `Slide deck structure created for "${topic}" (${slideCount} slides, ${style} style). The content follows — each slide is separated by ---.`,
      }
    },
  })
}
