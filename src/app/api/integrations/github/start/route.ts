import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGitHubAppConfig, gitHubAppInstallUrlWithState } from '@/lib/github/github-app'
import { hashGitHubConnectState } from '@/lib/github/project-connection'

export const runtime = 'nodejs'

const CONNECT_STATE = /^[A-Za-z0-9_-]{40,128}$/

/**
 * Telegram opens this short-lived bridge. It validates the one-use hand-off
 * before redirecting to GitHub, without exposing owner/project metadata.
 */
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')
  const config = getGitHubAppConfig()
  if (!config || !state || !CONNECT_STATE.test(state)) {
    return new NextResponse('This GitHub connection link is unavailable.', { status: 410 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('github_connect_requests')
    .select('id')
    .eq('state_hash', hashGitHubConnectState(state))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!data) {
    return new NextResponse('This GitHub connection link has expired. Return to Telegram and use /connect again.', { status: 410 })
  }

  return NextResponse.redirect(gitHubAppInstallUrlWithState(config, state))
}
