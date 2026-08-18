import { redirect } from 'next/navigation'

/**
 * Retired to a redirect.
 *
 * An "Inbox" of its own is ruled out in DESIGN.md ("Do not add a thirteenth
 * (Review, Inbox, and 'Waiting on you' as a place are all wrong)"). What lived
 * here was a read-only list that could only ask the Director to draft a reply,
 * beside a desk at `/agency/engagement` that answers in place and puts every
 * word through the advertising review. Two lists of the same conversations is
 * how they start disagreeing about who is still waiting.
 */
export default function RetiredInboxPage() {
  redirect('/agency/engagement')
}
