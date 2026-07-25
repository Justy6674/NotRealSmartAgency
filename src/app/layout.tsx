import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Providers } from '@/providers/Providers'
import { HelpSearchOverlay } from '@/components/help/HelpSearchOverlay'
import { constructMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
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

export const metadata: Metadata = constructMetadata()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/Favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/Favicon.png" />
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
        </Providers>
      </body>
    </html>
  )
}
