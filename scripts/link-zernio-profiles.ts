/**
 * Link a brand to its Zernio profile — verifying the profile first.
 *
 * Zernio's multi-tenant model is one profile per customer, so the profile id is
 * the tenant boundary. Writing an id that does not exist, or that belongs to a
 * different customer, would point a brand's publishing at the wrong place and
 * look correct in every screen a person would check — which is exactly how the
 * profileId object/string bug hid for weeks. So this asks Zernio what the id
 * actually is before writing anything, and refuses on any mismatch.
 *
 * Reads the profile id out of `brands.social_urls.zernio_profile_id`, the same
 * place src/lib/auth/brand-zernio-profile.ts reads it from. social_urls is
 * JSONB holding other keys, so it is MERGED, never replaced.
 *
 *   npx tsx scripts/link-zernio-profiles.ts            # dry run, changes nothing
 *   npx tsx scripts/link-zernio-profiles.ts --apply    # writes
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import Zernio from '@zernio/node'
import { fetchZernioAccounts } from '../src/lib/zernio/client'

config({ path: '.env.local' })

const APPLY = process.argv.includes('--apply')

/** brand id -> Zernio profile id, as supplied by Justin on 2026-08-17. */
const LINKS: { brandId: string; profileId: string; label: string }[] = [
  {
    label: 'Scent Sell',
    brandId: '941fd585-1f85-4646-a1d7-e000aa0ca00a',
    profileId: '6a828fcdad7b3b2362f28fdf',
  },
  {
    label: 'EndorseMe',
    brandId: '9e27eb7c-8689-4e3e-87f4-e2445daedec3',
    profileId: '6a8290868799378c5c7d4530',
  },
]

/**
 * Pull a named collection out of a Zernio SDK response.
 *
 * Responses come back as { data: { <key>: [...] }, request, response }, but the
 * shape varies by endpoint and the SDK is young, so every plausible nesting is
 * accepted rather than one being assumed. Guessing here is what produced the
 * profileId object/string bug that silently disabled Zernio entirely.
 */
function unwrap(res: unknown, key: string): Record<string, unknown>[] {
  const seen = new Set<unknown>()
  const walk = (node: unknown, depth: number): Record<string, unknown>[] | null => {
    if (!node || typeof node !== 'object' || depth > 4 || seen.has(node)) return null
    seen.add(node)
    if (Array.isArray(node)) return node as Record<string, unknown>[]
    const obj = node as Record<string, unknown>
    if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[]
    for (const nested of ['data', 'result', 'body']) {
      const found = walk(obj[nested], depth + 1)
      if (found) return found
    }
    return null
  }
  return walk(res, 0) ?? []
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const zernioKey = process.env.ZERNIO_API_KEY

  if (!url || !key) throw new Error('Missing Supabase env in .env.local')
  if (!zernioKey) throw new Error('Missing ZERNIO_API_KEY in .env.local')

  const supabase = createClient(url, key)
  const zernio = new Zernio({ apiKey: zernioKey })

  // 1. Ask Zernio what profiles actually exist, rather than trusting the ids.
  let profiles: Record<string, unknown>[] = []
  try {
    // The SDK wraps everything as { data: { profiles: [...] }, request, response }
    // and each profile carries Mongo's `_id`, not `id` — the same shape mismatch
    // that made the publish cron never select Zernio for any brand.
    const res = (await zernio.profiles.listProfiles()) as unknown
    profiles = unwrap(res, 'profiles')
  } catch (err) {
    console.error('Could not list Zernio profiles:', err)
    process.exit(1)
  }

  const byId = new Map<string, Record<string, unknown>>()
  for (const p of profiles) {
    const id = String(p.id ?? p._id ?? '')
    if (id) byId.set(id, p)
  }

  console.log(`\nZernio reports ${profiles.length} profile(s):`)
  for (const [id, p] of byId) console.log(`  ${id}  ${String(p.name ?? '(no name)')}`)

  // 2. Verify every link before writing any of them.
  let ok = true
  for (const link of LINKS) {
    const profile = byId.get(link.profileId)
    if (!profile) {
      console.error(
        `\nREFUSING ${link.label}: profile ${link.profileId} does not exist in this Zernio account.`,
      )
      ok = false
      continue
    }
    console.log(
      `\n${link.label} -> ${link.profileId} ("${String(profile.name ?? '')}")`,
    )

    // What is actually connected to it? A profile with no accounts publishes nothing.
    try {
      // Through the app's own client, which filters by profile in our code.
      // Calling the SDK directly here would print every account in the team and
      // make an isolated profile look like a leaking one.
      const accounts = await fetchZernioAccounts(link.profileId)
      if (accounts.length === 0) {
        console.log('  connected accounts: NONE — nothing can publish through it yet')
      } else {
        for (const a of accounts) {
          console.log(
            `  connected: ${a.platform} ${a.username ?? a.displayName ?? ''}`.trimEnd(),
          )
        }
      }
    } catch (err) {
      console.log('  could not list accounts for this profile:', err)
    }
  }

  if (!ok) {
    console.error('\nNothing was written. Fix the ids above and re-run.')
    process.exit(1)
  }

  // 3. Write, merging into social_urls rather than replacing it.
  for (const link of LINKS) {
    const { data: brand, error } = await supabase
      .from('brands')
      .select('id, name, social_urls, compliance_flags')
      .eq('id', link.brandId)
      .single()

    if (error || !brand) {
      console.error(`\n${link.label}: brand ${link.brandId} not found —`, error?.message)
      continue
    }

    const social = (brand.social_urls ?? {}) as Record<string, unknown>
    const before = social.zernio_profile_id
    const flags = (brand.compliance_flags ?? {}) as Record<string, unknown>
    const regulated = Boolean(flags.ahpra || flags.tga)

    console.log(
      `\n${brand.name}: zernio_profile_id ${String(before ?? '(unset)')} -> ${link.profileId}` +
        (regulated ? '   [REGULATED — publishing passes the AHPRA/TGA gate]' : ''),
    )

    if (!APPLY) continue

    const { error: upErr } = await supabase
      .from('brands')
      .update({ social_urls: { ...social, zernio_profile_id: link.profileId } })
      .eq('id', link.brandId)

    if (upErr) console.error(`  FAILED: ${upErr.message}`)
    else console.log('  written')
  }

  console.log(APPLY ? '\nDone.' : '\nDry run — nothing written. Re-run with --apply.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
