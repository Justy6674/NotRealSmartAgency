/**
 * review_content — Pre-publish quality gate.
 *
 * Takes a scheduled post ID, fetches the post + brand config, then runs
 * a single Claude Haiku call scoring voice match, compliance, and overall
 * quality. Stores the result as a post_activity row (type: 'review') so
 * it's visible in the Review tab and on DraftCard badges.
 *
 * Registered for Director (overall) + Compliance agent.
 */

import { generateObject } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { getGatewayModel } from '@/lib/ai/model-routing'
import { z } from 'zod/v3'
import { tool } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'

const reviewSchema = z.object({
  voice_score: z.number().min(0).max(100).describe('How well the caption matches the brand voice (0-100)'),
  voice_issues: z.array(z.string()).describe('Voice inconsistencies found. Empty if none.'),
  compliance_score: z.number().min(0).max(100).describe('Regulatory compliance score (0-100). 100 if not a health brand.'),
  compliance_issues: z.array(z.string()).describe('Compliance violations found. Empty if none.'),
  quality_score: z.number().min(0).max(100).describe('Overall content quality — clarity, hooks, CTA, grammar (0-100)'),
  quality_issues: z.array(z.string()).describe('Quality issues found. Empty if none.'),
  overall_score: z.number().min(0).max(100).describe('Weighted average of voice, compliance, and quality scores'),
  approved: z.boolean().describe('True if overall_score >= 70 and no critical compliance issues'),
  recommendations: z.array(z.string()).describe('Actionable suggestions to improve the post'),
})

export function createReviewContentTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Review a scheduled post for brand voice consistency, regulatory compliance, and content quality. Returns a detailed scorecard. Use before approving or publishing any draft.',
    inputSchema: z.object({
      post_id: z.string().uuid().describe('The scheduled_posts.id to review'),
    }),
    execute: async ({ post_id }: { post_id: string }) => {
      // 1. Fetch the post
      const { data: post, error: postErr } = await supabase
        .from('scheduled_posts')
        .select('id, caption, platform, hashtags, content_type, post_type, metadata')
        .eq('id', post_id)
        .eq('brand_id', brandId)
        .single()

      if (postErr || !post) {
        return { error: `Post not found or not accessible: ${postErr?.message ?? 'unknown'}` }
      }

      // 2. Fetch brand config
      const { data: brand, error: brandErr } = await supabase
        .from('brands')
        .select('name, tone_of_voice, brand_dna_constraints, compliance_flags, content_pillars, niche')
        .eq('id', brandId)
        .single()

      if (brandErr || !brand) {
        return { error: `Brand not found: ${brandErr?.message ?? 'unknown'}` }
      }

      const toneOfVoice = brand.tone_of_voice as Record<string, unknown> | null
      const brandDNA = brand.brand_dna_constraints as Record<string, unknown> | null
      const complianceFlags = brand.compliance_flags as { ahpra?: boolean; tga?: boolean; tga_categories?: string[] } | null
      const isHealthBrand = !!(complianceFlags?.ahpra || complianceFlags?.tga)

      // 3. Build the review prompt
      const caption = (post.caption as string) ?? ''
      const hashtags = (post.hashtags as string[]) ?? []
      const platform = post.platform as string

      let systemPrompt = `You are a senior marketing quality reviewer for "${brand.name}" (${brand.niche}).

Your job is to score a social media post across three dimensions:
1. **Voice Match** — does the caption match the brand's tone and voice rules?
2. **Compliance** — does it follow regulatory requirements?
3. **Quality** — is it well-written, engaging, platform-appropriate?

Score each 0-100. Be strict but fair.`

      // Brand voice context
      if (toneOfVoice) {
        systemPrompt += `\n\nBrand Tone of Voice:\n${JSON.stringify(toneOfVoice, null, 2)}`
      }
      if (brandDNA) {
        const voiceRules = (brandDNA.voice_rules as string[]) ?? []
        const bannedWords = (brandDNA.banned_words as string[]) ?? []
        const neverDo = (brandDNA.never_do as string[]) ?? []
        if (voiceRules.length) systemPrompt += `\n\nVoice Rules:\n${voiceRules.map(r => `- ${r}`).join('\n')}`
        if (bannedWords.length) systemPrompt += `\n\nBanned Words: ${bannedWords.join(', ')}`
        if (neverDo.length) systemPrompt += `\n\nNever Do:\n${neverDo.map(r => `- ${r.replace(/_/g, ' ')}`).join('\n')}`
      }

      // Compliance context
      if (isHealthBrand) {
        systemPrompt += `\n\n**This is an Australian healthcare brand. STRICT compliance checking required.**`
        if (complianceFlags?.ahpra) {
          systemPrompt += `\n- AHPRA: No testimonials claiming therapeutic outcomes, no misleading claims, no before/after implying guaranteed results, proper disclaimers required.`
        }
        if (complianceFlags?.tga) {
          systemPrompt += `\n- TGA: No promotion of prescription-only medicines to the public.`
          if (complianceFlags.tga_categories?.length) {
            systemPrompt += ` Categories: ${complianceFlags.tga_categories.join(', ')}.`
          }
        }
      } else {
        systemPrompt += `\n\nThis is not a regulated healthcare brand. Compliance score should be 100 unless there are general advertising law concerns.`
      }

      // Content pillars
      const pillars = (brand.content_pillars as string[]) ?? []
      if (pillars.length) {
        systemPrompt += `\n\nContent Pillars: ${pillars.join(', ')}`
      }

      systemPrompt += `\n\nPlatform: ${platform}
Evaluate platform-appropriateness (length, tone, hashtag usage, hook quality).`

      const userPrompt = `Review this ${platform} post:\n\nCaption:\n${caption}\n\nHashtags: ${hashtags.length ? hashtags.map(h => `#${h}`).join(' ') : '(none)'}`

      // 4. Run the review via the Gateway, like every other AI call here.
      //
      // This tool called Anthropic directly, and there is no Anthropic key in
      // production — so it has returned "Review failed: Anthropic API key is
      // missing" on every invocation since 12 April. The failure was caught
      // and reported as a bland "Review failed", which reads as a hiccup
      // rather than a feature that has never once run. The model it asked for,
      // claude-3-5-haiku-latest, no longer exists in the catalogue either.
      //
      // This is the AHPRA/TGA check. A regulatory review that silently does
      // nothing is worse than no review, because the absence is invisible.
      try {
        const { object: review } = await generateObject({
          model: gateway(getGatewayModel('fast')),
          system: systemPrompt,
          prompt: userPrompt,
          schema: reviewSchema,
        })

        // 5. Store as post_activity
        const scoreEmoji = review.overall_score >= 80 ? 'pass' : review.overall_score >= 60 ? 'needs work' : 'fail'

        const body = [
          `**AI Review — ${scoreEmoji.toUpperCase()}** (Score: ${review.overall_score}/100)`,
          '',
          `Voice: ${review.voice_score}/100${review.voice_issues.length ? '\n' + review.voice_issues.map(i => `  - ${i}`).join('\n') : ''}`,
          `Compliance: ${review.compliance_score}/100${review.compliance_issues.length ? '\n' + review.compliance_issues.map(i => `  - ${i}`).join('\n') : ''}`,
          `Quality: ${review.quality_score}/100${review.quality_issues.length ? '\n' + review.quality_issues.map(i => `  - ${i}`).join('\n') : ''}`,
          '',
          review.approved ? 'Recommendation: **Approved** for publishing.' : 'Recommendation: **Revise** before publishing.',
          '',
          ...(review.recommendations.length
            ? ['Suggestions:', ...review.recommendations.map(r => `- ${r}`)]
            : []),
        ].join('\n')

        await supabase.from('post_activity').insert({
          scheduled_post_id: post_id,
          user_id: userId,
          type: 'review',
          body,
          metadata: {
            voice_score: review.voice_score,
            voice_issues: review.voice_issues,
            compliance_score: review.compliance_score,
            compliance_issues: review.compliance_issues,
            quality_score: review.quality_score,
            quality_issues: review.quality_issues,
            overall_score: review.overall_score,
            approved: review.approved,
            recommendations: review.recommendations,
          },
        })

        // 6. Return formatted card for Director
        return {
          review_score: review.overall_score,
          approved: review.approved,
          voice_score: review.voice_score,
          compliance_score: review.compliance_score,
          quality_score: review.quality_score,
          issues: [
            ...review.voice_issues,
            ...review.compliance_issues,
            ...review.quality_issues,
          ],
          recommendations: review.recommendations,
          summary: body,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[review_content] AI review failed:', message)
        return { error: `Review failed: ${message}` }
      }
    },
  })
}
