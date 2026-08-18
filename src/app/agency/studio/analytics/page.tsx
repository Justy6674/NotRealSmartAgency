import { redirect } from 'next/navigation'

/**
 * Retired to a redirect.
 *
 * This was a second Performance screen — the same ten channel reports and the
 * same overview, one revision behind. When Social gained the four figures a
 * posting tool cannot answer (when to post, how long a post keeps earning, how
 * often to post, whether the following is growing) this copy did not, so the
 * same business could read two different answers depending on which door it
 * came through. DESIGN.md is explicit that Analytics nests under Social rather
 * than standing on its own, so Social is the one that survives.
 *
 * 307 rather than 308, for the reason spelled out in `studio/post/page.tsx`: a
 * permanent redirect is cached forever and reversing it would mean sending a
 * non-technical owner into his browser settings.
 */
export default function RetiredStudioAnalyticsPage() {
  redirect('/agency/social/analytics')
}
