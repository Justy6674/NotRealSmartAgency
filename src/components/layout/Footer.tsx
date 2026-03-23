import Link from 'next/link'
import { SITE_CONFIG, DISCLAIMER } from '@/lib/constants'

const footerLinks = {
  Product: [
    { label: 'Phases', href: '/#phases' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Diagnostic', href: '/diagnostic' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: 'mailto:hello@notrealsmart.com.au' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Not<span className="text-primary">Real</span>Smart
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              {SITE_CONFIG.tagline}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {SITE_CONFIG.company}
              <br />
              ABN {SITE_CONFIG.abn}
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-sm mb-3">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colours"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t py-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {DISCLAIMER.footer}
          </p>
        </div>
      </div>
    </footer>
  )
}
