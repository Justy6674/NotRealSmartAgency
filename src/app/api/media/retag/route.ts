export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateDeterministicTags,
  generateAITagsForImage,
  guessTagCategory,
} from '@/lib/media/auto-tagger'

/**
 * POST /api/media/retag?brandId=xxx
 *
 * Retroactively applies smart deterministic tags to ALL existing media for a brand.
 * Also runs AI vision on images that don't have an ai_description yet.
 * Safe to run multiple times — merges tags, doesn't replace.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  // Fetch brand context
  const { data: brand } = await supabase
    .from('brands')
    .select('name, niche, content_pillars, compliance_flags, description, target_audience')
    .eq('id', brandId)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  // Fetch all media for this brand
  const { data: items, error } = await supabase
    .from('media_items')
    .select('id, file_name, file_type, file_url, tags, ai_description')
    .eq('user_id', user.id)
    .eq('brand_id', brandId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items?.length) return NextResponse.json({ retagged: 0, message: 'No media found' })

  let retagged = 0
  let aiDescribed = 0
  const allNewTags = new Set<string>()

  for (const item of items) {
    // Generate deterministic tags
    const smartTags = generateDeterministicTags(brand, item.file_type, item.file_name)
    const existingTags: string[] = item.tags ?? []
    const mergedTags = Array.from(new Set([...existingTags, ...smartTags]))

    const updates: Record<string, unknown> = {}

    // Only update if we have new tags
    if (mergedTags.length > existingTags.length) {
      updates.tags = mergedTags
      smartTags.forEach(t => allNewTags.add(t))
    }

    // AI vision for images without description (batch — max 10 to stay within timeout)
    const isImage = (item.file_type as string).startsWith('image/')
    if (isImage && !item.ai_description && aiDescribed < 10) {
      try {
        const aiResult = await generateAITagsForImage(item.file_url, brand)
        if (aiResult.description) {
          updates.ai_description = aiResult.description
          aiDescribed++
        }
        if (aiResult.tags.length) {
          const withAI = Array.from(new Set([...(updates.tags as string[] ?? mergedTags), ...aiResult.tags]))
          updates.tags = withAI
          aiResult.tags.forEach(t => allNewTags.add(t))
        }
      } catch {
        // Non-fatal — skip AI for this item
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('media_items')
        .update(updates)
        .eq('id', item.id)

      retagged++
    }
  }

  // Ensure new tags exist in structured media_tags table
  if (allNewTags.size > 0) {
    const tagInserts = Array.from(allNewTags).map(tag => ({
      user_id: user.id,
      name: tag,
      brand_id: brandId,
      category: guessTagCategory(tag),
      colour: '#6366f1',
    }))

    await supabase
      .from('media_tags')
      .upsert(tagInserts, { onConflict: 'user_id,name,brand_id', ignoreDuplicates: true })
  }

  return NextResponse.json({
    success: true,
    total: items.length,
    retagged,
    aiDescribed,
    newTags: Array.from(allNewTags),
    message: `Retagged ${retagged}/${items.length} items. ${aiDescribed} AI descriptions added. ${allNewTags.size} new smart tags.`,
  })
}
