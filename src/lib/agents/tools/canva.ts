import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCanvaToken, canvaFetch } from '@/lib/canva/client'

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number; title_suffix: string }> = {
  instagram_post: { width: 1080, height: 1080, title_suffix: 'Instagram Post' },
  instagram_story: { width: 1080, height: 1920, title_suffix: 'Instagram Story' },
  facebook_post: { width: 1200, height: 630, title_suffix: 'Facebook Post' },
  linkedin_post: { width: 1200, height: 627, title_suffix: 'LinkedIn Post' },
  twitter_post: { width: 1600, height: 900, title_suffix: 'X Post' },
  tiktok_video: { width: 1080, height: 1920, title_suffix: 'TikTok Video' },
  youtube_thumbnail: { width: 1280, height: 720, title_suffix: 'YouTube Thumbnail' },
  presentation: { width: 1920, height: 1080, title_suffix: 'Presentation' },
  a4_document: { width: 595, height: 842, title_suffix: 'A4 Document' },
}

function noKeyError() {
  return {
    success: false,
    error:
      'No Canva API key connected. To use Canva features, connect your Canva account: go to canva.com/developers to get an API key, then tell me and I\'ll save it for you.',
  }
}

// ---------------------------------------------------------------------------
// Search designs by keyword
// ---------------------------------------------------------------------------
export function createSearchDesignsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Search existing designs in the connected Canva account by keyword. Use this to find designs, images, presentations, or any files the user has in Canva.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Search term to find designs by title or content'),
      ownership: z
        .enum(['any', 'owned', 'shared'])
        .default('any')
        .describe('Filter by ownership: any, owned, or shared'),
    }),
    execute: async ({ query, ownership }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const params = new URLSearchParams({
          query,
          ownership,
          sort_by: 'relevance',
        })

        const res = await canvaFetch(apiKey, `/designs?${params}`)
        const data = await res.json()
        const items = data.items ?? []

        if (items.length === 0) {
          return {
            success: true,
            count: 0,
            message: `No designs found matching "${query}". Try a different search term or check folder contents with search_folders.`,
          }
        }

        const results = items.map(
          (d: { id: string; title: string; urls?: { edit_url?: string; view_url?: string }; thumbnail?: { url?: string }; updated_at?: string }) => ({
            id: d.id,
            title: d.title,
            edit_url: d.urls?.edit_url,
            view_url: d.urls?.view_url,
            thumbnail: d.thumbnail?.url,
            updated_at: d.updated_at,
          })
        )

        return {
          success: true,
          count: results.length,
          designs: results,
          message: `Found ${results.length} design(s) matching "${query}":\n${results.map((r: { title: string; edit_url?: string }, i: number) => `${i + 1}. **${r.title}** — [Open in Canva](${r.edit_url})`).join('\n')}`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to search Canva designs',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Search folders
// ---------------------------------------------------------------------------
export function createSearchFoldersTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Search folders in the connected Canva account by name. Use to find where brand assets, templates, or project files are organised.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Search term to match against folder names'),
    }),
    execute: async ({ query }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const params = new URLSearchParams({ query, ownership: 'any' })
        const res = await canvaFetch(apiKey, `/folders/search?${params}`)
        const data = await res.json()
        const items = data.items ?? []

        if (items.length === 0) {
          return {
            success: true,
            count: 0,
            message: `No folders found matching "${query}". Try searching for designs directly with search_designs.`,
          }
        }

        const results = items.map(
          (f: { id: string; name: string; thumbnail?: { url?: string }; updated_at?: string }) => ({
            id: f.id,
            name: f.name,
            thumbnail: f.thumbnail?.url,
            updated_at: f.updated_at,
          })
        )

        return {
          success: true,
          count: results.length,
          folders: results,
          message: `Found ${results.length} folder(s) matching "${query}":\n${results.map((f: { name: string; id: string }, i: number) => `${i + 1}. **${f.name}** (ID: ${f.id})`).join('\n')}\n\nUse list_folder_items with a folder ID to see what's inside.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to search Canva folders',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// List folder items
// ---------------------------------------------------------------------------
export function createListFolderItemsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Browse the contents of a Canva folder. Returns designs, images, and subfolders. Use folder ID from search_folders, or "root" for top-level items.',
    inputSchema: z.object({
      folder_id: z
        .string()
        .describe('Folder ID to browse, or "root" for top-level'),
      item_types: z
        .array(z.enum(['design', 'folder', 'image']))
        .optional()
        .describe('Filter by item type(s)'),
    }),
    execute: async ({ folder_id, item_types }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const params = new URLSearchParams({
          sort_by: 'modified_descending',
        })
        if (item_types?.length) {
          for (const t of item_types) {
            params.append('item_types', t)
          }
        }

        const res = await canvaFetch(
          apiKey,
          `/folders/${folder_id}/items?${params}`
        )
        const data = await res.json()
        const items = data.items ?? []

        if (items.length === 0) {
          return {
            success: true,
            count: 0,
            message: 'This folder is empty.',
          }
        }

        const results = items.map(
          (item: { type: string; folder?: { id: string; name: string }; design?: { id: string; title: string; urls?: { edit_url?: string }; thumbnail?: { url?: string } }; image?: { id: string; urls?: { view_url?: string }; thumbnail?: { url?: string } } }) => {
            if (item.type === 'folder') {
              return { type: 'folder', id: item.folder?.id, name: item.folder?.name }
            }
            if (item.type === 'design') {
              return {
                type: 'design',
                id: item.design?.id,
                title: item.design?.title,
                edit_url: item.design?.urls?.edit_url,
                thumbnail: item.design?.thumbnail?.url,
              }
            }
            // image
            return {
              type: 'image',
              id: item.image?.id,
              view_url: item.image?.urls?.view_url,
              thumbnail: item.image?.thumbnail?.url,
            }
          }
        )

        const lines = results.map(
          (r: { type: string; title?: string; name?: string; id?: string; edit_url?: string; view_url?: string }, i: number) => {
            if (r.type === 'folder') return `${i + 1}. 📁 **${r.name}** (folder ID: ${r.id})`
            if (r.type === 'design') return `${i + 1}. 🎨 **${r.title}** — [Open](${r.edit_url})`
            return `${i + 1}. 🖼️ Image — [View](${r.view_url})`
          }
        )

        return {
          success: true,
          count: results.length,
          items: results,
          message: `Folder contains ${results.length} item(s):\n${lines.join('\n')}`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to list folder items',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// List brand kits
// ---------------------------------------------------------------------------
export function createListBrandKitsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List brand kits available in the connected Canva account. Brand kits contain colours, fonts, and logos. Use to find a brand_kit_id for on-brand design creation.',
    inputSchema: z.object({}),
    execute: async () => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const res = await canvaFetch(apiKey, '/brand-kits')
        const data = await res.json()
        const kits = data.items ?? []

        if (kits.length === 0) {
          return {
            success: true,
            count: 0,
            message:
              'No brand kits found in Canva. You can create one at canva.com → Brand Kit to set up your brand colours, fonts, and logos.',
          }
        }

        const results = kits.map(
          (k: { id: string; name: string; thumbnail?: { url?: string } }) => ({
            id: k.id,
            name: k.name,
            thumbnail: k.thumbnail?.url,
          })
        )

        return {
          success: true,
          count: results.length,
          brand_kits: results,
          message: `Found ${results.length} brand kit(s):\n${results.map((k: { name: string; id: string }, i: number) => `${i + 1}. **${k.name}** (ID: ${k.id})`).join('\n')}\n\nI can use these to create on-brand designs with your colours and fonts.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to list brand kits',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Get design details
// ---------------------------------------------------------------------------
export function createGetDesignTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get detailed information about a specific Canva design by its ID. Returns title, owner, thumbnail, edit/view URLs, and page count.',
    inputSchema: z.object({
      design_id: z
        .string()
        .describe('Canva design ID (starts with D, 11 chars)'),
    }),
    execute: async ({ design_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const res = await canvaFetch(apiKey, `/designs/${design_id}`)
        const data = await res.json()
        const d = data.design

        return {
          success: true,
          design: {
            id: d.id,
            title: d.title,
            owner: d.owner?.display_name,
            page_count: d.page_count,
            edit_url: d.urls?.edit_url,
            view_url: d.urls?.view_url,
            thumbnail: d.thumbnail?.url,
            created_at: d.created_at,
            updated_at: d.updated_at,
          },
          message: `**${d.title}**\n- Pages: ${d.page_count}\n- Last updated: ${d.updated_at}\n- [Open in Canva](${d.urls?.edit_url})`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to get design details',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Design graphic (upgraded — now supports brand kits)
// ---------------------------------------------------------------------------
export function createDesignGraphicTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Create a graphic design using Canva. Supports social media posts, stories, presentations, thumbnails, and documents. Optionally use a brand_kit_id (from list_brand_kits) for on-brand colours and fonts.',
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          'What to design, e.g. "Instagram post announcing our new telehealth feature with modern, clean aesthetic"'
        ),
      format: z
        .enum([
          'instagram_post',
          'instagram_story',
          'facebook_post',
          'linkedin_post',
          'twitter_post',
          'tiktok_video',
          'youtube_thumbnail',
          'presentation',
          'a4_document',
        ])
        .describe('Design format/size'),
      brand_name: z
        .string()
        .optional()
        .describe('Brand name to include in the design'),
      brand_kit_id: z
        .string()
        .optional()
        .describe('Canva brand kit ID for on-brand colours and fonts (from list_brand_kits)'),
    }),
    execute: async ({ prompt, format, brand_name, brand_kit_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)

      if (!apiKey) return noKeyError()

      const dims = FORMAT_DIMENSIONS[format]
      const designTitle = brand_name
        ? `${brand_name} — ${dims.title_suffix}`
        : dims.title_suffix

      try {
        // Build request body
        const body: Record<string, unknown> = {
          design_type: {
            type: 'custom',
            width: dims.width,
            height: dims.height,
          },
          title: designTitle,
        }

        // If brand kit provided, attach it
        if (brand_kit_id) {
          body.brand_kit_id = brand_kit_id
        }

        const createRes = await canvaFetch(apiKey, '/designs', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const createData = await createRes.json()

        const designId = createData.design?.id
        const editUrl = createData.design?.urls?.edit_url

        // Try to get thumbnail
        let thumbnailUrl: string | null = null
        if (designId) {
          try {
            const thumbRes = await canvaFetch(apiKey, `/designs/${designId}`)
            const thumbData = await thumbRes.json()
            thumbnailUrl = thumbData.design?.thumbnail?.url ?? null
          } catch {
            // Thumbnail fetch is best-effort
          }
        }

        // Resolve brand name if not provided
        let resolvedBrandName = brand_name
        if (!resolvedBrandName) {
          const { data: brand } = await supabase
            .from('brands')
            .select('name')
            .eq('id', brandId)
            .single()
          resolvedBrandName = brand?.name ?? undefined
        }

        return {
          success: true,
          design_id: designId,
          edit_url: editUrl,
          thumbnail_url: thumbnailUrl,
          format,
          dimensions: `${dims.width}x${dims.height}`,
          title: designTitle,
          brand_kit_applied: !!brand_kit_id,
          message: `I've created a ${dims.title_suffix} design${resolvedBrandName ? ` for ${resolvedBrandName}` : ''}${brand_kit_id ? ' using your brand kit colours and fonts' : ''} in Canva. You can open and edit it here: ${editUrl}\n\nDesign prompt: "${prompt}"\n\nOnce you're happy with it, tell me to export it and I'll download it as a PNG, JPG, or PDF.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to create Canva design',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Start editing transaction
// ---------------------------------------------------------------------------
export function createStartEditingTransactionTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Start an editing session on a Canva design. Returns a transaction ID needed for all edit operations. Always commit or cancel when done.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID to start editing'),
    }),
    execute: async ({ design_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/editing/transactions`,
          { method: 'POST', body: JSON.stringify({}) }
        )
        const data = await res.json()
        const transactionId =
          data.transaction?.id ?? data.id ?? data.transaction_id

        return {
          success: true,
          transaction_id: transactionId,
          design_id,
          message: `Editing session started on design ${design_id}. Transaction ID: ${transactionId}.\n\nYou can now perform edit operations (replace text, swap images, format text). Remember to commit when done or cancel to discard changes.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to start editing transaction',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Perform editing operations
// ---------------------------------------------------------------------------
export function createPerformEditingOperationsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Perform editing operations on a Canva design — replace text, swap images, format text, delete elements. Requires an active editing transaction.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID being edited'),
      transaction_id: z
        .string()
        .describe('Active transaction ID from start_editing_transaction'),
      operations: z
        .array(
          z.object({
            type: z
              .enum([
                'replace_text',
                'find_and_replace_text',
                'update_fill',
                'delete_element',
                'format_text',
              ])
              .describe('Type of editing operation'),
            target: z
              .string()
              .optional()
              .describe('Element ID to target'),
            find: z
              .string()
              .optional()
              .describe('Text to find (for find_and_replace)'),
            replacement: z
              .string()
              .optional()
              .describe('Replacement text'),
            url: z
              .string()
              .optional()
              .describe('Image/video URL for update_fill'),
            font_size: z.number().optional().describe('Font size in points'),
            font_weight: z
              .string()
              .optional()
              .describe('Font weight (e.g. bold, normal)'),
            color: z
              .string()
              .optional()
              .describe('Hex colour (e.g. #FF0000)'),
            text_align: z
              .enum(['left', 'center', 'right'])
              .optional()
              .describe('Text alignment'),
          })
        )
        .describe('Array of editing operations to perform'),
    }),
    execute: async ({ design_id, transaction_id, operations }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        // Map our schema to Canva's operation format
        const canvaOps = operations.map((op) => {
          const canvaOp: Record<string, unknown> = { type: op.type }

          if (op.target) canvaOp.target = { element_id: op.target }
          if (op.find !== undefined) canvaOp.find = op.find
          if (op.replacement !== undefined) canvaOp.replacement = op.replacement
          if (op.url) canvaOp.url = op.url

          // Format text properties
          const formatting: Record<string, unknown> = {}
          if (op.font_size) formatting.font_size = op.font_size
          if (op.font_weight) formatting.font_weight = op.font_weight
          if (op.color) formatting.color = op.color
          if (op.text_align) formatting.text_align = op.text_align
          if (Object.keys(formatting).length > 0)
            canvaOp.formatting = formatting

          return canvaOp
        })

        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/editing/transactions/${transaction_id}/operations`,
          { method: 'POST', body: JSON.stringify({ operations: canvaOps }) }
        )
        const data = await res.json()

        return {
          success: true,
          design_id,
          transaction_id,
          operations_count: operations.length,
          result: data,
          message: `Successfully queued ${operations.length} editing operation(s) on design ${design_id}. Remember to commit the transaction to save changes.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to perform editing operations',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Commit editing transaction
// ---------------------------------------------------------------------------
export function createCommitEditingTransactionTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Save all pending changes to a Canva design. Must be called after performing edit operations.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID being edited'),
      transaction_id: z
        .string()
        .describe('Active transaction ID to commit'),
    }),
    execute: async ({ design_id, transaction_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        await canvaFetch(
          apiKey,
          `/designs/${design_id}/editing/transactions/${transaction_id}/commit`,
          { method: 'POST' }
        )

        return {
          success: true,
          design_id,
          transaction_id,
          message: `All changes have been saved to design ${design_id}. The editing session is now closed.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to commit editing transaction',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Cancel editing transaction
// ---------------------------------------------------------------------------
export function createCancelEditingTransactionTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Discard all pending changes to a Canva design without saving.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID being edited'),
      transaction_id: z
        .string()
        .describe('Active transaction ID to cancel'),
    }),
    execute: async ({ design_id, transaction_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        await canvaFetch(
          apiKey,
          `/designs/${design_id}/editing/transactions/${transaction_id}/cancel`,
          { method: 'POST' }
        )

        return {
          success: true,
          design_id,
          transaction_id,
          message: `All pending changes to design ${design_id} have been discarded. The editing session is now closed.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to cancel editing transaction',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Get design content (text)
// ---------------------------------------------------------------------------
export function createGetDesignContentTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Read all text content from a Canva design. Useful for checking copy, compliance review, or extracting text for repurposing.',
    inputSchema: z.object({
      design_id: z
        .string()
        .describe('Canva design ID to read content from'),
    }),
    execute: async ({ design_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const res = await canvaFetch(apiKey, `/designs/${design_id}/content`)
        const data = await res.json()

        return {
          success: true,
          design_id,
          content: data,
          message: `Retrieved text content from design ${design_id}. Review the content field for all text elements across pages.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to get design content',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Get design pages
// ---------------------------------------------------------------------------
export function createGetDesignPagesTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get a list of all pages in a Canva design with thumbnails. Useful for presentations and multi-page designs.',
    inputSchema: z.object({
      design_id: z
        .string()
        .describe('Canva design ID to get pages from'),
    }),
    execute: async ({ design_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const res = await canvaFetch(apiKey, `/designs/${design_id}/pages`)
        const data = await res.json()
        const pages = data.items ?? data.pages ?? []

        return {
          success: true,
          design_id,
          page_count: pages.length,
          pages,
          message: `Design ${design_id} has ${pages.length} page(s).${pages.length > 0 ? '\n' + pages.map((p: { id?: string; title?: string }, i: number) => `${i + 1}. ${p.title || `Page ${i + 1}`} (ID: ${p.id})`).join('\n') : ''}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to get design pages',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Get design assets / elements
// ---------------------------------------------------------------------------
export function createGetDesignAssetsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get metadata for elements in a Canva design — IDs, types, positions. Needed to target specific elements for editing.',
    inputSchema: z.object({
      design_id: z
        .string()
        .describe('Canva design ID to get assets from'),
      page_id: z
        .string()
        .optional()
        .describe('Optional page ID to filter elements by page'),
    }),
    execute: async ({ design_id, page_id }) => {
      const apiKey = await getCanvaToken(supabase, userId)
      if (!apiKey) return noKeyError()

      try {
        const path = page_id
          ? `/designs/${design_id}/elements?page_id=${page_id}`
          : `/designs/${design_id}/elements`
        const res = await canvaFetch(apiKey, path)
        const data = await res.json()
        const elements = data.items ?? data.elements ?? []

        return {
          success: true,
          design_id,
          page_id: page_id ?? null,
          element_count: elements.length,
          elements,
          message: `Found ${elements.length} element(s) in design ${design_id}${page_id ? ` (page ${page_id})` : ''}.${elements.length > 0 ? '\n' + elements.map((e: { id?: string; type?: string }, i: number) => `${i + 1}. ${e.type ?? 'unknown'} (ID: ${e.id})`).join('\n') : ''}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to get design assets',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Export design (unchanged)
// ---------------------------------------------------------------------------
export function createExportDesignTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Export a Canva design as an image or PDF. Use after creating a design with design_graphic to download the finished file.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID to export'),
      format: z
        .enum(['png', 'jpg', 'pdf'])
        .default('png')
        .describe('Export format — png for social media, pdf for documents'),
    }),
    execute: async ({ design_id, format }) => {
      const apiKey = await getCanvaToken(supabase, userId)

      if (!apiKey) return noKeyError()

      try {
        // Step 1: Start the export
        const exportRes = await canvaFetch(apiKey, '/exports', {
          method: 'POST',
          body: JSON.stringify({
            design_id,
            format: { type: format },
          }),
        })
        const exportData = await exportRes.json()

        const exportId = exportData.export?.id

        if (!exportId) {
          return { success: false, error: 'No export ID returned from Canva' }
        }

        // Step 2: Poll for completion (max 30 seconds)
        const maxAttempts = 15
        const pollInterval = 2000

        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))

          try {
            const statusRes = await canvaFetch(
              apiKey,
              `/exports/${exportId}`
            )
            const statusData = await statusRes.json()
            const status = statusData.export?.status

            if (status === 'completed') {
              const downloadUrl =
                statusData.export?.urls?.[0]?.url ??
                statusData.export?.download_url

              return {
                success: true,
                export_id: exportId,
                design_id,
                format,
                download_url: downloadUrl,
                message: downloadUrl
                  ? `Your design has been exported as ${format.toUpperCase()}. Download it here: ${downloadUrl}`
                  : `Export completed but no download URL was returned. Export ID: ${exportId}`,
              }
            }

            if (status === 'failed') {
              return {
                success: false,
                error: 'Canva export failed. The design may be empty or corrupted.',
              }
            }
          } catch {
            // Poll attempt failed, continue
          }
        }

        return {
          success: false,
          error:
            'Export is still processing after 30 seconds. Try again in a moment — the export ID is ' +
            exportId,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to export Canva design',
        }
      }
    },
  })
}
