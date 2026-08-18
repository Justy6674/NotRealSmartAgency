'use client'

export const dynamic = 'force-dynamic'

import { use } from 'react'
import {
  EngagementDesk,
  ENGAGEMENT_TABS,
  type EngagementTab,
} from '@/components/agency/social/engagement/EngagementDesk'

interface PageProps {
  params: Promise<{ slug?: string[] }>
}

/**
 * Engagement — comments, messages, mentions and reviews.
 *
 * WHY THIS ROUTE AND NOT `/agency/social/inbox`: Engagement is section twelve
 * of the sidebar (DESIGN.md, "Twelve sections, in order"), with those four as
 * its named sub-items. An "Inbox" of its own is explicitly ruled out there, and
 * a second Engagement row under Social would have described one destination
 * twice in one column. So the four sidebar links keep their addresses and the
 * URL's last segment picks the tab — otherwise "Reviews" and "Comments" are the
 * same click with different words on it.
 *
 * WHAT CHANGED: this used to render a read-only list that could only ask the
 * Director to draft a reply. It now renders the desk that answers in place —
 * and every word that leaves it passes the same advertising review a post does.
 */
export default function EngagementDepartmentPage({ params }: PageProps) {
  const { slug } = use(params)
  const first = slug?.[0]
  const initialTab: EngagementTab = ENGAGEMENT_TABS.includes(first as EngagementTab)
    ? (first as EngagementTab)
    : 'comments'

  return <EngagementDesk initialTab={initialTab} />
}
