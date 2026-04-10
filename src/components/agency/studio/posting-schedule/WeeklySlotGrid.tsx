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
import { PLATFORM_BRAND_COLOURS, PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import type { PostingScheduleSlot } from '@/types/database'

const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface WeeklySlotGridProps {
  slots: PostingScheduleSlot[]
  /** Map of slotId → number of scheduled posts queued at that slot. */
  queuedCounts?: Record<string, number>
  onAddSlot: (dayOfWeek: number) => void
  onEditSlot: (slot: PostingScheduleSlot) => void
  onMoveSlot: (slotId: string, newDayOfWeek: number) => void
  onDeleteSlot: (slotId: string) => void
}

export function WeeklySlotGrid({
  slots,
  queuedCounts = {},
  onAddSlot,
  onEditSlot,
  onMoveSlot,
  onDeleteSlot,
}: WeeklySlotGridProps) {
  // Group slots by day
  const slotsByDay = React.useMemo(() => {
    const map: PostingScheduleSlot[][] = [[], [], [], [], [], [], []]
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
    const slotId = String(active.id)
    const overId = String(over.id)
    if (!overId.startsWith('day-')) return
    const newDay = parseInt(overId.replace('day-', ''), 10)
    if (Number.isNaN(newDay)) return
    const slot = slots.find((s) => s.id === slotId)
    if (!slot || slot.day_of_week === newDay) return
    onMoveSlot(slotId, newDay)
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
            queuedCounts={queuedCounts}
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
  slots: PostingScheduleSlot[]
  queuedCounts: Record<string, number>
  onAddSlot: (dayOfWeek: number) => void
  onEditSlot: (slot: PostingScheduleSlot) => void
  onDeleteSlot: (slotId: string) => void
}

function DayColumn({
  dayOfWeek,
  label,
  shortLabel,
  slots,
  queuedCounts,
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
        <span className="text-xs text-muted-foreground">{slots.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {slots.map((slot) => (
          <SlotChip
            key={slot.id}
            slot={slot}
            queued={queuedCounts[slot.id] ?? 0}
            onEdit={() => onEditSlot(slot)}
            onDelete={() => onDeleteSlot(slot.id)}
          />
        ))}

        {slots.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-2 py-3 text-center text-xs text-muted-foreground">
            No slots
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
        Add slot
      </Button>
    </div>
  )
}

interface SlotChipProps {
  slot: PostingScheduleSlot
  queued: number
  onEdit: () => void
  onDelete: () => void
}

function SlotChip({ slot, queued, onEdit, onDelete }: SlotChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: slot.id })

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {}

  const platformKey = slot.platform as PlatformKey
  const colour = PLATFORM_BRAND_COLOURS[platformKey] ?? '#888'
  const label = PLATFORM_LABELS[platformKey] ?? slot.platform

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 text-xs shadow-sm transition-shadow',
        isDragging ? 'opacity-60 shadow-md' : 'hover:border-foreground/30 hover:shadow',
      )}
    >
      {/* Drag handle: the body */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={onEdit}
        className="flex flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing"
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: colour }}
        />
        <span className="font-mono tabular-nums">{formatTime(slot.time)}</span>
        <span className="truncate text-muted-foreground">{label}</span>
        {queued > 0 ? (
          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {queued}
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
        aria-label="Delete slot"
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

function formatTime(time: string): string {
  // Postgres returns "HH:MM:SS"; trim to "HH:MM"
  const [h = '00', m = '00'] = time.split(':')
  return `${h}:${m}`
}
