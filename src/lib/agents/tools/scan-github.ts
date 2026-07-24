import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

function parseGithubRepo(repoUrl: string): { owner: string; repo: string } | null {
  try {
    // Normalise: strip protocol, trailing slashes, .git suffix
    const cleaned = repoUrl
      .replace(/^https?:\/\//, '')
      .replace(/^github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '')

    const parts = cleaned.split('/')
    if (parts.length < 2) return null

    const owner = parts[0]
    const repo = parts[1]
    if (!owner || !repo) return null

    return { owner, repo }
  } catch {
    return null
  }
}

/** Core scan logic — callable from both the AI tool and the review API */
export async function scanGithubCore(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  repoUrl: string
) {
  const parsed = parseGithubRepo(repoUrl)
  if (!parsed) {
    return { error: 'Could not parse GitHub repository URL' }
  }

  const { owner, repo } = parsed
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  // This public scanner intentionally never falls back to a deployment-wide
  // GitHub credential. Private repositories use the per-project GitHub App
  // connector, where access is scoped to one selected repository at a time.

  const [readmeRes, pkgRes, commitsRes] = await Promise.allSettled([
    fetch(`${apiBase}/readme`, { headers: { ...headers, Accept: 'application/vnd.github.raw' } }),
    fetch(`${apiBase}/contents/package.json`, { headers }),
    fetch(`${apiBase}/commits?per_page=10`, { headers }),
  ])

  let readme: string | null = null
  if (readmeRes.status === 'fulfilled' && readmeRes.value.ok) {
    const text = await readmeRes.value.text()
    readme = text.slice(0, 2000)
  }

  let techStack: Record<string, string> | null = null
  if (pkgRes.status === 'fulfilled' && pkgRes.value.ok) {
    try {
      const pkgData = await pkgRes.value.json() as { content?: string }
      const pkgText = pkgData.content ? Buffer.from(pkgData.content, 'base64').toString('utf-8') : null
      if (pkgText) {
        const pkg = JSON.parse(pkgText) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
        techStack = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
      }
    } catch { /* skip */ }
  }

  let recentCommits: { message: string; date: string }[] = []
  if (commitsRes.status === 'fulfilled' && commitsRes.value.ok) {
    try {
      const commits = await commitsRes.value.json() as Array<{ commit: { message: string; author: { date: string } } }>
      recentCommits = commits.map((c) => ({ message: c.commit.message.split('\n')[0], date: c.commit.author.date }))
    } catch { /* skip */ }
  }

  if (!readme && !techStack && recentCommits.length === 0) {
    await supabase.from('project_scans').insert({
      brand_id: brandId, user_id: userId, scan_type: 'github', status: 'failed', results: {}, error: 'Could not retrieve any data from the repository',
    })
    return { error: 'Could not retrieve data from the repository' }
  }

  const results = { repo_url: repoUrl, owner, repo, readme, techStack, recentCommits }

  await supabase.from('project_scans').insert({
    brand_id: brandId, user_id: userId, scan_type: 'github', status: 'completed', results, error: null,
  })

  return results
}

export function createScanGithubTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Scan a GitHub repository to extract the README, tech stack from package.json, and recent commit history. Use this when the user wants to analyse their codebase, understand what technologies they are using, or get context about a software project before making recommendations.',
    inputSchema: z.object({
      repo_url: z
        .string()
        .describe('The GitHub repository URL (e.g. https://github.com/owner/repo)'),
    }),
    execute: async ({ repo_url }) => scanGithubCore(supabase, userId, brandId, repo_url),
  })
}
