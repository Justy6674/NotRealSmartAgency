'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Check,
  Download,
  MoreVertical,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import type { MediaItemWithUsage } from '@/types/database'
import { MediaTile } from './MediaTile'
import { formatBytes, ownerWordFor } from '@/components/agency/studio/media/platform-limits'

/**
 * One file, the way the publishing tool the owner asked us to copy shows one.
 *
 * A square tile that is mostly picture, with everything else held back until
 * it is wanted: a tick in the top-left to gather files up, a three-dot menu in
 * the top-right for the things you do to one file, the run-time of a video in
 * the bottom-right, and the name along the bottom.
 *
 * ── Why the controls are not hover-only ────────────────────────────────
 * The obvious build reveals both buttons on `:hover`. On a phone there is no
 * hover — the first tap becomes the reveal and the second the action, if the
 * browser synthesises hover at all, and on many it simply never appears. Since
 * this desk has to work on a phone, the controls are always visible below the
 * `sm` breakpoint and only shy on a pointer device.
 */

interface MediaCardProps {
  item: MediaItemWithUsage
  selected: boolean
  /** True once anything is selected: the ticks stay out so the next is one tap. */
  selecting: boolean
  onToggleSelect: (id: string) => void
  onOpen: (item: MediaItemWithUsage) => void
  onAltText: (item: MediaItemWithUsage) => void
  onUseInPost?: (item: MediaItemWithUsage) => void
  onArchive: (item: MediaItemWithUsage) => void
  onDelete: (item: MediaItemWithUsage) => void
  /** "This video is too large for Instagram — trim it or pick another." */
  warning?: string | null
}

function altTextOf(item: MediaItemWithUsage): string {
  const raw = (item.metadata as { alt_text?: unknown } | null)?.alt_text
  return typeof raw === 'string' ? raw.trim() : ''
}

function attributionOf(item: MediaItemWithUsage): string {
  const raw = (item.metadata as { attribution?: unknown } | null)?.attribution
  return typeof raw === 'string' ? raw.trim() : ''
}

/** 9:07, or 0:42. Never "547 seconds", which is not a length anybody reads. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function MediaCard({
  item,
  selected,
  selecting,
  onToggleSelect,
  onOpen,
  onAltText,
  onUseInPost,
  onArchive,
  onDelete,
  warning,
}: MediaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [menuOpen])

  const isImage = item.file_type?.startsWith('image/') ?? false
  const isVideo = item.file_type?.startsWith('video/') ?? false
  const alt = altTextOf(item)
  const attribution = attributionOf(item)
  const reveal = selecting || selected ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'

  const menuItem =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-[var(--panel-2,oklch(0.975_0.004_240))]'

  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <div
        className={`group relative aspect-square overflow-hidden rounded-[12px] border transition-all ${
          item.is_archived ? 'opacity-60' : ''
        }`}
        style={{
          background: 'var(--panel-2, oklch(0.975 0.004 240))',
          borderColor: selected
            ? 'var(--brand, oklch(0.52 0.09 55))'
            : 'var(--line, oklch(0.915 0.007 240))',
          boxShadow: selected
            ? '0 0 0 2px var(--brand, oklch(0.52 0.09 55))'
            : 'var(--nrs-shadow, 0 1px 2px oklch(0.2 0.02 240 / .05))',
        }}
      >
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="absolute inset-0 h-full w-full"
          aria-label={`Open ${item.file_name}`}
        >
          <MediaTile
            fileType={item.file_type}
            fileUrl={item.file_url}
            thumbnailUrl={item.thumbnail_url}
          />
        </button>

        {/* Gather files up. Always reachable on a phone, shy on a mouse. */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleSelect(item.id)
          }}
          className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-opacity ${reveal}`}
          style={{
            borderColor: selected
              ? 'var(--brand, oklch(0.52 0.09 55))'
              : 'var(--line, oklch(0.915 0.007 240))',
            background: selected
              ? 'var(--brand-deep, oklch(0.33 0.07 55))'
              : 'var(--panel, oklch(1 0 0))',
            color: selected ? 'var(--brand-ink, oklch(1 0 0))' : 'var(--ink-3, oklch(0.615 0.011 240))',
          }}
          aria-pressed={selected}
          aria-label={selected ? `Deselect ${item.file_name}` : `Select ${item.file_name}`}
        >
          {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
        </button>

        <div className={`absolute right-2 top-2 z-20 transition-opacity ${reveal}`} ref={menuRef}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((open) => !open)
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-2, oklch(0.46 0.012 240))',
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`More for ${item.file_name}`}
          >
            <MoreVertical className="h-3.5 w-3.5" aria-hidden />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-8 z-30 w-44 overflow-hidden rounded-[10px] border py-1 shadow-lg"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
                color: 'var(--ink, oklch(0.20 0.014 240))',
              }}
            >
              {onUseInPost && !item.is_archived && (
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => {
                    setMenuOpen(false)
                    onUseInPost(item)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Use in a post
                </button>
              )}
              {isImage && (
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => {
                    setMenuOpen(false)
                    onAltText(item)
                  }}
                >
                  <Type className="h-3.5 w-3.5" aria-hidden />
                  {alt ? 'Edit description' : 'Add description'}
                </button>
              )}
              <a
                role="menuitem"
                href={item.file_url}
                target="_blank"
                rel="noreferrer"
                download
                className={menuItem}
                onClick={() => setMenuOpen(false)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download
              </a>
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                onClick={() => {
                  setMenuOpen(false)
                  onArchive(item)
                }}
              >
                {item.is_archived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                )}
                {item.is_archived ? 'Put back' : 'Put away'}
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                style={{ color: 'var(--st-fail, oklch(0.58 0.17 27))' }}
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(item)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* A picture with nothing saved for a screen reader to say reaches every
            platform that reads one with nothing to say. Invisible until publish
            time, and then too late — so it is shown on the file, where it can be
            filled in from the menu two centimetres away. Videos are exempt: the
            field is for stills. */}
        {isImage && !alt && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onAltText(item)
            }}
            className="absolute bottom-2 left-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: 'var(--panel, oklch(1 0 0))',
              border: '1px solid var(--line, oklch(0.915 0.007 240))',
              color: 'var(--ink-3, oklch(0.615 0.011 240))',
            }}
          >
            No description
          </button>
        )}

        {isVideo && item.duration_seconds != null && (
          <span
            className="absolute bottom-2 right-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ background: 'oklch(0.20 0.014 240 / .78)', color: 'oklch(1 0 0)' }}
          >
            {formatDuration(item.duration_seconds)}
          </span>
        )}

        {item.is_archived && (
          <span
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-3, oklch(0.615 0.011 240))',
            }}
          >
            Put away
          </span>
        )}
      </div>

      <figcaption className="min-w-0 px-0.5">
        <span
          className="block truncate text-[12px] font-medium"
          style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
          title={item.file_name}
        >
          {item.file_name}
        </span>
        <span className="block text-[10.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          {ownerWordFor(item.file_type)}
          {item.file_size_bytes ? ` · ${formatBytes(item.file_size_bytes)}` : ''}
        </span>
        {attribution && (
          <span className="block truncate text-[10.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
            {attribution}
          </span>
        )}
        {warning && (
          <span
            className="mt-1 block text-[10.5px] leading-snug"
            style={{ color: 'var(--warn, oklch(0.63 0.13 75))' }}
          >
            {warning}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
