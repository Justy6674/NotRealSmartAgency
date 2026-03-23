import Link from 'next/link'
import { SITE_CONFIG, DISCLAIMER } from '@/lib/constants'

export function AgencyFooter() {
  return (
    <footer className="relative z-20 px-6 py-10" style={{ background: 'oklch(0.06 0 0)' }}>
      <div className="mx-auto max-w-5xl">
        <hr style={{ borderColor: 'oklch(0.15 0 0)' }} />

        <div className="mt-8 flex flex-col items-center gap-6 md:flex-row md:justify-between">
          {/* Links */}
          <div className="flex gap-6 text-xs uppercase tracking-widest" style={{ color: 'oklch(0.4 0 0)' }}>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            <a href={`mailto:${SITE_CONFIG.contactEmail}`} className="transition-colors hover:text-white">Contact</a>
          </div>

          {/* Company */}
          <p className="text-xs" style={{ color: 'oklch(0.35 0 0)' }}>
            {SITE_CONFIG.company} | ABN {SITE_CONFIG.abn}
          </p>
        </div>

        <p className="mt-6 mx-auto max-w-2xl text-center text-[11px] leading-relaxed" style={{ color: 'oklch(0.3 0 0)' }}>
          {DISCLAIMER.footer}
        </p>

        <p className="mt-4 text-center text-[11px]" style={{ color: 'oklch(0.25 0 0)' }}>
          &copy; {new Date().getFullYear()} {SITE_CONFIG.company}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
