'use client'

import { useState } from 'react'
import { Check, Plus, Tag } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LABEL_COLOURS, type PostLabel } from '@/lib/posts/post-labels'

/**
 * The label chip, and the menu that puts one on a post.
 *
 * Labels are the owner's own filing system — "offer", "clinic", "before &
 * after" — and they exist because the publisher has no tag taxonomy at all.
 * Creating one is deliberately part of this menu rather than a settings page:
 * the moment a person wants a label is the moment they are looking at the post
 * that needs it, and sending them somewhere else to make it is how a feature
 * quietly goes unused.
 */

export function LabelChip({ label, onRemove }: { label: PostLabel; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex max-w-[140px] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        // A wash of the label's own colour rather than the colour itself, so a
        // row of chips reads as filing and never competes with the status dot.
        backgroundColor: `color-mix(in oklch, ${label.colour} 16%, transparent)`,
        color: label.colour,
      }}
    >
      <span
        aria-hidden
        className="inline-block h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ backgroundColor: label.colour }}
      />
      <span className="truncate">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 shrink-0 opacity-60 hover:opacity-100"
          aria-label={`Remove ${label.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}

interface PostLabelPickerProps {
  /** Every label the business has. */
  available: PostLabel[]
  /** The ids currently on this post. */
  selectedIds: string[]
  onChange: (labelIds: string[]) => void
  /** Creates a new label and returns it, so it can be applied straight away. */
  onCreate: (name: string, colour: string) => Promise<PostLabel | null>
  /** Rendered instead of the default button when given. */
  triggerLabel?: string
  disabled?: boolean
}

export function PostLabelPicker({
  available,
  selectedIds,
  onChange,
  onCreate,
  triggerLabel,
  disabled = false,
}: PostLabelPickerProps) {
  const [newName, setNewName] = useState('')
  const [colourIndex, setColourIndex] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = new Set(selectedIds)

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  const create = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    setError(null)
    try {
      const made = await onCreate(name, LABEL_COLOURS[colourIndex % LABEL_COLOURS.length]!)
      if (!made) {
        setError('That label could not be added.')
        return
      }
      setNewName('')
      setColourIndex((index) => index + 1)
      onChange(Array.from(new Set([...selectedIds, made.id])))
    } finally {
      setCreating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button {...props} variant="outline" size="sm" disabled={disabled}>
            <Tag className="mr-1" />
            {triggerLabel ?? (selectedIds.length > 0 ? `${selectedIds.length} labels` : 'Labels')}
          </Button>
        )}
      />
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Labels</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {available.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-muted-foreground">
            No labels yet. Add one below.
          </p>
        ) : (
          available.map((label) => (
            <DropdownMenuItem
              key={label.id}
              closeOnClick={false}
              onClick={(event) => {
                event.preventDefault()
                toggle(label.id)
              }}
              className="justify-between"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-[8px] w-[8px] shrink-0 rounded-full"
                  style={{ backgroundColor: label.colour }}
                />
                <span className="truncate">{label.name}</span>
              </span>
              {selected.has(label.id) && <Check className="ml-2 h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <span
            aria-hidden
            className="inline-block h-[10px] w-[10px] shrink-0 rounded-full"
            style={{ backgroundColor: LABEL_COLOURS[colourIndex % LABEL_COLOURS.length] }}
          />
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void create()
              }
              event.stopPropagation()
            }}
            placeholder="New label"
            className="h-7 text-[12px]"
            maxLength={40}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void create()}
            disabled={creating || newName.trim().length === 0}
            aria-label="Add label"
          >
            <Plus />
          </Button>
        </div>
        {error && <p className="px-2 pb-2 text-[11px] text-destructive">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
