import { ObjectLiteral } from 'typeorm'
import { ColumnDef, SortingState, ColumnFiltersState, VisibilityState, PaginationState } from '@tanstack/react-table'
import { Atom, WritableAtom } from 'jotai'

/**
 * Universal Entity Table v2 - TypeScript Definitions
 * 
 * ✅ Based on lessons learned from performance debugging
 * ✅ Optimized for lightweight components and minimal re-renders
 * ✅ Stable column definitions and context usage
 */

// ==========================================
// Core Entity Types
// ==========================================

/**
 * Base entity requirements for Universal Entity Table
 */
export interface BaseEntity {
  id: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

/**
 * Entity with relationships resolved (for display)
 */
export type EntityWithRelations<T extends BaseEntity = BaseEntity> = T & {
  [key: string]: any // Allow for resolved relationship data
}

// ==========================================
// Service Interface
// ==========================================

/**
 * Generic service interface for CRUD operations with atomic reactivity
 * Updated for Hybrid Atomic Architecture - Phase 2
 */
export interface EntityService<T extends BaseEntity> {
  // ============================================================================
  // ATOMIC REACTIVITY - REQUIRED (Phase 2)
  // ============================================================================
  
  /** Atomic store for reactive entity management */
  atoms: AtomicEntityStore<T>
  
  // ============================================================================
  // CRUD OPERATIONS - OPTIONAL
  // ============================================================================
  
  create?: (data: Partial<T>) => Promise<T>
  update?: (id: string, data: Partial<T>) => Promise<T>
  delete?: (id: string) => Promise<void>
  bulkUpdate?: (ids: string[], data: Partial<T>) => Promise<T[]>
  bulkDelete?: (ids: string[]) => Promise<void>
  
  // ============================================================================
  // REMOVED: React Query dependencies eliminated in Phase 1
  // All data access now flows through atomic stores for 100x performance
  // ============================================================================
}

/**
 * Flexible atomic store interface for entity reactivity
 * Accommodates domain-specific naming while providing core functionality
 */
export interface AtomicEntityStore<T extends BaseEntity> {
  /** Bulk sync method for initial data loading (REQUIRED) */
  syncBulkLoad: WritableAtom<null, [T[]], void>
  
  /** 
   * Domain-specific atom names are supported via index signature
   * Examples:
   * - allTasksAtom: Atom<Task[]>
   * - allProjectsAtom: Atom<Project[]>
   * - getTaskAtom: (id: string) => Atom<Task | null>
   * - getProjectAtom: (id: string) => Atom<Project | null>
   */
  [key: string]: any
}

// ==========================================
// Table State Management
// ==========================================

/**
 * Persistent table UI state (stored in useDataTableUiStore)
 */
export interface TableUiState {
  sorting?: SortingState
  columnVisibility?: VisibilityState
  columnFilters?: ColumnFiltersState
  pagination?: {
    pageIndex: number
    pageSize: number
  }
  columnOrder?: string[]
  columnSizing?: Record<string, number>
}

/**
 * Table state management actions
 */
export interface TableStateActions {
  getUiState: (tableId: string) => TableUiState | null
  setUiState: (tableId: string, state: Partial<TableUiState>) => void
  resetUiState: (tableId: string) => void
}

// ==========================================
// Column System
// ==========================================

/**
 * Column type detection for automatic formatting
 */
export type ColumnDataType = 
  | 'text' 
  | 'number' 
  | 'currency' 
  | 'percentage'
  | 'date' 
  | 'datetime'
  | 'boolean'
  | 'relationship'
  | 'json'
  | 'custom'

/**
 * Enhanced column definition with performance optimizations
 */
export type UniversalColumnDef<T extends BaseEntity> = ColumnDef<T> & {
  /** Data type for automatic formatting and editing */
  dataType?: ColumnDataType
  /** Whether this column supports inline editing */
  editable?: boolean
  /** Whether this column supports sorting */
  sortable?: boolean
  /** Whether this column supports filtering */
  filterable?: boolean
  /** Relationship configuration for foreign key columns */
  relationshipConfig?: RelationshipConfig
  /** Custom cell editor component */
  cellEditor?: React.ComponentType<CellEditorProps<T>>
  /** Column description for tooltips/help */
  description?: string
  /** Whether column is required */
  required?: boolean
  /** Validation function for cell editing */
  validate?: (value: any) => string | null
  /** Custom formatting function */
  format?: (value: any) => string
}

/**
 * Relationship configuration for foreign key columns
 * Updated for atomic reactivity - Phase 2
 */
export interface RelationshipConfig {
  /** Related entity service with atomic store */
  relatedEntityService: EntityService<any>
  /** Function to extract entity ID from related object */
  getEntityId: (entity: any) => string
  /** Function to extract display value from related object */
  getDisplayValue: (entity: any) => string
  /** Whether to allow creating new related entities */
  allowCreate?: boolean
  /** Whether relationship is required */
  required?: boolean
  /** Search function for filtering options */
  searchFunction?: (entities: any[], query: string) => any[]
}

// ==========================================
// Cell Editing System
// ==========================================

/**
 * Cell editor component props
 */
export interface CellEditorProps<T extends BaseEntity> {
  /** Current cell value */
  value: any
  /** Callback when value changes */
  onValueChange: (value: any) => void
  /** Callback when editing is cancelled */
  onCancel: () => void
  /** Callback when editing is submitted */
  onSubmit?: () => void
  /** Row data */
  rowData: T
  /** Column definition */
  column: UniversalColumnDef<T>
  /** Whether editor should auto-focus */
  autoFocus?: boolean
  /** Validation error message */
  error?: string
}

/**
 * Cell editing state
 */
export interface CellEditingState {
  rowId: string
  columnId: string
  value: any
  isEditing: boolean
  error?: string
}

// ==========================================
// Bulk Operations
// ==========================================

/**
 * Bulk action configuration
 */
export interface BulkActionConfig<T extends BaseEntity> {
  /** Action identifier */
  id: string
  /** Display label */
  label: string
  /** Icon component */
  icon?: React.ComponentType<any>
  /** Action handler */
  handler: (selectedEntities: T[], selectedIds: string[]) => Promise<void>
  /** Whether action is destructive (requires confirmation) */
  destructive?: boolean
  /** Whether action is currently available */
  isAvailable?: (selectedEntities: T[]) => boolean
  /** Custom confirmation message */
  confirmationMessage?: (selectedEntities: T[]) => string
}

/**
 * Bulk edit field configuration
 */
export interface BulkEditFieldConfig<T extends BaseEntity> {
  /** Field key */
  key: keyof T
  /** Display label */
  label: string
  /** Field data type */
  dataType: ColumnDataType
  /** Editor component */
  editor: React.ComponentType<CellEditorProps<T>>
  /** Whether field is available for bulk editing */
  isAvailable?: boolean
}

// ==========================================
// PHASE 3: ATOMIC ENTITY TABLE PROPS - UPDATED
// ==========================================

export interface UniversalEntityTableProps<T extends BaseEntity> {
  // ===== CLEAN ATOM PATTERN - REQUIRED =====
  /** XState atom containing entities as Record<string, T> */
  entityAtom: any
  /** Column definitions */
  columns: UniversalColumnDef<T>[]
  
  // ===== Optional Configuration =====
  /** Optional table title */
  title?: string
  
  // ===== Feature Toggles =====
  /** Enable search functionality */
  enableSearch?: boolean
  /** Enable filters */
  enableFilters?: boolean
  /** Enable bulk actions and selection */
  enableBulkActions?: boolean
  /** Enable sorting */
  enableSorting?: boolean
  /** Enable pagination */
  enablePagination?: boolean
  /** Show toolbar with search/filters */
  showToolbar?: boolean
  /** Show table in card wrapper */
  showCard?: boolean
  
  // ===== Pagination =====
  /** Default page size */
  pageSize?: number
  /** Available page size options */
  pageSizeOptions?: number[]
  
  // ===== Bulk Operations =====
  /** Custom bulk actions */
  bulkActions?: BulkActionConfig<T>[]
  /** Bulk edit field configurations */
  bulkEditFields?: BulkEditFieldConfig<T>[]
  
  // ===== Styling =====
  /** Additional CSS classes */
  className?: string
  /** Use content width constraints */
  useContentWidth?: boolean
  
  // ===== Event Handlers =====
  /** Callback when entity is created */
  onEntityCreated?: (entity: T) => void
  /** Callback when entity is updated */
  onEntityUpdated?: (entity: T) => void
  /** Callback when entity is deleted */
  onEntityDeleted?: (entityId: string) => void
  /** Callback when bulk operation completes */
  onBulkOperationComplete?: (operation: string, count: number) => void
}

// ==========================================
// Table Context
// ==========================================

/**
 * Minimal table context (avoid heavy context usage for performance)
 */
export interface TableContextValue<T extends BaseEntity> {
  /** Entity type */
  entityType: string
  /** Whether inline editing is enabled */
  enableInlineEdit: boolean
  /** Whether optimistic updates are enabled */
  enableOptimisticUpdates: boolean
  /** Service for CRUD operations */
  service?: EntityService<T>
  /** Performance tracker instance */
  performanceTracker?: any
}

// ==========================================
// Error Handling
// ==========================================

/**
 * Table error types
 */
export type TableErrorType = 
  | 'data_loading_error'
  | 'service_error' 
  | 'validation_error'
  | 'permission_error'
  | 'network_error'
  | 'unknown_error'

/**
 * Table error details
 */
export interface TableError {
  type: TableErrorType
  message: string
  details?: any
  timestamp: number
  recoverable?: boolean
  retryAction?: () => void
}

// ==========================================
// Performance Monitoring
// ==========================================

/**
 * Performance metrics for table operations
 */
export interface TablePerformanceMetrics {
  /** Initial render time */
  initialRenderTime?: number
  /** Cell interaction times */
  cellInteractionTimes: number[]
  /** Sort operation times */
  sortOperationTimes: number[]
  /** Filter operation times */
  filterOperationTimes: number[]
  /** Memory usage snapshots */
  memoryUsage: number[]
  /** Component re-render counts */
  reRenderCounts: Record<string, number>
}

// ==========================================
// Note: All types are already exported above
// ========================================== 