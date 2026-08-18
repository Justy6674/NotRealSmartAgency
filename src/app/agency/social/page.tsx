import { redirect } from 'next/navigation'

/**
 * The Social department's front door is Compose, but it does not DRAW Compose.
 *
 * Two routes rendering the composer component is the same fault that retired
 * /agency/studio/post: every compliance rule, platform limit and media
 * constraint has to be written twice, they drift, and the owner cannot tell
 * which composer he is standing in. So this route redirects and nothing else —
 * /agency/social/compose is the single composer, and safety-slice.test.ts fails
 * the build if this file so much as names the component again.
 *
 * The tab strip still lights "Compose" afterwards: socialTabIdFromPath() maps
 * both `/agency/social` and `/agency/social/compose` to the same tab id.
 */
export default function SocialComposePage() {
  redirect('/agency/social/compose')
}
