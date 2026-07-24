'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function McpLoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])

  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const state = searchParams.get('state')
  const codeChallenge = searchParams.get('code_challenge')

  const isValid = clientId && redirectUri && state && codeChallenge

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError(null)

    try {
      // Use plain client with no session persistence — avoids auth token lock
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )

      let session: { access_token: string } | null = null
      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (authError) throw new Error(authError.message)
        if (!data?.session?.access_token) throw new Error('No session returned')
        session = data.session
      } catch (loginErr) {
        setError(loginErr instanceof Error ? loginErr.message : 'Login failed')
        setLoading(false)
        return
      }

      const { data: projectRows, error: projectsError } = await supabase
        .from('brands')
        .select('id, name, slug')
        .order('name')

      if (projectsError) throw new Error('Could not load your project workspaces')
      setProjects(projectRows ?? [])
      setAccessToken(session.access_token)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const handleScopeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || !accessToken || selectedProjectIds.length === 0) return

    setLoading(true)
    setError(null)
    try {
      // Generate the PKCE code only after the user has explicitly selected
      // the project set this external MCP connection may access.
      const res = await fetch('/api/mcp/code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          code_challenge: codeChallenge,
          redirect_uri: redirectUri,
          state,
          project_ids: selectedProjectIds,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error_description ?? 'Failed to generate auth code')
        setLoading(false)
        return
      }

      const { code } = await res.json()

      // Redirect back to Claude with the auth code
      const callbackUrl = new URL(redirectUri)
      callbackUrl.searchParams.set('code', code)
      callbackUrl.searchParams.set('state', state)
      window.location.href = callbackUrl.toString()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (!isValid) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-xl font-bold">Invalid request</h1>
        <p className="text-sm text-muted-foreground">
          This page is used by Claude to connect to your agency.
          Open Claude and add NotRealSmart as a connector.
        </p>
      </div>
    )
  }

  if (accessToken) {
    return (
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Choose projects for this connection</h1>
          <p className="text-sm text-muted-foreground">
            Claude will only be able to list and work inside the projects you select. You can create another connection later for a different project set.
          </p>
        </div>

        <form onSubmit={handleScopeSubmit} className="space-y-4">
          {projects.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.map((project) => {
                const selected = selectedProjectIds.includes(project.id)
                return (
                  <label key={project.id} className="flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => setSelectedProjectIds((current) => selected
                        ? current.filter((id) => id !== project.id)
                        : [...current, project.id])}
                      className="size-4 shrink-0"
                    />
                    <span className="min-w-0 truncate">{project.name}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              No project workspaces are available for this account yet.
            </p>
          )}

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || selectedProjectIds.length === 0}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect selected projects'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Connect your agency</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to give Claude access to your NotRealSmart marketing agency.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Connecting...' : 'Connect to Claude'}
        </button>
      </form>

      <p className="text-center text-[11px] text-muted-foreground">
        Don&apos;t have an account?{' '}
        <a href="/signup" className="underline">Sign up</a> first, then come back here.
      </p>

      <p className="text-center text-[10px] text-muted-foreground">
        NRS Agency by NotRealSmart &mdash; notrealsmart.com.au
      </p>
    </div>
  )
}

export default function McpLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }>
        <McpLoginForm />
      </Suspense>
    </div>
  )
}
