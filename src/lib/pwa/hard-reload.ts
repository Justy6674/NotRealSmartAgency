/**
 * Reload the running app, including a Dock / installed copy that keeps an
 * old page alive. A normal refresh is not enough when a worker or
 * Cache Storage still holds the last bundle.
 */
export async function hardReloadApp(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  const next = new URL(window.location.href)
  next.searchParams.set('_reload', String(Date.now()))
  window.location.replace(next.toString())
}
