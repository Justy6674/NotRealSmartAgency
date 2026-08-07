import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createSaveBrandInfoTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Save brand information gathered from conversation. Use this when the user tells you about their business — name, website, what they do, social profiles, competitors, products, compliance needs. For new brands use action "create". For updating the current brand use action "update".',
    inputSchema: z.object({
      action: z.enum(['create', 'update']).describe('Create a new brand or update the current one'),
      name: z.string().optional().describe('Brand name'),
      website_url: z.string().optional().describe('Brand website URL'),
      tagline: z.string().optional().describe('Brand tagline or slogan'),
      description: z.string().optional().describe('What the business does, in 1-2 sentences'),
      niche: z.string().optional().describe('Business niche, e.g. telehealth, saas, skincare'),
      business_stage: z
        .enum(['idea', 'mvp', 'launch', 'growth', 'scale', 'mature'])
        .optional()
        .describe('Current stage of the business'),
      social_urls: z
        .record(z.string())
        .optional()
        .describe('Social media URLs, e.g. { instagram: "https://instagram.com/brand", linkedin: "https://linkedin.com/company/brand" }'),
      competitors: z
        .array(
          z.object({
            name: z.string(),
            url: z.string().optional(),
            why: z.string().optional(),
          })
        )
        .optional()
        .describe('Known competitors'),
      products_services: z
        .array(
          z.object({
            name: z.string(),
            description: z.string(),
          })
        )
        .optional()
        .describe('Products or services the brand offers'),
      compliance_ahpra: z.boolean().optional().describe('Whether this brand needs AHPRA compliance (Australian health practitioners)'),
      compliance_tga: z.boolean().optional().describe('Whether this brand needs TGA compliance (therapeutic goods)'),
      channel_strategy: z.object({
        channels: z.record(z.number()).optional().describe('Platform → percentage allocation, must sum to 100. e.g. { linkedin: 30, youtube: 25, instagram: 20, facebook: 15, tiktok: 10 }'),
        content_mix: z.record(z.number()).optional().describe('Content type → percentage. e.g. { educational: 40, product: 25, behind_the_scenes: 15, social_proof: 10, engagement: 10 }'),
        posting_frequency: z.enum(['daily', '3x_week', '2x_week', 'weekly', 'custom']).optional(),
        avoid: z.array(z.string()).optional().describe('Things to avoid: email_campaigns, google_ads, etc.'),
        growth_approach: z.enum(['organic', 'paid', 'hybrid', 'community']).optional(),
        aeo_priority: z.boolean().optional().describe('Prioritise AI engine visibility (AEO/GEO)'),
        notes: z.string().optional(),
      }).optional().describe('Marketing channel strategy — the Marketing DNA for this brand'),
    }),
    execute: async (input) => {
      try {
        if (input.action === 'create') {
          return await createBrand(supabase, userId, input)
        } else {
          return await updateBrand(supabase, brandId, input)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { saved: false, error: message }
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

async function createBrand(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name?: string
    website_url?: string
    tagline?: string
    description?: string
    niche?: string
    business_stage?: string
    social_urls?: Record<string, string>
    competitors?: Array<{ name: string; url?: string; why?: string }>
    products_services?: Array<{ name: string; description: string }>
    compliance_ahpra?: boolean
    compliance_tga?: boolean
  }
) {
  if (!input.name) {
    return { saved: false, error: 'Brand name is required to create a new brand. Ask the user what their business is called.' }
  }

  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  // Check for duplicate slug
  const { data: existing } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return { saved: false, error: `A brand called "${input.name}" already exists. Ask if they meant to update it instead.` }
  }

  const complianceFlags = {
    ahpra: input.compliance_ahpra ?? false,
    tga: input.compliance_tga ?? false,
    tga_categories: [],
  }

  const { data, error } = await supabase
    .from('brands')
    .insert({
      user_id: userId,
      name: input.name,
      slug,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      website_url: input.website_url ?? null,
      niche: input.niche ?? 'general',
      business_stage: input.business_stage ?? 'launch',
      social_urls: input.social_urls ?? {},
      competitors: (input.competitors ?? []).map((c) => ({
        name: c.name,
        url: c.url ?? '',
        why: c.why ?? '',
        is_active: true,
      })),
      products_services: input.products_services ?? [],
      compliance_flags: complianceFlags,
      tone_of_voice: { formality: 'professional', humour: 'light', keywords: [], avoid_words: [] },
      target_audience: { demographics: '', pain_points: [], desires: [] },
      content_pillars: [],
      brand_colours: {},
      is_active: true,
    })
    .select('id, name, slug')
    .single()

  if (error) {
    return { saved: false, error: error.message }
  }

  const savedFields = [
    input.name && 'name',
    input.website_url && 'website',
    input.tagline && 'tagline',
    input.description && 'description',
    input.niche && 'niche',
    input.business_stage && 'business stage',
    input.social_urls && Object.keys(input.social_urls).length > 0 && 'social profiles',
    input.competitors && input.competitors.length > 0 && 'competitors',
    input.products_services && input.products_services.length > 0 && 'products/services',
    (input.compliance_ahpra || input.compliance_tga) && 'compliance flags',
  ].filter(Boolean)

  return {
    saved: true,
    brand_id: data.id,
    brand_slug: data.slug,
    brand_name: data.name,
    action: 'created',
    summary: `Created "${data.name}" with ${savedFields.join(', ')}. The user should now select this brand from the sidebar to start working with it.`,
    card: `\`\`\`json:card\n${JSON.stringify({ __card: 'brand_saved', action: 'created', brand_name: data.name, fields: savedFields })}\n\`\`\``,
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

async function updateBrand(
  supabase: SupabaseClient,
  brandId: string,
  input: {
    name?: string
    website_url?: string
    tagline?: string
    description?: string
    niche?: string
    business_stage?: string
    social_urls?: Record<string, string>
    competitors?: Array<{ name: string; url?: string; why?: string }>
    products_services?: Array<{ name: string; description: string }>
    compliance_ahpra?: boolean
    compliance_tga?: boolean
    channel_strategy?: {
      channels?: Record<string, number>
      content_mix?: Record<string, number>
      posting_frequency?: string
      avoid?: string[]
      growth_approach?: string
      aeo_priority?: boolean
      notes?: string
    }
  }
) {
  if (!brandId) {
    return { saved: false, error: 'No active brand selected. The user needs to select a brand first, or use action "create" to make a new one.' }
  }

  // Fetch current brand to merge arrays/objects
  const { data: current, error: fetchError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single()

  if (fetchError || !current) {
    return { saved: false, error: 'Could not find the current brand.' }
  }

  // Build update payload — only include fields that were provided
   
  const updates: Record<string, any> = {}
  const changedFields: string[] = []

  if (input.name !== undefined) { updates.name = input.name; changedFields.push('name') }
  if (input.website_url !== undefined) { updates.website_url = input.website_url; changedFields.push('website') }
  if (input.tagline !== undefined) { updates.tagline = input.tagline; changedFields.push('tagline') }
  if (input.description !== undefined) { updates.description = input.description; changedFields.push('description') }
  if (input.niche !== undefined) { updates.niche = input.niche; changedFields.push('niche') }
  if (input.business_stage !== undefined) { updates.business_stage = input.business_stage; changedFields.push('business stage') }

  // Merge social URLs with existing
  if (input.social_urls && Object.keys(input.social_urls).length > 0) {
    updates.social_urls = { ...(current.social_urls ?? {}), ...input.social_urls }
    changedFields.push('social profiles')
  }

  // Append competitors (don't replace)
  if (input.competitors && input.competitors.length > 0) {
    const existingComps = current.competitors ?? []
    const existingNames = new Set(existingComps.map((c: { name: string }) => c.name.toLowerCase()))
    const newComps = input.competitors
      .filter((c) => !existingNames.has(c.name.toLowerCase()))
      .map((c) => ({
        name: c.name,
        url: c.url ?? '',
        why: c.why ?? '',
        is_active: true,
      }))
    if (newComps.length > 0) {
      updates.competitors = [...existingComps, ...newComps]
      changedFields.push('competitors')
    }
  }

  // Append products/services (don't replace)
  if (input.products_services && input.products_services.length > 0) {
    const existingProds = current.products_services ?? []
    const existingNames = new Set(existingProds.map((p: { name: string }) => p.name.toLowerCase()))
    const newProds = input.products_services.filter((p) => !existingNames.has(p.name.toLowerCase()))
    if (newProds.length > 0) {
      updates.products_services = [...existingProds, ...newProds]
      changedFields.push('products/services')
    }
  }

  // Update compliance flags
  if (input.compliance_ahpra !== undefined || input.compliance_tga !== undefined) {
    const flags = current.compliance_flags ?? { ahpra: false, tga: false, tga_categories: [] }
    if (input.compliance_ahpra !== undefined) flags.ahpra = input.compliance_ahpra
    if (input.compliance_tga !== undefined) flags.tga = input.compliance_tga
    updates.compliance_flags = flags
    changedFields.push('compliance flags')
  }

  // Update channel strategy (Marketing DNA)
  if (input.channel_strategy) {
    const existing = current.channel_strategy ?? {}
    updates.channel_strategy = {
      ...existing,
      ...input.channel_strategy,
      channels: input.channel_strategy.channels ?? existing.channels,
      content_mix: input.channel_strategy.content_mix ?? existing.content_mix,
      avoid: input.channel_strategy.avoid ?? existing.avoid,
    }
    changedFields.push('channel strategy')
  }

  if (changedFields.length === 0) {
    return { saved: true, action: 'no_changes', summary: 'No new information to update.' }
  }

  const { error } = await supabase
    .from('brands')
    .update(updates)
    .eq('id', brandId)

  if (error) {
    return { saved: false, error: error.message }
  }

  return {
    saved: true,
    brand_id: brandId,
    brand_name: updates.name ?? current.name,
    action: 'updated',
    summary: `Updated ${current.name}: ${changedFields.join(', ')}.`,
    card: `\`\`\`json:card\n${JSON.stringify({ __card: 'brand_saved', action: 'updated', brand_name: updates.name ?? current.name, fields: changedFields })}\n\`\`\``,
  }
}
