import { createSign } from 'node:crypto'
import type { GitHubAppConfig } from './github-app'
import {
  GITHUB_PRODUCT_CONTEXT_PATHS,
  isAllowedGitHubProductPath,
  redactRepositoryProductText,
} from './project-connection'

const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'

interface GitHubInstallation {
  id: number
  account: { login: string }
}

export interface GitHubInstallationRepository {
  id: number
  full_name: string
  default_branch: string | null
}

interface InstallationAccessToken {
  token: string
}

export interface GitHubProductContext {
  repository: GitHubInstallationRepository
  documents: Partial<Record<string, string>>
  recentCommits: Array<{ message: string; date: string }>
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

/** GitHub App JWTs are short-lived and signed only in server memory. */
export function createGitHubAppJwt(config: GitHubAppConfig, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000) - 30
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({
    iat: issuedAt,
    exp: issuedAt + 9 * 60,
    iss: config.appId,
  }))
  const unsigned = `${header}.${payload}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  return `${unsigned}.${signer.sign(config.privateKey).toString('base64url')}`
}

function appHeaders(config: GitHubAppConfig): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${createGitHubAppJwt(config)}`,
    'User-Agent': 'NRS-GitHub-App',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
}

function installationHeaders(accessToken: string, accept = 'application/vnd.github+json'): HeadersInit {
  return {
    Accept: accept,
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'NRS-GitHub-App',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
}

async function requireGitHubResponse(response: Response, action: string): Promise<Response> {
  if (response.ok) return response
  // Deliberately avoid forwarding GitHub's response body. It can contain
  // private repository names or account details that do not belong in logs.
  throw new Error(`${action} failed (${response.status})`)
}

export async function getGitHubInstallation(
  config: GitHubAppConfig,
  installationId: number,
): Promise<GitHubInstallation> {
  const response = await fetch(`${GITHUB_API_URL}/app/installations/${installationId}`, {
    headers: appHeaders(config),
    cache: 'no-store',
  })
  return requireGitHubResponse(response, 'GitHub installation verification').then((value) => value.json()) as Promise<GitHubInstallation>
}

async function createInstallationAccessToken(
  config: GitHubAppConfig,
  installationId: number,
  repositoryIds?: number[],
): Promise<string> {
  const response = await fetch(`${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      ...appHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      permissions: { contents: 'read', metadata: 'read' },
      ...(repositoryIds ? { repository_ids: repositoryIds } : {}),
    }),
    cache: 'no-store',
  })
  const token = await requireGitHubResponse(response, 'GitHub access-token issuance')
    .then((value) => value.json()) as InstallationAccessToken
  if (!token.token) throw new Error('GitHub access-token issuance returned no token')
  return token.token
}

export async function listGitHubInstallationRepositories(
  config: GitHubAppConfig,
  installationId: number,
): Promise<GitHubInstallationRepository[]> {
  const accessToken = await createInstallationAccessToken(config, installationId)
  const response = await fetch(`${GITHUB_API_URL}/installation/repositories?per_page=100`, {
    headers: installationHeaders(accessToken),
    cache: 'no-store',
  })
  const payload = await requireGitHubResponse(response, 'GitHub repository listing')
    .then((value) => value.json()) as { repositories?: GitHubInstallationRepository[] }
  return Array.isArray(payload.repositories) ? payload.repositories : []
}

async function readOptionalRepositoryFile(
  accessToken: string,
  repository: GitHubInstallationRepository,
  path: string,
): Promise<string | null> {
  if (!isAllowedGitHubProductPath(path)) return null
  const response = await fetch(
    `${GITHUB_API_URL}/repos/${repository.full_name}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    {
      headers: installationHeaders(accessToken, 'application/vnd.github.raw'),
      cache: 'no-store',
    },
  )
  if (response.status === 404) return null
  const readable = await requireGitHubResponse(response, 'GitHub product-document read')
  return redactRepositoryProductText((await readable.text()).slice(0, 4_000))
}

/**
 * Fetches only the product-document allowlist and high-level commit metadata.
 * The temporary installation token is restricted to this one repository.
 */
export async function readGitHubProductContext(
  config: GitHubAppConfig,
  installationId: number,
  repository: GitHubInstallationRepository,
): Promise<GitHubProductContext> {
  const accessToken = await createInstallationAccessToken(config, installationId, [repository.id])
  const paths = GITHUB_PRODUCT_CONTEXT_PATHS
  const reads = await Promise.all(paths.map(async (path) => [path, await readOptionalRepositoryFile(accessToken, repository, path)] as const))
  const documents: Partial<Record<string, string>> = {}
  for (const [path, content] of reads) {
    if (typeof content === 'string') documents[path] = content
  }

  const commitsResponse = await fetch(
    `${GITHUB_API_URL}/repos/${repository.full_name}/commits?per_page=10`,
    { headers: installationHeaders(accessToken), cache: 'no-store' },
  )
  const recentCommits = commitsResponse.ok
    ? ((await commitsResponse.json()) as Array<{ commit?: { message?: string; author?: { date?: string } } }>).flatMap((commit) => {
      const message = commit.commit?.message?.split('\n')[0]
      const date = commit.commit?.author?.date
      return message && date ? [{ message, date }] : []
    })
    : []

  return { repository, documents, recentCommits }
}
