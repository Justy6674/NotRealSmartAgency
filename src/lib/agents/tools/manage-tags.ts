import { tool } from 'ai'
import { z } from 'zod/v3'
import { fetchMixpostTags, createMixpostTag } from '@/lib/mixpost/client'

export function createManageTagsTool() {
  return tool({
    description:
      'Manage Mixpost tags for organising social posts by brand, campaign, or category.',
    inputSchema: z.object({
      action: z.enum(['list', 'create']).describe('Action to perform'),
      name: z.string().optional().describe('Tag name (required for create)'),
      hex_color: z
        .string()
        .optional()
        .describe('Hex colour for the tag (default #6366f1)'),
    }),
    execute: async ({ action, name, hex_color }) => {
      if (action === 'list') {
        const tags = await fetchMixpostTags()
        if (!tags) return { success: false, error: 'Cannot reach Mixpost.' }
        return {
          success: true,
          tags,
          message: `${tags.length} tags found: ${tags.map((t) => t.name).join(', ')}`,
        }
      }

      if (action === 'create') {
        if (!name) return { success: false, error: 'Tag name is required.' }
        const tag = await createMixpostTag(name, hex_color ?? '#6366f1')
        if (!tag) return { success: false, error: 'Failed to create tag.' }
        return { success: true, tag, message: `Tag "${tag.name}" created.` }
      }

      return { success: false, error: 'Invalid action.' }
    },
  })
}
