import type { SupabaseClient } from '@supabase/supabase-js'
import { scanSocialCore } from '@/lib/agents/tools/scan-social'
import { scanWebsiteCore } from '@/lib/agents/tools/scan-website'
import type { GitHubAppConfig } from '@/lib/github/github-app'
import {
  readGitHubProductContext,
  type GitHubInstallationRepository,
} from '@/lib/github/github-app-client'
import { appendRepositoryContext } from '@/lib/github/repository-context'
import { discoverWebsiteSitemap } from './project-discovery'

export interface DiscoveryProject {
  id: string
  name: string
  websiteUrl: string | null
  socialUrls: Record<string, string>
}

export interface DiscoveryGitHubBinding {
  installationId: number
  repository: GitHubInstallationRepository
}

export interface ProjectDiscoveryResult {
  github: 'completed' | 'failed'
  website: 'completed' | 'unavailable'
  social: 'completed' | 'failed'
  pagesFound: number
}

function buildGitHubSummary(context: Awaited<ReturnType<typeof readGitHubProductContext>>): string {
  let summary = `GitHub App repository: ${context.repository.full_name}\n`
  summary += 'Access: read-only product documentation and commit metadata\n'
  if (context.repository.default_branch) summary += `Default branch: ${context.repository.default_branch}\n`
  if (context.recentCommits.length) {
    summary += `Recent commits: ${context.recentCommits.map((commit) => `${commit.date.slice(0, 10)} ${commit.message}`).join(' | ')}\n`
  }
  for (const [path, content] of Object.entries(context.documents)) {
    if (typeof content !== 'string') continue
    summary = appendRepositoryContext(summary, path, content)
  }
  return summary.slice(0, 16_000)
}

/**
 * A source-grounded first pass for one sealed project. All writes carry the
 * same brand ID; it never reads a sibling project or sends anything outbound.
 */
export async function runProjectDiscovery({
  supabase,
  userId,
  project,
  githubApp,
  githubBinding,
}: {
  supabase: SupabaseClient
  userId: string
  project: DiscoveryProject
  githubApp: GitHubAppConfig
  githubBinding: DiscoveryGitHubBinding
}): Promise<ProjectDiscoveryResult> {
  let github: ProjectDiscoveryResult['github'] = 'failed'
  try {
    const context = await readGitHubProductContext(
      githubApp,
      githubBinding.installationId,
      githubBinding.repository,
    )
    const summary = buildGitHubSummary(context)
    await supabase.from('brands').update({ github_context: summary }).eq('id', project.id).eq('user_id', userId)
    await supabase.from('project_scans').insert({
      brand_id: project.id,
      user_id: userId,
      scan_type: 'github',
      status: 'completed',
      results: {
        source: 'github_app',
        repository: context.repository.full_name,
        documents: Object.keys(context.documents),
        recent_commits: context.recentCommits,
      },
      error: null,
    })
    github = 'completed'
  } catch {
    await supabase.from('project_scans').insert({
      brand_id: project.id,
      user_id: userId,
      scan_type: 'github',
      status: 'failed',
      results: { source: 'github_app' },
      error: 'Could not retrieve the project GitHub marketing context',
    })
  }

  let website: ProjectDiscoveryResult['website'] = 'unavailable'
  let pagesFound = 0
  if (project.websiteUrl) {
    const websiteResult = await scanWebsiteCore(supabase, userId, project.id, project.websiteUrl, 'general')
    const websiteError = 'error' in websiteResult ? websiteResult.error : null
    const sitemap = await discoverWebsiteSitemap(project.websiteUrl)
    pagesFound = sitemap.pageUrls.length
    await supabase.from('project_scans').insert({
      brand_id: project.id,
      user_id: userId,
      scan_type: 'website',
      status: websiteError ? 'failed' : 'completed',
      results: {
        source: 'bounded_sitemap_discovery',
        robots_found: sitemap.robotsFound,
        sitemap_urls: sitemap.sitemapUrls,
        page_urls: sitemap.pageUrls,
      },
      error: websiteError,
    })
    website = websiteError ? 'unavailable' : 'completed'
  }

  let social: ProjectDiscoveryResult['social'] = 'completed'
  try {
    await scanSocialCore(supabase, userId, project.id, project.name, project.socialUrls)
  } catch {
    social = 'failed'
  }

  return { github, website, social, pagesFound }
}
