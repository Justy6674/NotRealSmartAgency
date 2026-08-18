'use client'

export const dynamic = 'force-dynamic'

import { MediaLibraryPane } from '@/components/agency/studio/media/MediaLibraryPane'

/**
 * The Social desk's media library.
 *
 * The department shell already supplies the scrolling, padded pane — it is the
 * only scroller in Social. This page used to wrap the library in a second
 * `overflow-y-auto` and the library added its own 26px on top of the shell's,
 * so the screen scrolled twice and sat 52px off the left edge.
 *
 * It renders the four-door library the owner asked for by name and by shape:
 * Uploads, Stock photos, GIFs, Designs, one square grid behind all four.
 */
export default function SocialMediaPage() {
  return <MediaLibraryPane />
}
