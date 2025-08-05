/**
 * VibeKan Type Definitions
 * Generic types for kanban board functionality
 */

import type { ReactNode } from 'react'

// Minimal constraint - entities must have an id
export interface WithId {
  id: string
}

// Column definition
export interface KanbanColumn<TStatus = string> {
  id: string
  title: string
  status: TStatus
}

// Configuration for the kanban board
export interface VibeKanConfig<TEntity extends WithId, TStatus = string> {
  // Column definitions
  columns: KanbanColumn<TStatus>[]
  
  // Get the column ID for an entity
  getColumnId: (entity: TEntity) => string
  
  // Get the status value for a column
  getStatusForColumn: (columnId: string) => TStatus
  
  // Render a card for an entity
  renderCard: (entity: TEntity, isDragging: boolean, overlay: boolean) => ReactNode
  
  // Handle status update
  onStatusChange: (entityId: string, newStatus: TStatus) => Promise<void>
  
  // Optional: Custom drag overlay
  renderDragOverlay?: (entity: TEntity) => ReactNode
  
  // Optional: Custom column header
  renderColumnHeader?: (column: KanbanColumn<TStatus>, taskCount: number) => ReactNode
  
  // Optional: Empty column placeholder
  renderEmptyColumn?: (column: KanbanColumn<TStatus>) => ReactNode
}

// Persistence configuration
export interface VibeKanPersistence {
  // Entity order per column (array of entity IDs)
  entityOrder: Record<string, string[]>
}

// Props for the main VibeKan component
export interface VibeKanProps<TEntity extends WithId, TStatus = string> {
  // Entities to display
  entities: TEntity[]
  
  // Configuration
  config: VibeKanConfig<TEntity, TStatus>
  
  // Optional: Additional class names
  className?: string
  
  // Optional: Column width
  columnWidth?: string
  
  // Optional: Gap between columns
  columnGap?: string
  
  // Optional: Persistence settings
  enablePersistence?: boolean
  kanbanId?: string
  enableCrossTabSync?: boolean
  debugMode?: boolean
}