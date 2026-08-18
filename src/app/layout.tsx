import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Providers } from '@/providers/Providers'
import { HelpSearchOverlay } from '@/components/help/HelpSearchOverlay'
import { constructMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar'
import { SITE_CONFIG } from '@/lib/constants'
import './globals.css'

const ibmSans = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
})

const ibmMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  ...constructMetadata(),
  applicationName: 'Not Real Smart',
  /**
   * Overrides constructMetadata()'s pair, which pointed BOTH the favicon and
   * the Apple touch icon at the raw 2000x2000 mark. iOS composites a
   * transparent PNG onto black and then rounds it, so that came out as a black
   * tile with a dark smudge in it; the touch icon is now the 180px render on
   * the ink ground. Set here rather than as a hand-written <link> in <head>,
   * or Next emits its tag alongside ours and the browser picks whichever it
   * likes.
   */
  icons: {
    icon: '/Favicon.png',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  /**
   * iOS reads none of the manifest until the page is added to the home screen,
   * and even then it takes the standalone flag and the title from these tags
   * rather than from manifest.ts. Leave them out and an installed iOS icon
   * opens Safari with its address bar still on screen — which looks like the
   * install did not work.
   */
  appleWebApp: {
    capable: true,
    title: 'Not Real Smart',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

/**
 * `viewport` is its own export, NOT a key inside `metadata`.
 *
 * Next moved it out in 14 and warns rather than errors when it is left in the
 * wrong place, so the tag silently stops being emitted and the phone falls back
 * to a 980px desktop viewport — every screen zoomed out and unreadable, with a
 * build that passed.
 *
 * ── viewportFit: 'cover' ─────────────────────────────────────────────────
 * Required before env(safe-area-inset-*) returns anything but zero. The shell
 * reads those insets, so without this the drawer and the mobile bar sit under
 * the notch and the home indicator on every iPhone.
 *
 * ── maximumScale ─────────────────────────────────────────────────────────
 * 5, not 1. Pinch-zoom is how a person with poor eyesight reads a 12.5px label,
 * and locking it is the single most common accessibility fault in an installed
 * web app. The keyboard-zoom annoyance it is usually set to 1 to avoid is
 * already handled: no input in this product is below 16px on a phone.
 *
 * ── themeColor ───────────────────────────────────────────────────────────
 * One value, matching --panel (oklch(1 0 0)) — the desk chrome. Not a
 * light/dark pair keyed to the OS: the signed-in desk is paper in BOTH themes
 * (globals.css pins color-scheme:light on [data-nrs-shell]), so a dark variant
 * here would paint the browser chrome charcoal above a white page.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        {/*
          Next emits the standard `mobile-web-app-capable`, which WebKit only
          started reading in Safari 17.4. Below that — and there are a lot of
          iPhones below that — the ONLY thing that makes an installed icon open
          without Safari's address bar is Apple's own deprecated tag. It costs
          one line and it is the difference between "the app installed" and "the
          app installed but it still looks like a website".
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${ibmSans.variable} ${ibmMono.variable} antialiased`}
        style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
      >
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', '@id': `${SITE_CONFIG.url}/#organization`, name: SITE_CONFIG.name, url: SITE_CONFIG.url, description: SITE_CONFIG.description, legalName: SITE_CONFIG.company, identifier: SITE_CONFIG.abn },
            { '@type': 'SoftwareApplication', '@id': `${SITE_CONFIG.url}/#application`, name: SITE_CONFIG.name, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: SITE_CONFIG.url, description: SITE_CONFIG.description, creator: { '@id': `${SITE_CONFIG.url}/#organization` } },
            { '@type': 'WebSite', '@id': `${SITE_CONFIG.url}/#website`, name: SITE_CONFIG.name, url: SITE_CONFIG.url, publisher: { '@id': `${SITE_CONFIG.url}/#organization` } },
          ],
        }} />
        <Providers>
          {children}
          <HelpSearchOverlay />
          {/* Renders nothing. Registers the offline helper, production only. */}
          <ServiceWorkerRegistrar />
        </Providers>
      </body>
    </html>
  )
}
