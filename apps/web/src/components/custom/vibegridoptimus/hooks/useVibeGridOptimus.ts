import { useState, useMemo, useCallback } from 'react'
import type { SortColumn, FillEvent, CellCopyArgs, CellPasteArgs } from 'react-data-grid'
import type { BaseEntity, VibeGridOptimusProps, GridState, OptimusColumn } from '../types'
import { useColumnAdapter } from './useColumnAdapter'
import { useBatchOperations } from './useBatchOperations'
import { useClipboardOps } from './useClipboardOps'

/**
 * Main hook for VibeGridOptimus state management and handlers
 */
export function useVibeGridOptimus<TEntity extends BaseEntity>({
  data,
  columns,
  onUpdate,
  onBatchUpdate,
  sortColumns: externalSortColumns,
  onSortColumnsChange: externalOnSortColumnsChange,
  hiddenColumns,
  columnOrder,
  enableSorting = true,
  ...props
}: VibeGridOptimusProps<TEntity>) {
  
  // Convert DataForge columns to VibeGridOptimus format
  const baseColumns = useColumnAdapter(columns, {
    hiddenColumns,
    columnOrder
  })
  
  // Just return the base columns - renderers will be added in the main component
  const optimusColumns = baseColumns
  
  // Internal sort state if not controlled externally
  const [internalSortColumns, setInternalSortColumns] = useState<readonly SortColumn[]>([])
  
  // Cell selection state
  const [selectedPosition, setSelectedPosition] = useState<{ row: number; idx: number } | null>(null)
  
  // Use external sort state if provided, otherwise internal
  const sortColumns = externalSortColumns ?? internalSortColumns
  const onSortColumnsChange = externalOnSortColumnsChange ?? setInternalSortColumns
  
  // Initialize batch operations
  const { processBatchUpdates, createBatchUpdate } = useBatchOperations({
    onUpdate,
    onBatchUpdate
  })
  
  // Initialize clipboard operations
  const { copiedCell, handleCellCopy, handleCellPaste } = useClipboardOps<TEntity>()
  
  // Sort data based on current sort columns
  const sortedData = useMemo(() => {
    if (!enableSorting || sortColumns.length === 0) return data
    
    return [...data].sort((a, b) => {
      for (const sort of sortColumns) {
        const column = optimusColumns.find(col => String(col.key) === sort.columnKey)
        if (!column) continue
        
        const aVal = a[column.key]
        const bVal = b[column.key]
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return -1
        if (bVal == null) return 1
        
        // Type-specific comparisons
        let result = 0
        switch (column.cellType) {
          case 'number':
            result = Number(aVal) - Number(bVal)
            break
          case 'date':
            result = new Date(aVal as any).getTime() - new Date(bVal as any).getTime()
            break
          case 'boolean':
            result = (aVal ? 1 : 0) - (bVal ? 1 : 0)
            break
          default:
            result = String(aVal).localeCompare(String(bVal))
        }
        
        if (result !== 0) {
          return sort.direction === 'ASC' ? result : -result
        }
      }
      return 0
    })
  }, [data, sortColumns, optimusColumns, enableSorting])
  
  // Handle cell click for row selection
  const handleCellClick = useCallback((args: any) => {
    const { row } = args
    
    // Call the row click handler if provided
    props.onRowClick?.(row)
    
    // Note: Single-click editing is now handled via onCellClick on the grid ref
  }, [props.onRowClick])
  
  // Handle row selection
  const handleSelectedRowsChange = useCallback((newSelectedRows: Set<React.Key>) => {
    if (props.onSelectedRowsChange) {
      props.onSelectedRowsChange(new Set(Array.from(newSelectedRows).map(String)))
    }
  }, [props.onSelectedRowsChange])
  
  // Handle fill down (drag to fill cells)
  const handleFill = useCallback((event: FillEvent<TEntity>): TEntity => {
    const { columnKey, sourceRow, targetRow } = event
    const column = optimusColumns.find(col => col.key === columnKey) as OptimusColumn<TEntity>
    
    // Don't allow filling system fields
    if (column?.systemField) {
      return targetRow
    }
    
    // Don't allow filling non-editable fields
    if (!column?.config?.editable) {
      return targetRow
    }
    
    // For relationship fields, copy the ID value correctly
    if (column?.cellType?.startsWith('relationship') && column.accessorKey) {
      const sourceValue = sourceRow[column.accessorKey]
      return { ...targetRow, [column.accessorKey]: sourceValue } as TEntity
    }
    
    // Copy the source value to target
    const sourceValue = sourceRow[columnKey as keyof TEntity]
    return { ...targetRow, [columnKey]: sourceValue } as TEntity
  }, [optimusColumns])
  
  // Handle copy operation
  const handleCopy = useCallback((
    { row, column }: CellCopyArgs<TEntity>,
    event: React.ClipboardEvent<HTMLDivElement>
  ): void => {
    const optimusColumn = optimusColumns.find(col => col.key === column.key) as OptimusColumn<TEntity>
    if (optimusColumn) {
      handleCellCopy(row, optimusColumn, event)
    }
  }, [optimusColumns, handleCellCopy])
  
  // Handle paste operation
  const handlePaste = useCallback((
    { row, column }: CellPasteArgs<TEntity>,
    event: React.ClipboardEvent<HTMLDivElement>
  ): TEntity => {
    const optimusColumn = optimusColumns.find(col => col.key === column.key) as OptimusColumn<TEntity>
    if (optimusColumn) {
      return handleCellPaste(row, optimusColumn, event)
    }
    return row
  }, [optimusColumns, handleCellPaste])
  
  // Handle row changes from fill operations
  const handleRowsChange = useCallback((rows: TEntity[], { indexes }: { indexes: number[] }) => {
    if (!onUpdate && !onBatchUpdate) return
    if (indexes.length === 0) return
    
    console.log('[VibeGridOptimus] 📦 Processing', indexes.length, 'row changes')
    console.log('[VibeGridOptimus] 📦 Received rows:', rows)
    console.log('[VibeGridOptimus] 📦 Changed indexes:', indexes)
    console.log('[VibeGridOptimus] 📦 Original sortedData:', sortedData)
    
    // Collect all changes for batch processing
    const batchUpdates = indexes
      .map(index => {
        const changedRow = rows[index]
        const originalRow = sortedData[index]
        
        if (!changedRow || !originalRow) {
          return null
        }
        
        console.log('[VibeGridOptimus] 🔍 Comparing index', index)
        console.log('[VibeGridOptimus] 🔍 changedRow:', changedRow)
        console.log('[VibeGridOptimus] 🔍 originalRow:', originalRow)
        console.log('[VibeGridOptimus] 🔍 Same reference?', changedRow === originalRow)
        
        if (changedRow === originalRow) {
          console.log('[VibeGridOptimus] ⚠️ Same reference detected - skipping')
          return null
        }
        
        // Find what changed
        const changes: Partial<TEntity> = {}
        Object.keys(changedRow).forEach(key => {
          const typedKey = key as keyof TEntity
          if (changedRow[typedKey] !== originalRow[typedKey]) {
            changes[typedKey] = changedRow[typedKey]
          }
        })
        
        return Object.keys(changes).length > 0 
          ? createBatchUpdate(changedRow.id, changes)
          : null
      })
      .filter((update): update is NonNullable<typeof update> => update !== null)
    
    // Process batch updates
    if (batchUpdates.length > 0) {
      processBatchUpdates(batchUpdates).catch(error => {
        console.error('[VibeGridOptimus] ❌ Batch update failed:', error)
      })
    }
  }, [sortedData, onUpdate, onBatchUpdate, createBatchUpdate, processBatchUpdates])
  
  // Handle cell selection change
  const handleSelectedCellChange = useCallback((position: { row: number; idx: number } | null) => {
    setSelectedPosition(position)
    // Additional debug logging could go here if needed
  }, [])
  
  // Grid state
  const gridState: GridState = {
    sortColumns,
    selectedPosition,
    copiedCell
  }
  
  // Return all grid props and handlers
  return {
    // Processed data and columns
    data: sortedData,
    columns: optimusColumns,
    
    // State
    state: gridState,
    
    // Handlers
    handlers: {
      onCellClick: handleCellClick,
      onSelectedRowsChange: handleSelectedRowsChange,
      onSortColumnsChange: enableSorting ? onSortColumnsChange : undefined,
      onSelectedCellChange: handleSelectedCellChange,
      onFill: handleFill,
      onCellCopy: handleCopy,
      onCellPaste: handlePaste,
      onRowsChange: handleRowsChange
    }
  }
}