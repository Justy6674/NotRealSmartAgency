import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — accept a team invitation
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { token } = await request.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = createAdminClient()

  // Find invite by token
  const { data: invite } = await admin
    .from('team_members')
    .select('*')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 })
  }

  // Verify email matches
  if (invite.member_email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({
      error: `This invitation was sent to ${invite.member_email}. Please log in with that email.`,
    }, { status: 403 })
  }

  // Accept
  const { data, error } = await admin
    .from('team_members')
    .update({
      member_id: user.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      invite_token: null,
    })
    .eq('id', invite.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
