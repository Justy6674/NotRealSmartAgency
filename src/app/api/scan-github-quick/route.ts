import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseGithubRepo(repoUrl: string): { owner: string; repo: string } | null {
  try {
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

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  const parsed = parseGithubRepo(url)
  if (!parsed) {
    return NextResponse.json({ error: 'Could not parse GitHub URL' }, { status: 400 })
  }

  const { owner, repo } = parsed
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  // Fetch repo info, README, and package.json in parallel
  const [repoRes, readmeRes, pkgRes] = await Promise.allSettled([
    fetch(apiBase, { headers }),
    fetch(`${apiBase}/readme`, {
      headers: { ...headers, Accept: 'application/vnd.github.raw' },
    }),
    fetch(`${apiBase}/contents/package.json`, { headers }),
  ])

  // Repo metadata
  let repoDescription: string | null = null
  let repoTopics: string[] = []
  let repoName: string | null = null
  if (repoRes.status === 'fulfilled' && repoRes.value.ok) {
    const data = await repoRes.value.json() as {
      description?: string
      topics?: string[]
      name?: string
    }
    repoDescription = data.description ?? null
    repoTopics = data.topics ?? []
    repoName = data.name ?? null
  }

  // README
  let readme: string | null = null
  if (readmeRes.status === 'fulfilled' && readmeRes.value.ok) {
    const text = await readmeRes.value.text()
    readme = text.slice(0, 3000)
  }

  // Tech stack from package.json
  let techStack: string[] = []
  if (pkgRes.status === 'fulfilled' && pkgRes.value.ok) {
    try {
      const pkgData = await pkgRes.value.json() as { content?: string }
      const pkgText = pkgData.content
        ? Buffer.from(pkgData.content, 'base64').toString('utf-8')
        : null
      if (pkgText) {
        const pkg = JSON.parse(pkgText) as {
          dependencies?: Record<string, string>
          devDependencies?: Record<string, string>
        }
        techStack = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) })
      }
    } catch {
      // malformed — skip
    }
  }

  // Extract first paragraph from README as description
  let readmeDescription: string | null = null
  if (readme) {
    const lines = readme.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('!')  && !l.startsWith('['))
    readmeDescription = lines.slice(0, 3).join(' ').slice(0, 300) || null
  }

  return NextResponse.json({
    owner,
    repo: repo,
    name: repoName,
    description: repoDescription || readmeDescription,
    topics: repoTopics,
    techStack,
    readme: readme?.slice(0, 1000) ?? null,
  })
}
