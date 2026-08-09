import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canvaFetch } from '@/lib/canva/client'
import { getCanvaState } from '@/lib/canva/status'
import {
  filterCanvaTemplatesForBrand,
  isCanvaTemplateAllowed,
  readCanvaTemplateContract,
  type CanvaTemplateContract,
} from '@/lib/canva/template-contract'

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

const AUTOFILL_POLL_INTERVAL_MS = 500
const AUTOFILL_POLL_ATTEMPTS = 60

type CanvaAutofillValue = string | Record<string, unknown>

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type BrandTemplateScope =
  | { brandName: string; contract: CanvaTemplateContract }
  | { error: string }

/**
 * Canva exposes the whole connected account rather than an owner/project
 * column for each Brand Template.  A title such as "Heading" is never enough
 * to establish ownership, so every template write is scoped through the NRS
 * brand's explicit contract before Canva is called.
 */
async function loadBrandTemplateScope(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
): Promise<BrandTemplateScope> {
  const { data: brand, error } = await supabase
    .from('brands')
    .select('name, brand_dna_constraints')
    .eq('id', brandId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !brand) {
    return { error: 'Could not read the active NRS brand contract. No Canva template was used.' }
  }

  const contract = readCanvaTemplateContract(brand.brand_dna_constraints)
  if (!contract) {
    return {
      error:
        `${brand.name} has no explicit Canva template mapping. NRS will not use account-wide templates or invent another brand’s look. No design was created.`,
    }
  }

  return { brandName: brand.name, contract }
}

/** Convert the convenient text form used by NRS into Canva's documented data shape. */
export function normaliseCanvaAutofillData(
  data: Record<string, CanvaAutofillValue>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([field, value]) => [
    field,
    typeof value === 'string' ? { type: 'text', text: value } : value,
  ]))
}

/** Validate against Canva's live template definition before any write is attempted. */
export function validateCanvaAutofillData(
  data: Record<string, CanvaAutofillValue>,
  dataset: Record<string, unknown>,
): string | null {
  const fields = Object.entries(dataset)
  if (fields.length === 0) {
    return 'This Canva template has no published Autofill fields, so NRS cannot safely replace its copy automatically. No design was created.'
  }
  if (Object.keys(data).length === 0) {
    return 'No Canva Autofill values were supplied. No design was created.'
  }

  const normalised = normaliseCanvaAutofillData(data)
  for (const [fieldName, value] of Object.entries(normalised)) {
    const expected = asRecord(dataset[fieldName])
    if (!expected || typeof expected.type !== 'string') {
      return `"${fieldName}" is not a field in this Canva template. No design was created.`
    }
    const supplied = asRecord(value)
    if (!supplied || supplied.type !== expected.type) {
      return `"${fieldName}" must use Canva's ${expected.type} field type. No design was created.`
    }
    if (expected.type === 'text' && (typeof supplied.text !== 'string' || !supplied.text.trim())) {
      return `"${fieldName}" needs non-empty text. No design was created.`
    }
    if (expected.type === 'image' && (typeof supplied.asset_id !== 'string' || !supplied.asset_id)) {
      return `"${fieldName}" needs a Canva image asset ID. No design was created.`
    }
  }

  return null
}

export interface CompletedCanvaDesign {
  jobId: string
  designId: string
  editUrl: string
}

/** A synchronous receipt returned when Canva makes an editable template copy. */
export interface CanvaTemplateCopyReceipt {
  designId: string
  editUrl: string
  viewUrl: string | null
  thumbnailUrl: string | null
  pageCount: number | null
}

/**
 * Canva's documented preview request for copying a Brand Template. Keeping
 * this small and pure means the exact provider payload is regression-tested.
 */
export function buildCanvaBrandTemplateCopyRequest(
  brandTemplateId: string,
  pageNumbers?: number[],
): Record<string, unknown> {
  return {
    type: 'brand_template',
    brand_template_id: brandTemplateId,
    ...(pageNumbers?.length ? { page_numbers: pageNumbers } : {}),
  }
}

/** Read a receipt only when Canva confirms it created an editable design. */
export function canvaTemplateCopyReceipt(payload: unknown): CanvaTemplateCopyReceipt | null {
  const design = asRecord(asRecord(payload)?.design)
  const urls = asRecord(design?.urls)
  const designId = typeof design?.id === 'string' ? design.id : null
  const editUrl = typeof urls?.edit_url === 'string' ? urls.edit_url : null
  if (!designId || !editUrl) return null

  const thumbnail = asRecord(design?.thumbnail)
  return {
    designId,
    editUrl,
    viewUrl: typeof urls?.view_url === 'string' ? urls.view_url : null,
    thumbnailUrl: typeof thumbnail?.url === 'string' ? thumbnail.url : null,
    pageCount: typeof design?.page_count === 'number' ? design.page_count : null,
  }
}

function designIdFromEditUrl(editUrl: string): string | null {
  try {
    const parts = new URL(editUrl).pathname.split('/').filter(Boolean)
    const designIndex = parts.indexOf('design')
    return designIndex >= 0 ? parts[designIndex + 1] ?? null : null
  } catch {
    return null
  }
}

/** Return a receipt only after Canva says the async Autofill job succeeded. */
export function completedCanvaDesignFromJob(job: unknown): CompletedCanvaDesign | null {
  const jobRecord = asRecord(job)
  if (!jobRecord || jobRecord.status !== 'success' || typeof jobRecord.id !== 'string') return null

  const design = asRecord(asRecord(jobRecord.result)?.design)
  const urls = asRecord(design?.urls)
  const editUrl = typeof design?.url === 'string'
    ? design.url
    : typeof urls?.edit_url === 'string'
      ? urls.edit_url
      : null
  if (!editUrl) return null

  const designId = typeof design?.id === 'string' ? design.id : designIdFromEditUrl(editUrl)
  return designId ? { jobId: jobRecord.id, designId, editUrl } : null
}

function autofillJob(value: unknown): Record<string, unknown> | null {
  const response = asRecord(value)
  return asRecord(response?.job) ?? response
}

function terminalAutofillFailure(job: Record<string, unknown>): boolean {
  return typeof job.status === 'string' && ['failed', 'error', 'cancelled'].includes(job.status)
}

/**
 * Every Canva tool starts here.
 *
 * It used to call getCanvaToken, which falls back to CANVA_API_KEY — a value
 * that returns 401 for every request, because Canva Connect is OAuth only and
 * has no static API keys. So the tools always HAD a token, always failed, and
 * reported it as Canva misbehaving rather than as never having been connected.
 * The owner was told the connection was "failing on my side" while the
 * Director claimed to have checked his brand kits.
 *
 * Returns the token when genuinely usable, or a message that says which of
 * those two situations this is and what to do about it.
 */
async function requireCanva(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ token: string } | { success: false; error: string }> {
  const state = await getCanvaState(supabase, userId)
  if (state.state === 'ready') return { token: state.token }
  return { success: false, error: state.message }
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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        /**
         * Canva has no folder-search endpoint. `/v1/folders/search` returns
         * 404 endpoint_not_found — verified against the live API — so this
         * tool has never once returned a folder.
         *
         * Folders are browsed, not searched: `/v1/folders/{id}/items` lists a
         * folder's contents, and "root" is the top level. So list the root and
         * match on the name here.
         */
        const res = await canvaFetch(apiKey, '/folders/root/items?limit=100')
        const data = await res.json()
        const needle = query.trim().toLowerCase()
        const items = (data.items ?? [])
          .flatMap((item: Record<string, unknown>) => {
            const folder = item.folder as Record<string, unknown> | undefined
            return folder ? [folder] : []
          })
          .filter((folder: Record<string, unknown>) =>
            !needle || String(folder.name ?? '').toLowerCase().includes(needle))

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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'List only the Canva templates explicitly mapped to the active NRS brand. Canva account-wide templates are deliberately hidden: a name, colour or shared workspace is not proof that another brand may use it.',
    inputSchema: z.object({}),
    execute: async () => {
      const scope = await loadBrandTemplateScope(supabase, userId, brandId)
      if ('error' in scope) return { success: false, error: scope.error }

      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        /**
         * `/brand-kits` DOES NOT EXIST. Canva answers
         * 404 endpoint_not_found — verified against the live API — so this
         * tool has never returned a single result. The real endpoint is
         * `/v1/brand-templates`, covered by the `brandtemplate:meta:read`
         * scope NRS already asks for at consent.
         */
        const res = await canvaFetch(apiKey, '/brand-templates?limit=100')
        const data = await res.json()
        const kits = filterCanvaTemplatesForBrand(
          (data.items ?? []) as Array<{ id?: unknown; title?: string; name?: string; thumbnail?: { url?: string }; view_url?: string }>,
          scope.contract,
        )

        if (kits.length === 0) {
          return {
            success: false,
            count: 0,
            message:
              `${scope.brandName} has ${scope.contract.templates.length} mapped Canva template(s), but none are available in the connected Canva account right now. NRS will not substitute another brand’s template or invent a visual.`,
          }
        }

        const results = kits.flatMap((k) => {
          if (typeof k.id !== 'string') return []
          return [{
            id: k.id,
            // Brand templates carry `title`; the old code read `name`, which
            // would have printed "undefined" even once the URL was right.
            name: k.title ?? k.name ?? 'Untitled template',
            thumbnail: k.thumbnail?.url,
            view_url: k.view_url,
          }]
        })

        return {
          success: true,
          count: results.length,
          brand_templates: results,
          message: `Found ${results.length} mapped ${scope.brandName} template(s):\n${results.map((k: { name: string; id: string }, i: number) => `${i + 1}. **${k.name}** (ID: ${k.id})`).join('\n')}\n\nOnly these mapped templates may be used. Do not infer ownership from a title, Canva workspace, colour, or shared team.`,
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
// Create a copy of an explicitly mapped Brand Template
// ---------------------------------------------------------------------------
export function createCanvaTemplateCopyTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Create an editable copy of an exact Canva Brand Template mapped to the active NRS brand. This preserves the template’s own layout, colours and typography. It never substitutes another brand’s template and never describes an untouched copy as finished social creative.',
    inputSchema: z.object({
      brand_template_id: z.string().describe('Exact mapped Canva Brand Template ID from list_brand_templates'),
      page_numbers: z.array(z.number().int().min(1)).min(1).optional().describe('Optional one-based template pages to copy. Omit to copy every page.'),
    }),
    execute: async ({ brand_template_id, page_numbers }) => {
      const scope = await loadBrandTemplateScope(supabase, userId, brandId)
      if ('error' in scope) return { success: false, error: scope.error }
      if (!isCanvaTemplateAllowed(scope.contract, brand_template_id)) {
        return {
          success: false,
          error: `${brand_template_id} is not mapped to ${scope.brandName}. NRS will not copy a cross-brand Canva template.`,
        }
      }

      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva

      try {
        const response = await canvaFetch(canva.token, '/designs', {
          method: 'POST',
          body: JSON.stringify(buildCanvaBrandTemplateCopyRequest(brand_template_id, page_numbers)),
        })
        const payload = await response.json() as unknown
        const receipt = canvaTemplateCopyReceipt(payload)
        if (!receipt) {
          return {
            success: false,
            error: 'Canva did not return an editable design receipt. No finished creative or Mixpost draft was created.',
          }
        }

        const template = scope.contract.templates.find((entry) => entry.id === brand_template_id)
        return {
          success: true,
          status: 'template_copy_created',
          template: {
            id: brand_template_id,
            title: template?.title ?? brand_template_id,
            role: template?.role ?? null,
          },
          design_id: receipt.designId,
          edit_url: receipt.editUrl,
          view_url: receipt.viewUrl,
          thumbnail_url: receipt.thumbnailUrl,
          page_count: receipt.pageCount,
          message:
            `Created an editable copy of ${scope.brandName}'s mapped Canva template “${template?.title ?? brand_template_id}”. Its existing layout and typography are intact. This is a template copy, not a finished social post: the template has no Autofill fields, so NRS has not replaced its copy and has not created a Mixpost draft.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Canva could not create the template copy. No creative or draft was made.',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Get brand template dataset
// ---------------------------------------------------------------------------
export function createGetBrandTemplateDatasetTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Read the actual Autofill fields in one Canva brand template before creating a design. Use the exact field keys and data types returned here; never guess template fields.',
    inputSchema: z.object({
      brand_template_id: z.string().describe('Canva brand template ID from list_brand_templates'),
    }),
    execute: async ({ brand_template_id }) => {
      const scope = await loadBrandTemplateScope(supabase, userId, brandId)
      if ('error' in scope) return { success: false, error: scope.error }
      if (!isCanvaTemplateAllowed(scope.contract, brand_template_id)) {
        return {
          success: false,
          error: `${brand_template_id} is not mapped to ${scope.brandName}. NRS will not inspect or use a cross-brand Canva template.`,
        }
      }

      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva

      try {
        const res = await canvaFetch(canva.token, `/brand-templates/${brand_template_id}/dataset`)
        const data = await res.json() as Record<string, unknown>
        const dataset = asRecord(data.dataset) ?? {}
        const fields: Array<Record<string, unknown> & { name: string }> = Object.entries(dataset).map(([name, definition]) => ({
          name,
          ...(asRecord(definition) ?? {}),
        }))

        return {
          success: true,
          brand_template_id,
          fields,
          message: fields.length
            ? `Template ${brand_template_id} has ${fields.length} Autofill field(s): ${fields.map((field) => `${field.name} (${String(field.type ?? 'unknown')})`).join(', ')}. Use these exact field names in generate_design_structured.`
            : `Template ${brand_template_id} has no published Autofill fields. It cannot be populated automatically until fields are configured in Canva.`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to read Canva template Autofill fields',
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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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
      'Create an editable blank Canva canvas at the requested size. This prepares the design surface but does not generate image pixels from the prompt; use generate_image for a new image asset, then upload_asset_from_url or a Canva template/autofill tool to place it.',
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
      const scope = await loadBrandTemplateScope(supabase, userId, brandId)
      if (!('error' in scope) && scope.contract.requireTemplateForSocialVisuals) {
        return {
          success: false,
          error:
            `${scope.brandName} uses a template-locked visual identity. NRS will not create an improvised blank Canva design; use one of its mapped brand templates instead.`,
        }
      }

      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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
          message: `I've created a blank ${dims.title_suffix} canvas${resolvedBrandName ? ` for ${resolvedBrandName}` : ''}${brand_kit_id ? ' using your brand kit colours and fonts' : ''} in Canva. You can open and edit it here: ${editUrl}\n\nCreative brief recorded for the next asset/design step: "${prompt}"\n\nUse generate_image to make a new image asset, or a Canva template/autofill workflow to turn the brief into a finished design.`,
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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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
// Resize design to different dimensions
// ---------------------------------------------------------------------------
export function createResizeDesignTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Resize a Canva design to different dimensions — perfect for creating versions for each social platform from one design.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID to resize'),
      width: z.number().describe('New width in pixels'),
      height: z.number().describe('New height in pixels'),
      title: z
        .string()
        .optional()
        .describe('Optional title for the resized copy'),
    }),
    execute: async ({ design_id, width, height, title }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const body: Record<string, unknown> = { width, height }
        if (title) body.title = title

        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/resize`,
          { method: 'POST', body: JSON.stringify(body) }
        )
        const data = await res.json()
        const newDesign = data.design ?? data

        return {
          success: true,
          design_id: newDesign.id,
          edit_url: newDesign.urls?.edit_url,
          dimensions: `${width}x${height}`,
          message: `Resized design created (${width}x${height}). New design ID: ${newDesign.id}\n[Open in Canva](${newDesign.urls?.edit_url})`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to resize Canva design',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Upload asset from URL
// ---------------------------------------------------------------------------
export function createUploadAssetFromUrlTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Upload an image or video from a URL into Canva\'s asset library for use in designs.',
    inputSchema: z.object({
      url: z.string().describe('Public URL of the image or video to upload'),
      name: z
        .string()
        .optional()
        .describe('Optional display name for the asset'),
    }),
    execute: async ({ url, name }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const body: Record<string, unknown> = { url }
        if (name) body.name = name

        const res = await canvaFetch(apiKey, '/assets', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const data = await res.json()
        const asset = data.asset ?? data

        return {
          success: true,
          asset_id: asset.id,
          name: asset.name ?? name ?? null,
          message: `Asset uploaded to Canva successfully. Asset ID: ${asset.id}${name ? ` (${name})` : ''}. You can now use this asset in any design.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to upload asset to Canva',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Create design from candidate
// ---------------------------------------------------------------------------
export function createDesignFromCandidateTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Convert an AI-generated design candidate into an editable Canva design.',
    inputSchema: z.object({
      candidate_id: z
        .string()
        .describe('Design candidate ID from a previous generate-design call'),
      title: z
        .string()
        .optional()
        .describe('Optional title for the new design'),
    }),
    execute: async ({ candidate_id, title }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const body: Record<string, unknown> = {
          design_candidate_id: candidate_id,
        }
        if (title) body.title = title

        const res = await canvaFetch(apiKey, '/designs', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const data = await res.json()
        const design = data.design ?? data

        return {
          success: true,
          design_id: design.id,
          edit_url: design.urls?.edit_url,
          title: design.title ?? title ?? null,
          message: `Design created from candidate. ID: ${design.id}\n[Open in Canva](${design.urls?.edit_url})`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to create design from candidate',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Request outline review (presentation outlines)
// ---------------------------------------------------------------------------
export function createRequestOutlineReviewTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Create a presentation outline for review before generating slides. Supports brand kit styling and audience targeting.',
    inputSchema: z.object({
      title: z.string().describe('Title of the presentation'),
      topics: z
        .array(z.string())
        .describe('List of topics or sections to cover'),
      brand_kit_id: z
        .string()
        .optional()
        .describe('Canva brand kit ID for on-brand styling'),
      style: z
        .string()
        .optional()
        .describe('Visual style hint (e.g. "modern", "corporate", "playful")'),
      audience: z
        .string()
        .optional()
        .describe('Target audience description'),
    }),
    execute: async ({ title, topics, brand_kit_id, style, audience }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const body: Record<string, unknown> = { title, topics }
        if (brand_kit_id) body.brand_kit_id = brand_kit_id
        if (style) body.style = style
        if (audience) body.audience = audience

        const res = await canvaFetch(apiKey, '/autofills/outlines', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const data = await res.json()

        return {
          success: true,
          outline: data,
          message: `Presentation outline created for "${title}" with ${topics.length} topic(s). Review the outline and confirm before generating slides.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to create presentation outline',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Import design from URL (PDF, PowerPoint, etc.)
// ---------------------------------------------------------------------------
export function createImportDesignFromUrlTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Import an external file (PDF, PowerPoint, etc.) into Canva as an editable design.',
    inputSchema: z.object({
      url: z
        .string()
        .describe('Public URL of the file to import (PDF, PPTX, etc.)'),
      title: z
        .string()
        .optional()
        .describe('Optional title for the imported design'),
    }),
    execute: async ({ url, title }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const body: Record<string, unknown> = { url }
        if (title) body.title = title

        const res = await canvaFetch(apiKey, '/imports', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const data = await res.json()
        const imported = data.design ?? data.import ?? data

        return {
          success: true,
          design_id: imported.id ?? imported.design_id,
          edit_url: imported.urls?.edit_url,
          title: imported.title ?? title ?? null,
          message: `File imported into Canva successfully.${imported.id ? ` Design ID: ${imported.id}` : ''}${imported.urls?.edit_url ? `\n[Open in Canva](${imported.urls.edit_url})` : ''}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to import file into Canva',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Comment on a design
// ---------------------------------------------------------------------------
export function createCommentOnDesignTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Add a comment to a Canva design — useful for leaving feedback, compliance notes, or revision requests.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID to comment on'),
      message: z.string().describe('Comment text to leave on the design'),
    }),
    execute: async ({ design_id, message }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/comments`,
          { method: 'POST', body: JSON.stringify({ message }) }
        )
        const data = await res.json()
        const comment = data.comment ?? data

        return {
          success: true,
          comment_id: comment.id,
          design_id,
          message: `Comment added to design ${design_id}: "${message}"`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to comment on Canva design',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// List comments on a design
// ---------------------------------------------------------------------------
export function createListCommentsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List all comments on a Canva design. Useful for reviewing feedback, compliance notes, or team discussion.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID to list comments for'),
    }),
    execute: async ({ design_id }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/comments`
        )
        const data = await res.json()
        const comments = data.items ?? data.comments ?? []

        return {
          success: true,
          design_id,
          count: comments.length,
          comments,
          message: comments.length === 0
            ? `No comments on design ${design_id}.`
            : `Found ${comments.length} comment(s) on design ${design_id}:\n${comments.map((c: { id?: string; message?: string; author?: { display_name?: string } }, i: number) => `${i + 1}. ${c.author?.display_name ?? 'Unknown'}: "${c.message}" (ID: ${c.id})`).join('\n')}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to list comments on Canva design',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// List replies to a comment
// ---------------------------------------------------------------------------
export function createListRepliesTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List replies to a specific comment on a Canva design. Use after list_comments to see threaded discussions.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID'),
      comment_id: z.string().describe('Comment ID to list replies for'),
    }),
    execute: async ({ design_id, comment_id }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/comments/${comment_id}/replies`
        )
        const data = await res.json()
        const replies = data.items ?? data.replies ?? []

        return {
          success: true,
          design_id,
          comment_id,
          count: replies.length,
          replies,
          message: replies.length === 0
            ? `No replies to comment ${comment_id}.`
            : `Found ${replies.length} reply/replies to comment ${comment_id}:\n${replies.map((r: { id?: string; message?: string; author?: { display_name?: string } }, i: number) => `${i + 1}. ${r.author?.display_name ?? 'Unknown'}: "${r.message}"`).join('\n')}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to list replies on Canva comment',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Reply to a comment
// ---------------------------------------------------------------------------
export function createReplyToCommentTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Reply to an existing comment on a Canva design — useful for responding to feedback or compliance queries.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID'),
      comment_id: z.string().describe('Comment ID to reply to'),
      message: z.string().describe('Reply text'),
    }),
    execute: async ({ design_id, comment_id, message }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/comments/${comment_id}/replies`,
          { method: 'POST', body: JSON.stringify({ message }) }
        )
        const data = await res.json()
        const reply = data.reply ?? data

        return {
          success: true,
          reply_id: reply.id,
          comment_id,
          design_id,
          message: `Reply added to comment ${comment_id}: "${message}"`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to reply to Canva comment',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Create folder
// ---------------------------------------------------------------------------
export function createCreateFolderTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Create a new folder in Canva to organise designs by brand, campaign, or content type.',
    inputSchema: z.object({
      name: z.string().describe('Name for the new folder'),
      parent_folder_id: z
        .string()
        .optional()
        .describe('Optional parent folder ID to create a subfolder'),
    }),
    execute: async ({ name, parent_folder_id }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const body: Record<string, unknown> = { name }
        if (parent_folder_id) body.parent_folder_id = parent_folder_id

        const res = await canvaFetch(apiKey, '/folders', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const data = await res.json()
        const folder = data.folder ?? data

        return {
          success: true,
          folder_id: folder.id,
          name: folder.name ?? name,
          message: `Folder "${name}" created successfully. Folder ID: ${folder.id}${parent_folder_id ? ` (inside folder ${parent_folder_id})` : ''}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to create Canva folder',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Move item to folder
// ---------------------------------------------------------------------------
export function createMoveItemToFolderTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Move a design or asset into a Canva folder for organisation.',
    inputSchema: z.object({
      folder_id: z.string().describe('Destination folder ID'),
      item_id: z.string().describe('ID of the item (design or asset) to move'),
      item_type: z
        .enum(['design', 'folder', 'image', 'video'])
        .describe('Type of the item being moved'),
    }),
    execute: async ({ folder_id, item_id, item_type }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const res = await canvaFetch(
          apiKey,
          `/folders/${folder_id}/items`,
          {
            method: 'POST',
            body: JSON.stringify({ item_id, item_type }),
          }
        )
        await res.json()

        return {
          success: true,
          folder_id,
          item_id,
          item_type,
          message: `Moved ${item_type} ${item_id} into folder ${folder_id}.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to move item to Canva folder',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Get export formats for a design
// ---------------------------------------------------------------------------
export function createGetExportFormatsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get the available export formats for a Canva design (PNG, PDF, etc.). Check before exporting to know what options are available.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID to check export formats for'),
    }),
    execute: async ({ design_id }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/export-formats`
        )
        const data = await res.json()
        const formats = data.items ?? data.formats ?? data

        return {
          success: true,
          design_id,
          formats,
          message: `Available export formats for design ${design_id}: ${Array.isArray(formats) ? formats.map((f: { type?: string }) => f.type ?? JSON.stringify(f)).join(', ') : JSON.stringify(formats)}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to get export formats',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Resolve Canva shortlink
// ---------------------------------------------------------------------------
export function createResolveShortlinkTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Resolve a Canva shortlink (canva.design/...) to get the full design ID and metadata.',
    inputSchema: z.object({
      url: z.string().describe('Canva shortlink URL to resolve'),
    }),
    execute: async ({ url }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const params = new URLSearchParams({ url })
        const res = await canvaFetch(
          apiKey,
          `/shortlinks/resolve?${params}`
        )
        const data = await res.json()

        return {
          success: true,
          resolved: data,
          design_id: data.design_id ?? data.id,
          message: `Shortlink resolved. Design ID: ${data.design_id ?? data.id ?? 'unknown'}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to resolve Canva shortlink',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Generate design (structured autofill)
// ---------------------------------------------------------------------------
export function createGenerateDesignStructuredTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Generate a Canva design with structured Autofill. Call get_brand_template_dataset first and use its exact field names and types. This tool waits for the asynchronous Canva job and only succeeds when Canva returns an editable design ID and URL.',
    inputSchema: z.object({
      brand_template_id: z
        .string()
        .describe('Canva brand template ID to autofill'),
      data: z
        .record(z.string(), z.union([
          z.string(),
          z.object({ type: z.literal('text'), text: z.string() }).passthrough(),
          z.object({ type: z.literal('image'), asset_id: z.string() }).passthrough(),
        ]))
        .describe('Exact dataset field names mapped to text strings, or documented Canva text/image field objects.'),
    }),
    execute: async ({ brand_template_id, data }) => {
      const scope = await loadBrandTemplateScope(supabase, userId, brandId)
      if ('error' in scope) return { success: false, error: scope.error }
      if (!isCanvaTemplateAllowed(scope.contract, brand_template_id)) {
        return {
          success: false,
          error: `${brand_template_id} is not mapped to ${scope.brandName}. NRS will not create a design from a cross-brand Canva template.`,
        }
      }

      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const datasetResponse = await canvaFetch(apiKey, `/brand-templates/${brand_template_id}/dataset`)
        const datasetPayload = await datasetResponse.json() as Record<string, unknown>
        const dataset = asRecord(datasetPayload.dataset) ?? {}
        const validationError = validateCanvaAutofillData(data, dataset)
        if (validationError) return { success: false, error: validationError }

        const body = {
          brand_template_id,
          data: normaliseCanvaAutofillData(data),
        }

        const res = await canvaFetch(apiKey, '/autofills', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        let job = autofillJob(await res.json())
        if (!job || typeof job.id !== 'string') {
          return { success: false, error: 'Canva did not return an Autofill job ID. No design was created.' }
        }

        for (let attempt = 0; attempt <= AUTOFILL_POLL_ATTEMPTS; attempt++) {
          const receipt = completedCanvaDesignFromJob(job)
          if (receipt) {
            return {
              success: true,
              job_id: receipt.jobId,
              status: 'success',
              design_id: receipt.designId,
              edit_url: receipt.editUrl,
              message: `Design generated from template. Design ID: ${receipt.designId}\n[Open in Canva](${receipt.editUrl})`,
            }
          }

          if (terminalAutofillFailure(job)) {
            return {
              success: false,
              job_id: job.id,
              status: job.status,
              error: 'Canva Autofill did not create a design. No design receipt was issued.',
            }
          }

          if (attempt === AUTOFILL_POLL_ATTEMPTS) break
          await delay(AUTOFILL_POLL_INTERVAL_MS)
          const poll = await canvaFetch(apiKey, `/autofills/${job.id}`)
          job = autofillJob(await poll.json())
          if (!job || typeof job.id !== 'string') {
            return { success: false, error: 'Canva returned an invalid Autofill job while waiting. No design was created.' }
          }
        }

        return {
          success: false,
          job_id: job.id,
          status: job.status,
          error: 'Canva Autofill did not finish within 30 seconds. No design receipt was issued, so NRS will not present this as a created asset.',
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to generate design via autofill',
        }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Get presenter notes for a design page
// ---------------------------------------------------------------------------
export function createGetPresenterNotesTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get the presenter/speaker notes for a specific page in a Canva presentation. Useful for reviewing or extracting talk tracks.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design (presentation) ID'),
      page_id: z.string().describe('Page ID within the presentation'),
    }),
    execute: async ({ design_id, page_id }) => {
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

      try {
        const res = await canvaFetch(
          apiKey,
          `/designs/${design_id}/pages/${page_id}/presenter-notes`
        )
        const data = await res.json()
        const notes = data.notes ?? data.presenter_notes ?? data

        return {
          success: true,
          design_id,
          page_id,
          notes,
          message: typeof notes === 'string' && notes.length > 0
            ? `Presenter notes for page ${page_id}:\n${notes}`
            : `No presenter notes found for page ${page_id} in design ${design_id}.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to get presenter notes',
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
      const canva = await requireCanva(supabase, userId)
      if ('error' in canva) return canva
      const apiKey = canva.token

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

        // Canva's export endpoints answer with `job`, not `export`. Reading the
        // wrong key meant export_design NEVER worked: Canva returned HTTP 200
        // having happily created the job, and this read undefined and gave up.
        // `export` is kept as a fallback in case an older shape is ever served.
        const exportId = exportData.job?.id ?? exportData.export?.id

        if (!exportId) {
          // Canva says WHY it refused — a missing scope, an unrenderable
          // design, a bad token. Reporting only "no export ID" threw that away
          // and left an un-debuggable failure in front of the user.
          const canvaMessage =
            exportData?.message ??
            exportData?.error?.message ??
            exportData?.error ??
            null
          const detail = canvaMessage
            ? `${typeof canvaMessage === 'string' ? canvaMessage : JSON.stringify(canvaMessage)}`
            : JSON.stringify(exportData).slice(0, 300)
          return {
            success: false,
            error: `Canva refused the export (HTTP ${exportRes.status}): ${detail}`,
            design_id,
            format,
          }
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
            const job = statusData.job ?? statusData.export
            // Canva's terminal state is 'success'. This checked for
            // 'completed', which Canva never sends — so even a finished export
            // would have polled out and reported a timeout.
            const status = job?.status

            if (status === 'success' || status === 'completed') {
              // urls is an array of download links — one per page. Canva sends
              // plain strings; tolerate the {url} object shape too.
              const firstUrl = job?.urls?.[0]
              const downloadUrl =
                (typeof firstUrl === 'string' ? firstUrl : firstUrl?.url) ??
                job?.download_url

              return {
                success: true,
                export_id: exportId,
                design_id,
                format,
                download_url: downloadUrl,
                // Canva's download URLs expire, so say so rather than let the
                // user save a link that quietly dies.
                url_expires_in: '24 hours',
                message: downloadUrl
                  ? `Your design has been exported as ${format.toUpperCase()}. Download it here (link valid 24 hours): ${downloadUrl}`
                  : `Export completed but no download URL was returned. Export ID: ${exportId}`,
              }
            }

            if (status === 'failed') {
              const reason =
                job?.error?.message ?? job?.error?.code ?? job?.error ?? null
              return {
                success: false,
                error: reason
                  ? `Canva export failed: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`
                  : 'Canva export failed. The design may be empty or corrupted.',
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
