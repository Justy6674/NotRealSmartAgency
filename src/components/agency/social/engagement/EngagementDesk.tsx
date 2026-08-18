'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useConversations } from '@/hooks/useEngagement'
import type { InboxItem } from '@/components/agency/inbox/types'
import { CommentsList } from './CommentsList'
import { ConversationList } from './ConversationList'
import { ConversationThread } from './ConversationThread'
import { MentionsList } from './MentionsList'
import { ReviewsList } from './ReviewsList'

/**
 * The Engagement desk — comments, messages, mentions and reviews in one place.
 *
 * ── What this is for ───────────────────────────────────────────────────
 * Publishing is only half of a social presence; the other half is what people
 * say back. For a business advertising a regulated health service, the half we
 * could not see was the half carrying the risk: a comment under its own post
 * making a claim it would never publish itself is still on its page, and
 * answering it badly is advertising it badly.
 *
 * ── The one rule this screen enforces ──────────────────────────────────
 * Nothing here sends words without the same review a post gets. Not a comment
 * reply, not a private message, not a review reply. A refusal is shown as an
 * answer with a reason, not as a failure.
 *
 * Automated outbound — rules that reply on a schedule, or on a keyword — is
 * deliberately absent. A business that advertises regulated health services
 * does not get an answering machine writing its advertising, and the review has
 * to sit in front of a person's judgement, not behind a vendor's rules engine.
 */

const INK = 'var(--ink, oklch(0.20 0.014 240))'
const INK_3 = 'var(--ink-3, oklch(0.615 0.011 240))'
const LINE = 'var(--line, oklch(0.915 0.007 240))'
const CARE = 'var(--care, oklch(0.52 0.150 25))'
const CARE_WASH = 'var(--care-wash, oklch(0.965 0.028 25))'

/** The four things people say back. Also the four sidebar sub-items. */
export type EngagementTab = 'comments' | 'messages' | 'mentions' | 'reviews'

export const ENGAGEMENT_TABS: readonly EngagementTab[] = [
  'comments',
  'messages',
  'mentions',
  'reviews',
]

export interface EngagementDeskProps {
  /**
   * Which of the four to open on. The sidebar names all four as separate
   * destinations, so the URL has to be able to say which one — otherwise
   * "Reviews" and "Comments" are the same click with different words on it.
   */
  initialTab?: EngagementTab
}

export function EngagementDesk({ initialTab = 'comments' }: EngagementDeskProps = {}) {
  const { activeBrandId } = useAgencyStore()
  const studio = useStudioData(activeBrandId)
  const [tab, setTab] = useState<EngagementTab>(initialTab)
  const [selected, setSelected] = useState<InboxItem | null>(null)

  const conversations = useConversations(activeBrandId)
  const waiting = conversations.items.filter((item) => item.state === 'needs_you').length

  const isHealthBrand = !!(
    studio.brand?.compliance_flags?.ahpra || studio.brand?.compliance_flags?.tga
  )

  if (!activeBrandId) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <p className="text-[13px]" style={{ color: INK_3 }}>
          Choose a business from the sidebar to see what people are saying.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 px-6 pt-5">
        <div className="flex items-end gap-4">
          <div>
            <h1 className="text-[19px] font-[700] tracking-tight" style={{ color: INK }}>
              What people are saying
            </h1>
            <p className="mt-0.5 text-[13px]" style={{ color: INK_3 }}>
              Comments, messages, mentions and reviews for{' '}
              {studio.brand?.name ?? 'this business'} — answer them here.
            </p>
          </div>
          {isHealthBrand ? (
            <span
              className="ml-auto mb-1 rounded-lg px-2.5 py-1 text-[11.5px] font-[600]"
              style={{ color: CARE, background: CARE_WASH }}
            >
              AHPRA applies — every reply is checked
            </span>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 px-6 py-4">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as EngagementTab)}
          className="flex h-full min-h-0 flex-col"
        >
          <TabsList variant="line" className="h-auto flex-wrap">
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="messages">
              Messages{waiting > 0 ? ` (${waiting})` : ''}
            </TabsTrigger>
            <TabsTrigger value="mentions">Mentions</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="min-h-0 flex-1 overflow-y-auto">
            <CommentsList brandId={activeBrandId} />
          </TabsContent>

          <TabsContent value="messages" className="min-h-0 flex-1">
            {/*
              * There is deliberately no "these are every connected account's
              * messages" notice any more. It used to appear when this business
              * had no publisher link — and it was describing a leak, not a
              * scope: the route answered that state with the whole team's
              * conversations. It now answers with none, and says why in the
              * list itself, so an unlinked business shows an explanation
              * instead of somebody else's customers.
              */}
            {conversations.accountsFailed > 0 ? (
              <p className="px-4 pt-2 text-[12px]" style={{ color: CARE }}>
                {conversations.accountsFailed === 1
                  ? 'One account could not be read this time, so this list may be short.'
                  : `${conversations.accountsFailed} accounts could not be read this time, so this list may be short.`}
              </p>
            ) : null}
            <div className="mt-2 grid h-full min-h-0 gap-0 md:grid-cols-[minmax(260px,340px)_1fr]">
              <div
                className="flex min-h-0 flex-col overflow-hidden border-r"
                style={{ borderColor: LINE }}
              >
                <ConversationList
                  items={conversations.items}
                  loading={conversations.loading}
                  problem={conversations.problem}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelected}
                />
              </div>
              <div className="min-h-0 overflow-hidden">
                <ConversationThread
                  brandId={activeBrandId}
                  item={selected}
                  onChanged={conversations.refresh}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mentions" className="min-h-0 flex-1 overflow-y-auto">
            <MentionsList brandId={activeBrandId} />
          </TabsContent>

          <TabsContent value="reviews" className="min-h-0 flex-1 overflow-y-auto">
            <ReviewsList brandId={activeBrandId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
