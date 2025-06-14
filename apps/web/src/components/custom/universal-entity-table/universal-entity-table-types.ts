import { ColumnDef } from '@tanstack/react-table'
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm'
import React from 'react'

/**
 * @deprecated No longer needed - Relationship cells access TanStack Query cache directly
 * via Universal Reactive Data Pattern. Cache keys come directly from domain services.
 */
export interface PreloadedRelationshipData {
  [entityType: string]: {
    data: any[] | null
    liveQueryBuilder?: SelectQueryBuilder<any> | null
    isLoading?: boolean
    error?: Error | null
  }
}

/**
 * Universal Entity Table Props - Universal Reactive Data Pattern
 * ✅ Follows the pattern: Router Loader → Global Live Query Manager → TanStack Query Cache → Components
 */
export interface UniversalEntityTableProps<T> {
  /** Entity type for automatic domain service selection and cache keys */
  entityType: string
  
  /** Column definitions */
  columns: ColumnDef<T, any>[]
  
  /** The data to display in the table (follows: live data || loader data || cached data || []) */
  data: T[]
  
  /** Optional: Custom service override (auto-detected if not provided) */
  service?: any
  
  /** Table title */
  title?: string
  
  /** Show toolbar with search and column visibility */
  showToolbar?: boolean
  
  /** Enable bulk selection and actions */
  enableBulkActions?: boolean
  
  /** Enable inline editing */
  enableInlineEdit?: boolean
  
  /** Enable optimistic updates */
  enableOptimisticUpdates?: boolean
  
  /** Enable sorting */
  enableSorting?: boolean
  
  /** Enable pagination */
  enablePagination?: boolean
  
  /** Page size for pagination */
  pageSize?: number
  
  /** Use content width constraints */
  useContentWidth?: boolean
  
  /** Wrap in Card component */
  showCard?: boolean
  
  /** Additional CSS classes */
  className?: string
  
  /** Callbacks for entity operations */
  onEntityCreated?: (entity: T) => void
  onEntityUpdated?: (entity: T) => void
  onEntityDeleted?: (id: string) => void
}

/**
 * Enhanced column definition with entity-specific features
 */
export interface EntityColumnDef<T extends ObjectLiteral> extends Omit<ColumnDef<T, any>, 'cell' | 'header'> {
  // Basic properties
  key: keyof T
  header: string | React.ReactNode
  
  // Display options
  sortable?: boolean
  filterable?: boolean
  editable?: boolean
  hidden?: boolean
  
  // Sizing
  width?: number
  minWidth?: number
  maxWidth?: number
  
  // Field type for smart rendering
  type?: 'text' | 'enum' | 'date' | 'boolean' | 'relation' | 'array' | 'number' | 'custom'
  
  // Enum configuration
  enumValues?: Record<string, string>
  enumColors?: Record<string, string>
  
  // Custom rendering
  cell?: (props: {
    value: any
    entity: T
    isOptimistic?: boolean
    updateMutation?: any
  }) => React.ReactNode
  
  // Validation for editing
  validate?: (value: any) => string | null
}

/**
 * Legacy interface for backward compatibility
 */
export interface EntityTableColumn<T extends ObjectLiteral = any> {
  key: keyof T
  label: string
  sortable?: boolean
  filterable?: boolean
  editable?: boolean
  width?: number
  minWidth?: number
  maxWidth?: number
}

/**
 * Bulk action definition
 */
export interface BulkActionDef<T extends ObjectLiteral> {
  id: string
  label: string
  icon?: React.ComponentType<any>
  action: (selectedIds: string[], entities: T[]) => Promise<void>
  variant?: 'default' | 'destructive' | 'outline'
  confirmMessage?: string
}

/**
 * Table meta extension for entity operations
 */
export interface EntityTableMeta<T extends ObjectLiteral> {
  mutations?: {
    update?: any
    delete?: any
    create?: any
  }
  enableOptimisticUpdates?: boolean
  onUpdate?: (id: string, data: Partial<T>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onCreate?: (data: Partial<T>) => Promise<T>
} 