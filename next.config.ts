import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep standalone tracing inside this app instead of inheriting an unrelated
  // workspace lockfile from the parent directory during Vercel builds.
  outputFileTracingRoot: process.cwd(),
  // Chromium resolves its Brotli browser pack at runtime. Keep that pack only
  // with routes that can run the rendered website audit, rather than relying
  // on static dependency tracing to discover a dynamically assembled path.
  // Native binaries the tracer cannot see, because their paths are resolved at
  // runtime rather than imported.
  //
  // ffmpeg-static was never traced at all, so EVERY route that touches video
  // failed in production with "spawn .next/server/chunks/ffmpeg ENOENT" — no
  // thumbnails, no delivery copies, and captions and trimming would have died
  // the same way. It worked perfectly on this machine, where node_modules is
  // simply there, which is exactly why it went unnoticed.
  //
  // And libass given a font it cannot find does not error — it renders a video
  // with no captions on it and reports success. So the subtitle font ships
  // alongside.
  outputFileTracingIncludes: {
    '/api/diagnostics/video': ['node_modules/ffmpeg-static/ffmpeg', 'assets/fonts/**'],
    '/api/media/process': ['node_modules/ffmpeg-static/ffmpeg', 'assets/fonts/**'],
    '/api/telegram/mini-app/upload': ['node_modules/ffmpeg-static/ffmpeg', 'assets/fonts/**'],
    '/api/chat': ['node_modules/@sparticuz/chromium/bin/**', 'assets/fonts/**', 'node_modules/ffmpeg-static/ffmpeg'],
    '/api/mcp': ['node_modules/@sparticuz/chromium/bin/**', 'assets/fonts/**', 'node_modules/ffmpeg-static/ffmpeg'],
    '/api/webhooks/telegram': ['node_modules/@sparticuz/chromium/bin/**', 'assets/fonts/**', 'node_modules/ffmpeg-static/ffmpeg'],
    '/api/telegram/mini-app/message': ['node_modules/@sparticuz/chromium/bin/**', 'assets/fonts/**', 'node_modules/ffmpeg-static/ffmpeg'],
    '/api/brands/\\[brandId\\]/review': ['node_modules/@sparticuz/chromium/bin/**'],
    '/api/integrations/github/callback': ['node_modules/@sparticuz/chromium/bin/**'],
  },
  // Keep ffmpeg unbundled, or it cannot find itself.
  //
  // `ffmpeg-static` locates its binary with path.join(__dirname, 'ffmpeg').
  // Bundled by webpack, __dirname becomes .next/server/chunks, so it looks for
  // /var/task/.next/server/chunks/ffmpeg — a path that has never existed.
  // Tracing the real binary in does not help on its own: the file lands under
  // node_modules and the code goes on looking in the chunks folder, which is
  // why the first attempt at this fixed nothing.
  serverExternalPackages: ['ffmpeg-static', 'fluent-ffmpeg'],
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
        /**
         * The service worker must never be served from a stale cache.
         *
         * A worker is the one file that can outlive a deploy: the browser keeps
         * running the copy it already has, and if that copy came back 304 from
         * an intermediary the site is pinned to an old one indefinitely. There
         * is no way for the owner to notice, and no way for them to fix it.
         * `no-cache` makes the browser revalidate every time, which is one
         * conditional request and buys the guarantee that a deploy actually
         * lands.
         *
         * `Service-Worker-Allowed: /` is belt and braces — the file already
         * sits at the root, so its default scope is / — but it means moving it
         * later cannot silently shrink what it covers.
         */
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
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
