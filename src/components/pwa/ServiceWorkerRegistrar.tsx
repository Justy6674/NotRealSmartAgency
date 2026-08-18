'use client'

import { useEffect } from 'react'

/**
 * Turns the worker on. Renders nothing.
 *
 * ── Production only, and the else branch is not tidiness ─────────────────
 * In development the worker's cache-first rule for /_next/static/ would serve
 * yesterday's chunk while Turbopack is busy rebuilding today's, and the symptom
 * is an edit that "did not take" — which is a very expensive hour. Worse, a
 * worker registered once during a dev session survives into every later visit
 * to localhost:3000, including the next feature. So dev does not merely skip
 * registering: it actively unregisters anything already installed and drops the
 * caches, so a machine that ran an older build cleans itself up without anyone
 * having to be told to open browser settings.
 *
 * ── After `load`, deliberately ───────────────────────────────────────────
 * Registration competes for bandwidth with the page that is still arriving.
 * Waiting for `load` costs nothing on a second visit (the worker is already
 * there) and keeps the first one from being slower for the sake of the second.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister()
      })
      if ('caches' in window) {
        void caches.keys().then((names) => {
          for (const name of names) if (name.startsWith('nrs-')) void caches.delete(name)
        })
      }
      return
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        // Never surfaced. A worker that will not install is a slower app, not a
        // broken one, and there is nothing the owner could do about it.
        console.error('[pwa] the offline helper could not start', err)
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
