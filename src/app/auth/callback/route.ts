import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin, hash } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const redirect = searchParams.get('redirect') ?? '/agency/chat'

  // Supabase PKCE flow: code is in query params
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if this is a password recovery flow
      if (type === 'recovery' || redirect === '/reset-password') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // Supabase implicit flow: token is in URL hash (handled client-side)
  // For recovery links, Supabase may use hash-based tokens
  // Redirect to a client page that can read the hash
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
