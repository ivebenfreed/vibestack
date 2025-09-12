/**
 * KanbanCard - Generic draggable card component
 */

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { WithId } from '../types'

interface KanbanCardProps<TEntity extends WithId> {
  entity: TEntity
  children: React.ReactNode
  disabled?: boolean
}

export function KanbanCard<TEntity extends WithId>({ 
  entity, 
  children,
  disabled = false 
}: KanbanCardProps<TEntity>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: entity.id,
    data: {
      type: 'Entity',
      entity,
    },
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-50' : ''}
    >
      {children}
    </div>
  )
}