import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createManageCollectionsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Manage media collections (carousel sets, campaign groups, albums). ' +
      'Create collections from media items, add/remove items, reorder, list, or delete. ' +
      'Use this when the user wants to group media together for a carousel, campaign, or album.',
    inputSchema: z.object({
      action: z.enum(['create', 'list', 'add_items', 'remove_items', 'reorder', 'delete'])
        .describe('Action to perform on collections'),
      collection_id: z.string().optional()
        .describe('Collection ID (required for add_items, remove_items, reorder, delete)'),
      name: z.string().optional()
        .describe('Collection name (required for create)'),
      description: z.string().optional()
        .describe('Collection description'),
      collection_type: z.enum(['carousel', 'campaign', 'album', 'story_set']).optional()
        .describe('Type of collection (default: carousel)'),
      media_item_ids: z.array(z.string()).optional()
        .describe('Media item IDs to add (for create, add_items)'),
      item_ids_to_remove: z.array(z.string()).optional()
        .describe('Collection item IDs to remove (for remove_items)'),
      order: z.array(z.object({ id: z.string(), position: z.number() })).optional()
        .describe('New order for items (for reorder)'),
      search: z.string().optional()
        .describe('Search media items by file name, tags, or AI description (for create/add_items when IDs not known)'),
    }),
    execute: async ({ action, collection_id, name, description, collection_type, media_item_ids, item_ids_to_remove, order, search }) => {

      // Helper: search media items by text
      async function searchMedia(query: string): Promise<string[]> {
        const { data } = await supabase
          .from('media_items')
          .select('id, file_name, tags, ai_description')
          .eq('user_id', userId)
          .eq('brand_id', brandId)
          .eq('is_archived', false)
          .or(`file_name.ilike.%${query}%,ai_description.ilike.%${query}%`)
          .limit(20)

        return (data ?? []).map(m => m.id)
      }

      if (action === 'list') {
        const { data, error } = await supabase
          .from('media_collections')
          .select('id, name, description, collection_type, cover_image_url, is_archived, created_at, media_collection_items(id, media_item_id, position, slide_title)')
          .eq('user_id', userId)
          .eq('brand_id', brandId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })

        if (error) return { success: false, error: error.message }
        return {
          success: true,
          collections: data ?? [],
          message: `${(data ?? []).length} collection(s) found for this brand.`,
        }
      }

      if (action === 'create') {
        if (!name) return { success: false, error: 'Collection name is required.' }

        // If search provided instead of IDs, find matching media
        let resolvedIds = media_item_ids ?? []
        if (search && !resolvedIds.length) {
          resolvedIds = await searchMedia(search)
          if (!resolvedIds.length) {
            return { success: false, error: `No media items found matching "${search}".` }
          }
        }

        const { data: collection, error: collError } = await supabase
          .from('media_collections')
          .insert({
            user_id: userId,
            brand_id: brandId,
            name,
            description: description ?? null,
            collection_type: collection_type ?? 'carousel',
          })
          .select()
          .single()

        if (collError) return { success: false, error: collError.message }

        if (resolvedIds.length) {
          const items = resolvedIds.map((mediaItemId, i) => ({
            collection_id: collection.id,
            media_item_id: mediaItemId,
            position: i,
          }))

          const { error: itemsError } = await supabase
            .from('media_collection_items')
            .insert(items)

          if (itemsError) return { success: false, error: itemsError.message }

          // Set cover from first item
          const { data: first } = await supabase
            .from('media_items')
            .select('file_url')
            .eq('id', resolvedIds[0])
            .single()

          if (first) {
            await supabase
              .from('media_collections')
              .update({ cover_image_url: first.file_url })
              .eq('id', collection.id)
          }
        }

        return {
          success: true,
          collection_id: collection.id,
          name: collection.name,
          item_count: resolvedIds.length,
          message: `Created "${name}" collection with ${resolvedIds.length} item(s).`,
        }
      }

      if (action === 'add_items') {
        if (!collection_id) return { success: false, error: 'collection_id is required.' }

        let resolvedIds = media_item_ids ?? []
        if (search && !resolvedIds.length) {
          resolvedIds = await searchMedia(search)
          if (!resolvedIds.length) {
            return { success: false, error: `No media items found matching "${search}".` }
          }
        }

        if (!resolvedIds.length) return { success: false, error: 'No media items to add.' }

        // Get current max position
        const { data: existing } = await supabase
          .from('media_collection_items')
          .select('position')
          .eq('collection_id', collection_id)
          .order('position', { ascending: false })
          .limit(1)

        const startPos = (existing?.[0]?.position ?? -1) + 1

        const items = resolvedIds.map((mediaItemId, i) => ({
          collection_id,
          media_item_id: mediaItemId,
          position: startPos + i,
        }))

        const { error } = await supabase
          .from('media_collection_items')
          .upsert(items, { onConflict: 'collection_id,media_item_id' })

        if (error) return { success: false, error: error.message }
        return {
          success: true,
          added: resolvedIds.length,
          message: `Added ${resolvedIds.length} item(s) to the collection.`,
        }
      }

      if (action === 'remove_items') {
        if (!collection_id) return { success: false, error: 'collection_id is required.' }
        if (!item_ids_to_remove?.length) return { success: false, error: 'item_ids_to_remove is required.' }

        const { error } = await supabase
          .from('media_collection_items')
          .delete()
          .eq('collection_id', collection_id)
          .in('id', item_ids_to_remove)

        if (error) return { success: false, error: error.message }
        return {
          success: true,
          removed: item_ids_to_remove.length,
          message: `Removed ${item_ids_to_remove.length} item(s) from the collection.`,
        }
      }

      if (action === 'reorder') {
        if (!collection_id) return { success: false, error: 'collection_id is required.' }
        if (!order?.length) return { success: false, error: 'order array is required.' }

        for (const item of order) {
          await supabase
            .from('media_collection_items')
            .update({ position: item.position })
            .eq('id', item.id)
            .eq('collection_id', collection_id)
        }

        return {
          success: true,
          reordered: order.length,
          message: `Reordered ${order.length} item(s).`,
        }
      }

      if (action === 'delete') {
        if (!collection_id) return { success: false, error: 'collection_id is required.' }

        const { error } = await supabase
          .from('media_collections')
          .delete()
          .eq('id', collection_id)
          .eq('user_id', userId)

        if (error) return { success: false, error: error.message }
        return { success: true, message: 'Collection deleted.' }
      }

      return { success: false, error: 'Invalid action.' }
    },
  })
}
