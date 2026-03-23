import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // base-ui/shadcn v4 has a known prerendering issue with _global-error in Next.js 16
    // Type checking is handled by `npm run lint` separately
    ignoreBuildErrors: false,
  },
  experimental: {
    // Skip static prerendering of global error page (base-ui useContext issue)
    staticGenerationRetryCount: 0,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uyhtrwlotoriblicqqrl.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
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
