import { redirect } from 'next/navigation'

/**
 * Retired to a redirect.
 *
 * The Engagement desk lives at `/agency/engagement`, which is where the sidebar
 * has always pointed and which DESIGN.md names as section twelve. This address
 * existed for one build only, was never linked from anywhere, and two doors
 * onto the same desk is how the two of them start disagreeing. Never add a
 * feature here.
 */
export default function RetiredSocialInboxPage() {
  redirect('/agency/engagement')
}
