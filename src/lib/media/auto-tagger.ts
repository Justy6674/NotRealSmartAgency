/**
 * Smart auto-tagging for media uploads.
 *
 * Tier 1 — Deterministic tags: instant, zero cost, derived from brand context + file metadata.
 * Tier 2 — AI-enriched tags: async, one Claude call, derived from image vision or transcript analysis.
 */

import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'

// ── Types ────────────────────────────────────────────────────────────────────

interface BrandContext {
  name: string
  niche: string
  content_pillars: string[]
  compliance_flags: { ahpra: boolean; tga: boolean; tga_categories?: string[] }
  description?: string | null
  target_audience?: { demographics?: string; pain_points?: string[]; desires?: string[] } | null
}

export interface AITagResult {
  tags: string[]
  description: string
}

// ── Tier 1: Deterministic Tags (instant) ─────────────────────────────────────

const FILE_TYPE_TAGS: Record<string, string> = {
  image: 'photo',
  video: 'video',
  audio: 'audio',
}

/** Filename patterns that map to content type tags */
const FILENAME_PATTERNS: [RegExp, string][] = [
  [/behind.?the.?scenes|bts|backstage/i, 'behind-the-scenes'],
  [/testimonial|review|feedback/i, 'testimonial'],
  [/tutorial|how.?to|demo/i, 'tutorial'],
  [/unbox|reveal|haul/i, 'unboxing'],
  [/before.?after|transformation/i, 'before-after'],
  [/promo|sale|discount|offer/i, 'promotional'],
  [/event|launch|opening/i, 'event'],
  [/interview|podcast|chat/i, 'interview'],
  [/product|item|listing/i, 'product'],
  [/reel|short|tiktok|story/i, 'short-form'],
]

export function generateDeterministicTags(
  brand: BrandContext | null,
  fileType: string,
  fileName: string
): string[] {
  const tags: Set<string> = new Set()

  // Media type
  const mediaCategory = fileType.split('/')[0]
  const typeTag = FILE_TYPE_TAGS[mediaCategory]
  if (typeTag) tags.add(typeTag)

  // Brand context
  if (brand) {
    // Brand name (lowercase, cleaned)
    const brandTag = brand.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
    if (brandTag) tags.add(brandTag)

    // Niche
    if (brand.niche) {
      tags.add(brand.niche.toLowerCase().trim())
    }

    // Compliance flags
    if (brand.compliance_flags?.ahpra) tags.add('ahpra-regulated')
    if (brand.compliance_flags?.tga) tags.add('tga-regulated')

    // Content pillars — match against filename
    for (const pillar of brand.content_pillars ?? []) {
      const pillarLower = pillar.toLowerCase()
      if (fileName.toLowerCase().includes(pillarLower)) {
        tags.add(pillarLower)
      }
    }
  }

  // Filename pattern matching
  const fileNameLower = fileName.toLowerCase()
  for (const [pattern, tag] of FILENAME_PATTERNS) {
    if (pattern.test(fileNameLower)) {
      tags.add(tag)
    }
  }

  return Array.from(tags)
}

// ── Tier 2: AI-Enriched Tags (async) ─────────────────────────────────────────

/**
 * Generate AI tags for an image using Claude vision.
 * Returns description + contextual tags based on brand niche.
 */
export async function generateAITagsForImage(
  imageUrl: string,
  brand: BrandContext
): Promise<AITagResult> {
  const pillarsStr = brand.content_pillars?.length
    ? `Content pillars: ${brand.content_pillars.join(', ')}.`
    : ''

  const { text } = await generateText({
    model: gateway(getGatewayModel('fast')),
    providerOptions: getGatewayProviderOptions('fast'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: new URL(imageUrl) },
          {
            type: 'text',
            text: `You are tagging media for a ${brand.niche} brand called "${brand.name}".
${brand.description ? `Brand: ${brand.description}` : ''}
${pillarsStr}

Look at this image and return JSON with:
- "description": 1-2 sentence description of what's in the image (plain language, useful for search)
- "tags": 3-6 specific, lowercase tags relevant to this brand's content (not generic like "image" or "photo")

Good tags are specific: product names, themes, content types, moods, settings.
Bad tags are generic: "marketing", "content", "business".

Return ONLY valid JSON, no markdown fences.`,
          },
        ],
      },
    ],
    maxOutputTokens: 300,
  })

  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    return {
      description: parsed.description ?? '',
      tags: (parsed.tags ?? []).map((t: string) => t.toLowerCase().trim()).filter(Boolean),
    }
  } catch {
    return { description: '', tags: [] }
  }
}

/**
 * Generate AI tags from a transcript using Claude text analysis.
 * Extracts topic tags based on what was said + brand context.
 */
export async function generateAITagsFromTranscript(
  transcript: string,
  brand: BrandContext
): Promise<AITagResult> {
  const pillarsStr = brand.content_pillars?.length
    ? `Content pillars: ${brand.content_pillars.join(', ')}.`
    : ''

  const truncatedTranscript = transcript.slice(0, 2000)

  const { text } = await generateText({
    model: gateway(getGatewayModel('fast')),
    providerOptions: getGatewayProviderOptions('fast'),
    messages: [
      {
        role: 'user',
        content: `You are tagging media for a ${brand.niche} brand called "${brand.name}".
${brand.description ? `Brand: ${brand.description}` : ''}
${pillarsStr}

Here is the transcript from a video/audio recording:
"${truncatedTranscript}"

Return JSON with:
- "description": 1-2 sentence summary of what this recording is about (plain language, useful for search)
- "tags": 3-6 specific, lowercase tags relevant to this brand's content

Good tags: specific topics discussed, product names mentioned, content type (tutorial, testimonial, Q&A, etc.).
Bad tags: generic words like "video", "audio", "content".

Return ONLY valid JSON, no markdown fences.`,
      },
    ],
    maxOutputTokens: 300,
  })

  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    return {
      description: parsed.description ?? '',
      tags: (parsed.tags ?? []).map((t: string) => t.toLowerCase().trim()).filter(Boolean),
    }
  } catch {
    return { description: '', tags: [] }
  }
}

// ── Tag category assignment ──────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  'ahpra-regulated': 'compliance',
  'tga-regulated': 'compliance',
  'photo': 'media-type',
  'video': 'media-type',
  'audio': 'media-type',
  'short-form': 'format',
  'behind-the-scenes': 'content',
  'testimonial': 'content',
  'tutorial': 'content',
  'unboxing': 'content',
  'before-after': 'content',
  'promotional': 'content',
  'event': 'content',
  'interview': 'content',
  'product': 'content',
}

/** Guess a category for a tag. Returns null for brand/niche/AI-generated tags. */
export function guessTagCategory(tag: string): string | null {
  return CATEGORY_MAP[tag] ?? null
}
