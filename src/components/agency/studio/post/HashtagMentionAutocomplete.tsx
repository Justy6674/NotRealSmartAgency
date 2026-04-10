'use client'

/**
 * TipTap Mention extension wrapper for hashtag + mention autocomplete.
 *
 * Phase 3 of the Mixpost UI port — matches Mixpost's PostTags.vue
 * (205 LOC) hashtag + mention autocomplete but wired to NRS's own
 * hashtag_groups table + brand team member list instead of Mixpost's
 * per-account entity store.
 *
 * This exports a factory function `createHashtagMentionExtensions(opts)`
 * that returns an array of TipTap extensions — the caller spreads them
 * into StarterKit's extensions list inside RichCaptionEditor.
 *
 * Triggers:
 *   #  → hashtag autocomplete, suggestions from hashtag_groups[*].tags
 *        for the active brand
 *   @  → mention autocomplete, suggestions from team_members for the
 *        active brand (falls back to an empty list if team members API
 *        not yet wired)
 *
 * The callbacks are plain fetch calls so the component stays server-agnostic.
 */

import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

interface SuggestionItem {
  id: string
  label: string
}

interface FetchSuggestionsArgs {
  query: string
  brandId: string | null
}

type SuggestionFetcher = (args: FetchSuggestionsArgs) => Promise<SuggestionItem[]>

interface CreateHashtagMentionOpts {
  brandId: string | null
  fetchHashtags?: SuggestionFetcher
  fetchMentions?: SuggestionFetcher
}

// ── Default fetchers ─────────────────────────────────────────────────────────

/** Default hashtag fetcher — pulls from /api/hashtag-groups for the brand
 *  and flattens tag arrays into a single suggestion list. */
const defaultFetchHashtags: SuggestionFetcher = async ({ query, brandId }) => {
  if (!brandId) return []
  try {
    const res = await fetch(`/api/hashtag-groups?brandId=${brandId}`)
    if (!res.ok) return []
    const groups = (await res.json()) as Array<{ name: string; tags: string[] }>
    const allTags = new Set<string>()
    for (const g of groups) {
      for (const t of g.tags ?? []) allTags.add(t.replace(/^#/, ''))
    }
    const q = query.toLowerCase()
    return Array.from(allTags)
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 10)
      .map((t) => ({ id: t, label: t }))
  } catch {
    return []
  }
}

/** Default mention fetcher — returns empty for now. Wire to /api/team when
 *  the team members endpoint supports brand-filtered lookups. */
const defaultFetchMentions: SuggestionFetcher = async () => []

// ── Suggestion list component (rendered via tippy inside TipTap) ─────────────

interface SuggestionListProps {
  items: SuggestionItem[]
  command: (item: SuggestionItem) => void
}

interface SuggestionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

const SuggestionList = forwardRef<SuggestionListHandle, SuggestionListProps>(
  function SuggestionList({ items, command }, ref) {
    const [selected, setSelected] = useState(0)

    useEffect(() => setSelected(0), [items])

    useImperativeHandle(ref, () => ({
      onKeyDown(event: KeyboardEvent): boolean {
        if (event.key === 'ArrowUp') {
          setSelected((s) => (s + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelected((s) => (s + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          const item = items[selected]
          if (item) command(item)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground shadow-lg">
          No matches
        </div>
      )
    }

    return (
      <div className="rounded-lg border border-border bg-background py-1 shadow-lg min-w-[180px]">
        {items.map((item, i) => (
          <button
            type="button"
            key={item.id}
            onClick={() => command(item)}
            className={`block w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
              i === selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    )
  },
)

// ── Extension factory ────────────────────────────────────────────────────────

function buildMentionExtension(
  char: '#' | '@',
  fetcher: SuggestionFetcher,
  brandId: string | null,
) {
  return Mention.extend({ name: char === '#' ? 'hashtag' : 'mention' }).configure({
    HTMLAttributes: {
      class: char === '#' ? 'text-[oklch(0.55_0.15_240)]' : 'text-[oklch(0.55_0.15_145)]',
    },
    renderText({ options, node }) {
      return `${char}${node.attrs.label ?? node.attrs.id}`
    },
    suggestion: {
      char,
      items: ({ query }: { query: string }) => fetcher({ query, brandId }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (): any => {
        let reactRenderer: ReactRenderer<SuggestionListHandle, SuggestionListProps>
        let popup: TippyInstance[]

        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStart: (props: any) => {
            reactRenderer = new ReactRenderer<SuggestionListHandle, SuggestionListProps>(SuggestionList, {
              props: {
                items: props.items,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                command: (item: SuggestionItem) =>
                  (props.command as (x: { id: string; label?: string }) => void)({ id: item.id, label: item.label }),
              },
              editor: props.editor,
            })
            if (!props.clientRect) return
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: reactRenderer.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            })
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onUpdate: (props: any) => {
            reactRenderer?.updateProps({
              items: props.items,
              command: (item: SuggestionItem) =>
                (props.command as (x: { id: string; label?: string }) => void)({ id: item.id, label: item.label }),
            })
            if (!props.clientRect) return
            popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect })
          },
          onKeyDown: (props: { event: KeyboardEvent }) => {
            if (props.event.key === 'Escape') {
              popup?.[0]?.hide()
              return true
            }
            return reactRenderer?.ref?.onKeyDown(props.event) ?? false
          },
          onExit: () => {
            popup?.[0]?.destroy()
            reactRenderer?.destroy()
          },
        }
      },
    },
  })
}

/**
 * Build the pair of mention extensions (hashtag + @mention) to spread into
 * TipTap's extensions array inside RichCaptionEditor.
 */
export function createHashtagMentionExtensions(opts: CreateHashtagMentionOpts) {
  const { brandId, fetchHashtags = defaultFetchHashtags, fetchMentions = defaultFetchMentions } = opts
  return [
    buildMentionExtension('#', fetchHashtags, brandId),
    buildMentionExtension('@', fetchMentions, brandId),
  ]
}
