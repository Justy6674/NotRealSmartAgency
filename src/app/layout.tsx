import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Providers } from '@/providers/Providers'
import { constructMetadata } from '@/lib/seo'
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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
