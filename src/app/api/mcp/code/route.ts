import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Generate an OAuth authorization code after the user logs in.
 * Called by the /mcp-login page with the Supabase access token in Authorization header.
 */
export async function POST(request: Request) {
  // Verify user via Bearer token (passed directly from signInWithPassword result)
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'unauthorized', error_description: 'Missing authorization' },
      { status: 401 }
    )
  }

  const accessToken = authHeader.slice(7)

  // Validate the Supabase JWT to get the user
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)

  if (authError || !user) {
    return NextResponse.json(
      { error: 'unauthorized', error_description: 'Invalid token' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { client_id, code_challenge, redirect_uri, state, project_ids } = body as {
    client_id: string
    code_challenge: string
    redirect_uri: string
    state: string
    project_ids?: unknown
  }

  if (!client_id || !code_challenge || !redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing parameters' },
      { status: 400 }
    )
  }

  const untrustedProjectIds: unknown[] = Array.isArray(project_ids) ? project_ids : []
  const projectIds = [...new Set(
    untrustedProjectIds.filter((value): value is string => typeof value === 'string' && value.length > 0),
  )]
  if (projectIds.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Select at least one project for this connection' },
      { status: 400 },
    )
  }

  const scopedSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  )
  const { data: permittedProjects, error: projectsError } = await scopedSupabase
    .from('brands')
    .select('id')
    .in('id', projectIds)

  if (projectsError || !permittedProjects || permittedProjects.length !== projectIds.length) {
    return NextResponse.json(
      { error: 'access_denied', error_description: 'One or more selected projects are not available to you' },
      { status: 403 },
    )
  }

  // Validate client exists
  const admin = createAdminClient()
  const { data: client } = await admin
    .from('oauth_clients')
    .select('redirect_uris')
    .eq('client_id', client_id)
    .single()

  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Unknown client or redirect_uri mismatch' },
      { status: 400 }
    )
  }

  // Generate a random auth code
  const code = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

  // Store it (expires in 5 minutes)
  const { error } = await admin.from('oauth_auth_codes').insert({
    code,
    client_id,
    user_id: user.id,
    code_challenge,
    redirect_uri,
    state,
    project_ids: projectIds,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  if (error) {
    return NextResponse.json(
      { error: 'server_error', error_description: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ code })
}
