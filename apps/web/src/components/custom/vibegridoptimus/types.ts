import type { ColumnDef } from '@tanstack/react-table'
import type { Column as RDGColumn, SortColumn, CellSelectArgs } from 'react-data-grid'

// Import actual DataForge entities to derive base type
import type { Project, Task, User, Comment } from '@repo/dataforge/client-entities'

// Create a proper base entity type from actual DataForge entities
// This extracts the common properties that all domain entities have
type DataForgeEntity = Project | Task | User | Comment
type BaseEntityKeys = keyof Project & keyof Task & keyof User & keyof Comment
export type BaseEntity = Pick<DataForgeEntity, BaseEntityKeys>

/**
 * VibeGridOptimus component props - leverages DataForge generated types
 */
export interface VibeGridOptimusProps<TEntity extends BaseEntity> {
  // Data - uses DataForge entities and columns
  data: TEntity[]
  columns: Record<keyof TEntity, ColumnDef<TEntity>>
  
  // Event handlers
  onUpdate?: (id: string, updates: Partial<TEntity>) => Promise<void>
  onBatchUpdate?: (batchUpdates: Array<{ id: string; updates: Partial<TEntity> }>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onRowClick?: (row: TEntity) => void
  
  // Grid configuration
  sortColumns?: readonly SortColumn[]
  onSortColumnsChange?: (sortColumns: readonly SortColumn[]) => void
  selectedRows?: Set<string>
  onSelectedRowsChange?: (selectedRows: Set<string>) => void
  selectedCells?: readonly [number, number] | null
  onSelectedCellsChange?: (args: CellSelectArgs<TEntity>) => void
  
  // UI configuration
  height?: number | string
  theme?: 'light' | 'dark'
  enableVirtualization?: boolean
  enableRowSelection?: boolean
  enableSorting?: boolean
  enableFiltering?: boolean
  
  // Customization
  hiddenColumns?: (keyof TEntity)[]
  columnOrder?: (keyof TEntity)[]
  
  // Loading states
  isLoading?: boolean
  error?: string | null
  
  // Additional features
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  emptyState?: React.ReactNode
  
  // CSS classes
  className?: string
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