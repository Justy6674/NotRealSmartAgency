'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function McpLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Read OAuth params from URL
  const params = typeof window !== 'undefined' ? new URL(window.location.href).searchParams : null
  const clientId = params?.get('client_id')
  const redirectUri = params?.get('redirect_uri')
  const state = params?.get('state')
  const codeChallenge = params?.get('code_challenge')

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

      if (authError || !data.user) {
        setError(authError?.message ?? 'Login failed')
        setLoading(false)
        return
      }

      // Generate auth code on the server
      const res = await fetch('/api/mcp/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold">Invalid request</h1>
          <p className="text-sm text-muted-foreground">
            This page is used by Claude Desktop to connect to your agency.
            Open Claude Desktop and add NotRealSmart as a connector.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
    </div>
  )
}
