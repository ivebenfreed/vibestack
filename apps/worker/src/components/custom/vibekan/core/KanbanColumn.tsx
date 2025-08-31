/**
 * KanbanColumn - Generic droppable column component
 */

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Badge } from '@/components/ui/badge'
import type { KanbanColumn as KanbanColumnType } from '../types'

interface KanbanColumnProps<TStatus = string> {
  column: KanbanColumnType<TStatus>
  entityIds: string[]
  children: React.ReactNode
  renderHeader?: (column: KanbanColumnType<TStatus>, count: number) => React.ReactNode
  width?: string
}

export function KanbanColumn<TStatus = string>({ 
  column, 
  entityIds,
  children,
  renderHeader,
  width = 'w-80'
}: KanbanColumnProps<TStatus>) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  })

  return (
    <div ref={setNodeRef} className={`${width} flex-shrink-0`}>
      <div className="bg-muted/50 rounded-lg p-4">
        {renderHeader ? (
          renderHeader(column, entityIds.length)
        ) : (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{column.title}</h3>
            <Badge variant="secondary">{entityIds.length}</Badge>
          </div>
        )}
        
        <SortableContext items={entityIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 min-h-[200px] max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {children}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}