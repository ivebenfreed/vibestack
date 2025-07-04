import type { ColumnDef } from '@tanstack/react-table'
import type { Column as RDGColumn, SortColumn, CellSelectArgs } from 'react-data-grid'
import type { EntityName } from './core/EntityRegistry'

// Import actual DataForge entities to derive base type
import type { Project, Task, User, Comment } from '@repo/dataforge/client-entities'

// Create a proper base entity type from actual DataForge entities
// This extracts the common properties that all domain entities have
type DataForgeEntity = Project | Task | User | Comment
type BaseEntityKeys = keyof Project & keyof Task & keyof User & keyof Comment
export type BaseEntity = Pick<DataForgeEntity, BaseEntityKeys>

/**
 * VibeGridOptimus component props - Clean declarative API
 * Maximum 9 props for simplicity
 * 
 * @deprecated Use ValidatedVibeGridOptimusProps with createVibeGrid helper for type safety
 */
export interface VibeGridOptimusProps {
  /** Entity name for automatic configuration */
  entityName: EntityName
  
  /** Entity data array */
  data: any[]
  
  /** Save handler for cell edits */
  onSave?: (id: string, column: string, value: any) => Promise<void>
  
  /** Optional height override */
  height?: string | number
  
  /** Theme support */
  theme?: 'light' | 'dark'
  
  /** Additional CSS classes */
  className?: string
  
  /** Loading state */
  isLoading?: boolean
  
  /** Error state */
  error?: string | null
  
  /** Optional style overrides */
  style?: React.CSSProperties
}

/**
 * Type-safe VibeGridOptimus props with compile-time validation
 * 
 * Enforces:
 * 1. ✅ Entity validation - entityName must be valid DataForge entity
 * 2. ✅ Data validation - data must come from useValidatedEntityArray 
 * 3. ✅ Column validation - columns must match entity type
 * 
 * @example
 * ```typescript
 * // Use createVibeGrid helper for automatic validation
 * const gridProps = createVibeGrid({
 *   entityName: "Task",
 *   atom: tasksAtom
 * })
 * <VibeGridOptimus {...gridProps} />
 * ```
 */
export interface ValidatedVibeGridOptimusProps<T extends EntityName> {
  /** Entity name - validated at compile time */
  entityName: T
  
  /** Entity data array - must come from useValidatedEntityArray */
  data: EntityType<T>[] & { readonly __brand: `GridData_${T}` }
  
  /** Type-safe save handler with entity field validation */
  onSave?: (id: string, column: keyof EntityType<T>, value: any) => Promise<void>
  
  /** Optional height override */
  height?: string | number
  
  /** Theme support */
  theme?: 'light' | 'dark'
  
  /** Additional CSS classes */
  className?: string
  
  /** Loading state */
  isLoading?: boolean
  
  /** Error state */
  error?: string | null
  
  /** Optional style overrides */
  style?: React.CSSProperties
}

/**
 * Converted react-data-grid column with DataForge metadata
 */
export interface OptimusColumn<TEntity extends BaseEntity> extends Omit<RDGColumn<TEntity>, 'key'> {
  key: keyof TEntity
  idx: number
  accessorKey?: keyof TEntity
  // DataForge metadata - extracted from column.meta
  cellType: string
  config?: Record<string, any>
  systemField?: boolean
  businessLogic?: Record<string, any>
}

/**
 * Cell renderer props for pure display components
 */
export interface CellRendererProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  value: any
  rowIndex: number
  onContentClick?: (rowIndex: number, columnKey: string, event: React.MouseEvent) => void  // Content-specific click for edit mode
  onUpdate?: (id: string, updates: Partial<TEntity>) => Promise<void>  // For direct updates (legacy)
}

/**
 * Cell editor props for edit mode components
 */
export interface CellEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  value: any
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Batch update operation
 */
export interface BatchUpdate<TEntity extends BaseEntity> {
  id: string
  changes: Partial<TEntity>
}

/**
 * Column adapter options
 */
export interface ColumnAdapterOptions<TEntity extends BaseEntity> {
  hiddenColumns?: (keyof TEntity)[]
  columnOrder?: (keyof TEntity)[]
}

/**
 * Grid state interface
 */
export interface GridState {
  sortColumns: readonly SortColumn[]
  selectedPosition: { row: number; idx: number } | null
  copiedCell: { row: any; column: OptimusColumn<any> } | null
}