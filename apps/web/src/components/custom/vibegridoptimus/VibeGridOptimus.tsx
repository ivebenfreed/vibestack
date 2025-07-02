import React from 'react'
import { DataGrid, type DataGridHandle } from 'react-data-grid'
import type { BaseEntity, VibeGridOptimusProps } from './types'
import { useVibeGridOptimus } from './hooks/useVibeGridOptimus'
import { CellRenderer } from './renderers/CellRenderer'
import { CellEditor } from './editors/CellEditor'
import { GRID_DEFAULTS, CSS_CLASSES } from './utils/constants'
import 'react-data-grid/lib/styles.css'
import './VibeGridOptimus.css'

/**
 * VibeGridOptimus - Next generation data grid built on react-data-grid
 * 
 * Key Features:
 * - Clean hook-based architecture with separated concerns
 * - 100% DataForge integration with generated types and columns
 * - Optimized performance with proper memoization
 * - Full native react-data-grid feature support (copy/paste, drag fill, keyboard nav)
 * - Type-safe cell renderers and editors
 * - Intelligent batch update processing
 * - Zero conflict CSS with native features
 */
export function VibeGridOptimus<TEntity extends BaseEntity>(
  props: VibeGridOptimusProps<TEntity>
) {
  console.log('[VibeGridOptimus] Component called with props:', {
    dataLength: props.data?.length || 0,
    columnsType: typeof props.columns,
    columnsKeys: props.columns ? Object.keys(props.columns) : 'undefined'
  })
  
  const {
    height = GRID_DEFAULTS.height,
    theme = GRID_DEFAULTS.theme,
    enableVirtualization = GRID_DEFAULTS.enableVirtualization,
    enableRowSelection = GRID_DEFAULTS.enableRowSelection,
    isLoading = false,
    error = null,
    toolbar,
    footer,
    emptyState,
    className = '',
    style = {},
    selectedRows,
    // Remove any props that might interfere with DataGrid
    data: _data,
    columns: _columns,
    onUpdate: _onUpdate,
    onBatchUpdate: _onBatchUpdate,
    onRowClick: _onRowClick,
    hiddenColumns: _hiddenColumns,
    columnOrder: _columnOrder,
    ...restProps
  } = props
  
  // Grid ref for advanced operations
  const gridRef = React.useRef<DataGridHandle>(null)
  
  // Early return if columns are not properly provided
  if (!props.columns || typeof props.columns !== 'object') {
    console.warn('[VibeGridOptimus] Invalid columns prop:', props.columns)
    return (
      <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Invalid columns configuration</div>
          <div className="text-sm">Columns prop is required and must be an object</div>
        </div>
      </div>
    )
  }
  
  // Use main hook for all grid logic
  const {
    data: sortedData,
    columns: baseColumns,
    state,
    handlers
  } = useVibeGridOptimus(props)
  
  
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

  // Add renderers to columns
  const optimusColumns = React.useMemo(() => {
    console.log('[VibeGridOptimus] useMemo called with baseColumns:', baseColumns)
    
    // Defensive programming - ensure baseColumns is an array
    if (!Array.isArray(baseColumns)) {
      console.warn('[VibeGridOptimus] baseColumns is not an array:', baseColumns)
      console.warn('[VibeGridOptimus] Type of baseColumns:', typeof baseColumns)
      console.warn('[VibeGridOptimus] Original columns prop:', props.columns)
      return []
    }
    
    if (baseColumns.length === 0) {
      console.warn('[VibeGridOptimus] baseColumns is empty array')
      return []
    }
    
    console.log('[VibeGridOptimus] Processing', baseColumns.length, 'columns')
    
    // Debug: Log column editability
    baseColumns.forEach((column, index) => {
      console.log(`[VibeGridOptimus] Column ${index}: ${String(column.key)} - editable: ${column.config?.editable}, cellType: ${column.cellType}`)
    })
    
    return baseColumns.map((column, columnIndex) => ({
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
            onUpdate={props.onUpdate}
          />
        ),
        editorOptions: {
          // Only keep background content visible for non-text editors (enums, relationships)
          // Text editors need clean input fields without background content
          displayCellContent: column.cellType !== 'text' && column.cellType !== 'number'
        }
      })
    }))
  }, [baseColumns])
  
  // Debug the final columns before passing to DataGrid
  console.log('[VibeGridOptimus] Final optimusColumns for DataGrid:', optimusColumns)
  console.log('[VibeGridOptimus] optimusColumns is Array?', Array.isArray(optimusColumns))
  console.log('[VibeGridOptimus] optimusColumns type:', typeof optimusColumns)
  
  if (optimusColumns && Array.isArray(optimusColumns) && optimusColumns.length > 0) {
    console.log('[VibeGridOptimus] Sample column structure:', optimusColumns[0])
  }
  
  // Early return if no columns or invalid columns
  if (!Array.isArray(optimusColumns) || optimusColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">No columns available</div>
          <div className="text-sm">
            Column processing resulted in {!Array.isArray(optimusColumns) ? 'invalid column type' : 'empty column list'}
          </div>
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
  
  return (
    <div className={`${CSS_CLASSES.container} theme-${theme} ${className}`} style={style}>
      {toolbar}
      
      <div className="flex-1 border border-border rounded-lg overflow-hidden" style={{ height }}>
        <DataGrid
          ref={gridRef}
          columns={optimusColumns}
          rows={sortedData}
          sortColumns={state.sortColumns}
          onSortColumnsChange={handlers.onSortColumnsChange}
          selectedRows={selectedRows}
          onSelectedRowsChange={enableRowSelection ? handlers.onSelectedRowsChange : undefined}
          selectedPosition={state.selectedPosition}
          onSelectedCellChange={handlers.onSelectedCellChange}
          cellNavigationMode="CHANGE_ROW"
          enableVirtualization={enableVirtualization}
          onFill={handlers.onFill}
          onCellCopy={handlers.onCellCopy}
          onCellPaste={handlers.onCellPaste}
          onRowsChange={handlers.onRowsChange}
          onCellDoubleClick={handlers.onCellClick}
          className={`${theme === 'dark' ? 'rdg-dark' : 'rdg-light'} rdg-spreadsheet`}
          style={{ height: '100%' }}
          {...restProps}
        />
      </div>
      
      {footer}
    </div>
  )
}