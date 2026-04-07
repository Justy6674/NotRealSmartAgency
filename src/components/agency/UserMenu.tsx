'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Settings, User, Users } from 'lucide-react'

export function UserMenu() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      setEmail(user?.email ?? null)
      const name =
        user?.user_metadata?.full_name ??
        user?.user_metadata?.name ??
        null
      setDisplayName(name)
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!email) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-muted border border-transparent hover:border-border"
      >
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0"
          style={{ background: 'oklch(0.25 0.04 240)', color: 'oklch(0.75 0.06 240)' }}
        >
          {(displayName ?? email ?? '?').charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:inline text-muted-foreground font-medium max-w-[120px] truncate">
          {displayName ?? email?.split('@')[0] ?? 'Account'}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
            <div className="px-3 py-2 border-b border-border mb-1">
              {displayName && (
                <div className="text-xs font-medium text-foreground">{displayName}</div>
              )}
              <div className="text-xs text-muted-foreground truncate">{email}</div>
            </div>
            <button
              onClick={() => { router.push('/agency/settings'); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <User className="h-3.5 w-3.5" />
              Agency Settings
            </button>
            <button
              onClick={() => { router.push('/agency/brands'); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-3.5 w-3.5" />
              Brand Settings
            </button>
            <button
              onClick={() => { router.push('/agency/team'); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Users className="h-3.5 w-3.5" />
              Team
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
