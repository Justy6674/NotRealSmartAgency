'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Settings, User, Users } from 'lucide-react'

export function UserMenu() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
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
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline text-muted-foreground font-medium">Settings</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
            <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border mb-1">
              {email}
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
