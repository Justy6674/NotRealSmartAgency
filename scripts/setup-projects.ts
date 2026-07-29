/**
 * One-shot, idempotent project setup for the NRS project roster.
 *
 * The platform already has the right pipelines — they had simply only ever run
 * once, from the GitHub App connect callback. This script drives every project
 * through them: it corrects the roster, binds each project to its private
 * repository via the installed GitHub App, then calls the same
 * `runProjectDiscovery()` the callback uses plus the brand-kit extraction.
 *
 * No brand data is hand-written here. Everything comes from the live site or
 * the repository, so a re-run produces current data rather than stale copies.
 *
 * Usage:
 *   vercel env pull .env.github-app --environment=production
 *   npx tsx scripts/setup-projects.ts            # full run
 *   npx tsx scripts/setup-projects.ts --dry-run  # report only, no writes
 *   npx tsx scripts/setup-projects.ts --only=scent-sell,do-today
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getGitHubAppConfig } from '@/lib/github/github-app'
import { listGitHubInstallationRepositories, type GitHubInstallationRepository } from '@/lib/github/github-app-client'
import { GITHUB_PRODUCT_CONTEXT_PATHS } from '@/lib/github/project-connection'
import { runProjectDiscovery } from '@/lib/discovery/project-discovery-run'
import { discoverWebsiteSitemap } from '@/lib/discovery/project-discovery'
import { scanWebsiteCore } from '@/lib/agents/tools/scan-website'
import { scanSocialCore } from '@/lib/agents/tools/scan-social'
import { ensureProforma } from '@/lib/proforma/auto-populate'
import { extractBrandKitCore } from '@/lib/agents/tools/extract-brand-kit'

// ── Env loading ───────────────────────────────────────────────────────────────
// GitHub App credentials are deliberately server-only and are not in
// .env.local. They are pulled from Vercel production into a gitignored file.
function loadEnvFile(path: string, required: boolean): void {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    if (required) {
      console.error(`Missing ${path}`)
      process.exit(1)
    }
    return
  }
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_0-9]+)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    const value = rawValue.trim().replace(/^["']|["']$/g, '')
    // `vercel env pull` writes this placeholder for variables marked sensitive.
    // Treating it as a real value produces a confusing crypto error later
    // instead of the honest "credentials unavailable" path.
    if (!value || value === '[SENSITIVE]') continue
    process.env[key] = value
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(resolve(root, '.env.local'), true)
loadEnvFile(resolve(root, '.env.github-app'), false)

// ── Roster ────────────────────────────────────────────────────────────────────
// Every repository below was verified against the Vercel production domain that
// serves the site, not inferred from the project's name.
interface RosterEntry {
  slug: string
  name: string
  websiteUrl: string
  repo: string
  /** Set only when creating the project for the first time. */
  create?: {
    niche: string
    businessStage: string
    tagline: string
    complianceFlags?: Record<string, unknown>
  }
  /** Merged into extra_context so agents know about secondary properties. */
  extraContextNote?: string
  logoUrl?: string
  /**
   * Canva brand kit id, recorded so design tools use this project's own kit.
   * Left unset where the project has no kit — a neighbouring brand's kit would
   * put the wrong colours and logo on its designs.
   */
  canvaBrandKitId?: string
}

const ROSTER: RosterEntry[] = [
  { slug: 'downscale', name: 'Downscale Weight Loss', websiteUrl: 'https://downscale.com.au', repo: 'Justy6674/DSWebsite_next.js', canvaBrandKitId: 'kAGdnxtlmr4' },
  { slug: 'telecheck', name: 'TeleCheck', websiteUrl: 'https://telecheck.com.au', repo: 'Justy6674/astro-assist-check' },
  {
    slug: 'telecheck-clinic',
    name: 'TeleCheck Clinic',
    websiteUrl: 'https://telecheck.clinic',
    repo: 'Justy6674/telecheck_as_nextjs',
    logoUrl: 'https://telecheck.clinic/telechecklogofavicon.png',
    create: {
      niche: 'health_saas',
      businessStage: 'growth',
      tagline: 'Medicare telehealth disaster eligibility for clinics',
      complianceFlags: { tga: false, ahpra: true, tga_categories: [] },
    },
  },
  { slug: 'telescribe', name: 'TeleScribe', websiteUrl: 'https://telescribe.com.au', repo: 'Justy6674/Telescribe', canvaBrandKitId: 'kAHFjkOunos' },
  { slug: 'notrealsmart', name: 'NotRealSmart', websiteUrl: 'https://notrealsmart.com.au', repo: 'Justy6674/NotRealSmartAgency' },
  {
    slug: 'scent-sell',
    name: 'Scent Sell',
    websiteUrl: 'https://scentsell.com.au',
    repo: 'Justy6674/scent-australia',
    canvaBrandKitId: 'kAHHGIUgnAc',
    extraContextNote:
      'Help centre: https://help.scentsell.com.au is a Docusaurus site deployed from the docs-site/ directory of the same scent-australia repository. Sniffbot MCP runs at https://mcp.scentsell.com.au.',
  },
  { slug: 'endorseme', name: 'EndorseMe', websiteUrl: 'https://endorseme.com.au', repo: 'Justy6674/pathway-to-np' },
  { slug: 'do-today', name: 'Do Today', websiteUrl: 'https://www.dotoday.com.au', repo: 'Justy6674/DoToday' },
  {
    slug: 'underground-parfums',
    name: 'Underground Parfums',
    websiteUrl: 'https://www.undergroundparfums.com',
    repo: 'Justy6674/underground-parfums',
    logoUrl: 'https://www.undergroundparfums.com/favicon.ico',
  },
  {
    slug: 'sniffopotamus',
    name: 'Sniffopotamus',
    websiteUrl: 'https://sniffopotamus.com',
    repo: 'Justy6674/sniffopotamus',
    canvaBrandKitId: 'kAHK8I7vcJA',
    logoUrl: 'https://sniffopotamus.com/favicon-512x512.png',
    create: {
      niche: 'fragrance_discovery',
      businessStage: 'launch',
      tagline: 'Fragrance memory, AI tools, and scent data',
    },
  },
  {
    slug: 'black-health-intelligence',
    name: 'Black Health Intelligence',
    websiteUrl: 'https://blackhealthintelligence.com',
    repo: 'Justy6674/black-health-intelligence',
    logoUrl: 'https://blackhealthintelligence.com/FAVICON.png',
    create: {
      niche: 'healthcare_innovation',
      businessStage: 'growth',
      tagline: 'Healthcare innovation portfolio',
      complianceFlags: { tga: false, ahpra: true, tga_categories: [] },
    },
  },
]

/** Superseded or paused — deactivated, never deleted, so history survives. */
const RETIRE: Array<{ slug: string; reason: string }> = [
  { slug: 'tele360', reason: 'paused at owner request' },
  { slug: 'downscale-diary', reason: 'superseded by Do Today' },
  { slug: 'downscalederm', reason: 'removed at owner request' },
]

const WEB_CAPABILITIES = ['director:chat', 'draft:post', 'direct:read', 'direct:utility', 'publish:request']
const TELEGRAM_CAPABILITIES = ['director:chat', 'draft:post', 'direct:read', 'direct:utility']

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
/** Only meaningful where the serverless Chromium build can launch. */
const withWebsiteAudit = args.includes('--with-website-audit')
const onlyArg = args.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null

interface Report {
  project: string
  action: string
  github: string
  website: string
  social: string
  colours: string
  proforma: string
  notes: string[]
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // The App private key is a Vercel "sensitive" variable, so `vercel env pull`
  // redacts it and it cannot be used from a laptop. That is deliberate. When it
  // is absent the run still does everything that does not need GitHub — roster,
  // website, social, brand kit, proforma — and the repository context is filled
  // by the product's own connect flow (`/connect all` in Telegram), which runs
  // on production with the real credentials.
  const githubApp = getGitHubAppConfig()
  if (!githubApp) {
    console.log('GitHub App credentials unavailable locally — skipping repository context.')
    console.log('Run `/connect all` in Telegram afterwards to fill it on production.\n')
  }

  // The owner account. Every project and grant is scoped to it.
  const { data: installation } = await admin
    .from('github_app_installations')
    .select('id, owner_user_id, github_installation_id, account_login, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!installation) {
    console.error('No active GitHub App installation found. Connect GitHub in NRS first.')
    process.exit(1)
  }

  const userId = installation.owner_user_id as string
  const installationId = installation.github_installation_id as number
  console.log(`GitHub App installation ${installationId} (${installation.account_login}), owner ${userId}\n`)

  // Repository ids come from the live installation so a newly-granted repo is
  // picked up without waiting for a re-connect. Without App credentials fall
  // back to the repositories already recorded from the last connect.
  const repoByFullName = new Map<string, GitHubInstallationRepository>()
  if (githubApp) {
    const liveRepos = await listGitHubInstallationRepositories(githubApp, installationId)
    for (const r of liveRepos) repoByFullName.set(r.full_name.toLowerCase(), r)
    console.log(`Installation currently grants ${liveRepos.length} repositories.\n`)
  } else {
    const { data: knownRepos } = await admin
      .from('github_installation_repositories')
      .select('github_repository_id, full_name, default_branch')
      .eq('installation_id', installation.id)
    for (const r of knownRepos ?? []) {
      repoByFullName.set((r.full_name as string).toLowerCase(), {
        id: r.github_repository_id as number,
        full_name: r.full_name as string,
        default_branch: (r.default_branch as string) ?? 'main',
      })
    }
    console.log(`Using ${repoByFullName.size} repositories recorded from the last connect.\n`)
  }

  const reports: Report[] = []

  // ── Retire superseded projects ──────────────────────────────────────────────
  for (const { slug, reason } of RETIRE) {
    const { data: existing } = await admin
      .from('brands')
      .select('id, name, is_active')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) continue
    if (!existing.is_active) {
      console.log(`· ${existing.name} — already inactive`)
      continue
    }
    if (dryRun) {
      console.log(`· ${existing.name} — WOULD deactivate (${reason})`)
      continue
    }
    const { error } = await admin
      .from('brands')
      .update({ is_active: false, marketing_notes: `Deactivated: ${reason}.` })
      .eq('id', existing.id)
    console.log(error ? `✗ ${existing.name} — deactivate failed: ${error.message}` : `· ${existing.name} — deactivated (${reason})`)
  }
  console.log()

  // ── Set up each active project ──────────────────────────────────────────────
  for (const entry of ROSTER) {
    if (only && !only.includes(entry.slug)) continue

    const report: Report = {
      project: entry.name,
      action: '—',
      github: '—',
      website: '—',
      social: '—',
      colours: '—',
      proforma: '—',
      notes: [],
    }
    reports.push(report)
    console.log(`━━ ${entry.name} ━━`)

    const { data: found } = await admin
      .from('brands')
      .select('*')
      .eq('slug', entry.slug)
      .maybeSingle()

    let brand = found

    // Create the project if it is new to NRS.
    if (!brand) {
      if (!entry.create) {
        report.action = 'MISSING — no create block'
        report.notes.push('Project row absent and no creation defaults defined; skipped.')
        console.log('  ✗ not found and no create block — skipped')
        continue
      }
      if (dryRun) {
        report.action = 'WOULD create'
        console.log('  → WOULD create')
        continue
      }
      const { data: created, error } = await admin
        .from('brands')
        .insert({
          user_id: userId,
          name: entry.name,
          slug: entry.slug,
          tagline: entry.create.tagline,
          website_url: entry.websiteUrl,
          github_url: `https://github.com/${entry.repo}`,
          niche: entry.create.niche,
          business_stage: entry.create.businessStage,
          compliance_flags: entry.create.complianceFlags ?? { tga: false, ahpra: false, tga_categories: [] },
          is_active: true,
        })
        .select('*')
        .single()

      if (error || !created) {
        report.action = 'CREATE FAILED'
        report.notes.push(error?.message ?? 'unknown insert error')
        console.log(`  ✗ create failed: ${error?.message}`)
        continue
      }
      brand = created
      report.action = 'created'
      console.log(`  ✓ created (${created.id})`)

      // Mirror the access grants the existing projects carry so the new project
      // is reachable from the web app and the paired Telegram account.
      await admin.from('project_access_grants').upsert(
        [
          { actor_user_id: userId, brand_id: created.id, channel: 'web', capabilities: WEB_CAPABILITIES, status: 'active', created_by: userId, revoked_at: null },
          { actor_user_id: userId, brand_id: created.id, channel: 'telegram', capabilities: TELEGRAM_CAPABILITIES, status: 'active', created_by: userId, revoked_at: null },
        ],
        { onConflict: 'actor_user_id,brand_id,channel' },
      )
      console.log('  ✓ web + telegram grants')
    } else {
      report.action = 'updated'
    }

    // Correct wiring that drifted from reality.
    const corrections: Record<string, unknown> = {}
    const desiredGithubUrl = `https://github.com/${entry.repo}`
    if (brand.github_url !== desiredGithubUrl) {
      corrections.github_url = desiredGithubUrl
      report.notes.push(`repo → ${entry.repo}`)
    }
    if (!brand.website_url) {
      corrections.website_url = entry.websiteUrl
      report.notes.push(`website → ${entry.websiteUrl}`)
    }
    if (entry.logoUrl && !brand.logo_url) {
      corrections.logo_url = entry.logoUrl
      report.notes.push('logo set')
    }
    // An absolute URL is required — a relative path cannot be loaded by an
    // external AI client or an image generator.
    if (typeof brand.logo_url === 'string' && brand.logo_url.startsWith('/')) {
      corrections.logo_url = new URL(brand.logo_url, entry.websiteUrl).toString()
      report.notes.push('logo made absolute')
    }
    if (!brand.is_active) {
      corrections.is_active = true
      report.notes.push('reactivated')
    }
    if (entry.extraContextNote) {
      const current = typeof brand.extra_context === 'string' ? brand.extra_context : ''
      if (!current.includes('help.scentsell.com.au')) {
        corrections.extra_context = current ? `${current}\n\n${entry.extraContextNote}` : entry.extraContextNote
        report.notes.push('help-site context added')
      }
    }

    if (Object.keys(corrections).length && !dryRun) {
      const { error } = await admin.from('brands').update(corrections).eq('id', brand.id)
      if (error) report.notes.push(`correction failed: ${error.message}`)
      else Object.assign(brand, corrections)
      console.log(`  ✓ corrections: ${Object.keys(corrections).join(', ')}`)
    } else if (Object.keys(corrections).length) {
      console.log(`  → WOULD correct: ${Object.keys(corrections).join(', ')}`)
    }

    if (dryRun) continue

    // ── Bind the repository so the App can read it ────────────────────────────
    const repo = repoByFullName.get(entry.repo.toLowerCase())
    if (!repo) {
      report.github = 'no App access'
      report.notes.push(`${entry.repo} is not granted to the installation`)
      console.log(`  ✗ ${entry.repo} not granted to the App installation`)
    } else {
      const { data: installationRepo } = await admin
        .from('github_installation_repositories')
        .upsert({
          installation_id: installation.id,
          github_repository_id: repo.id,
          full_name: repo.full_name,
          default_branch: repo.default_branch ?? 'main',
        }, { onConflict: 'installation_id,github_repository_id' })
        .select('id')
        .single()

      if (installationRepo) {
        await admin.from('github_repository_bindings').upsert({
          brand_id: brand.id,
          installation_id: installation.id,
          installation_repository_id: installationRepo.id,
          allowed_paths: [...GITHUB_PRODUCT_CONTEXT_PATHS],
          status: 'active',
        }, { onConflict: 'brand_id' })

        await admin.from('project_connectors').upsert({
          brand_id: brand.id,
          connector_type: 'github_app',
          display_name: 'Private GitHub product context',
          endpoint_url: `https://github.com/${repo.full_name}`,
          credential_reference: `github-installation:${installation.id}`,
          allowed_resources: [...GITHUB_PRODUCT_CONTEXT_PATHS, 'commit_metadata'],
          read_only: true,
          status: 'active',
          freshness_seconds: 86_400,
          last_checked_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error: null,
        }, { onConflict: 'brand_id,connector_type' })

        console.log(`  ✓ bound ${repo.full_name}`)
      }
    }

    // ── Canva: record this project's own brand kit ─────────────────────────────
    if (entry.canvaBrandKitId) {
      const { error: canvaError } = await admin.from('project_connectors').upsert({
        brand_id: brand.id,
        connector_type: 'canva_brand_kit',
        display_name: 'Canva brand kit',
        endpoint_url: `https://www.canva.com/brand/${entry.canvaBrandKitId}`,
        credential_reference: `canva-brand-kit:${entry.canvaBrandKitId}`,
        allowed_resources: ['brand_colours', 'brand_fonts', 'brand_logos'],
        read_only: true,
        status: 'active',
        freshness_seconds: 86_400,
        last_checked_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: 'brand_id,connector_type' })
      if (canvaError) {
        report.notes.push(`canva connector failed: ${canvaError.message}`)
      } else {
        report.notes.push(`canva kit ${entry.canvaBrandKitId}`)
        console.log(`  ✓ canva brand kit ${entry.canvaBrandKitId}`)
      }
    } else {
      report.notes.push('no canva brand kit — designs use saved brand colours')
    }

    const websiteUrl = ((corrections.website_url as string) ?? brand.website_url) as string | null
    const socialUrls = (brand.social_urls ?? {}) as Record<string, string>

    if (githubApp && repo) {
      // ── The platform's own discovery pass ───────────────────────────────────
      const result = await runProjectDiscovery({
        supabase: admin,
        userId,
        project: { id: brand.id, name: brand.name, websiteUrl, socialUrls },
        githubApp,
        githubBinding: { installationId, repository: repo },
      })
      report.github = result.github
      report.website = `${result.website} (${result.pagesFound} pages)`
      report.social = result.social
      console.log(`  ✓ discovery: github ${result.github}, website ${result.website}, ${result.pagesFound} pages, social ${result.social}`)
    } else {
      // The website passes the discovery run performs, minus the parts this
      // machine cannot do. Sitemap discovery is plain HTTP and works anywhere;
      // the rendered audit needs the serverless Chromium build
      // (`@sparticuz/chromium`) and only runs on Vercel, so it is skipped here
      // rather than recording a failure that says nothing about the site.
      if (websiteUrl) {
        const sitemap = await discoverWebsiteSitemap(websiteUrl)
        await admin.from('project_scans').insert({
          brand_id: brand.id,
          user_id: userId,
          scan_type: 'website',
          status: 'completed',
          results: {
            source: 'bounded_sitemap_discovery',
            robots_found: sitemap.robotsFound,
            sitemap_urls: sitemap.sitemapUrls,
            page_urls: sitemap.pageUrls,
          },
          error: null,
        })
        report.website = `sitemap ${sitemap.pageUrls.length} pages (rendered audit pending)`
        console.log(`  ✓ website: ${report.website}`)

        if (withWebsiteAudit) {
          const websiteResult = await scanWebsiteCore(admin, userId, brand.id, websiteUrl, 'general')
          const websiteError = 'error' in websiteResult ? websiteResult.error : null
          report.website = websiteError
            ? `sitemap ${sitemap.pageUrls.length} pages; audit failed`
            : `completed (${sitemap.pageUrls.length} pages)`
          console.log(`  ${websiteError ? '✗' : '✓'} rendered audit: ${websiteError ?? 'completed'}`)
        }
      }
      try {
        await scanSocialCore(admin, userId, brand.id, brand.name, socialUrls)
        report.social = 'completed'
      } catch {
        report.social = 'failed'
      }
      if (report.github === '—') {
        report.github = 'pending — run /connect all'
      }
    }

    // ── Brand kit: colours + voice, grounded in the site's real CSS ───────────
    const kitResult = await extractBrandKitCore(admin, userId, brand.id, entry.websiteUrl)
    if ('error' in kitResult && kitResult.error) {
      report.colours = 'failed'
      report.notes.push(`brand kit: ${kitResult.error}`)
      console.log(`  ✗ brand kit: ${kitResult.error}`)
    } else if ('kit' in kitResult && kitResult.kit) {
      // The extractor refuses to save colours it could not read from CSS, so a
      // false here means the palette genuinely needs a human, not that it failed.
      if (kitResult.coloursGrounded) {
        report.colours = kitResult.palette
          ? `${kitResult.palette.primary} / ${kitResult.palette.accent}`
          : 'saved'
        console.log(`  ✓ brand kit: ${report.colours}`)
      } else {
        report.colours = 'not in CSS — skipped'
        report.notes.push('Colours could not be read from the site CSS; left empty rather than invented.')
        console.log('  ⚠ brand kit: colours not readable from CSS — skipped (voice saved)')
      }
    }

    const { data: refreshed } = await admin
      .from('brands')
      .select('github_context')
      .eq('id', brand.id)
      .maybeSingle()
    if (refreshed && report.github === 'completed') {
      report.github = `completed (${String(refreshed.github_context ?? '').length} chars)`
    }

    console.log()
  }

  // ── Proforma backfill (needs brand_colours, so it runs last) ────────────────
  console.log('━━ Proforma ━━')
  const { data: activeBrands } = await admin.from('brands').select('*').eq('is_active', true).order('name')
  for (const b of activeBrands ?? []) {
    const { count } = await admin
      .from('brand_proforma_sections')
      .select('section_key', { count: 'exact', head: true })
      .eq('brand_id', b.id)
    const before = count ?? 0
    if (before >= 21) {
      console.log(`  · ${b.name}: ${before}/21 already`)
      const r = reports.find((x) => x.project === b.name)
      if (r) r.proforma = `${before}/21`
      continue
    }
    if (dryRun) {
      console.log(`  → ${b.name}: WOULD seed (${before}/21)`)
      continue
    }
    const sections = await ensureProforma(admin, b)
    console.log(`  ✓ ${b.name}: ${before}/21 → ${sections.length}/21`)
    const r = reports.find((x) => x.project === b.name)
    if (r) r.proforma = `${sections.length}/21`
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n━━ Summary ━━')
  for (const r of reports) {
    console.log(`\n${r.project} [${r.action}]`)
    console.log(`  github: ${r.github}   website: ${r.website}   social: ${r.social}`)
    console.log(`  colours: ${r.colours}   proforma: ${r.proforma}`)
    for (const n of r.notes) console.log(`  · ${n}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
