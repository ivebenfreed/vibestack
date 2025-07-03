import React from 'react'
import { DataGrid, type DataGridHandle } from 'react-data-grid'
import type { VibeGridOptimusProps } from './types'
import { useEntityConfig } from './hooks/useEntityConfig'
import { useColumnAdapter } from './hooks/useColumnAdapter'
import { useBatchOperations } from './hooks/useBatchOperations'
import { useClipboardOps } from './hooks/useClipboardOps'
import { CellRenderer } from './renderers/CellRenderer'
import { CellEditor } from './editors/CellEditor'
import { GRID_DEFAULTS, CSS_CLASSES } from './utils/constants'
import 'react-data-grid/lib/styles.css'
import './VibeGridOptimus.css'

/**
 * VibeGridOptimus - Clean declarative data grid with automatic configuration
 * 
 * Key Features:
 * - Declarative entity-based API (9 props instead of 20+)
 * - Automatic column and relationship resolution from DataForge
 * - All existing editors preserved (ComboboxEditor, relationships, etc.)
 * - Full react-data-grid features (copy/paste, drag fill, keyboard nav)
 * - Type-safe with entity name system
 * - Intelligent batch update processing
 */
export function VibeGridOptimus(props: VibeGridOptimusProps) {
  const {
    entityName,
    data,
    onSave,
    height = GRID_DEFAULTS.height,
    theme = GRID_DEFAULTS.theme,
    className = '',
    style = {},
    isLoading = false,
    error = null
  } = props
  
  console.log('[VibeGridOptimus] Declarative mode:', {
    entityName,
    dataLength: data?.length || 0,
    theme
  })
  
  // Grid ref for advanced operations
  const gridRef = React.useRef<DataGridHandle>(null)
  
  // Auto-resolve entity configuration including save handler
  const { columns: enhancedColumns, relationshipData, saveHandler, configError } = useEntityConfig(entityName)
  
  // Convert enhanced columns to react-data-grid format
  const baseColumns = useColumnAdapter(enhancedColumns as any, {})
  
  // State management
  const [sortColumns, setSortColumns] = React.useState<readonly import('react-data-grid').SortColumn[]>([])
  const [selectedPosition, setSelectedPosition] = React.useState<{ row: number; idx: number } | null>(null)
  
  // Use provided onSave or automatic save handler
  const finalSaveHandler = onSave || saveHandler
  
  // Initialize enhanced batch operations
  const { processBatch, pendingUpdates, clearBatch } = useBatchOperations(finalSaveHandler)
  
  // Initialize clipboard operations
  const { copiedCell, handleCellCopy, handleCellPaste } = useClipboardOps()
  
  // Direct save handler for individual editor commits (bypasses batching)
  const stableOnUpdate = React.useCallback(async (id: string, column: string, value: any) => {
    console.log('[VibeGridOptimus] 🔄 Direct save called:', { id, column, value })
    if (finalSaveHandler) {
      await finalSaveHandler(id, column, value)
    }
  }, [finalSaveHandler])
  
  // Sort data based on current sort columns
  const sortedData = React.useMemo(() => {
    if (sortColumns.length === 0) return data
    
    return [...data].sort((a, b) => {
      for (const sort of sortColumns) {
        const column = baseColumns.find(col => String(col.key) === sort.columnKey)
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
  }, [data, sortColumns, baseColumns])
  
  
  // Handle content click for single-click editing (triggered from renderer components)
  const handleContentClick = React.useCallback((rowIdx: number, columnKey: string, event: React.MouseEvent) => {
    // Stop propagation to prevent normal cell selection
    event.stopPropagation()
    
    // Find the column configuration
    const optimusColumn = baseColumns.find(col => col.key === columnKey)
    
    // If column is editable, enter edit mode using the correct react-data-grid API
    if (optimusColumn?.config?.editable && gridRef.current) {
      console.log('[VibeGridOptimus] 🎯 Entering edit mode for content click:', {
        rowIdx,
        columnKey,
        idx: optimusColumn.idx
      })
      
      // Use selectCell with enableEditor option to enter edit mode
      gridRef.current.selectCell({ rowIdx, idx: optimusColumn.idx || 0 }, { enableEditor: true })
    }
  }, [baseColumns])

  // Add renderers to columns - React Compiler will optimize this automatically
  const optimusColumns = baseColumns.map((column) => ({
    ...column,
    // React-data-grid requires this property for edit functionality
    editable: column.config?.editable || false,
    renderCell: (cellProps: any) => (
      <CellRenderer
        row={cellProps.row}
        column={column}
        value={cellProps.row[column.key]}
        rowIndex={cellProps.rowIdx}
        onContentClick={handleContentClick}
      />
    ),
    // Rich editor for editable cells
    ...(column.config?.editable && {
      renderEditCell: (editProps: any) => (
        <CellEditor
          row={editProps.row}
          column={column}
          onRowChange={editProps.onRowChange}
          onClose={editProps.onClose}
          onUpdate={finalSaveHandler ? stableOnUpdate : undefined}
        />
      ),
      editorOptions: {
        // Only keep background content visible for non-text editors (enums, relationships)
        // Text editors need clean input fields without background content
        displayCellContent: column.cellType !== 'text' && column.cellType !== 'number'
      }
    })
  }))
  
  // Debug the final columns before passing to DataGrid
  console.log('[VibeGridOptimus] Processing columns:', baseColumns.length)
  console.log('[VibeGridOptimus] Final optimusColumns for DataGrid:', optimusColumns)
  console.log('[VibeGridOptimus] optimusColumns is Array?', Array.isArray(optimusColumns))
  console.log('[VibeGridOptimus] optimusColumns type:', typeof optimusColumns)
  
  if (optimusColumns && Array.isArray(optimusColumns) && optimusColumns.length > 0) {
    console.log('[VibeGridOptimus] Sample column structure:', optimusColumns[0])
  }
  
  // Handle errors
  if (configError) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Configuration Error</div>
          <div className="text-sm">{configError}</div>
        </div>
      </div>
    )
  }
  
  // Early return if no columns
  if (!Array.isArray(optimusColumns) || optimusColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">No columns available</div>
          <div className="text-sm">No columns configured for entity: {entityName}</div>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Error loading data</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg border border-border">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }
  
  // Empty state
  if (sortedData.length === 0) {
    return (
      <div className="flex flex-col h-64">
        {toolbar}
        <div className="flex-1 flex items-center justify-center bg-muted rounded-lg border border-border">
          {emptyState || (
            <div className="text-center text-muted-foreground">
              <div className="text-lg font-medium mb-2">No data available</div>
              <div className="text-sm">There are no items to display</div>
            </div>
          )}
        </div>
        {footer}
      </div>
    )
  }
  
  // Handle fill operations
  const handleFill = React.useCallback((event: import('react-data-grid').FillEvent<any>): any => {
    const { columnKey, sourceRow, targetRow } = event
    const column = optimusColumns.find(col => col.key === columnKey)
    
    // Don't allow filling system fields or non-editable fields
    if (column?.systemField || !column?.config?.editable) {
      return targetRow
    }
    
    // For relationship fields, copy the ID value correctly
    if (column?.cellType?.startsWith('relationship') && column.accessorKey) {
      const sourceValue = sourceRow[column.accessorKey]
      return { ...targetRow, [column.accessorKey]: sourceValue }
    }
    
    // Copy the source value to target
    const sourceValue = sourceRow[columnKey]
    return { ...targetRow, [columnKey]: sourceValue }
  }, [optimusColumns])

  // Handle rows change for enhanced batch operations
  const handleRowsChange = React.useCallback((rows: any[], { indexes }: { indexes: number[] }) => {
    if (!onSave || indexes.length === 0) return
    
    console.log('[VibeGridOptimus] Processing', indexes.length, 'row changes with enhanced batching')
    
    // Process each row change through intelligent batching
    indexes.forEach(index => {
      const changedRow = rows[index]
      const originalRow = sortedData[index]
      
      if (!changedRow || !originalRow || changedRow === originalRow) {
        return
      }
      
      // Find what changed and batch each column update
      Object.keys(changedRow).forEach(column => {
        if (changedRow[column] !== originalRow[column]) {
          processBatch(changedRow.id, column, changedRow[column]).catch(error => {
            console.error('[VibeGridOptimus] Batch column update failed:', error)
          })
        }
      })
    })
  }, [sortedData, onSave, processBatch])

  return (
    <div className={`${CSS_CLASSES.container} theme-${theme} ${className} relative`} style={style}>
      {/* Enhanced batch operations feedback */}
      {pendingUpdates > 0 && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
          {pendingUpdates} pending update{pendingUpdates > 1 ? 's' : ''}
        </div>
      )}
      
      <div className="flex-1 border border-border rounded-lg overflow-hidden" style={{ height }}>
        <DataGrid
          ref={gridRef}
          columns={optimusColumns}
          rows={sortedData}
          sortColumns={sortColumns}
          onSortColumnsChange={setSortColumns}
          selectedPosition={selectedPosition}
          onSelectedCellChange={setSelectedPosition}
          cellNavigationMode="CHANGE_ROW"
          enableVirtualization={true}
          onFill={handleFill}
          onCellCopy={handleCellCopy}
          onCellPaste={handleCellPaste}
          onRowsChange={handleRowsChange}
          className={`${theme === 'dark' ? 'rdg-dark' : 'rdg-light'} rdg-spreadsheet`}
          style={{ height }}
        />
      </div>
    </div>
  )
}