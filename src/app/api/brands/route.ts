import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { applyHealthFlags } from '@/lib/agents/health-signal'
import { userSafeError } from '@/lib/errors/user-safe'

/**
 * The social handles a screen may set, and nothing else.
 *
 * `social_urls` is not only social URLs. It is also where machine-managed values
 * live, and one of them is an authorisation subject: `zernio_profile_id` is what
 * /api/zernio/accounts, /analytics, /ads and the callback read AFTER their
 * ownership check passes, to decide whose Zernio data to fetch. A free-form
 * `z.record(z.unknown())` therefore let a signed-in owner pass the brand-id door
 * legitimately — it is their own brand — and then write another tenant's profile
 * id into it, reading that tenant's connected accounts and figures through their
 * own brand. Shutting the brand-id door and leaving this open would have routed
 * straight around the fix.
 *
 * The machine keys are not merely refused here; they are merged back on from the
 * stored record before the update (see mergeSocialUrls). That also fixes a
 * standing bug: BrandProfileForm sends only the six handles below, so every
 * profile save was silently wiping `mixpost_account_ids` — the brand's Mixpost
 * account mapping — along with `zernio_profile_id` and any `*_legacy` account
 * kept for reference.
 *
 * `twitter` and `x` are both here because the form sends `twitter` while
 * PLATFORM_LABELS and newer copy say `x`. Refusing either would fail a save the
 * owner had no way to understand.
 */
const SOCIAL_HANDLE_KEYS = [
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'tiktok',
  'twitter',
  'x',
] as const

const SocialUrlsSchema = z
  .object(
    Object.fromEntries(
      SOCIAL_HANDLE_KEYS.map((key) => [key, z.string().nullable().optional()]),
    ) as Record<(typeof SOCIAL_HANDLE_KEYS)[number], z.ZodOptional<z.ZodNullable<z.ZodString>>>,
  )
  .strict()

const CreateBrandSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
  github_url: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  niche: z.string().min(1),
  business_stage: z.string().optional(),
  tone_of_voice: z.record(z.unknown()).optional(),
  target_audience: z.record(z.unknown()).optional(),
  competitors: z.array(z.record(z.unknown())).optional(),
  compliance_flags: z.record(z.unknown()).optional(),
  content_pillars: z.array(z.string()).optional(),
  brand_colours: z.record(z.unknown()).optional(),
  // Same door as PATCH: a brand created with someone else's zernio_profile_id
  // would read their connected accounts and figures from the first save.
  social_urls: SocialUrlsSchema.optional(),
  extra_context: z.string().nullable().optional(),
  products_services: z.array(z.record(z.unknown())).optional(),
  video_preferences: z.record(z.unknown()).optional(),
  github_context: z.string().nullable().optional(),
  marketing_status: z.string().optional(),
  marketing_notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

/**
 * What a person may change about a project of theirs, and nothing else.
 *
 * PATCH used to read `const { id, ...updates } = body` and hand the remainder
 * straight to `.update()`. Every column was therefore writable by whoever sent
 * the request: `user_id` above all — the row policy says which row you may
 * touch, not what you may put in it, so one PATCH could sign a project, its
 * media and its scheduled posts over to another account with nothing in the
 * interface to undo it. `created_at` could be back-dated, `slug` rewritten
 * (agent memories are namespaced `nrs-<slug>`), `mixpost_tag_id` pointed at
 * another project's queue.
 *
 * So the door is turned around: named fields pass, anything else is refused by
 * name. Every entry here is sent by a screen that works today —
 *   BrandProfileForm    identity, socials, content pillars, compliance ticks
 *   BrandSettings       competitors, voice, audience, extra context, watermark
 *   BrandColoursEditor  brand_colours
 *   BrandDNAEditor      brand_dna_constraints
 * and the four together are the whole of what the browser PATCHes.
 *
 * Deliberately absent:
 *   id (below), user_id, created_at, updated_at — tenancy and bookkeeping, never the caller's
 *   slug            — agent memory namespaces are derived from it
 *   is_active       — the project list only shows active ones, so `false` here
 *                     would hide a project with no screen able to bring it back
 *   mixpost_*, vercel_*, github_context — written by the syncs that own them
 *
 * Shapes stay loose (records rather than exact objects), matching
 * CreateBrandSchema above. This is a door, not a second type system.
 */
const UpdateBrandSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    name_full: z.string().nullable().optional(),
    tagline: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    website_url: z.string().nullable().optional(),
    github_url: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
    niche: z.string().min(1).optional(),
    business_stage: z.string().optional(),
    tone_of_voice: z.record(z.unknown()).optional(),
    target_audience: z.record(z.unknown()).optional(),
    competitors: z.array(z.record(z.unknown())).optional(),
    // The regulatory ticks are the owner's to set from the project's settings —
    // see applyHealthFlags, which only ever turns them ON at creation.
    compliance_flags: z
      .object({
        ahpra: z.boolean().optional(),
        tga: z.boolean().optional(),
        tga_categories: z.array(z.string()).optional(),
      })
      .optional(),
    content_pillars: z.array(z.string()).optional(),
    // Colours are strings; null clears one. Anything else is a mistake, and a
    // mistake here becomes the palette every agent is told to obey.
    brand_colours: z.record(z.string().nullable()).optional(),
    // Handles only. The machine keys are merged back from the stored record
    // below, so a save cannot set one and cannot wipe one either.
    social_urls: SocialUrlsSchema.optional(),
    extra_context: z.string().nullable().optional(),
    products_services: z.array(z.record(z.unknown())).optional(),
    video_preferences: z.record(z.unknown()).optional(),
    brand_dna_constraints: z.record(z.unknown()).optional(),
    emulation_wishlist: z.array(z.record(z.unknown())).optional(),
    channel_strategy: z.record(z.unknown()).optional(),
    post_signature: z.record(z.unknown()).optional(),
    watermark: z.record(z.unknown()).optional(),
    marketing_status: z.string().optional(),
    marketing_notes: z.string().nullable().optional(),
  })
  .strict()

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/brands GET',
          error,
          'Your projects could not be loaded just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateBrandSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  // Regulatory flags were optional, and they are invisible in the interface,
  // so a clinic could be added with no review on anything it published and
  // nothing would say so. Read the project's own words and settle them here.
  const { compliance_flags, notice } = applyHealthFlags(
    parsed.data,
    parsed.data.compliance_flags as { ahpra?: boolean; tga?: boolean; tga_categories?: string[] } | undefined,
  )

  const { data, error } = await supabase
    .from('brands')
    .insert({ user_id: user.id, ...parsed.data, compliance_flags })
    .select()
    .single()

  if (error) {
    // A Postgres message here is read by a non-technical owner: unique
    // constraint names, relation names, row-level-security wording. See
    // src/lib/errors/user-safe.ts for the incident that motivated this.
    return NextResponse.json(
      {
        error: userSafeError(
          'api/brands POST',
          error,
          'That project was not created. Nothing has been changed — try again in a moment.',
        ),
      },
      { status: 500 },
    )
  }

  return NextResponse.json(notice ? { ...data, notice } : data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Those settings were not saved, because the change could not be read. Nothing has been changed.' },
      { status: 400 },
    )
  }

  const parsed = UpdateBrandSchema.safeParse(body)

  if (!parsed.success) {
    // Name the refused fields. A screen that starts sending something new must
    // fail loudly here rather than have it quietly dropped and reported saved.
    const refused = [
      ...new Set(
        parsed.error.issues.flatMap((issue) =>
          issue.code === 'unrecognized_keys' ? issue.keys : [],
        ),
      ),
    ]
    return NextResponse.json(
      {
        error: refused.length
          ? `Those settings were not saved. These cannot be changed here: ${refused.join(', ')}.`
          : 'Those settings were not saved, because some of them were not in a form this can accept.',
        details: parsed.error.issues,
      },
      { status: 400 },
    )
  }

  const { id, ...updates } = parsed.data

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'Nothing was sent to change, so nothing has been changed.' },
      { status: 400 },
    )
  }

  const project = await loadEditableProject(supabase, id, user.id)

  if (!project) {
    // Same answer for "no such project" and "not yours", so the ids of other
    // people's projects cannot be found by asking.
    return NextResponse.json({ error: 'That project could not be found.' }, { status: 404 })
  }

  // A `social_urls` save replaces the whole JSON column, so the handles the
  // screen sent are put back over the record rather than in place of it.
  const patch = updates.social_urls
    ? { ...updates, social_urls: mergeSocialUrls(project.social_urls, updates.social_urls) }
    : updates

  const { data, error } = await supabase
    .from('brands')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/brands PATCH',
          error,
          'Those settings were not saved. Nothing has been changed — try again in a moment.',
        ),
      },
      { status: 500 },
    )
  }

  return NextResponse.json(data)
}

/**
 * Keep everything in `social_urls` that is not a handle a screen can set.
 *
 * The caller's object is authoritative for the seven handle keys — omitting one
 * clears it, which is how the form deletes an account — and the stored value
 * wins for everything else. That is `zernio_profile_id` (an authorisation
 * subject, so it must never come from a request), `mixpost_account_ids`,
 * `mixpost_tag_id`, `mixpost_tag_uuid`, and retired accounts like
 * `instagram_legacy` that are kept for reference. All of them were being wiped
 * on every profile save, because the form sends only the handles.
 */
function mergeSocialUrls(
  stored: unknown,
  incoming: Record<string, string | null | undefined>,
): Record<string, unknown> {
  const handles = new Set<string>(SOCIAL_HANDLE_KEYS)
  const merged: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(incoming)) {
    // An empty handle means "no account", not an account named "".
    if (typeof value === 'string' && value.trim() !== '') merged[key] = value
  }

  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      if (!handles.has(key)) merged[key] = value
    }
  }

  return merged
}

/**
 * The project this person may write to, or null.
 *
 * Asked in the route rather than left to the row policy alone. The policy
 * (`brands_update` → `can_write_for_owner`) is the real fence and it is still
 * there; this is the same rule stated where it can be read, so that a change
 * to the database's own settings cannot quietly open the route, and so that a
 * request for someone else's project gets a plain 404 instead of a Postgres
 * complaint about no rows coming back.
 *
 * Ownership is not simply `user_id = you`: an accepted team member with the
 * owner or admin role writes to the owner's projects, and one such member
 * exists in production. Narrowing this to the owner alone would lock them out
 * of every settings screen, so the database's rule is mirrored exactly.
 *
 * It returns the row rather than a yes/no because the update needs the stored
 * `social_urls` to merge against, and reading it twice would leave a window
 * where the two reads disagree.
 */
async function loadEditableProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
  userId: string,
): Promise<{ id: string; user_id: string; social_urls: unknown } | null> {
  const { data: brand } = await supabase
    .from('brands')
    .select('id, user_id, social_urls')
    .eq('id', brandId)
    .maybeSingle()

  if (!brand) return null
  if (brand.user_id === userId) return brand

  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('owner_id', brand.user_id)
    .eq('member_id', userId)
    .eq('status', 'accepted')
    .in('role', ['owner', 'admin'])
    .limit(1)

  return membership && membership.length > 0 ? brand : null
}
