/**
 * VibeKan - Generic Kanban Board Component with Persistence
 * 
 * A fully generic drag-and-drop kanban board that can work with any entity type.
 * Maintains order within columns, syncs status changes, and persists state.
 */

import React, { useState, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import type { WithId, VibeKanProps, VibeKanPersistence } from '../types'

// Internal type to track entity positions
interface EntityPosition<TEntity extends WithId> {
  entity: TEntity
  columnId: string
}

export function VibeKan<TEntity extends WithId, TStatus = string>({
  entities,
  config,
  className,
  columnWidth = 'w-80',
  columnGap = 'gap-6',
  enablePersistence = false,
  kanbanId = 'default',
  enableCrossTabSync = false,
  debugMode = false
}: VibeKanProps<TEntity, TStatus>) {
  // ============================================================================
  // Persistence: Load State Synchronously
  // ============================================================================
  
  const getInitialEntityOrder = React.useCallback(() => {
    if (!enablePersistence) {
      return {}
    }
    
    try {
      const key = `kanban-preferences:vibekan:${kanbanId}`
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored) as VibeKanPersistence
        
        if (debugMode) {
          console.log('🔧 [VibeKan] Loaded preferences from localStorage:', {
            kanbanId,
            entityOrder: parsed.entityOrder
          })
        }
        
        return parsed.entityOrder || {}
      }
    } catch (error) {
      console.warn('Failed to load kanban preferences:', error)
    }
    
    return {}
  }, [enablePersistence, kanbanId, debugMode])

  // Track entity positions with their column assignments
  const [entityPositions, setEntityPositions] = useState<EntityPosition<TEntity>[]>([])
  const [activeEntity, setActiveEntity] = useState<TEntity | null>(null)
  
  // Initialize and sync entity positions with persistence
  React.useEffect(() => {
    console.log('🔄 [VibeKan] Entity positions effect triggered', {
      entitiesCount: entities.length,
      entityIds: entities.map(e => e.id),
      enablePersistence,
      kanbanId
    })
    
    const persistedOrder = getInitialEntityOrder()
    
    // Build a map of existing positions by entity ID
    const positionMap = new Map(
      entityPositions.map(pos => [pos.entity.id, pos])
    )
    
    // Update positions with current entity data
    const newPositions: EntityPosition<TEntity>[] = []
    
    // If we have persisted order, use it
    if (Object.keys(persistedOrder).length > 0) {
      // Process entities in the persisted order
      config.columns.forEach(column => {
        const columnOrder = persistedOrder[column.id] || []
        columnOrder.forEach(entityId => {
          const entity = entities.find(e => e.id === entityId)
          if (entity) {
            // Always use current entity status to determine column
            const currentColumnId = config.getColumnId(entity)
            newPositions.push({
              entity,
              columnId: currentColumnId
            })
          }
        })
      })
      
      // Add any new entities that aren't in the persisted order
      entities.forEach(entity => {
        if (!newPositions.some(pos => pos.entity.id === entity.id)) {
          newPositions.push({
            entity,
            columnId: config.getColumnId(entity)
          })
        }
      })
    } else {
      // No persisted order, use current entity positions or create new ones
      // Always use current entity status to determine column
      entities.forEach(entity => {
        newPositions.push({
          entity,
          columnId: config.getColumnId(entity)
        })
      })
    }
    
    console.log('✅ [VibeKan] Setting new entity positions', {
      positionsCount: newPositions.length,
      positionsByColumn: newPositions.reduce((acc, pos) => {
        acc[pos.columnId] = (acc[pos.columnId] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    })
    
    setEntityPositions(newPositions)
  }, [entities, getInitialEntityOrder, config])

  // ============================================================================
  // Persistence: Save State Changes (Debounced)
  // ============================================================================
  
  React.useEffect(() => {
    if (!enablePersistence) return
    
    const timeoutId = setTimeout(() => {
      try {
        const key = `kanban-preferences:vibekan:${kanbanId}`
        
        // Build entity order from current positions
        const entityOrder: Record<string, string[]> = {}
        config.columns.forEach(column => {
          entityOrder[column.id] = []
        })
        
        entityPositions.forEach(position => {
          if (entityOrder[position.columnId]) {
            entityOrder[position.columnId].push(position.entity.id)
          }
        })
        
        const preferences: VibeKanPersistence = {
          entityOrder
        }
        
        localStorage.setItem(key, JSON.stringify(preferences))
        
        if (debugMode) {
          console.log('[VibeKan] 💾 Preferences saved:', preferences)
        }
      } catch (error) {
        console.warn('Failed to save kanban preferences:', error)
      }
    }, 500) // 500ms debounce
    
    return () => clearTimeout(timeoutId)
  }, [enablePersistence, kanbanId, entityPositions, config.columns, debugMode])

  // ============================================================================
  // Cross-Tab Synchronization (Optional)
  // ============================================================================
  
  React.useEffect(() => {
    if (enableCrossTabSync && enablePersistence) {
      const storageKey = `kanban-preferences:vibekan:${kanbanId}`
      
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === storageKey && e.newValue) {
          try {
            const newPreferences = JSON.parse(e.newValue) as VibeKanPersistence
            
            if (debugMode) {
              console.log('[VibeKan] 🔄 Cross-tab sync triggered:', newPreferences)
            }
            
            // Update entity positions from cross-tab changes
            const newPositions: EntityPosition<TEntity>[] = []
            
            config.columns.forEach(column => {
              const columnOrder = newPreferences.entityOrder[column.id] || []
              columnOrder.forEach(entityId => {
                const entity = entities.find(e => e.id === entityId)
                if (entity) {
                  newPositions.push({
                    entity,
                    columnId: column.id
                  })
                }
              })
            })
            
            setEntityPositions(newPositions)
          } catch (error) {
            console.warn('Failed to sync kanban preferences:', error)
          }
        }
      }
      
      window.addEventListener('storage', handleStorageChange)
      return () => window.removeEventListener('storage', handleStorageChange)
    }
  }, [enableCrossTabSync, enablePersistence, kanbanId, entities, config.columns, debugMode])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  )

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event
    console.log('🚀 VibeKan drag start:', active.id, active.data.current)
    
    if (active.data.current?.type === 'Entity') {
      setActiveEntity(active.data.current.entity)
    }
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    console.log('🔄 VibeKan drag over:', { activeId, overId })

    const activeData = active.data.current
    const overData = over.data.current

    if (!activeData || activeData.type !== 'Entity') return

    const isOverAnEntity = overData?.type === 'Entity'
    const isOverAColumn = overData?.type === 'Column'

    setEntityPositions((positions) => {
      const activeIndex = positions.findIndex((pos) => pos.entity.id === activeId)
      if (activeIndex === -1) return positions

      const activePosition = positions[activeIndex]

      // Entity over entity
      if (isOverAnEntity) {
        const overIndex = positions.findIndex((pos) => pos.entity.id === overId)
        if (overIndex === -1) return positions

        const overPosition = positions[overIndex]
        
        // Update column if different
        if (activePosition.columnId !== overPosition.columnId) {
          // Cross-column move: Move item to new column and insert at the target position
          const newPositions = [...positions]
          
          // Update the active item's column
          const updatedActivePosition = {
            ...activePosition,
            columnId: overPosition.columnId
          }
          
          // Remove the active item from its current position
          newPositions.splice(activeIndex, 1)
          
          // Find the new insertion index (accounting for the removal)
          let insertIndex = overIndex
          if (activeIndex < overIndex) {
            insertIndex = overIndex - 1 // Adjust for the removed item
          }
          
          // Insert at the target position
          newPositions.splice(insertIndex, 0, updatedActivePosition)
          
          console.log(`✅ Entity ${activeId} moved to column ${overPosition.columnId}`)
          return newPositions
        }

        // Same column, just reorder
        return arrayMove(positions, activeIndex, overIndex)
      }

      // Entity over column - move to new column
      if (isOverAColumn) {
        const newColumnId = overData.column.id
        
        if (activePosition.columnId !== newColumnId) {
          const newPositions = [...positions]
          newPositions[activeIndex] = {
            ...activePosition,
            columnId: newColumnId
          }
          console.log(`✅ Entity ${activeId} moved to column ${newColumnId}`)
          return newPositions
        }
      }

      return positions
    })
  }

  const onDragEnd = async (event: DragEndEvent) => {
    console.log('🏁 VibeKan drag end')
    setActiveEntity(null)

    const { active, over } = event
    if (!over) return

    const activeId = active.id as string

    // Find the moved entity position
    const movedPosition = entityPositions.find(pos => pos.entity.id === activeId)
    if (!movedPosition) return

    // Check if column changed from original
    const originalColumnId = config.getColumnId(movedPosition.entity)
    if (originalColumnId !== movedPosition.columnId) {
      const newStatus = config.getStatusForColumn(movedPosition.columnId)
      await config.onStatusChange(activeId, newStatus)
    }
  }

  // Group entities by column while maintaining order
  // Keep useMemo for drag-and-drop stability - object reference must be stable
  const entitiesByColumn = useMemo(() => {
    const grouped: Record<string, TEntity[]> = {}
    
    // Initialize empty arrays for each column
    config.columns.forEach(column => {
      grouped[column.id] = []
    })
    
    // Group entities by their tracked column position
    entityPositions.forEach(position => {
      if (grouped[position.columnId]) {
        grouped[position.columnId].push(position.entity)
      }
    })
    
    return grouped
  }, [entityPositions, config.columns])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className={cn('flex overflow-x-auto overflow-y-hidden h-full pb-4', columnGap, className)} style={{ scrollBehavior: 'smooth' }}>
        {config.columns.map(column => (
          <KanbanColumn 
            key={column.id} 
            column={column} 
            entityIds={entitiesByColumn[column.id]?.map(e => e.id) || []}
            renderHeader={config.renderColumnHeader}
            width={columnWidth}
          >
            {entitiesByColumn[column.id]?.map(entity => (
              <KanbanCard key={entity.id} entity={entity}>
                {config.renderCard(entity, false, false)}
              </KanbanCard>
            ))}
          </KanbanColumn>
        ))}
      </div>
      
      <DragOverlay>
        {activeEntity && (
          config.renderDragOverlay?.(activeEntity) || 
          config.renderCard(activeEntity, true, true)
        )}
      </DragOverlay>
    </DndContext>
  )
}