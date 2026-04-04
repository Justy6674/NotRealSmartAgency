export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InviteAcceptClient } from '@/components/agency/InviteAcceptClient'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  // Fetch invite by token (admin client — user may not be logged in)
  const { data: invite } = await admin
    .from('team_members')
    .select('*, owner:users!team_members_owner_id_fkey(full_name, email)')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Invitation Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation has expired, been revoked, or was already accepted.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ownerData = invite.owner as { full_name: string | null; email: string } | null
  const ownerName = ownerData?.full_name || ownerData?.email || 'Someone'

  // Get brand names if specific brands
  let brandNames = 'all brands'
  if (invite.brand_ids?.length) {
    const { data: brands } = await admin
      .from('brands')
      .select('name')
      .in('id', invite.brand_ids)
    brandNames = brands?.map((b: { name: string }) => b.name).join(', ') || 'selected brands'
  }

  // If logged in and email matches — show accept button
  if (user && user.email?.toLowerCase() === invite.member_email.toLowerCase()) {
    return (
      <InviteAcceptClient
        token={token}
        ownerName={ownerName}
        role={invite.role}
        brandNames={brandNames}
      />
    )
  }

  // If logged in but wrong email
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Wrong Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation was sent to <strong>{invite.member_email}</strong>.
            You&apos;re logged in as <strong>{user.email}</strong>.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please log out and sign in with the correct email.
          </p>
        </div>
      </div>
    )
  }

  // Not logged in — check if user exists
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', invite.member_email)
    .single()

  const encodedEmail = encodeURIComponent(invite.member_email)
  const encodedRedirect = encodeURIComponent(`/invite/${token}`)

  if (existingUser) {
    redirect(`/login?redirect=${encodedRedirect}`)
  } else {
    redirect(`/signup?redirect=${encodedRedirect}&email=${encodedEmail}`)
  }
}
