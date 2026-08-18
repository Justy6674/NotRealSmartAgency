'use client'

import * as React from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'
import { DAY_NAMES, DAY_NAMES_SHORT, friendlyTime, joinNames } from './rhythms'

/**
 * One time on the weekly grid.
 *
 * `platforms` is EMPTY for almost every time, and empty means everywhere: a
 * posting time belongs to the business, not to one network. It is only filled
 * when a time reaches some of the connected accounts and not all of them, which
 * the local table can express and older rows sometimes do — and in that case
 * the chip says so out loud rather than letting the owner assume otherwise.
 */
export interface DeskScheduleSlot {
  id: string
  day_of_week: number
  /** "HH:MM". */
  time: string
  platforms: string[]
  /** Posts the queue says are actually going out at this time. */
  upcoming: number
}

/** How far one press of the nudge arrows moves a time. */
export const NUDGE_MINUTES = 15

export interface WeeklySlotGridProps {
  slots: DeskScheduleSlot[]
  /** True when the counts come from the real queue and mean something. */
  countsAreReal: boolean
  /** Owner-facing names of everywhere a time posts, for the empty chip's copy. */
  accountNames: readonly string[]
  onAddSlot: (dayOfWeek: number) => void
  onEditSlot: (slot: DeskScheduleSlot) => void
  onMoveSlot: (slotId: string, newDayOfWeek: number) => void
  onNudgeSlot: (slotId: string, minutes: number) => void
  onDeleteSlot: (slotId: string) => void
}

export function WeeklySlotGrid({
  slots,
  countsAreReal,
  accountNames,
  onAddSlot,
  onEditSlot,
  onMoveSlot,
  onNudgeSlot,
  onDeleteSlot,
}: WeeklySlotGridProps) {
  const slotsByDay = React.useMemo(() => {
    const map: DeskScheduleSlot[][] = [[], [], [], [], [], [], []]
    for (const slot of slots) {
      const day = clampDay(slot.day_of_week)
      map[day]!.push(slot)
    }
    for (const dayList of map) {
      dayList.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    }
    return map
  }, [slots])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    if (!overId.startsWith('day-')) return
    const newDay = parseInt(overId.replace('day-', ''), 10)
    if (Number.isNaN(newDay)) return
    const slot = slots.find((s) => s.id === id)
    if (!slot || slot.day_of_week === newDay) return
    onMoveSlot(id, newDay)
  }

  const empty = slots.length === 0

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {DAY_NAMES.map((label, dayIdx) => (
          <DayColumn
            key={dayIdx}
            dayOfWeek={dayIdx}
            label={label}
            shortLabel={DAY_NAMES_SHORT[dayIdx]!}
            slots={slotsByDay[dayIdx]!}
            countsAreReal={countsAreReal}
            accountNames={accountNames}
            /* An empty week is answered by the rhythm cards above, so the seven
               columns stay short and quiet rather than being seven tall boxes
               each saying "No times" — which is what made this screen read as
               broken rather than as new. */
            compact={empty}
            onAddSlot={onAddSlot}
            onEditSlot={onEditSlot}
            onNudgeSlot={onNudgeSlot}
            onDeleteSlot={onDeleteSlot}
          />
        ))}
      </div>
    </DndContext>
  )
}

interface DayColumnProps {
  dayOfWeek: number
  label: string
  shortLabel: string
  slots: DeskScheduleSlot[]
  countsAreReal: boolean
  accountNames: readonly string[]
  compact: boolean
  onAddSlot: (dayOfWeek: number) => void
  onEditSlot: (slot: DeskScheduleSlot) => void
  onNudgeSlot: (slotId: string, minutes: number) => void
  onDeleteSlot: (slotId: string) => void
}

function DayColumn({
  dayOfWeek,
  label,
  shortLabel,
  slots,
  countsAreReal,
  accountNames,
  compact,
  onAddSlot,
  onEditSlot,
  onNudgeSlot,
  onDeleteSlot,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayOfWeek}` })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg border p-3 transition-colors',
        compact ? 'min-h-0' : 'min-h-[220px]',
      )}
      style={{
        borderColor: isOver ? 'var(--brand, var(--border))' : 'var(--line, var(--border))',
        background: isOver ? 'var(--brand-wash, transparent)' : 'var(--card, transparent)',
      }}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">
          <span className="hidden md:inline">{label}</span>
          <span className="md:hidden">{shortLabel}</span>
        </h3>
        {slots.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">{slots.length}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {slots.map((slot) => (
          <SlotChip
            key={slot.id}
            slot={slot}
            countsAreReal={countsAreReal}
            accountNames={accountNames}
            onEdit={() => onEditSlot(slot)}
            onNudge={(minutes) => onNudgeSlot(slot.id, minutes)}
            onDelete={() => onDeleteSlot(slot.id)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 w-full text-xs"
        onClick={() => onAddSlot(dayOfWeek)}
      >
        <Plus className="mr-1 size-3" />
        Add a time
        <span className="sr-only"> on {label}</span>
      </Button>
    </div>
  )
}

interface SlotChipProps {
  slot: DeskScheduleSlot
  countsAreReal: boolean
  accountNames: readonly string[]
  onEdit: () => void
  onNudge: (minutes: number) => void
  onDelete: () => void
}

function SlotChip({ slot, countsAreReal, accountNames, onEdit, onNudge, onDelete }: SlotChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: slot.id })

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {}

  // Named networks mean this time does NOT cover everything. Saying nothing
  // would let the owner read a partial time as a whole one.
  const partial = slot.platforms.length > 0
  const covers = partial
    ? joinNames(slot.platforms.map(ownerFacingPlatformLabel))
    : accountNames.length > 0
      ? joinNames([...accountNames])
      : 'every account you have connected'

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderColor: 'var(--line, var(--border))',
        background: 'var(--panel, var(--background))',
      }}
      className={cn(
        'group relative flex flex-col gap-1 rounded-md border px-2 py-1.5 text-xs shadow-sm transition-shadow',
        isDragging ? 'opacity-60 shadow-md' : 'hover:shadow',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={onEdit}
          title={`Posts to ${covers}`}
          className="flex flex-1 cursor-grab items-center gap-1.5 text-left active:cursor-grabbing"
        >
          <span className="font-mono tabular-nums font-semibold">{friendlyTime(slot.time)}</span>
          {/* The count only appears when it is a measurement. It used to be a
              permanent 0 because nothing ever wrote a queue assignment. */}
          {countsAreReal && slot.upcoming > 0 ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
              style={{
                background: 'var(--brand-wash, oklch(0.966 0.0068 240))',
                color: 'var(--brand-deep, currentColor)',
              }}
              title={`${slot.upcoming} coming up at this time`}
            >
              {slot.upcoming}
            </span>
          ) : null}
        </button>

        {/*
          Buttons, not only drag. One of the two people who uses this screen
          works entirely from what is on the glass, so "move it a bit later"
          has to be pressable — a drag-only affordance is a feature she does
          not have.
        */}
        <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onNudge(-NUDGE_MINUTES)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Make ${friendlyTime(slot.time)} ${NUDGE_MINUTES} minutes earlier`}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onNudge(NUDGE_MINUTES)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Make ${friendlyTime(slot.time)} ${NUDGE_MINUTES} minutes later`}
          >
            <ChevronDown className="size-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            style={{ color: 'var(--st-fail, oklch(0.58 0.17 27))' }}
            aria-label={`Remove ${friendlyTime(slot.time)}`}
          >
            <Trash2 className="size-3" />
          </button>
        </span>
      </div>

      {partial && (
        <span className="truncate text-[10.5px] text-muted-foreground" title={covers}>
          {covers} only
        </span>
      )}
    </div>
  )
}

function clampDay(day: number): number {
  if (day < 0) return 0
  if (day > 6) return 6
  return Math.floor(day)
}
