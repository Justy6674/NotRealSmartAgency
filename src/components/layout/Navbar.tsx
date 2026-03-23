'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const navLinks = [
  { label: 'Phases', href: '/#phases' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Diagnostic', href: '/diagnostic' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, loading } = useAuth()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            Not<span className="text-primary">Real</span>Smart
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colours"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {!loading && (
            <>
              {user ? (
                <Button render={<Link href="/dashboard" />}>Dashboard</Button>
              ) : (
                <>
                  <Button render={<Link href="/login" />} variant="ghost">Log in</Button>
                  <Button render={<Link href="/signup" />}>Get Started</Button>
                </>
              )}
            </>
          )}
        </div>

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" />} className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-6 mt-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-lg font-medium"
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t pt-6 flex flex-col gap-3">
                {user ? (
                  <Button render={<Link href="/dashboard" onClick={() => setOpen(false)} />}>
                      Dashboard
                  </Button>
                ) : (
                  <>
                    <Button render={<Link href="/login" onClick={() => setOpen(false)} />} variant="outline">
                        Log in
                    </Button>
                    <Button render={<Link href="/signup" onClick={() => setOpen(false)} />}>
                        Get Started
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
