'use client'

import { useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { SortableItem } from './SortableItem'

interface SortableImageGridProps {
  /** Array of image objects with id and url */
  items: { id: string; url: string; name?: string }[]
  /** Called with the new order after a drag */
  onReorder: (newItems: { id: string; url: string; name?: string }[]) => void
  /** Render each item (receives the item + index) */
  renderItem?: (item: { id: string; url: string; name?: string }, index: number) => React.ReactNode
}

/**
 * A sortable grid of images using @dnd-kit.
 * Drag to reorder. Touch-friendly.
 */
export function SortableImageGrid({ items, onReorder, renderItem }: SortableImageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    onReorder(arrayMove(items, oldIndex, newIndex))
  }, [items, onReorder])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item, index) => (
            <SortableItem key={item.id} id={item.id} showHandle={false}>
              {renderItem ? renderItem(item, index) : (
                <div className="relative aspect-square overflow-hidden rounded-lg cursor-grab active:cursor-grabbing">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.name ?? ''}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute top-1 left-1 rounded-full bg-black/60 w-5 h-5 flex items-center justify-center text-[9px] font-bold text-white">
                    {index + 1}
                  </div>
                </div>
              )}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
