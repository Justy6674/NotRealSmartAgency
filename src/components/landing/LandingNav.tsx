'use client'

import Image from 'next/image'
import Link from 'next/link'

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/Favicon.png"
          alt="NRS"
          width={36}
          height={36}
          className="rounded"
        />
        <span
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: 'oklch(0.65 0.01 240)' }}
        >
          NRS Agency
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="text-xs font-medium uppercase tracking-widest transition-colors hover:text-white"
          style={{ color: 'oklch(0.5 0 0)' }}
        >
          Log In
        </Link>
        <Link
          href="/agency/chat"
          className="rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, oklch(0.7 0.01 240), oklch(0.45 0.01 240))',
            color: 'oklch(0.05 0 0)',
          }}
        >
          Enter
        </Link>
      </div>
    </nav>
  )
}
