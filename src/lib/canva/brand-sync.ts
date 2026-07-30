import type { SupabaseClient } from '@supabase/supabase-js'
import { getCanvaToken, canvaFetch } from './client'

/**
 * Push a project's brand into Canva, and say plainly what Canva will not take.
 *
 * NRS, Canva and the publisher have been three separate places holding three
 * versions of a brand. This makes NRS the source and Canva the workspace: the
 * logo is uploaded, a folder is created to hold the project's designs, and
 * everything Canva's API refuses is returned as a short list to paste by hand.
 *
 * Canva's Connect API has no endpoint for brand-kit colours, fonts, voice or
 * guidelines — read or write. That is Canva's design, confirmed against their
 * documentation, not a gap here. Pretending otherwise would leave the owner
 * believing a sync happened that never could.
 */

export interface BrandSyncResult {
  ok: boolean
  project: string
  /** Canva asset id for the uploaded logo, when it worked. */
  logoAssetId?: string
  /** Canva folder holding this project's designs. */
  folderId?: string
  /** Values Canva cannot accept over the API, for the owner to enter once. */
  manual: {
    colours: Record<string, string>
    fonts: { display?: string; body?: string }
    voice: string[]
    guidelines: string[]
  }
  error?: string
}

interface CanvaAssetJob {
  job?: { status?: string; asset?: { id?: string } }
}

/**
 * Upload an image Canva can reach by URL.
 *
 * The asset endpoint takes the bytes, so the file is fetched here first. A
 * logo behind a login or on a private host simply cannot be synced, and says
 * so rather than failing silently.
 */
async function uploadLogo(token: string, url: string, name: string): Promise<string | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  const bytes = Buffer.from(await res.arrayBuffer())

  const upload = await fetch('https://api.canva.com/rest/v1/asset-uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': JSON.stringify({
        name_base64: Buffer.from(name).toString('base64'),
      }),
    },
    body: new Uint8Array(bytes),
  })

  if (!upload.ok) return null
  const job = (await upload.json()) as CanvaAssetJob
  return job.job?.asset?.id ?? null
}

/** Find or create the project's folder so its designs stay together. */
async function ensureFolder(token: string, name: string): Promise<string | null> {
  try {
    const found = await canvaFetch(token, `/folders/search?query=${encodeURIComponent(name)}`)
    const data = (await found.json()) as { items?: Array<{ folder?: { id: string; name: string } }> }
    const hit = data.items?.find((i) => i.folder?.name === name)
    if (hit?.folder?.id) return hit.folder.id
  } catch { /* fall through to create */ }

  try {
    const created = await canvaFetch(token, '/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_folder_id: 'root' }),
    })
    const data = (await created.json()) as { folder?: { id: string } }
    return data.folder?.id ?? null
  } catch {
    return null
  }
}

/**
 * Everything Canva will not take over its API, phrased for pasting.
 *
 * Returned even when the sync fails, because the manual list is the part the
 * owner actually needs and it does not depend on the connection working.
 */
export function manualBrandItems(brand: {
  brand_colours?: Record<string, string> | null
  tone_of_voice?: Record<string, unknown> | null
  brand_dna_constraints?: Record<string, unknown> | null
  tagline?: string | null
  description?: string | null
  compliance_flags?: { ahpra?: boolean; tga?: boolean } | null
}): BrandSyncResult['manual'] {
  const dna = brand.brand_dna_constraints ?? {}
  const typo = (dna.typography ?? {}) as { display?: string; body?: string }
  const tone = brand.tone_of_voice ?? {}

  const voice: string[] = []
  const keywords = (tone.keywords ?? []) as string[]
  const avoid = (tone.avoid_words ?? []) as string[]
  if (keywords.length) voice.push(`Words that describe us: ${keywords.join(', ')}`)
  if (avoid.length) voice.push(`Never use: ${avoid.join(', ')}`)
  for (const rule of (dna.voice_rules ?? []) as string[]) voice.push(rule)

  const guidelines: string[] = []
  if (brand.tagline) guidelines.push(`Tagline: ${brand.tagline}`)
  if (brand.description) guidelines.push(brand.description)
  for (const never of (dna.never_do ?? []) as string[]) guidelines.push(`Never: ${never}`)
  if (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) {
    const regime = [brand.compliance_flags.ahpra ? 'AHPRA' : null, brand.compliance_flags.tga ? 'TGA' : null]
      .filter(Boolean).join(' + ')
    guidelines.push(`REGULATED (${regime}) — every piece of content is reviewed before it publishes`)
  }

  return {
    colours: brand.brand_colours ?? {},
    fonts: { display: typo.display, body: typo.body },
    voice,
    guidelines,
  }
}

/**
 * Sync one project's brand into Canva.
 *
 * Safe to run repeatedly: the folder is reused, and a second logo upload
 * simply produces another asset rather than breaking anything.
 */
export async function syncBrandToCanva(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
): Promise<BrandSyncResult> {
  const { data: brand } = await supabase
    .from('brands')
    .select('name, logo_url, brand_colours, tone_of_voice, brand_dna_constraints, tagline, description, compliance_flags')
    .eq('id', brandId)
    .maybeSingle()

  if (!brand) return { ok: false, project: brandId, manual: manualBrandItems({}), error: 'Project not found.' }

  const manual = manualBrandItems(brand)
  const token = await getCanvaToken(supabase, userId)
  if (!token) {
    return {
      ok: false, project: brand.name, manual,
      error: 'Canva is not connected. Connect it in Settings, then run this again.',
    }
  }

  const result: BrandSyncResult = { ok: true, project: brand.name, manual }

  if (brand.logo_url) {
    const assetId = await uploadLogo(token, brand.logo_url as string, `${brand.name} logo`)
    if (assetId) result.logoAssetId = assetId
    else result.error = 'The logo could not be uploaded — check it is reachable without a login.'
  }

  const folderId = await ensureFolder(token, brand.name as string)
  if (folderId) result.folderId = folderId

  result.ok = Boolean(result.logoAssetId || result.folderId)
  return result
}

/** The sync as a short report, for a person or an assistant to read aloud. */
export function describeBrandSync(result: BrandSyncResult): string {
  const lines: string[] = [`**${result.project}**`]

  if (result.logoAssetId) lines.push(`- Logo uploaded to Canva (asset ${result.logoAssetId})`)
  if (result.folderId) lines.push(`- Folder ready for this project's designs`)
  if (result.error) lines.push(`- ${result.error}`)

  lines.push('', 'Canva has no way to receive these over its API — enter them once in the brand kit:')
  const c = Object.entries(result.manual.colours)
  if (c.length) lines.push(`- **Colours:** ${c.map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  if (result.manual.fonts.display || result.manual.fonts.body) {
    lines.push(`- **Fonts:** ${result.manual.fonts.display ?? '—'} for headings, ${result.manual.fonts.body ?? '—'} for body`)
  }
  for (const v of result.manual.voice) lines.push(`- **Voice:** ${v}`)
  for (const g of result.manual.guidelines) lines.push(`- **Guideline:** ${g}`)

  return lines.join('\n')
}
