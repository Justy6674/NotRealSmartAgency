import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createTelegramDirectorExecution } from '@/lib/agents/director-execution'
import { runProjectDiscovery, type DiscoveryProject } from '@/lib/discovery/project-discovery-run'
import { getGitHubAppConfig } from '@/lib/github/github-app'
import {
  getGitHubInstallation,
  listGitHubInstallationRepositories,
  type GitHubInstallationRepository,
} from '@/lib/github/github-app-client'
import {
  GITHUB_PRODUCT_CONTEXT_PATHS,
  hashGitHubConnectState,
  matchProjectsToInstalledRepositories,
} from '@/lib/github/project-connection'
import { runDirectorJob } from '@/lib/mcp/director-job'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramText } from '@/lib/telegram/telegram-api'
import { formatTelegramMarketingCopy } from '@/lib/telegram/telegram-marketing-copy'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'

export const runtime = 'nodejs'

const CONNECT_STATE = /^[A-Za-z0-9_-]{40,128}$/

interface ConnectRequestRow {
  id: string
  actor_user_id: string
  telegram_account_id: string
  project_access_grant_ids: string[]
  brand_ids: string[]
}

interface GrantRow {
  id: string
  brand_id: string
  capabilities: string[]
}

interface ConnectedProject {
  project: DiscoveryProject
  grant: GrantRow
  repository: GitHubInstallationRepository
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value))
}

function successPage(message: string): NextResponse {
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><title>NRS GitHub connection</title></head><body><p>${message}</p><p>You can return to Telegram.</p></body></html>`, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'referrer-policy': 'no-referrer',
    },
  })
}

async function sendSafeTelegramUpdate(chatId: string, text: string): Promise<void> {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return
  try {
    await sendTelegramText({ botToken: config.botToken, chatId, text })
  } catch {
    // The connection remains valid even if Telegram delivery is temporarily unavailable.
  }
}

async function deliverDiscoveryBrief({
  admin,
  actorUserId,
  project,
  grant,
  chatId,
  sourceSummary,
}: {
  admin: ReturnType<typeof createAdminClient>
  actorUserId: string
  project: DiscoveryProject
  grant: GrantRow
  chatId: string
  sourceSummary: string
}): Promise<void> {
  let execution
  try {
    execution = createTelegramDirectorExecution({
      userId: actorUserId,
      grant: {
        grantId: grant.id,
        projectId: project.id,
        capabilities: grant.capabilities.filter((capability): capability is 'director:chat' => capability === 'director:chat'),
      },
    })
  } catch {
    return
  }

  const message = [
    'This is an automatic Project Discovery Run for the selected project.',
    'Do not ask whether to scan GitHub, the website, sitemap, or social profiles: that source pass has already happened.',
    sourceSummary,
    'Write a concise founder-facing Discovery Brief with: what the product appears to do; the three highest-value marketing priorities; any missing public marketing assets; and the next single action. Use only this project and do not mention sibling businesses or customer/patient information.',
  ].join('\n\n')

  const { data: job } = await admin
    .from('mcp_jobs')
    .insert({
      user_id: execution.actorUserId,
      brand_id: execution.projectId,
      channel: execution.channel,
      api_key_id: null,
      project_access_grant_id: execution.projectAccessGrantId,
      policy_version: execution.policyVersion,
      job_type: 'director_chat',
      status: 'queued',
      input: { brand_id: execution.projectId, message },
    })
    .select('id')
    .maybeSingle()
  if (!job?.id) return

  try {
    await runDirectorJob(job.id, execution, { brand_id: execution.projectId, message })
    const { data: completed } = await admin
      .from('mcp_jobs')
      .select('status, result')
      .eq('id', job.id)
      .eq('user_id', execution.actorUserId)
      .eq('brand_id', execution.projectId)
      .eq('channel', 'telegram')
      .eq('project_access_grant_id', execution.projectAccessGrantId)
      .is('api_key_id', null)
      .maybeSingle()
    const response = (completed?.result as { response?: unknown } | null)?.response
    if (completed?.status === 'done' && typeof response === 'string' && inspectMarketingInput(response).allowed) {
      await sendSafeTelegramUpdate(chatId, formatTelegramMarketingCopy(response))
    }
  } catch {
    // The source discovery is complete even if the optional AI brief fails.
  }
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')
  const installationId = Number(request.nextUrl.searchParams.get('installation_id'))
  const githubApp = getGitHubAppConfig()
  if (!githubApp || !state || !CONNECT_STATE.test(state) || !Number.isSafeInteger(installationId) || installationId <= 0) {
    return new NextResponse('This GitHub connection could not be verified.', { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: rawRequest } = await admin
    .from('github_connect_requests')
    .select('id, actor_user_id, telegram_account_id, project_access_grant_ids, brand_ids')
    .eq('state_hash', hashGitHubConnectState(state))
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle()
  if (!rawRequest) return new NextResponse('This GitHub connection link has expired. Return to Telegram and use /connect again.', { status: 410 })

  const connectRequest: ConnectRequestRow = {
    id: rawRequest.id as string,
    actor_user_id: rawRequest.actor_user_id as string,
    telegram_account_id: rawRequest.telegram_account_id as string,
    project_access_grant_ids: asStringArray(rawRequest.project_access_grant_ids),
    brand_ids: asStringArray(rawRequest.brand_ids),
  }
  if (!connectRequest.id || !connectRequest.actor_user_id || !connectRequest.telegram_account_id || !connectRequest.project_access_grant_ids.length || !sameSet(connectRequest.project_access_grant_ids, [...new Set(connectRequest.project_access_grant_ids)]) || !connectRequest.brand_ids.length || !sameSet(connectRequest.brand_ids, [...new Set(connectRequest.brand_ids)])) {
    return new NextResponse('This GitHub connection could not be verified.', { status: 400 })
  }

  const [{ data: account }, { data: rawGrants }, { data: rawProjects }] = await Promise.all([
    admin.from('telegram_accounts').select('telegram_chat_id, actor_user_id').eq('id', connectRequest.telegram_account_id).is('revoked_at', null).maybeSingle(),
    admin.from('project_access_grants').select('id, brand_id, capabilities').in('id', connectRequest.project_access_grant_ids).eq('actor_user_id', connectRequest.actor_user_id).eq('channel', 'telegram').eq('status', 'active').is('revoked_at', null).or(`expires_at.is.null,expires_at.gt.${now}`),
    admin.from('brands').select('id, name, github_url, website_url, social_urls').in('id', connectRequest.brand_ids).eq('user_id', connectRequest.actor_user_id),
  ])
  const grants = ((rawGrants ?? []) as Array<Record<string, unknown>>).flatMap<GrantRow>((grant) => (
    typeof grant.id === 'string' && typeof grant.brand_id === 'string'
      ? [{ id: grant.id, brand_id: grant.brand_id, capabilities: asStringArray(grant.capabilities) }]
      : []
  ))
  const projects = ((rawProjects ?? []) as Array<Record<string, unknown>>).flatMap<DiscoveryProject>((project) => (
    typeof project.id === 'string' && typeof project.name === 'string'
      ? [{
        id: project.id,
        name: project.name,
        websiteUrl: typeof project.website_url === 'string' ? project.website_url : null,
        socialUrls: project.social_urls && typeof project.social_urls === 'object' && !Array.isArray(project.social_urls)
          ? project.social_urls as Record<string, string>
          : {},
      }]
      : []
  ))
  const grantPairsValid = grants.length === connectRequest.project_access_grant_ids.length
    && projects.length === connectRequest.brand_ids.length
    && sameSet(grants.map((grant) => grant.id), connectRequest.project_access_grant_ids)
    && sameSet(projects.map((project) => project.id), connectRequest.brand_ids)
    && sameSet(grants.map((grant) => grant.brand_id), connectRequest.brand_ids)
  if (!account || account.actor_user_id !== connectRequest.actor_user_id || !grantPairsValid) {
    return new NextResponse('This GitHub connection is no longer authorised for the selected project.', { status: 403 })
  }

  let installation
  let repositories: GitHubInstallationRepository[]
  try {
    installation = await getGitHubInstallation(githubApp, installationId)
    if (installation.id !== installationId || typeof installation.account?.login !== 'string') throw new Error('GitHub installation mismatch')
    repositories = await listGitHubInstallationRepositories(githubApp, installationId)
  } catch {
    await sendSafeTelegramUpdate(account.telegram_chat_id, 'NRS could not verify that GitHub installation. No project was connected; use /connect to try again.')
    return new NextResponse('GitHub installation verification failed. Return to Telegram and use /connect again.', { status: 400 })
  }

  // Mark it consumed immediately before durable changes, preventing a replay
  // from binding a different installation after the user has completed setup.
  const { data: consumed } = await admin
    .from('github_connect_requests')
    .update({ used_at: new Date().toISOString() })
    .eq('id', connectRequest.id)
    .is('used_at', null)
    .gt('expires_at', now)
    .select('id')
    .maybeSingle()
  if (!consumed) return new NextResponse('This GitHub connection link has already been used. Return to Telegram and use /connect again.', { status: 409 })

  const { data: savedInstallation, error: installationError } = await admin
    .from('github_app_installations')
    .upsert({
      owner_user_id: connectRequest.actor_user_id,
      github_installation_id: installationId,
      account_login: installation.account.login,
      status: 'active',
      last_verified_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'owner_user_id,github_installation_id' })
    .select('id')
    .single()
  if (installationError || !savedInstallation?.id) {
    await sendSafeTelegramUpdate(account.telegram_chat_id, 'NRS could not save that GitHub connection. No project was linked; use /connect to try again.')
    return new NextResponse('NRS could not save this GitHub connection.', { status: 500 })
  }

  const { data: savedRepositories, error: repositoryError } = await admin
    .from('github_installation_repositories')
    .upsert(repositories.map((repository) => ({
      installation_id: savedInstallation.id,
      github_repository_id: repository.id,
      full_name: repository.full_name,
      default_branch: repository.default_branch,
    })), { onConflict: 'installation_id,github_repository_id' })
    .select('id, github_repository_id')
  if (repositoryError) {
    await sendSafeTelegramUpdate(account.telegram_chat_id, 'NRS could not save the GitHub repository list. No project was linked; use /connect to try again.')
    return new NextResponse('NRS could not save the selected repositories.', { status: 500 })
  }

  const projectCandidates = (rawProjects ?? []) as Array<Record<string, unknown>>
  const matches = matchProjectsToInstalledRepositories(
    projectCandidates.flatMap((project) => typeof project.id === 'string'
      ? [{ brandId: project.id, repositoryUrl: typeof project.github_url === 'string' ? project.github_url : null }]
      : []),
    repositories.map((repository) => ({ id: repository.id, fullName: repository.full_name })),
  )
  const savedRepositoryByGitHubId = new Map(((savedRepositories ?? []) as Array<{ id: string; github_repository_id: number }>)
    .map((repository) => [repository.github_repository_id, repository.id]))
  const connectedProjects: ConnectedProject[] = []

  for (const match of matches) {
    const installationRepositoryId = savedRepositoryByGitHubId.get(match.repository.id)
    const project = projects.find((candidate) => candidate.id === match.brandId)
    const grant = grants.find((candidate) => candidate.brand_id === match.brandId)
    if (!installationRepositoryId || !project || !grant) continue

    const repository = repositories.find((candidate) => candidate.id === match.repository.id)
    if (!repository) continue
    const { error: bindingError } = await admin.from('github_repository_bindings').upsert({
      brand_id: project.id,
      installation_id: savedInstallation.id,
      installation_repository_id: installationRepositoryId,
      allowed_paths: [...GITHUB_PRODUCT_CONTEXT_PATHS],
      status: 'active',
    }, { onConflict: 'brand_id' })
    if (bindingError) continue

    const { error: connectorError } = await admin.from('project_connectors').upsert({
      brand_id: project.id,
      connector_type: 'github_app',
      display_name: 'Private GitHub product context',
      endpoint_url: `https://github.com/${repository.full_name}`,
      credential_reference: `github-installation:${savedInstallation.id}`,
      allowed_resources: [...GITHUB_PRODUCT_CONTEXT_PATHS, 'commit_metadata'],
      read_only: true,
      status: 'active',
      freshness_seconds: 86_400,
      last_checked_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'brand_id,connector_type' })
    if (connectorError) continue
    connectedProjects.push({ project, grant, repository })
  }

  const projectNames = connectedProjects.map(({ project }) => project.name)
  await sendSafeTelegramUpdate(
    account.telegram_chat_id,
    projectNames.length
      ? `GitHub is connected read-only for ${projectNames.join(', ')}. NRS is now running the project Discovery Run.`
      : 'GitHub was installed, but none of the selected repositories exactly matched a project GitHub URL in NRS. Nothing was connected to a project.',
  )

  if (connectedProjects.length) {
    after(async () => {
      for (const connected of connectedProjects) {
        const result = await runProjectDiscovery({
          supabase: admin,
          userId: connectRequest.actor_user_id,
          project: connected.project,
          githubApp,
          githubBinding: { installationId, repository: connected.repository },
        })
        const sourceSummary = `Source pass completed: GitHub ${result.github}; website ${result.website}; ${result.pagesFound} same-site sitemap page URLs found; social presence scan ${result.social}.`
        await deliverDiscoveryBrief({
          admin,
          actorUserId: connectRequest.actor_user_id,
          project: connected.project,
          grant: connected.grant,
          chatId: account.telegram_chat_id,
          sourceSummary,
        })
      }
    })
  }

  return successPage(projectNames.length
    ? 'GitHub is connected to the selected NRS project. Discovery is running in Telegram.'
    : 'GitHub was installed, but no selected repository matched a project GitHub URL in NRS.')
}
