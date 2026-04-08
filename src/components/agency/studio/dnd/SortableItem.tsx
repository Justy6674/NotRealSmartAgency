'use client'

import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortableItemProps {
  id: string
  children: ReactNode
  /** Show a grab handle (default true) */
  showHandle?: boolean
}

/**
 * Generic sortable wrapper using @dnd-kit/sortable.
 * Wraps any content to make it draggable within a SortableContext.
 */
export function SortableItem({ id, children, showHandle = true }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-1">
        {showHandle && (
          <button
            type="button"
            className="cursor-grab rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
