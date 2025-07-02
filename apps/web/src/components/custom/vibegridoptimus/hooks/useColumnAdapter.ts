import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { BaseEntity, OptimusColumn, ColumnAdapterOptions } from '../types'
import { DEFAULT_COLUMN_WIDTHS, MIN_COLUMN_WIDTHS } from '../utils/constants'

/**
 * Hook to convert DataForge TanStack columns to VibeGridOptimus format
 */
export function useColumnAdapter<TEntity extends BaseEntity>(
  tanstackColumns: Record<keyof TEntity, ColumnDef<TEntity>>,
  options: ColumnAdapterOptions<TEntity> = {}
): OptimusColumn<TEntity>[] {
  const { hiddenColumns = [], columnOrder } = options

  return useMemo(() => {
    // Defensive programming - ensure tanstackColumns is defined
    if (!tanstackColumns || typeof tanstackColumns !== 'object') {
      console.warn('[useColumnAdapter] tanstackColumns is not a valid object:', tanstackColumns)
      return []
    }
    
    // Get column keys in specified order or default order
    const columnKeys = columnOrder || (Object.keys(tanstackColumns) as (keyof TEntity)[])
    
    return columnKeys
      .filter(key => !hiddenColumns.includes(key))
      .map((key, index) => {
        const tanstackCol = tanstackColumns[key]
        const meta = tanstackCol.meta || {}
        
        // Extract DataForge metadata
        const cellType = meta.cellType || 'text'
        const config = meta.config || {}
        const systemField = meta.systemField || false
        const businessLogic = meta.businessLogic || {}
        
        // Create VibeGridOptimus column
        const optimusColumn: OptimusColumn<TEntity> = {
          key,
          idx: index,
          accessorKey: tanstackCol.accessorKey as keyof TEntity | undefined,
          name: tanstackCol.header as string,
          width: tanstackCol.size || getDefaultWidth(cellType),
          minWidth: tanstackCol.minSize || getDefaultMinWidth(cellType),
          maxWidth: tanstackCol.maxSize || undefined,
          resizable: tanstackCol.enableResizing !== false,
          sortable: tanstackCol.enableSorting !== false,
          editable: config.editable ?? false,
          
          // Preserve DataForge metadata
          cellType,
          config,
          systemField,
          businessLogic
        }
        
        return optimusColumn
      })
  }, [tanstackColumns, hiddenColumns, columnOrder])
}

/**
 * Get default column width based on cell type
 */
function getDefaultWidth(cellType: string): number {
  return DEFAULT_COLUMN_WIDTHS[cellType as keyof typeof DEFAULT_COLUMN_WIDTHS] ?? DEFAULT_COLUMN_WIDTHS.default
}

/**
 * Get default minimum column width based on cell type
 */
function getDefaultMinWidth(cellType: string): number {
  return MIN_COLUMN_WIDTHS[cellType as keyof typeof MIN_COLUMN_WIDTHS] ?? MIN_COLUMN_WIDTHS.default
}

/**
 * Utility functions for column filtering
 */
export function getEditableColumns<TEntity extends BaseEntity>(
  columns: OptimusColumn<TEntity>[]
): OptimusColumn<TEntity>[] {
  return columns.filter(col => col.config?.editable === true && !col.systemField)
}

export function getSystemColumns<TEntity extends BaseEntity>(
  columns: OptimusColumn<TEntity>[]
): OptimusColumn<TEntity>[] {
  return columns.filter(col => col.systemField === true)
}

export function getRelationshipColumns<TEntity extends BaseEntity>(
  columns: OptimusColumn<TEntity>[]
): OptimusColumn<TEntity>[] {
  return columns.filter(col => 
    col.cellType?.startsWith('relationship') || 
    col.businessLogic?.relationship === true
  )
}