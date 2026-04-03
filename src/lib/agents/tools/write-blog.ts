import { tool } from 'ai'
import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ComplianceFlags } from '@/types/database'
import { runComplianceFilter } from '../compliance-filter'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function extractHeaders(markdown: string): string[] {
  const headers: string[] = []
  for (const line of markdown.split('\n')) {
    const match = line.match(/^#{2,3}\s+(.+)/)
    if (match) headers.push(match[1].trim())
  }
  return headers
}

function estimateReadTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 230))
  return `${minutes} min read`
}

export function createWriteBlogTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Write an SEO-optimised blog post targeting a specific keyword. Produces a complete, structured blog article with meta description, headers, and internal link suggestions. Saves it to the output library.',
    inputSchema: z.object({
      topic: z.string().describe('What to write about'),
      target_keyword: z
        .string()
        .optional()
        .describe('Primary SEO keyword to target'),
      secondary_keywords: z
        .array(z.string())
        .optional()
        .describe('Supporting keywords to weave in naturally'),
      word_count: z
        .number()
        .min(500)
        .max(5000)
        .default(1200)
        .describe('Target word count'),
      intent: z
        .enum([
          'educational',
          'comparison',
          'how_to',
          'case_study',
          'news',
          'listicle',
        ])
        .default('educational')
        .describe('Content intent / format'),
      cta: z
        .string()
        .optional()
        .describe(
          'Call to action at the end, e.g. "Book a consultation"'
        ),
    }),
    execute: async ({
      topic,
      target_keyword,
      secondary_keywords,
      word_count,
      intent,
      cta,
    }) => {
      // 1. Fetch brand context
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select(
          'name, description, website_url, niche, tone_of_voice, target_audience, competitors, compliance_flags, content_pillars, products_services, extra_context'
        )
        .eq('id', brandId)
        .single()

      if (brandError || !brand) {
        return {
          success: false,
          error: 'Could not load brand context. Make sure a brand is selected.',
        }
      }

      const keyword = target_keyword || topic
      const secondaryList = secondary_keywords?.length
        ? secondary_keywords.join(', ')
        : 'none specified'

      // Build brand context block
      const brandContext = [
        `Brand: ${brand.name}`,
        brand.description ? `Description: ${brand.description}` : null,
        brand.niche ? `Niche: ${brand.niche}` : null,
        brand.website_url ? `Website: ${brand.website_url}` : null,
        brand.tone_of_voice
          ? `Tone: ${JSON.stringify(brand.tone_of_voice)}`
          : null,
        brand.target_audience
          ? `Target audience: ${JSON.stringify(brand.target_audience)}`
          : null,
        brand.products_services?.length
          ? `Products/services: ${JSON.stringify(brand.products_services)}`
          : null,
        brand.content_pillars?.length
          ? `Content pillars: ${brand.content_pillars.join(', ')}`
          : null,
        brand.competitors?.length
          ? `Key competitors: ${brand.competitors.map((c: { name: string }) => c.name).join(', ')}`
          : null,
        brand.extra_context
          ? `Additional context: ${brand.extra_context}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')

      // AHPRA/TGA compliance rules
      const complianceFlags = brand.compliance_flags as ComplianceFlags | null
      const isHealthBrand =
        complianceFlags?.ahpra || complianceFlags?.tga
      let complianceRules = ''
      if (isHealthBrand) {
        complianceRules = `\n\nCOMPLIANCE (CRITICAL — violations carry $60K+ fines):
- AHPRA: No patient testimonials claiming therapeutic outcomes
- AHPRA: No misleading or deceptive claims about results
- AHPRA: No before/after imagery implying guaranteed results
- AHPRA: Include appropriate disclaimers where relevant
- TGA: No promotion of prescription-only medicines to the public
- TGA: Stay educational — do not cross into therapeutic goods promotion
- Use "may help", "can support", "designed to" — never "will cure", "guarantees", "proven to"
- Frame all health claims as general education, not specific medical advice`
      }

      const systemPrompt = `You are an expert SEO content writer for ${brand.name}.

Write a blog post targeting the keyword "${keyword}".
Content format: ${intent}
Target word count: ${word_count} words

SEO Requirements:
- Include the target keyword in: title, first 100 words, meta description, at least 2 H2 headings
- Meta description: 150-160 characters, includes keyword, compelling click trigger
- Use secondary keywords naturally: ${secondaryList}
- Header hierarchy: H1 (title — use a single # heading), H2 (main sections — ##), H3 (subsections — ###)
- Short paragraphs (2-3 sentences max)
- Include bullet points or numbered lists where appropriate
- Include internal link suggestions as: [Link to: page name](${brand.website_url || '/page'})
- Readability: Flesch-Kincaid grade 8-10 (accessible to general audience)

Content Requirements:
- Answer a specific question the target audience has — not generic fluff
- Lead with the benefit, not the feature
- Include data, statistics, or evidence where possible
- Position ${brand.name} as the authority — reference what makes this brand different from competitors
- End with a clear CTA: ${cta || 'encourage the reader to learn more or get in touch'}
- Australian English throughout (colour, behaviour, organisation, specialised, etc.)

Brand Context:
${brandContext}
${complianceRules}

Format your response EXACTLY as follows — start with YAML frontmatter, then the full blog in markdown:

---
title: "Your SEO Title Here"
meta_description: "150-160 character meta description with keyword"
target_keyword: "${keyword}"
slug: "url-friendly-slug"
---

# Title

[Full blog content in markdown...]`

      try {
        // 2. Generate the blog
        const { text, usage } = await generateText({
          model: gateway('anthropic/claude-sonnet-4'),
          system: systemPrompt,
          prompt: `Write a ${word_count}-word ${intent} blog post about: ${topic}`,
        })

        // 3. Parse frontmatter and content
        const frontmatterMatch = text.match(
          /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
        )

        let title = `${topic} — ${brand.name}`
        let metaDescription = ''
        let slug = slugify(topic)
        let blogContent = text

        if (frontmatterMatch) {
          const fm = frontmatterMatch[1]
          blogContent = frontmatterMatch[2].trim()

          const titleMatch = fm.match(/title:\s*"(.+)"/)
          if (titleMatch) title = titleMatch[1]

          const metaMatch = fm.match(/meta_description:\s*"(.+)"/)
          if (metaMatch) metaDescription = metaMatch[1]

          const slugMatch = fm.match(/slug:\s*"(.+)"/)
          if (slugMatch) slug = slugMatch[1]
        }

        if (!slug) slug = slugify(title)
        if (!metaDescription) {
          metaDescription = `${title}. Learn more from ${brand.name}.`
        }

        const actualWordCount = blogContent
          .split(/\s+/)
          .filter(Boolean).length
        const headers = extractHeaders(blogContent)
        const readTime = estimateReadTime(actualWordCount)

        // 4. Run compliance filter for health brands
        let complianceResult = null
        if (isHealthBrand) {
          try {
            complianceResult = await runComplianceFilter(
              blogContent,
              complianceFlags!
            )
          } catch {
            // Non-blocking
          }
        }

        // 5. Save to outputs
        const { data: output, error: saveError } = await supabase
          .from('outputs')
          .insert({
            user_id: userId,
            brand_id: brandId,
            conversation_id: conversationId,
            output_type: 'blog_article',
            title,
            content: blogContent,
            metadata: {
              target_keyword: keyword,
              secondary_keywords: secondary_keywords || [],
              meta_description: metaDescription,
              slug,
              intent,
              word_count: actualWordCount,
              headers,
              estimated_read_time: readTime,
              cta: cta || null,
              compliance: complianceResult,
              tokens_used: usage?.totalTokens || null,
            },
          })
          .select('id')
          .single()

        if (saveError) {
          return {
            success: false,
            error: `Blog was written but failed to save: ${saveError.message}`,
            title,
            content: blogContent,
          }
        }

        return {
          success: true,
          output_id: output.id,
          title,
          meta_description: metaDescription,
          slug,
          target_keyword: keyword,
          word_count: actualWordCount,
          headers,
          estimated_read_time: readTime,
          content: blogContent,
          ...(complianceResult && !complianceResult.isValid
            ? {
                compliance_warnings: complianceResult.warnings,
                compliance_flags: complianceResult.flags,
              }
            : {}),
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate the blog post',
        }
      }
    },
  })
}
