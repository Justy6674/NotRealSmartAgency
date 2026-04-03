import { tool, generateObject } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'

const voiceAnalysisSchema = z.object({
  overall_score: z.number().min(0).max(100).describe('Overall brand voice consistency score out of 100'),
  formality_match: z.object({
    score: z.number().min(0).max(100),
    expected: z.string(),
    actual: z.string(),
    suggestion: z.string().optional(),
  }),
  humour_match: z.object({
    score: z.number().min(0).max(100),
    expected: z.string(),
    actual: z.string(),
  }),
  keywords_used: z.array(z.string()).describe('Brand keywords found in the content'),
  keywords_missing: z.array(z.string()).describe('Brand keywords not present in the content'),
  avoid_words_found: z.array(z.string()).describe('Words the brand should avoid that were found in the content'),
  audience_fit: z.object({
    score: z.number().min(0).max(100),
    reasoning: z.string(),
  }),
  compliance_issues: z.array(z.string()).optional().describe('Any AHPRA/TGA compliance concerns detected'),
  rewrite_suggestions: z.array(z.string()).describe('Specific suggestions to improve brand voice consistency'),
})

export function createAnalyseVoiceTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Analyse a piece of content against the brand\'s voice settings and score its consistency. Returns a detailed scorecard with formality, humour, keyword usage, audience fit, and rewrite suggestions.',
    inputSchema: z.object({
      content: z.string().describe('The content to analyse for brand voice consistency'),
      content_type: z
        .enum(['social_post', 'blog', 'email', 'ad', 'website_copy'])
        .optional()
        .describe('The type of content being analysed'),
    }),
    execute: async ({ content, content_type }) => {
      // 1. Fetch brand voice settings and target audience
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('name, tone_of_voice, target_audience, compliance_flags, content_pillars')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single()

      if (brandError || !brand) {
        return { error: 'Could not fetch brand settings. Please ensure the brand exists.' }
      }

      const tov = brand.tone_of_voice as {
        formality?: string
        humour?: string
        keywords?: string[]
        avoid_words?: string[]
      } | null

      const audience = brand.target_audience as {
        demographics?: string
        pain_points?: string[]
        desires?: string[]
      } | null

      if (!tov || (!tov.formality && !tov.humour && (!tov.keywords || tov.keywords.length === 0))) {
        return {
          error:
            'Brand voice settings are not configured yet. Please set up your brand\'s tone of voice (formality, humour, keywords, avoid words) in Brand Settings before running a voice check.',
        }
      }

      // 2. Build analysis prompt
      const systemPrompt = `You are a brand voice consistency analyst. You evaluate marketing content against a brand's defined voice and tone settings.

Be precise and actionable in your analysis. Score each dimension 0-100 where:
- 90-100: Excellent match
- 70-89: Good match, minor adjustments needed
- 50-69: Moderate match, notable inconsistencies
- Below 50: Poor match, significant rewrite needed

Use Australian English throughout your analysis.`

      const userPrompt = `Analyse this content for brand voice consistency.

**Brand:** ${brand.name}

**Voice Settings:**
- Formality: ${tov.formality || 'not set'}
- Humour: ${tov.humour || 'not set'}
- Brand keywords to use: ${tov.keywords?.length ? tov.keywords.join(', ') : 'none set'}
- Words to avoid: ${tov.avoid_words?.length ? tov.avoid_words.join(', ') : 'none set'}

**Target Audience:**
- Demographics: ${audience?.demographics || 'not set'}
- Pain points: ${audience?.pain_points?.length ? audience.pain_points.join(', ') : 'not set'}
- Desires: ${audience?.desires?.length ? audience.desires.join(', ') : 'not set'}

**Content Pillars:** ${brand.content_pillars?.length ? brand.content_pillars.join(', ') : 'none set'}

${content_type ? `**Content Type:** ${content_type}` : ''}

${brand.compliance_flags && (brand.compliance_flags as { ahpra?: boolean; tga?: boolean }).ahpra ? '**Note:** This brand is subject to AHPRA advertising guidelines. Flag any potential compliance issues.' : ''}
${brand.compliance_flags && (brand.compliance_flags as { ahpra?: boolean; tga?: boolean }).tga ? '**Note:** This brand is subject to TGA advertising regulations. Flag any potential compliance issues.' : ''}

**Content to analyse:**
${content}`

      try {
        const { object } = await generateObject({
          model: gateway('anthropic/claude-haiku-4-5-20251001'),
          system: systemPrompt,
          prompt: userPrompt,
          schema: voiceAnalysisSchema,
        })

        // 3. Format as markdown scorecard
        const scoreEmoji = (score: number) => {
          if (score >= 90) return 'Excellent'
          if (score >= 70) return 'Good'
          if (score >= 50) return 'Moderate'
          return 'Needs work'
        }

        let scorecard = `## Brand Voice Scorecard — ${brand.name}\n\n`
        scorecard += `### Overall Score: ${object.overall_score}/100 (${scoreEmoji(object.overall_score)})\n\n`

        scorecard += `| Dimension | Score | Expected | Actual |\n`
        scorecard += `|-----------|-------|----------|--------|\n`
        scorecard += `| Formality | ${object.formality_match.score}/100 | ${object.formality_match.expected} | ${object.formality_match.actual} |\n`
        scorecard += `| Humour | ${object.humour_match.score}/100 | ${object.humour_match.expected} | ${object.humour_match.actual} |\n`
        scorecard += `| Audience Fit | ${object.audience_fit.score}/100 | — | ${object.audience_fit.reasoning} |\n\n`

        if (object.keywords_used.length > 0) {
          scorecard += `**Keywords used:** ${object.keywords_used.join(', ')}\n\n`
        }

        if (object.keywords_missing.length > 0) {
          scorecard += `**Keywords missing:** ${object.keywords_missing.join(', ')}\n\n`
        }

        if (object.avoid_words_found.length > 0) {
          scorecard += `**Avoid words found:** ${object.avoid_words_found.join(', ')}\n\n`
        }

        if (object.compliance_issues && object.compliance_issues.length > 0) {
          scorecard += `### Compliance Issues\n`
          object.compliance_issues.forEach((issue) => {
            scorecard += `- ${issue}\n`
          })
          scorecard += '\n'
        }

        if (object.formality_match.suggestion) {
          scorecard += `**Formality suggestion:** ${object.formality_match.suggestion}\n\n`
        }

        if (object.rewrite_suggestions.length > 0) {
          scorecard += `### Suggestions\n`
          object.rewrite_suggestions.forEach((s) => {
            scorecard += `- ${s}\n`
          })
        }

        return {
          scorecard,
          ...object,
        }
      } catch (err) {
        console.error('Voice analysis error:', err)
        return { error: 'Voice analysis failed. Please try again.' }
      }
    },
  })
}
