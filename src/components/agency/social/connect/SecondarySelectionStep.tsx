'use client'

import { useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'

import type { ConnectablePlatform } from './PlatformGrid'

/**
 * The second half of a connection, on our screen instead of theirs.
 *
 * Six platforms cannot finish a sign-in on their own: Facebook has to know
 * which Page, LinkedIn which company page, Pinterest which board, Google
 * Business which location, Snapchat which account, and Instagram-through-
 * Facebook which of the accounts attached to those Pages. The publisher will
 * host that step for us — and that is the moment the owner leaves our product,
 * lands on a company he has never heard of, and is asked to "select an entity"
 * for a business the screen cannot name. It is also the moment the connection
 * is most often abandoned, because the words are not about anything he
 * recognises.
 *
 * So the choice is made here: our chrome, our typeface, our sentences, the
 * business already decided. Each platform brings its own heading and its own
 * one-line explanation from `CONNECTABLE_PLATFORMS`, because "Choose which Page
 * to post to" and "Choose which board to pin to" are different decisions and a
 * shared "Select an option" would flatten both.
 *
 * ── Nothing is chosen by default ───────────────────────────────────────
 * Pre-selecting the first row would let an owner click Continue and connect a
 * Page he never looked at. A connection quietly pointed at the wrong Page is
 * discovered later, by a post arriving somewhere it should not have.
 */

/**
 * One row the owner can pick.
 *
 * This is deliberately the same shape as `ConnectChoice` in
 * `src/lib/zernio/connect.ts`, which is what the connect routes normalise every
 * platform's list into. It is restated rather than imported so a client
 * component does not reach into a module that opens `node:crypto`; if the two
 * ever drift, this is the copy that is wrong.
 *
 * `urn`, `vanityName` and `accountId` are carried through untouched and never
 * shown: LinkedIn wants the organisation's urn back when the choice is
 * submitted, and Google Business wants the account that owns the location. The
 * chosen row goes back whole for that reason — sending only an id silently
 * broke those two.
 */
export interface ConnectChoice {
  /** Opaque — the id the platform gave. Never shown. */
  id: string
  /** What the owner recognises: the Page name, the board name, the shopfront. */
  name: string
  /** A second line: the handle, the address, the category. */
  detail?: string
  /** Avatar or logo, when one came back. */
  imageUrl?: string
  urn?: string
  vanityName?: string
  accountId?: string
}

interface SecondarySelectionStepProps {
  platform: ConnectablePlatform
  choices: ConnectChoice[]
  /**
   * True when the list was cut short upstream. A business with hundreds of
   * shopfronts gets a bounded list, and saying so is the difference between
   * "yours is not here" and "keep typing".
   */
  hasMore?: boolean
  submitting?: boolean
  onConfirm: (choice: ConnectChoice) => void
  onCancel: () => void
}

/** Above this many rows, hunting by eye stops working and a filter earns itself. */
const FILTER_THRESHOLD = 8

export function SecondarySelectionStep({
  platform,
  choices,
  hasMore,
  submitting,
  onConfirm,
  onCancel,
}: SecondarySelectionStepProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const showFilter = choices.length > FILTER_THRESHOLD || hasMore === true

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return choices
    return choices.filter(
      (choice) =>
        choice.name.toLowerCase().includes(needle) ||
        (choice.detail ?? '').toLowerCase().includes(needle),
    )
  }, [choices, query])

  const selected = choices.find((choice) => choice.id === selectedId) ?? null

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
          {platform.choiceHeading ?? `Choose where to post on ${platform.label}`}
        </h4>
        {platform.choiceHelp ? (
          <p
            className="mt-1 text-[12.5px] leading-relaxed"
            style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
          >
            {platform.choiceHelp}
          </p>
        ) : null}
      </div>

      {choices.length === 0 ? (
        // Honest empty state. The sign-in worked; there was simply nothing on
        // the other side of it, and the owner needs to know which of those two
        // things happened.
        <p
          className="rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed"
          style={{
            borderColor: 'var(--warn, oklch(0.63 0.13 75))',
            background: 'var(--warn-wash, oklch(0.964 0.052 80))',
            color: 'var(--ink, oklch(0.20 0.014 240))',
          }}
        >
          You signed in, but {platform.label} did not offer anything this business can post to. That
          usually means the account you signed in with does not manage one yet. Nothing has been
          connected and nothing has been changed.
        </p>
      ) : (
        <>
          {showFilter ? (
            <label className="relative block">
              <span className="sr-only">Search the list</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Start typing to narrow the list"
                className="w-full rounded-lg border py-2 pl-8 pr-3 text-[13px] outline-none"
                style={{
                  borderColor: 'var(--line, oklch(0.915 0.007 240))',
                  background: 'var(--panel, oklch(1 0 0))',
                  color: 'var(--ink, oklch(0.20 0.014 240))',
                }}
              />
            </label>
          ) : null}

          <div
            role="radiogroup"
            aria-label={platform.choiceHeading ?? `Where to post on ${platform.label}`}
            className="max-h-[38vh] space-y-1.5 overflow-y-auto"
          >
            {visible.map((choice) => {
              const isSelected = choice.id === selectedId
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={submitting}
                  onClick={() => setSelectedId(choice.id)}
                  className="flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors disabled:opacity-60"
                  style={{
                    borderColor: isSelected
                      ? 'var(--brand, oklch(0.545 0.03 240))'
                      : 'var(--line, oklch(0.915 0.007 240))',
                    background: isSelected
                      ? 'var(--brand-wash, oklch(0.966 0.0068 240))'
                      : 'var(--panel, oklch(1 0 0))',
                  }}
                >
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full border"
                    style={{
                      borderColor: isSelected
                        ? 'var(--brand-deep, oklch(0.33 0.0209 240))'
                        : 'var(--line, oklch(0.915 0.007 240))',
                    }}
                    aria-hidden
                  >
                    {isSelected ? (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: 'var(--brand-deep, oklch(0.33 0.0209 240))' }}
                      />
                    ) : null}
                  </span>

                  {choice.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatars come from the platform's own CDN, which is not in next.config's image allowlist and must not be added there for one 26px chip.
                    <img
                      src={choice.imageUrl}
                      alt=""
                      className="h-[26px] w-[26px] shrink-0 rounded-full object-cover"
                    />
                  ) : null}

                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13px] font-semibold"
                      style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
                    >
                      {choice.name}
                    </span>
                    {choice.detail ? (
                      <span
                        className="block truncate text-[11.5px]"
                        style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
                      >
                        {choice.detail}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}

            {visible.length === 0 ? (
              <p className="px-1 py-2 text-[12.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
                Nothing matches “{query.trim()}”.
              </p>
            ) : null}
          </div>

          {hasMore ? (
            <p className="text-[11.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
              This is not the whole list — there are more than we can show at once. Type part of the
              name above to find yours.
            </p>
          ) : null}
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border px-3 py-2 text-[12.5px] font-semibold disabled:opacity-60"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          Back
        </button>
        <button
          type="button"
          disabled={!selected || submitting}
          onClick={() => selected && onConfirm(selected)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          style={{
            background: 'var(--brand-deep, oklch(0.33 0.0209 240))',
            color: 'var(--brand-ink, oklch(1 0 0))',
          }}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {selected ? `Post to ${selected.name}` : 'Choose one to continue'}
        </button>
      </div>
    </div>
  )
}
