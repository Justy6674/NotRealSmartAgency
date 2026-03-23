'use client'

import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
]

export function LandingNav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: 'linear-gradient(180deg, oklch(0.05 0 0 / 0.9) 0%, oklch(0.05 0 0 / 0.6) 70%, transparent 100%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/Favicon.png"
          alt="NRS"
          width={32}
          height={32}
          className="rounded"
        />
        <span
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: 'oklch(0.65 0.01 240)' }}
        >
          NRS Agency
        </span>
      </Link>

      <div className="hidden items-center gap-6 md:flex">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-xs font-medium uppercase tracking-widest transition-colors hover:text-white"
            style={{ color: 'oklch(0.6 0 0)' }}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="text-xs font-medium uppercase tracking-widest transition-colors hover:text-white"
          style={{ color: 'oklch(0.6 0 0)' }}
        >
          Log In
        </Link>
        <Link
          href="/agency/chat"
          className="rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all hover:brightness-125"
          style={{
            background: 'linear-gradient(135deg, oklch(0.7 0.005 250), oklch(0.45 0.008 240))',
            color: 'oklch(0.05 0 0)',
            borderColor: 'oklch(0.5 0.01 240 / 0.3)',
          }}
        >
          Enter
        </Link>
      </div>
    </nav>
  )
}
