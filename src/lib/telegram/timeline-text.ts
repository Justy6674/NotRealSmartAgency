/**
 * The marketing data boundary, applied structurally.
 *
 * Every user-visible string leaves through here. The switch is exhaustive with
 * a `never` check, so adding an event kind without declaring which of its
 * fields are model-authored FAILS TO COMPILE. The boundary stops being
 * something anyone has to remember.
 *
 * That is deliberate. The check already existed and was applied on the chat
 * path only — which receives no traffic — while the Mini App handed the same
 * text over unchecked. It was not forgotten through carelessness; it was
 * forgotten because nothing made it impossible to forget.
 */

import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import type { TimelineSourceEvent } from './timeline'

const WITHHELD = 'NRS withheld that response because it did not meet the project marketing data boundary.'

function allowed(text: string): boolean {
  if (!text.trim()) return true
  return inspectMarketingInput(text).allowed
}

/**
 * Returns the event unchanged when everything passes, or with its
 * model-authored text replaced and `withheld` set when it does not.
 *
 * The owner's OWN words are never inspected. He wrote them; withholding a
 * message back from the person who typed it protects nobody and would make the
 * screen lie about what he said.
 */
export function sanitiseTimelineEvent(event: TimelineSourceEvent): TimelineSourceEvent {
  const payload = event.payload

  switch (payload.kind) {
    case 'user_message':
    case 'media_upload':
    case 'director_pending':
      return event

    case 'director_error':
      // Written by us, not by a model.
      return event

    case 'director_reply': {
      if (allowed(payload.text)) return event
      return { ...event, payload: { ...payload, text: WITHHELD, withheld: true } }
    }

    case 'proposal': {
      const suspect = [payload.opener, payload.hook, payload.caption]
      if (suspect.every(allowed)) return event
      return {
        ...event,
        payload: {
          ...payload,
          opener: WITHHELD,
          hook: '',
          caption: '',
          hashtags: [],
          withheld: true,
        },
      }
    }

    default: {
      // A new event kind must declare its text fields above before it compiles.
      const exhaustive: never = payload
      return exhaustive
    }
  }
}

export function sanitiseTimeline(events: readonly TimelineSourceEvent[]): TimelineSourceEvent[] {
  return events.map(sanitiseTimelineEvent)
}
