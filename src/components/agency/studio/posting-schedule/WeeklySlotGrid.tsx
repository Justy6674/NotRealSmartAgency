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
import { Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'

const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * One time on the weekly grid.
 *
 * `platform` is null on a business whose schedule is the real queue: the queue
 * belongs to the business, not to one network, and pretending otherwise would
 * invite the owner to build a Facebook-only grid the queue would ignore.
 */
export interface DeskScheduleSlot {
  id: string
  day_of_week: number
  /** "HH:MM". */
  time: string
  platform: string | null
  /** Posts the queue says are actually going out at this time. */
  upcoming: number
}

export interface WeeklySlotGridProps {
  slots: DeskScheduleSlot[]
  /** True when the counts come from the real queue and mean something. */
  countsAreReal: boolean
  onAddSlot: (dayOfWeek: number) => void
  onEditSlot: (slot: DeskScheduleSlot) => void
  onMoveSlot: (slotId: string, newDayOfWeek: number) => void
  onDeleteSlot: (slotId: string) => void
}

export function WeeklySlotGrid({
  slots,
  countsAreReal,
  onAddSlot,
  onEditSlot,
  onMoveSlot,
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {DAY_LABELS_FULL.map((label, dayIdx) => (
          <DayColumn
            key={dayIdx}
            dayOfWeek={dayIdx}
            label={label}
            shortLabel={DAY_LABELS_SHORT[dayIdx]!}
            slots={slotsByDay[dayIdx]!}
            countsAreReal={countsAreReal}
            onAddSlot={onAddSlot}
            onEditSlot={onEditSlot}
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
  onAddSlot: (dayOfWeek: number) => void
  onEditSlot: (slot: DeskScheduleSlot) => void
  onDeleteSlot: (slotId: string) => void
}

function DayColumn({
  dayOfWeek,
  label,
  shortLabel,
  slots,
  countsAreReal,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayOfWeek}` })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[260px] flex-col rounded-lg border bg-card p-3 transition-colors',
        isOver ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">
          <span className="hidden md:inline">{label}</span>
          <span className="md:hidden">{shortLabel}</span>
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">{slots.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {slots.map((slot) => (
          <SlotChip
            key={slot.id}
            slot={slot}
            countsAreReal={countsAreReal}
            onEdit={() => onEditSlot(slot)}
            onDelete={() => onDeleteSlot(slot.id)}
          />
        ))}

        {slots.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-2 py-3 text-center text-xs text-muted-foreground">
            No times
          </p>
        ) : null}
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
      </Button>
    </div>
  )
}

interface SlotChipProps {
  slot: DeskScheduleSlot
  countsAreReal: boolean
  onEdit: () => void
  onDelete: () => void
}

function SlotChip({ slot, countsAreReal, onEdit, onDelete }: SlotChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: slot.id })

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs shadow-sm transition-shadow',
        isDragging ? 'opacity-60 shadow-md' : 'hover:border-foreground/30 hover:shadow',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={onEdit}
        className="flex flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing"
      >
        <span className="font-mono tabular-nums">{slot.time}</span>
        {slot.platform && (
          <span className="truncate text-muted-foreground">
            {ownerFacingPlatformLabel(slot.platform)}
          </span>
        )}
        {/* The count only appears when it is a measurement. It used to be a
            permanent 0 because nothing ever wrote a queue assignment. */}
        {countsAreReal && slot.upcoming > 0 ? (
          <span
            className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
        aria-label="Remove this time"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  )
}

function clampDay(day: number): number {
  if (day < 0) return 0
  if (day > 6) return 6
  return Math.floor(day)
}
