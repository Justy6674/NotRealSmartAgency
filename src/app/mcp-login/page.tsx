'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function McpLoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError || !data.session) {
        setError(authError?.message ?? 'Login failed')
        setLoading(false)
        return
      }

      // Generate auth code on the server — pass access token directly
      // (cookies aren't ready yet due to Supabase lock timing)
      const res = await fetch('/api/mcp/code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          code_challenge: codeChallenge,
          redirect_uri: redirectUri,
          state,
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
