import type { MetadataRoute } from 'next'

/**
 * The install manifest. This is what makes the desk a real app on a phone.
 *
 * ── Why the colours are hex and not oklch ────────────────────────────────
 * Everything else in this product is oklch, and DESIGN.md says so. The
 * manifest is the one place that rule does not hold, and it is not a style
 * choice.
 *
 * `theme_color` / `background_color` are read by things that are not a CSS
 * engine: Android mints a WebAPK from this file on Google's servers, iOS reads
 * it in the home-screen installer, and Windows reads it when it writes a Start
 * menu tile. Chromium's own manifest parser does understand modern colour
 * syntax, so oklch() "works" on a desktop dev machine — which is exactly the
 * trap. The pieces downstream of it do not all agree, and a colour they cannot
 * parse is not an error you see; it silently falls back to transparent, and you
 * get a black splash screen on someone's phone with no way to tell why.
 *
 * So the two values here are the sRGB renderings of the two house tokens they
 * came from, and the token is named beside each so they can be re-derived
 * rather than guessed at:
 *
 *   theme_color       #ffffff   --panel  oklch(1 0 0)          the desk chrome
 *   background_color  #f9fafb   --bg     oklch(0.985 0.002 240) the desk paper
 *
 * Both are the SIGNED-IN desk, deliberately, because `start_url` is /agency.
 * The installed app never opens on the marketing homepage, so its splash must
 * not be painted in the marketing homepage's charcoal.
 *
 * ── Why start_url is /agency and not / ───────────────────────────────────
 * Someone who has put this on their home screen has an account. Sending them
 * to the marketing site every time they tap the icon is a small insult. If
 * they are signed out, /agency redirects to the login screen on its own.
 *
 * ── Icons ────────────────────────────────────────────────────────────────
 * Two sets, and they are not interchangeable. `maskable` icons are cropped by
 * the OS to whatever shape that phone uses — a circle, a squircle, a rounded
 * square — so anything outside the middle 80% is liable to be cut off. Those
 * are drawn with the mark small and a lot of ground around it. The `any` icons
 * are never cropped, so the mark fills them. Ship only maskable and the mark
 * looks lost; ship only `any` and Android crops the mark's head off.
 *
 * All five are rendered from public/Favicon.png — the existing metal mark — on
 * the ink ground (--ink, oklch(0.20 0.014 240) → #10171c). The mark is silver;
 * on a white ground at 48px it disappears.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/agency',
    name: 'Not Real Smart',
    short_name: 'NotRealSmart',
    description:
      'Your marketing desk — write, review and schedule your posts from one screen.',
    start_url: '/agency',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    lang: 'en-AU',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    background_color: '#f9fafb',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Long-press the home screen icon. Both destinations are real screens; a
    // shortcut to a route that does not exist is a dead end the owner cannot
    // report, because it looks like the app is broken rather than the tile.
    shortcuts: [
      {
        name: 'Create a post',
        short_name: 'New post',
        url: '/agency/studio/create',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Waiting on you',
        short_name: 'Approvals',
        url: '/agency/approvals',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
