'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Settings, User } from 'lucide-react'

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
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <User className="h-3 w-3 text-primary" />
        </div>
        <span className="hidden sm:inline text-muted-foreground truncate max-w-[120px]">
          {email}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
            <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border mb-1">
              {email}
            </div>
            <button
              onClick={() => { router.push('/agency/brands'); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-3.5 w-3.5" />
              Brand Settings
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
