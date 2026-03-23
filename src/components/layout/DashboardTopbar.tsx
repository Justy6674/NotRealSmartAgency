'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings, CreditCard, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { TIER_CONFIG } from '@/lib/constants'
import type { User } from '@/types/database'

interface DashboardTopbarProps {
  profile: User | null
}

export function DashboardTopbar({ profile }: DashboardTopbarProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleManageBilling = async () => {
    const response = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url } = await response.json()
    if (url) window.location.href = url
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : profile?.email?.charAt(0).toUpperCase() ?? '?'

  const tierConfig = TIER_CONFIG[profile?.subscription_tier ?? 'free']

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={tierConfig.colour}>
          {tierConfig.label}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full" />}>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-sm font-medium">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/dashboard" />}>
              <Settings className="mr-2 h-4 w-4" />
              Dashboard
            </DropdownMenuItem>
            {profile?.subscription_tier !== 'free' && (
              <DropdownMenuItem onClick={handleManageBilling}>
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
