import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { issueScopedMcpAccessKey } from '@/lib/auth/api-key'

export const dynamic = 'force-dynamic'

// List user's API keys
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, name, prefix, last_used_at, revoked_at, created_at, token_kind')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .eq('token_kind', 'access')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: projects, error: projectsError } = await supabase
    .from('brands')
    .select('id, name, slug')
    .order('name')

  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 })

  const keyIds = (keys ?? []).map((key) => key.id)
  const { data: mappings } = keyIds.length > 0
    ? await supabase
      .from('api_key_project_grants')
      .select('api_key_id, project_access_grants!inner(brand_id)')
      .in('api_key_id', keyIds)
    : { data: [] }

  const projectNames = new Map((projects ?? []).map((project) => [project.id, project.name]))
  const scopedKeys = (keys ?? []).map((key) => {
    const projectIds = (mappings ?? [])
      .filter((mapping) => mapping.api_key_id === key.id)
      .map((mapping) => (mapping.project_access_grants as unknown as { brand_id: string }).brand_id)
    return {
      ...key,
      projects: projectIds.map((id) => ({ id, name: projectNames.get(id) ?? 'Restricted project' })),
    }
  })

  return NextResponse.json({ keys: scopedKeys, projects: projects ?? [] })
}

// Create a new API key
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = (body.name || 'Untitled key').slice(0, 100)
  const untrustedProjectIds: unknown[] = Array.isArray(body.project_ids) ? body.project_ids : []
  const projectIds = [...new Set(
    untrustedProjectIds.filter((value): value is string => typeof value === 'string' && value.length > 0),
  )]

  if (projectIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one project for this connection.' }, { status: 400 })
  }

  const { data: permittedProjects, error: projectsError } = await supabase
    .from('brands')
    .select('id')
    .in('id', projectIds)

  if (projectsError || !permittedProjects || permittedProjects.length !== projectIds.length) {
    return NextResponse.json({ error: 'One or more selected projects are not available to you.' }, { status: 403 })
  }

  let key
  try {
    key = await issueScopedMcpAccessKey({
      userId: user.id,
      projectIds,
      name,
    })
  } catch {
    return NextResponse.json({ error: 'Could not create a scoped MCP key.' }, { status: 500 })
  }

  // Return the raw key exactly once — never stored, never retrievable again
  return NextResponse.json({ key: key.raw, prefix: key.prefix, name, project_ids: projectIds })
}

// Revoke an API key
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const keyId = searchParams.get('id')
  if (!keyId) return NextResponse.json({ error: 'Missing key ID' }, { status: 400 })

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revoked: true })
}
