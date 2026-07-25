import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep standalone tracing inside this app instead of inheriting an unrelated
  // workspace lockfile from the parent directory during Vercel builds.
  outputFileTracingRoot: process.cwd(),
  // Chromium resolves its Brotli browser pack at runtime. Keep that pack only
  // with routes that can run the rendered website audit, rather than relying
  // on static dependency tracing to discover a dynamically assembled path.
  outputFileTracingIncludes: {
    '/api/chat': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/mcp': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/webhooks/telegram': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/telegram/mini-app/message': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/brands/\\[brandId\\]/review': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/integrations/github/callback': ['node_modules/@sparticuz/chromium/bin/**'],
  },
  transpilePackages: ['three'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uyhtrwlotoriblicqqrl.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons**',
      },
      {
        protocol: 'https',
        hostname: '**.com.au',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/favicon-64.png',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/well-known/oauth-authorization-server',
      },
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/well-known/oauth-protected-resource',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default nextConfig
