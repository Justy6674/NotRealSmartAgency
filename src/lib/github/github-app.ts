export interface GitHubAppConfig {
  appId: string
  appSlug: string
  privateKey: string
}

type GitHubAppEnvironment = Partial<Record<
  'GITHUB_APP_ID' | 'GITHUB_APP_SLUG' | 'GITHUB_APP_PRIVATE_KEY',
  string | undefined
>>

/**
 * GitHub App credentials are deliberately server-only. Installation access
 * tokens are minted at request time and never written to Supabase, Telegram,
 * agent memory, or audit logs.
 */
export function getGitHubAppConfig(
  env: GitHubAppEnvironment = process.env as GitHubAppEnvironment,
): GitHubAppConfig | null {
  const appId = env.GITHUB_APP_ID?.trim()
  const appSlug = env.GITHUB_APP_SLUG?.trim()
  const storedPrivateKey = env.GITHUB_APP_PRIVATE_KEY?.trim()

  if (!appId || !appSlug || !storedPrivateKey) return null

  return {
    appId,
    appSlug,
    privateKey: storedPrivateKey.replace(/\\n/g, '\n'),
  }
}

export function gitHubAppInstallUrl(config: Pick<GitHubAppConfig, 'appSlug'>): string {
  return `https://github.com/apps/${encodeURIComponent(config.appSlug)}/installations/new`
}

export function gitHubAppInstallUrlWithState(
  config: Pick<GitHubAppConfig, 'appSlug'>,
  state: string,
): string {
  const url = new URL(gitHubAppInstallUrl(config))
  url.searchParams.set('state', state)
  return url.toString()
}
