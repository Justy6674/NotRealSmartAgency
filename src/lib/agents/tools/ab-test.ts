import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { memoryStore } from '@/lib/ruflo/client'
import { getNamespace } from '@/lib/ruflo/namespaces'

// ─── A/B Content Testing Tool ────────────────────────────────────────────────
//
// Two actions: 'create' splits a scheduled post into control + variant,
//              'check'  compares engagement after 48 hours.

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000

export function createAbTestTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'A/B test content performance. Use "create" to duplicate a scheduled post with a variation (caption, hashtags, CTA, or timing). Use "check" to compare results after 48 hours and declare a winner.',
    inputSchema: z.object({
      action: z.enum(['create', 'check']).describe('"create" to set up a new A/B test, "check" to review results'),
      // create fields
      post_id: z.string().optional().describe('The scheduled_post ID to split (required for "create")'),
      dimension: z.enum(['caption', 'hashtags', 'cta', 'timing']).optional().describe('What to vary — caption text, hashtags, CTA phrasing, or posting time'),
      variant_caption: z.string().optional().describe('Custom variant caption (optional — auto-generated if omitted)'),
      // check fields
      ab_test_id: z.string().optional().describe('The A/B test ID to check results for (required for "check")'),
    }),
    execute: async ({ action, post_id, dimension, variant_caption, ab_test_id }) => {
      try {
        if (action === 'create') {
          return await createAbTest(supabase, userId, brandId, post_id, dimension, variant_caption)
        } else {
          return await checkAbTest(supabase, userId, brandId, ab_test_id)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    },
  })
}

// ─── Create ──────────────────────────────────────────────────────────────────

async function createAbTest(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  postId?: string,
  dimension?: string,
  variantCaption?: string,
) {
  if (!postId) return { success: false, error: 'post_id is required for "create" action.' }
  if (!dimension) return { success: false, error: 'dimension is required for "create" action.' }

  // Fetch the original post
  const { data: original, error: fetchErr } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('id', postId)
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .single()

  if (fetchErr || !original) {
    return { success: false, error: `Could not find post ${postId}: ${fetchErr?.message ?? 'not found'}` }
  }

  const testId = crypto.randomUUID()

  // Tag the original as control
  const originalMeta = {
    ...(original.metadata as Record<string, unknown>),
    ab_test_id: testId,
    variant_key: 'control',
    ab_dimension: dimension,
  }

  const { error: updateErr } = await supabase
    .from('scheduled_posts')
    .update({ metadata: originalMeta })
    .eq('id', postId)

  if (updateErr) {
    return { success: false, error: `Failed to tag control: ${updateErr.message}` }
  }

  // Build variant content
  const scheduledAt = new Date(original.scheduled_at)
  const variantScheduledAt = new Date(scheduledAt.getTime() + 30 * 60 * 1000) // +30 min

  let variantCaptionText = original.caption as string
  let variantHashtags = [...(original.hashtags as string[])]

  switch (dimension) {
    case 'caption':
      variantCaptionText = variantCaption ?? reverseHookAndBody(original.caption as string)
      break
    case 'hashtags':
      // Shuffle hashtags and drop the last one for variety
      variantHashtags = shuffleArray(variantHashtags).slice(0, Math.max(1, variantHashtags.length - 1))
      break
    case 'cta':
      variantCaptionText = variantCaption ?? swapCTA(original.caption as string)
      break
    case 'timing':
      // Shift to -30 min instead of +30 min
      variantScheduledAt.setTime(scheduledAt.getTime() - 30 * 60 * 1000)
      break
  }

  const variantMeta = {
    ...(original.metadata as Record<string, unknown>),
    ab_test_id: testId,
    variant_key: 'variant_a',
    ab_dimension: dimension,
  }

  const { data: variant, error: insertErr } = await supabase
    .from('scheduled_posts')
    .insert({
      user_id: userId,
      brand_id: brandId,
      media_item_id: original.media_item_id,
      media_item_ids: original.media_item_ids ?? [],
      post_type: original.post_type,
      output_id: original.output_id,
      platform: original.platform,
      caption: variantCaptionText,
      hashtags: variantHashtags,
      scheduled_at: variantScheduledAt.toISOString(),
      status: original.status,
      metadata: variantMeta,
      content_type: original.content_type ?? null,
      content_pillar: original.content_pillar ?? null,
    })
    .select('id')
    .single()

  if (insertErr) {
    return { success: false, error: `Failed to create variant: ${insertErr.message}` }
  }

  return {
    success: true,
    ab_test_id: testId,
    control_post_id: postId,
    variant_post_id: variant?.id,
    dimension,
    variant_scheduled_at: variantScheduledAt.toISOString(),
    message: `A/B test created. Control and Variant A scheduled. The ${dimension} has been varied. Check results after 48 hours with ab_test_id "${testId}".`,
  }
}

// ─── Check ───────────────────────────────────────────────────────────────────

async function checkAbTest(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  abTestId?: string,
) {
  if (!abTestId) return { success: false, error: 'ab_test_id is required for "check" action.' }

  // Fetch both posts
  const { data: posts, error: fetchErr } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .filter('metadata->>ab_test_id', 'eq', abTestId)
    .order('created_at', { ascending: true })

  if (fetchErr || !posts?.length) {
    return { success: false, error: `No posts found for A/B test ${abTestId}: ${fetchErr?.message ?? 'none'}` }
  }

  if (posts.length < 2) {
    return { success: false, error: 'Only one post found — the test may not have been set up correctly.' }
  }

  const control = posts.find((p) => (p.metadata as Record<string, unknown>)?.variant_key === 'control')
  const variant = posts.find((p) => (p.metadata as Record<string, unknown>)?.variant_key === 'variant_a')

  if (!control || !variant) {
    return { success: false, error: 'Could not identify control and variant posts.' }
  }

  // Check if both are published
  const bothPublished = control.status === 'published' && variant.status === 'published'

  if (!bothPublished) {
    const pendingVariants = [
      control.status !== 'published' ? 'Control' : null,
      variant.status !== 'published' ? 'Variant A' : null,
    ].filter(Boolean)

    return {
      success: true,
      ready: false,
      message: `Test still running. ${pendingVariants.join(' and ')} not yet published. Check back once both are live.`,
    }
  }

  // Check 48-hour wait
  const controlPublishedAt = new Date(control.published_at as string)
  const variantPublishedAt = new Date(variant.published_at as string)
  const latestPublish = new Date(Math.max(controlPublishedAt.getTime(), variantPublishedAt.getTime()))
  const msSincePublish = Date.now() - latestPublish.getTime()

  if (msSincePublish < FORTY_EIGHT_HOURS_MS) {
    const readyDate = new Date(latestPublish.getTime() + FORTY_EIGHT_HOURS_MS)
    return {
      success: true,
      ready: false,
      message: `Test still running. Check back after ${readyDate.toISOString().slice(0, 16).replace('T', ' ')} UTC (48 hours post-publish).`,
    }
  }

  // Compare engagement from metadata
  const controlEngagement = extractEngagement(control.metadata as Record<string, unknown>)
  const variantEngagement = extractEngagement(variant.metadata as Record<string, unknown>)

  const controlScore = controlEngagement.likes + controlEngagement.comments * 2 + controlEngagement.shares * 3
  const variantScore = variantEngagement.likes + variantEngagement.comments * 2 + variantEngagement.shares * 3

  const winner = controlScore >= variantScore ? 'control' : 'variant_a'
  const dimension = (control.metadata as Record<string, unknown>)?.ab_dimension ?? 'unknown'
  const improvement = controlScore > 0
    ? Math.round(Math.abs(variantScore - controlScore) / controlScore * 100)
    : 0

  // Store the learning in this project only. A/B results must never become
  // agency-global context or affect a sibling brand's recommendations.
  const learning = `A/B test on ${dimension}: ${winner === 'control' ? 'Original' : 'Variant'} won with ${improvement}% ${winner === 'variant_a' ? 'improvement' : 'higher'} engagement score. Platform: ${control.platform}. Control score: ${controlScore}, Variant score: ${variantScore}.`

  const { data: brand } = await supabase
    .from('brands')
    .select('slug')
    .eq('id', brandId)
    .single()
  if (brand?.slug) {
    await memoryStore(
      `ab-test-${abTestId}`,
      learning,
      getNamespace(brand.slug, 'overall'),
      ['ab_test_result', dimension, winner, control.platform],
      { brandId, userId },
    )
  }

  return {
    success: true,
    ready: true,
    ab_test_id: abTestId,
    dimension,
    winner,
    improvement_pct: improvement,
    comparison: {
      control: {
        post_id: control.id,
        caption_preview: (control.caption as string).slice(0, 80),
        ...controlEngagement,
        score: controlScore,
      },
      variant_a: {
        post_id: variant.id,
        caption_preview: (variant.caption as string).slice(0, 80),
        ...variantEngagement,
        score: variantScore,
      },
    },
    learning,
    message: `A/B test complete! **${winner === 'control' ? 'Control (original)' : 'Variant A'}** won with a weighted engagement score of ${winner === 'control' ? controlScore : variantScore} vs ${winner === 'control' ? variantScore : controlScore} (${improvement}% difference). Dimension tested: ${dimension}. Learning saved to memory.`,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractEngagement(metadata: Record<string, unknown>): { likes: number; comments: number; shares: number } {
  const engagement = (metadata?.engagement ?? metadata?.metrics ?? {}) as Record<string, unknown>
  return {
    likes: Number(engagement?.likes ?? 0),
    comments: Number(engagement?.comments ?? 0),
    shares: Number(engagement?.shares ?? engagement?.reposts ?? 0),
  }
}

function reverseHookAndBody(caption: string): string {
  const sentences = caption.split(/(?<=[.!?])\s+/)
  if (sentences.length < 2) return caption + ' (varied)'
  // Move the last sentence to the front
  return [sentences[sentences.length - 1], ...sentences.slice(0, -1)].join(' ')
}

function swapCTA(caption: string): string {
  const ctaPatterns: [RegExp, string][] = [
    [/\bclick the link\b/gi, 'tap the link in bio'],
    [/\btap the link\b/gi, 'check the link'],
    [/\blearn more\b/gi, 'find out how'],
    [/\bget started\b/gi, 'start today'],
    [/\bbook now\b/gi, 'reserve your spot'],
    [/\bshop now\b/gi, 'browse the collection'],
    [/\bsign up\b/gi, 'join us'],
    [/\bfollow us\b/gi, 'hit follow'],
    [/\bcomment below\b/gi, 'drop your thoughts'],
    [/\bDM us\b/gi, 'send us a message'],
  ]

  let result = caption
  for (const [pattern, replacement] of ctaPatterns) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement)
      return result
    }
  }

  // No CTA found — append one
  return result + '\n\nTap the link in bio to learn more.'
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
