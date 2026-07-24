import { createHash } from 'node:crypto'

/**
 * This is the only code surface that the marketing agent may read from a
 * private repository. It is intentionally small, product-oriented, and
 * excludes every likely secret or raw-data location by construction.
 */
export const GITHUB_PRODUCT_CONTEXT_PATHS = [
  'README.md',
  'package.json',
  'docs/CAPABILITY-MAP.md',
  'docs/PRODUCT.md',
  'PRODUCT.md',
  'BRAND.md',
] as const

export interface GitHubInstallationRepository {
  id: number
  fullName: string
}

export interface ProjectRepositoryCandidate {
  brandId: string
  repositoryUrl: string | null
}

export interface ProjectRepositoryMatch<T extends GitHubInstallationRepository> {
  brandId: string
  repository: T
}

export function normaliseGitHubRepositoryUrl(repoUrl: string): string | null {
  const candidate = repoUrl.trim()
  if (!candidate) return null

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`

  try {
    const url = new URL(withProtocol)
    if (url.hostname.toLowerCase() !== 'github.com') return null

    const parts = url.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.git$/i, '')
      .split('/')
      .filter(Boolean)

    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`
  } catch {
    return null
  }
}

/** Store only a non-reversible verifier for the browser-issued state value. */
export function hashGitHubConnectState(state: string): string {
  return createHash('sha256').update(state).digest('hex')
}

export function isAllowedGitHubProductPath(path: string): path is typeof GITHUB_PRODUCT_CONTEXT_PATHS[number] {
  return (GITHUB_PRODUCT_CONTEXT_PATHS as readonly string[]).includes(path)
}

export function selectRepositoryForProject<T extends GitHubInstallationRepository>(
  configuredRepositoryUrl: string,
  repositories: readonly T[],
): T | null {
  const expected = normaliseGitHubRepositoryUrl(configuredRepositoryUrl)
  if (!expected) return null

  return repositories.find((repository) => repository.fullName.toLowerCase() === expected) ?? null
}

/** Never offer an arbitrary installed repository to a project. */
export function matchProjectsToInstalledRepositories<T extends GitHubInstallationRepository>(
  projects: readonly ProjectRepositoryCandidate[],
  repositories: readonly T[],
): ProjectRepositoryMatch<T>[] {
  return projects.flatMap((project) => {
    if (!project.repositoryUrl) return []
    const repository = selectRepositoryForProject(project.repositoryUrl, repositories)
    return repository ? [{ brandId: project.brandId, repository }] : []
  })
}

/** Keep accidental credentials in product docs out of durable marketing context. */
export function redactRepositoryProductText(content: string): string {
  return content
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/(^|\n)\s*([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|KEY))\s*=\s*[^\r\n]+/g, '$1$2=[REDACTED]')
    .replace(/\b(api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*(['"]?)[^\s'"`]+\2/gi, '$1=[REDACTED]')
}
