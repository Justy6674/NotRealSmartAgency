import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMixpostTags, createMixpostTag } from '@/lib/mixpost/client'

export function createManageMediaTagsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Manage structured media tags and apply them to media items. ' +
      'Create, list, rename, or delete tags. Tag or untag media items. Bulk-tag multiple items. ' +
      'Also syncs with Mixpost publishing tags where relevant.',
    inputSchema: z.object({
      action: z.enum(['create_tag', 'list_tags', 'tag_media', 'untag_media', 'bulk_tag', 'delete_tag', 'rename_tag'])
        .describe('Action to perform'),
      tag_name: z.string().optional()
        .describe('Tag name (for create_tag, tag_media, untag_media, bulk_tag, rename_tag)'),
      new_name: z.string().optional()
        .describe('New tag name (for rename_tag)'),
      tag_id: z.string().optional()
        .describe('Tag ID (for delete_tag, rename_tag)'),
      colour: z.string().optional()
        .describe('Hex colour for the tag (default #6366f1)'),
      category: z.string().optional()
        .describe('Tag category: campaign, product, season, mood'),
      media_item_ids: z.array(z.string()).optional()
        .describe('Media item IDs to tag/untag'),
      search: z.string().optional()
        .describe('Search media items by name/description to find items to tag'),
      sync_mixpost: z.boolean().optional()
        .describe('Also create/sync this tag in Mixpost (default: false)'),
    }),
    execute: async ({ action, tag_name, new_name, tag_id, colour, category, media_item_ids, search, sync_mixpost }) => {

      if (action === 'list_tags') {
        const { data, error } = await supabase
          .from('media_tags')
          .select('*')
          .eq('user_id', userId)
          .or(`brand_id.eq.${brandId},brand_id.is.null`)
          .order('name')

        if (error) return { success: false, error: error.message }

        // Also fetch Mixpost tags for reference
        const mixpostTags = await fetchMixpostTags()

        return {
          success: true,
          tags: data ?? [],
          mixpost_tags: mixpostTags ?? [],
          message: `${(data ?? []).length} media tag(s), ${(mixpostTags ?? []).length} Mixpost tag(s).`,
        }
      }

      if (action === 'create_tag') {
        if (!tag_name?.trim()) return { success: false, error: 'tag_name is required.' }

        const { data, error } = await supabase
          .from('media_tags')
          .insert({
            user_id: userId,
            name: tag_name.trim(),
            colour: colour ?? '#6366f1',
            category: category ?? null,
            brand_id: brandId,
          })
          .select()
          .single()

        if (error) {
          if (error.code === '23505') return { success: false, error: `Tag "${tag_name}" already exists.` }
          return { success: false, error: error.message }
        }

        // Optionally sync to Mixpost
        if (sync_mixpost) {
          await createMixpostTag(tag_name.trim(), colour ?? '#6366f1')
        }

        return {
          success: true,
          tag: data,
          message: `Tag "${tag_name}" created${sync_mixpost ? ' (also synced to Mixpost)' : ''}.`,
        }
      }

      if (action === 'rename_tag') {
        if (!tag_id && !tag_name) return { success: false, error: 'tag_id or tag_name is required.' }
        if (!new_name?.trim()) return { success: false, error: 'new_name is required.' }

        let targetId = tag_id
        if (!targetId && tag_name) {
          const { data: found } = await supabase
            .from('media_tags')
            .select('id')
            .eq('user_id', userId)
            .eq('name', tag_name)
            .limit(1)
            .single()
          targetId = found?.id
        }
        if (!targetId) return { success: false, error: 'Tag not found.' }

        const updates: Record<string, unknown> = { name: new_name.trim() }
        if (colour) updates.colour = colour

        const { data, error } = await supabase
          .from('media_tags')
          .update(updates)
          .eq('id', targetId)
          .eq('user_id', userId)
          .select()
          .single()

        if (error) return { success: false, error: error.message }
        return { success: true, tag: data, message: `Tag renamed to "${new_name}".` }
      }

      if (action === 'delete_tag') {
        if (!tag_id && !tag_name) return { success: false, error: 'tag_id or tag_name is required.' }

        let query = supabase
          .from('media_tags')
          .delete()
          .eq('user_id', userId)

        if (tag_id) {
          query = query.eq('id', tag_id)
        } else if (tag_name) {
          query = query.eq('name', tag_name)
        }

        const { error } = await query
        if (error) return { success: false, error: error.message }
        return { success: true, message: `Tag deleted.` }
      }

      // Helper: resolve media IDs from search
      async function resolveMediaIds(): Promise<string[]> {
        if (media_item_ids?.length) return media_item_ids
        if (!search) return []

        const { data } = await supabase
          .from('media_items')
          .select('id')
          .eq('user_id', userId)
          .eq('brand_id', brandId)
          .eq('is_archived', false)
          .or(`file_name.ilike.%${search}%,ai_description.ilike.%${search}%`)
          .limit(50)

        return (data ?? []).map(m => m.id)
      }

      if (action === 'tag_media' || action === 'bulk_tag') {
        if (!tag_name?.trim()) return { success: false, error: 'tag_name is required.' }

        const ids = await resolveMediaIds()
        if (!ids.length) return { success: false, error: 'No media items found to tag.' }

        // Add the tag to each media item's tags array
        // Using the text[] column on media_items for backward compat
        let tagged = 0
        for (const id of ids) {
          const { data: item } = await supabase
            .from('media_items')
            .select('tags')
            .eq('id', id)
            .single()

          const existingTags: string[] = item?.tags ?? []
          if (!existingTags.includes(tag_name.trim())) {
            const { error } = await supabase
              .from('media_items')
              .update({ tags: [...existingTags, tag_name.trim()] })
              .eq('id', id)

            if (!error) tagged++
          }
        }

        // Ensure the structured tag exists
        await supabase
          .from('media_tags')
          .upsert({
            user_id: userId,
            name: tag_name.trim(),
            colour: colour ?? '#6366f1',
            category: category ?? null,
            brand_id: brandId,
          }, { onConflict: 'user_id,name,brand_id' })

        return {
          success: true,
          tagged,
          total: ids.length,
          message: `Tagged ${tagged} media item(s) with "${tag_name}".`,
        }
      }

      if (action === 'untag_media') {
        if (!tag_name?.trim()) return { success: false, error: 'tag_name is required.' }

        const ids = await resolveMediaIds()
        if (!ids.length) return { success: false, error: 'No media items found to untag.' }

        let untagged = 0
        for (const id of ids) {
          const { data: item } = await supabase
            .from('media_items')
            .select('tags')
            .eq('id', id)
            .single()

          const existingTags: string[] = item?.tags ?? []
          const newTags = existingTags.filter(t => t !== tag_name.trim())
          if (newTags.length !== existingTags.length) {
            const { error } = await supabase
              .from('media_items')
              .update({ tags: newTags })
              .eq('id', id)

            if (!error) untagged++
          }
        }

        return {
          success: true,
          untagged,
          message: `Removed "${tag_name}" from ${untagged} media item(s).`,
        }
      }

      return { success: false, error: 'Invalid action.' }
    },
  })
}
