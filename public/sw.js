/* eslint-disable */
/**
 * The service worker. Hand-rolled, on purpose, and deliberately small.
 *
 * ── Why not a library ────────────────────────────────────────────────────
 * next-pwa is unmaintained and pins an old Workbox. Serwist works but wants a
 * build step, a webpack plugin and a source file that Turbopack and the
 * production Webpack build have to agree about — and the production build here
 * is the one thing that must not become fragile, because a broken build takes
 * the whole desk down and the owner cannot read the error. This file is plain
 * JavaScript served straight out of /public. Nothing compiles it, so nothing
 * about it can fail a deploy.
 *
 * ── What it does NOT cache, and why that is the important part ───────────
 * This is a multi-tenant product on a device that may be shared. Every rule
 * below is about one failure: person A's numbers still being on the screen
 * after person B signs in, served out of a cache that has no idea anyone
 * signed out.
 *
 *   · /api/* is never touched. Not cached, not read from cache, not even
 *     inspected — the request goes straight to the network. Every figure the
 *     desk draws about a business comes through there.
 *   · Server-component payloads (?_rsc=, or Accept: text/x-component) are the
 *     same data in a different wrapper. Also never touched.
 *   · Navigations (the HTML) are network-only. The signed-in pages are
 *     rendered on the server WITH the business's content already in them, so a
 *     cached copy is a copy of somebody's data. When the network is gone the
 *     answer is the offline card below, never a stale page.
 *
 * What IS cached is the build's own static output — the JavaScript, the CSS,
 * the fonts, the icons. Those are content-hashed, identical for everyone, and
 * carry nothing about anyone. That is what makes a second launch instant, and
 * it is the whole benefit; caching pages on top of it would buy a little more
 * speed and risk the one thing worth protecting.
 */

const VERSION = 'nrs-v1'
const STATIC_CACHE = `${VERSION}-static`

/* Only these. Everything else falls through to the network untouched. */
const STATIC_PREFIXES = ['/_next/static/', '/icons/']
const STATIC_EXACT = ['/Favicon.png', '/Logo.png']

/**
 * The offline card, built in the worker rather than fetched from a file.
 *
 * A precached /offline page would be one more thing to keep in step with the
 * design and one more request that can fail during install — and an install
 * that fails takes the whole worker with it, including the static caching that
 * actually earns its keep. Colours are the sRGB renderings of the house tokens
 * (--bg, --ink, --ink-3, --panel, --line); this string cannot read CSS
 * variables, so they are written out with the token named beside them.
 */
const OFFLINE_HTML = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>No connection</title>
<style>
  :root{
    --bg:#f9fafb;      /* --bg     oklch(0.985 0.002 240) */
    --panel:#ffffff;   /* --panel  oklch(1 0 0)           */
    --line:#dfe4e7;    /* --line   oklch(0.915 0.007 240) */
    --ink:#10171c;     /* --ink    oklch(0.20 0.014 240)  */
    --ink-3:#7f868b;   /* --ink-3  oklch(0.615 0.011 240) */
  }
  html,body{height:100%;margin:0}
  body{
    background:var(--bg);color:var(--ink);
    font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
    font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;
    display:grid;place-items:center;
    padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));
  }
  .card{
    background:var(--panel);border:1px solid var(--line);border-radius:12px;
    padding:26px 24px;max-width:23rem;text-align:center;
    box-shadow:0 1px 2px rgb(16 23 28 / .05),0 8px 24px -16px rgb(16 23 28 / .28);
  }
  h1{font-size:19px;font-weight:600;letter-spacing:-.015em;margin:0 0 8px}
  p{margin:0;color:var(--ink-3);font-size:13px}
  button{
    margin-top:20px;min-height:44px;width:100%;
    background:#2c373f;color:#fff;border:0;border-radius:10px;
    font:600 13px/1 inherit;letter-spacing:.02em;cursor:pointer;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>You are offline</h1>
    <p>Your work is safe. Reconnect and this will pick up where you left off.</p>
    <button type="button" onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function isStaticAsset(url) {
  if (STATIC_EXACT.includes(url.pathname)) return true
  return STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
}

self.addEventListener('install', () => {
  /**
   * Nothing is precached. The build's asset names are only knowable at build
   * time and this file is not built, so a precache list here would be a list of
   * guesses — and a guess that 404s makes `addAll` reject, which fails the
   * install and leaves the site with no worker at all. Assets land in the cache
   * the first time the browser asks for them, which is a few hundred
   * milliseconds later on the very first visit and free every visit after.
   */
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith('nrs-') && name !== STATIC_CACHE)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

/**
 * A signed-out or switched account must not be able to read the previous one's
 * anything. Static assets carry nothing personal, but clearing on demand costs
 * nothing and removes the argument.
 */
self.addEventListener('message', (event) => {
  const type = event.data && event.data.type
  if (type === 'SKIP_WAITING') self.skipWaiting()
  if (type === 'NRS_CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n.startsWith('nrs-')).map((n) => caches.delete(n))),
      ),
    )
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  /* Someone else's origin is someone else's problem. */
  if (url.origin !== self.location.origin) return

  /* Tenant data, in both of its shapes. Never inspected, never stored. */
  if (url.pathname.startsWith('/api/')) return
  if (url.searchParams.has('_rsc')) return
  if ((request.headers.get('accept') || '').includes('text/x-component')) return

  /* The build's own output: cache-first, because it is content-hashed and can
     never go stale under its own name. */
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const hit = await cache.match(request)
        if (hit) return hit
        try {
          const response = await fetch(request)
          /* Only a clean, complete answer is worth keeping. An opaque or
             partial one cached here would be served forever as if it were the
             real file. */
          if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone())
          }
          return response
        } catch (err) {
          const stale = await cache.match(request, { ignoreSearch: true })
          if (stale) return stale
          throw err
        }
      })(),
    )
    return
  }

  /* Pages: network only, offline card as the floor. No HTML is ever stored. */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          return offlineResponse()
        }
      })(),
    )
  }
})
