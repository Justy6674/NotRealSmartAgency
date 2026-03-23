import { SITE_CONFIG, DISCLAIMER } from '@/lib/constants'

export function AgencyFooter() {
  return (
    <footer className="px-6 py-12" style={{ background: 'oklch(0.06 0 0)' }}>
      <div className="mx-auto max-w-4xl">
        <hr style={{ borderColor: 'oklch(0.18 0 0)' }} />
        <div className="mt-8 text-center">
          <p className="text-xs" style={{ color: 'oklch(0.4 0 0)' }}>
            {SITE_CONFIG.company} | ABN {SITE_CONFIG.abn}
          </p>
          <p className="mt-3 max-w-2xl mx-auto text-[11px] leading-relaxed" style={{ color: 'oklch(0.35 0 0)' }}>
            {DISCLAIMER.footer}
          </p>
          <p className="mt-4 text-[11px]" style={{ color: 'oklch(0.3 0 0)' }}>
            &copy; {new Date().getFullYear()} {SITE_CONFIG.company}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
