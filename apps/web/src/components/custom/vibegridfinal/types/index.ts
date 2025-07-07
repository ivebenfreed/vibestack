/**
 * VibeGridFinal - Core Type Definitions
 * 
 * Centralized type system for the modularized VibeGridFinal components
 */

import type { ColumnDef, OnChangeFn, PaginationState, SortingState, ColumnFiltersState, RowSelectionState } from '@tanstack/react-table'
import type { BaseEntity } from '@/components/custom/vibegrid/types'
import type { Task } from '@repo/dataforge/client-entities'

// ============================================================================
// Base Entity Interface (Re-export from original location)
// ============================================================================

export type { BaseEntity }

// ============================================================================
// 🔥 NEW: Architectural Pattern Enforcement Interfaces
// ============================================================================

/**
 * Balanced Selector Pattern - Enforces proper XState selector usage
 * 
 * ✅ PREVENTS: Over-stabilized selectors that miss content updates
 * ✅ ENFORCES: Balanced selectors that detect both structural AND content changes
 */
export interface BalancedSelectorConfig<TEntity extends BaseEntity> {
  /** 
   * REQUIRED: Balanced selector that detects content changes
   * Must use: useSelector(atom, (record) => Object.values(record).sort(...), shallowEqual)
   * NEVER use: Over-stabilized ID-only selectors with useMemo + atom.get()
   */
  useBalancedSelector: () => TEntity[]
  
  /** Optional: Relationship data selectors using same balanced pattern */
  useRelationshipSelectors?: () => {
    projects?: Array<{ id: string; name: string; [key: string]: any }>
    users?: Array<{ id: string; name: string; [key: string]: any }>
    [key: string]: Array<{ id: string; name?: string; [key: string]: any }> | undefined
  }
}

/**
 * Business Logic Handler Pattern - Enforces proper domain integration
 * 
 * ✅ PREVENTS: Direct state mutations and anti-patterns
 * ✅ ENFORCES: Proper domain action usage with business logic
 */
export interface BusinessLogicHandlers<TEntity extends BaseEntity> {
  /**
   * REQUIRED: Save handler with business logic
   * Must use domain actions, not direct atom updates
   */
  handleSave: (entityId: string, columnId: string, value: any) => Promise<void>
  
  /**
   * REQUIRED: Bulk action handler with proper error handling
   */
  handleBulkAction?: (selectedIds: string[], action: string) => Promise<void>
  
  /**
   * Optional: Validation logic
   */
  handleValidation?: (entityId: string, columnId: string, value: any) => Promise<boolean>
}

/**
 * Column Configuration Pattern - Enforces proper column setup
 * 
 * ✅ PREVENTS: Ad-hoc column definitions
 * ✅ ENFORCES: Generated column configurations with type safety
 */
export interface ColumnConfigurationPattern<TEntity extends BaseEntity> {
  /**
   * REQUIRED: Generated column definitions from @repo/dataforge
   * Must use: TaskColumns, ProjectColumns, etc. from column-configurations
   */
  columns: ColumnDef<TEntity>[]
  
  /**
   * REQUIRED: Relationship data provider with proper structure
   */
  relationshipData: RelationshipDataProvider
  
  /**
   * Optional: Column selection (subset of available columns)
   */
  selectedColumns?: (keyof TEntity)[]
}

/**
 * Direct Usage Pattern - Complete interface for flattened architecture
 * 
 * ✅ PREVENTS: Wrapper component anti-patterns
 * ✅ ENFORCES: Direct VibeGridFinal usage with proper patterns
 */
export interface DirectUsagePattern<TEntity extends BaseEntity> 
  extends BalancedSelectorConfig<TEntity>, 
          BusinessLogicHandlers<TEntity>, 
          ColumnConfigurationPattern<TEntity> {
  
  /**
   * Architecture validation - ensures this is used in page components
   */
  readonly __architecturalPattern: 'DIRECT_USAGE_FLATTENED'
  
  /**
   * Performance target - enforces performance expectations
   */
  readonly __performanceTarget: '<100ms'
  
  /**
   * Required table configuration for persistence
   */
  tableId: string
  enablePersistence?: boolean
}

/**
 * Performance Metrics Interface - Enforces performance monitoring
 */
export interface PerformanceMetrics {
  renderTime: number
  cellCount: number
  timePerCell: number
  dataSize: number
}

// ============================================================================
// Cell Type System
// ============================================================================

export type CellType = 
  | 'text'
  | 'number' 
  | 'boolean'
  | 'date'
  | 'enum'
  | 'uuid'
  | 'json'
  | 'relationship-single'
  | 'relationship-multi'
  | 'relationship'
  | 'relationship-collection'

export interface CellConfig {
  editable?: boolean
  placeholder?: string
  enumValues?: Record<string, string>
  format?: string
  showTime?: boolean
  dateMin?: string
  dateMax?: string
  relationshipType?: string
  displayField?: string
  searchFields?: string[]
  allowCreate?: boolean
  options?: Array<{ value: string; label: string }>
  searchable?: boolean
  numberMin?: number
  numberMax?: number
  step?: number
  maxLength?: number
  inputType?: string
  readOnly?: boolean
  [key: string]: any
}

export interface CellMeta {
  cellType: CellType
  config?: CellConfig
  onSave?: (value: any, entity: any) => Promise<void>
  onValidate?: (value: any) => string | null
  systemField?: boolean
}

// ============================================================================
// Relationship Data Provider
// ============================================================================

export interface RelationshipDataProvider {
  [key: string]: {
    data: Array<{ id: string; name?: string; [key: string]: any }>
    displayField?: string
  }
}

// ============================================================================
// Universal Cell Renderer Props
// ============================================================================

export interface UniversalCellRendererProps<TEntity extends BaseEntity> {
  getValue: () => any
  row: { original: TEntity }
  column: { columnDef: ColumnDef<TEntity> }
  relationshipData?: RelationshipDataProvider
  onSave?: (entityId: string, columnId: string, value: any) => Promise<void>
}

// ============================================================================
// Enhanced VibeGridFinal Props with Pattern Enforcement
// ============================================================================

export interface VibeGridFinalProps<TEntity extends BaseEntity> {
  // Required props - enforced through DirectUsagePattern
  data: TEntity[]
  columns: ColumnDef<TEntity>[]
  
  // Universal cell renderer configuration
  relationshipData?: RelationshipDataProvider
  onSave?: (entityId: string, columnId: string, value: any) => Promise<void>
  
  // Optional configuration
  enableSorting?: boolean
  enablePagination?: boolean
  enableFiltering?: boolean
  enableGlobalSearch?: boolean
  enableHorizontalScrolling?: boolean
  
  // Pagination
  pageSize?: number
  pageSizeOptions?: number[]
  
  // Styling
  className?: string
  tableClassName?: string
  
  // State control (optional - for external state management)
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  
  // Row selection (optional - for external state management)
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  enableRowSelection?: boolean
  onBulkAction?: (selectedIds: string[], action: string) => Promise<void> | void
  
  // Performance/Debug
  debugMode?: boolean
  
  // 🔍 NEW: Ellipsis debugging props
  debugEllipsis?: boolean
  debugBorders?: boolean
  debugForceConstraints?: boolean
  
  // 🔥 ENFORCED: Persistence props (required for proper usage)
  tableId: string // Made required
  enablePersistence?: boolean
  enableCrossTabSync?: boolean
  
  // 🔥 NEW: Pattern validation (development only)
  __usagePattern?: DirectUsagePattern<TEntity>
}

// ============================================================================
// Utility type for enforcing proper page component usage
// ============================================================================

/**
 * PageComponentProps - Enforces that VibeGridFinal is used in page components
 * with proper patterns
 */
export interface PageComponentVibeGridProps<TEntity extends BaseEntity> 
  extends Omit<VibeGridFinalProps<TEntity>, '__usagePattern'> {
  
  /**
   * REQUIRED: Direct usage pattern configuration
   * Use createDirectUsagePattern() to create this
   */
  usagePattern: DirectUsagePattern<TEntity>
}

// ============================================================================
// Header Component Props
// ============================================================================

export interface VibeGridHeaderProps {
  enableGlobalSearch: boolean
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  filteredRowCount: number
  totalRowCount: number
  className?: string
}

export interface SmartGlobalSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// ============================================================================
// Footer Component Props
// ============================================================================

export interface VibeGridFooterProps {
  enablePagination: boolean
  table: any // TanStack table instance
  pageSizeOptions: number[]
  filteredRowCount: number
  totalRowCount: number
  globalFilter?: string
  className?: string
}

export interface PageSizeSelectorProps {
  table: any
  pageSizeOptions: number[]
}

export interface PaginationControlsProps {
  table: any
}

// ============================================================================
// 🚨 DEPRECATED: Entity-Specific Grid Props (Use DirectUsagePattern instead)
// ============================================================================

/** @deprecated Use DirectUsagePattern<Task> instead for better performance and patterns */
export interface TaskVibeGridProps {
  // Column configuration
  customColumns?: (keyof Task)[]
  
  // Bulk actions
  enableBulkActions?: boolean
  onBulkDelete?: (ids: string[]) => Promise<void>
  onBulkEdit?: (ids: string[]) => Promise<void>
  onBulkArchive?: (ids: string[]) => Promise<void>
  
  // Styling
  className?: string
  
  // Debug mode
  debugMode?: boolean
  
  // ✅ NEW: XState persistence configuration
  tableId?: string
  enablePersistence?: boolean
  enableCrossTabSync?: boolean
}

/** @deprecated Use DirectUsagePattern instead */
export interface ProjectVibeGridProps {
  customColumns?: string[]
  enableBulkActions?: boolean
  onBulkDelete?: (ids: string[]) => Promise<void>
  className?: string
  debugMode?: boolean
}

/** @deprecated Use DirectUsagePattern instead */
export interface UserVibeGridProps {
  customColumns?: string[]
  enableBulkActions?: boolean
  onBulkDelete?: (ids: string[]) => Promise<void>
  className?: string
  debugMode?: boolean
}

/** @deprecated Use DirectUsagePattern instead */
export interface CommentVibeGridProps {
  customColumns?: string[]
  enableBulkActions?: boolean
  onBulkDelete?: (ids: string[]) => Promise<void>
  className?: string
  debugMode?: boolean
}

// ============================================================================
// Legacy Adapter Configs (Consider deprecating)
// ============================================================================

export interface AtomAdapterConfig<TEntity extends BaseEntity> {
  entityType: string
  entityAtom: any
  entityActions: any
}

export interface RelationshipAdapterConfig {
  entityType: string
  relationshipMappings: Record<string, {
    entityType: string
    displayField: string
    searchFields: string[]
  }>
}

export interface SaveAdapterConfig<TEntity extends BaseEntity> {
  entityActions: any
  optimisticUpdates?: boolean
  validationRules?: Record<string, (value: any, entity: TEntity) => Promise<boolean>>
} 