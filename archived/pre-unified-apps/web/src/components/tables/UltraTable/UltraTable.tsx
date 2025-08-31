/**
 * Ultra-Performance Virtualized Table Component
 * 
 * Leverages react-virtuoso's TableVirtuoso for:
 * - Sub-50ms full screen renders (1000+ rows)
 * - Smooth 60fps scrolling with virtualization
 * - Legend State granular updates for changed cells only
 * - Minimal React reconciliation overhead
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { TableVirtuoso } from 'react-virtuoso'
import { use$ } from '@legendapp/state/react'
import { observable } from '@legendapp/state'
import { cn } from '@/lib/utils'
import { UltraTableCell } from './UltraTableCell'
import { UltraTableEditor } from './UltraTableEditor'
import { UltraTableSelection } from './UltraTableSelection'
import { useUltraTableSelection } from './hooks/use-ultra-table-selection'
import { PortalSelectionOverlay } from './components/PortalSelectionOverlay'
import { selectionState$ } from './state/selection-state'
import type { 
  UseTableEntityResult, 
  TableColumn, 
  TableSorting,
  UseTableEntityOptions 
} from '@/legend-state/hooks/use-table-entity'
import { useTableEntity$ } from '@/legend-state/hooks/use-table-entity'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface UltraTableProps {
  /** Entity name to display */
  entityName: string
  /** External data array (optional - will fetch from Legend State if not provided) */
  data?: any[]
  /** Entity schema (optional - will infer from Legend State if not provided) */
  schema?: any
  /** Table configuration options */
  options?: UseTableEntityOptions
  /** Table height - defaults to 400px */
  height?: number
  /** Additional CSS classes */
  className?: string
  /** Show header */
  showHeader?: boolean
  /** Enable cell editing */
  enableEditing?: boolean
  /** Custom cell renderers by column key */
  cellRenderers?: Record<string, (value: any, row: any, rowIndex: number) => React.ReactNode>
}

/**
 * Ultra-performance table with sub-50ms rendering
 * 
 * Architecture:
 * - TableVirtuoso handles virtualization (only renders visible rows)
 * - UltraTableCell provides granular Legend State reactivity
 * - Portal-based editing overlay (UltraTableEditor)
 * - CSS-based selection highlighting (UltraTableSelection)
 * - Minimal React component tree for maximum performance
 */
export function UltraTable({
  entityName,
  data: externalData,
  schema: externalSchema,
  options = {},
  height = 400,
  className,
  showHeader = true,
  enableEditing = true,
  cellRenderers = {}
}: UltraTableProps) {
  const tableRef = useRef<any>(null)
  const tableElementRef = useRef<HTMLTableElement>(null)
  
  // Always call hooks in same order - conditionally use results
  const shouldUseLegendState = !externalData
  const legendStateResult = useTableEntity$(entityName, options)
  
  // Always call use$ hooks to maintain hook order consistency
  const legendStateData = use$(legendStateResult.tableData$)
  const legendStateColumns = use$(legendStateResult.columns$)
  const legendStateSorting = use$(legendStateResult.sorting$)
  
  // Choose data source based on shouldUseLegendState flag
  const tableData = shouldUseLegendState ? legendStateData : (externalData || [])
  const loading = shouldUseLegendState ? legendStateResult.loading : false
  const error = shouldUseLegendState ? legendStateResult.error : null

  // Create simple columns from external data if provided
  const simpleColumns = useMemo(() => {
    if (!externalData || !externalData.length) return []
    
    const sampleRow = externalData[0]
    return Object.keys(sampleRow).map(key => {
      const value = sampleRow[key]
      let type = typeof value === 'number' ? 'number' : 
            typeof value === 'boolean' ? 'boolean' :
            value instanceof Date ? 'date' : 'string'
      
      // Detect select fields based on content patterns
      let options: string[] | undefined
      if (key.toLowerCase().includes('status')) {
        type = 'select'
        options = ['active', 'inactive', 'pending', 'archived']
      } else if (key.toLowerCase().includes('type')) {
        type = 'select'
        options = ['client', 'lead', 'prospect', 'customer', 'partner']
      } else if (key.toLowerCase().includes('category')) {
        type = 'select'
        options = ['basic', 'standard', 'premium', 'enterprise']
      } else if (key.toLowerCase().includes('industry')) {
        type = 'select'
        options = ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Services', 'Retail']
      }
      
      // Default widths based on type and content
      let defaultWidth = 120 // Base width
      if (type === 'number') defaultWidth = 100
      else if (type === 'boolean') defaultWidth = 80
      else if (type === 'date') defaultWidth = 120
      else if (type === 'select') defaultWidth = 120
      else if (key === 'id') defaultWidth = 180
      else if (key.toLowerCase().includes('name')) defaultWidth = 200
      else if (key.toLowerCase().includes('description')) defaultWidth = 300
      else if (key.toLowerCase().includes('status')) defaultWidth = 120
      else if (key.toLowerCase().includes('amount')) defaultWidth = 120

      return {
        key,
        header: formatHeaderName(key),
        field: key,
        width: defaultWidth,
        type,
        options,
        sortable: true,
        filterable: true
      }
    })
  }, [externalData])

  // Choose data source based on shouldUseLegendState flag (hooks already called above)
  const columns = shouldUseLegendState ? legendStateColumns : simpleColumns
  const currentSorting = shouldUseLegendState ? legendStateSorting : null
  const totalCount = shouldUseLegendState ? legendStateResult.totalCount : (externalData ? externalData.length : 0)
  const filteredCount = shouldUseLegendState ? legendStateResult.filteredCount : (externalData ? externalData.length : 0)
  const actions = shouldUseLegendState ? legendStateResult.actions : {
    setSorting: () => {},
    getRow$: (index: number) => externalData && externalData[index] ? observable(externalData[index]) : null
  }

  // Enhanced columns with custom renderers
  const enhancedColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      render: cellRenderers[col.key] || col.render
    }))
  }, [columns, cellRenderers])

  // Local state for editing
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number
    columnIndex: number
    field: string
    value: any
  } | null>(null)

  // Enhanced selection hook - always call to maintain hook order
  const selection = useUltraTableSelection({
    tableData: tableData || [],
    columns: enhancedColumns || [],
    onCellEdit: (rowIndex, field, newValue, oldValue) => {
      console.log('Cell edited:', { rowIndex, field, oldValue, newValue })
    },
    enableKeyboardShortcuts: enhancedColumns.length > 0 // Only enable shortcuts when columns are ready
  })

  // Virtualized selection overlay system
  // Portal selection overlay that renders outside table DOM
  const portalRef = useRef<{ updateScroll: (location: any) => void } | null>(null)
  
  

  // Event handlers optimized for performance
  const handleCellClick = useCallback((rowIndex: number, columnIndex: number, field: string, event?: MouseEvent) => {
    if (options.enableSelection !== false) {
      // Use enhanced selection logic (cell-level, not row-level)
      selection.handleCellClick(rowIndex, columnIndex, field, event)
      
    }
  }, [tableData, options.enableSelection, selection.handleCellClick])

  const handleCellDoubleClick = useCallback((rowIndex: number, columnIndex: number, field: string, currentValue: any) => {
    if (!enableEditing) return
    
    console.log('Double-click triggered:', { rowIndex, columnIndex, field, currentValue, enableEditing })
    
    // Use enhanced selection double-click logic
    selection.handleCellDoubleClick(rowIndex, columnIndex, field, currentValue)
    
    // Maintain existing editing logic
    const columnConfig = enhancedColumns[columnIndex]
    console.log('Column config for editing:', { columnIndex, field, columnConfig })
    
    setEditingCell({
      rowIndex,
      columnIndex,
      field,
      value: currentValue
    })
  }, [enableEditing, selection.handleCellDoubleClick, enhancedColumns])

  const handleHeaderClick = useCallback((column: TableColumn) => {
    if (!column.sortable) return

    const current = currentSorting
    let newDirection: 'asc' | 'desc' | null = 'asc'

    if (current?.field === column.field) {
      if (current.direction === 'asc') {
        newDirection = 'desc'
      } else if (current.direction === 'desc') {
        newDirection = null
      }
    }

    actions.setSorting(column.field, newDirection)
  }, [currentSorting, actions])

  const handleEditComplete = useCallback((newValue: any) => {
    if (!editingCell) return

    const { rowIndex, field, value: oldValue } = editingCell
    
    // Update Legend State observable directly
    if (shouldUseLegendState) {
      const row$ = actions.getRow$(rowIndex)
      if (row$) {
        // Get the nested observable for the field
        const fieldPath = field.split('.')
        let targetObservable = row$
        
        // Navigate to nested field if needed
        for (let i = 0; i < fieldPath.length - 1; i++) {
          targetObservable = targetObservable[fieldPath[i]]
          if (!targetObservable) break
        }
        
        if (targetObservable) {
          const finalField = fieldPath[fieldPath.length - 1]
          targetObservable[finalField].set(newValue)
          
          console.log('Legend State edit complete:', {
            rowIndex,
            field,
            oldValue,
            newValue
          })
        }
      }
    } else {
      // For external data, update the array directly
      if (externalData && externalData[rowIndex]) {
        const fieldPath = field.split('.')
        let target = externalData[rowIndex]
        
        // Navigate to nested field if needed
        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (target[fieldPath[i]] === undefined) {
            target[fieldPath[i]] = {}
          }
          target = target[fieldPath[i]]
        }
        
        target[fieldPath[fieldPath.length - 1]] = newValue
        
        console.log('External data edit complete:', {
          rowIndex,
          field,
          oldValue,
          newValue
        })
      }
    }

    setEditingCell(null)
  }, [editingCell, shouldUseLegendState, actions, externalData])

  const handleEditCancel = useCallback(() => {
    setEditingCell(null)
  }, [])

  // Row component for virtualization - returns only cells, TableVirtuoso handles <tr>
  const RowComponent = useCallback((index: number) => {
    const row = tableData[index]
    if (!row) {
      console.log(`[UltraTable] Row ${index} not found in tableData (length: ${tableData.length})`)
      return null
    }

    const rowId = String(row.id || index)
    const isSelected = selection.isRowSelected(rowId)
    const row$ = actions.getRow$(index)

    if (!row$) {
      console.log(`[UltraTable] Row$ null for index ${index}, row:`, row)
      // For external data, create a simple observable-like object
      if (externalData) {
        const mockRow$ = {
          get: () => row,
          peek: () => row
        } as any
        
        return (
          <>
            {enhancedColumns.map((column, columnIndex) => (
              <UltraTableCell
                key={column.key}
                row$={mockRow$}
                column={column}
                rowIndex={index}
                columnIndex={columnIndex}
                onCellClick={handleCellClick}
                onCellDoubleClick={handleCellDoubleClick}
                isSelected={selection.isCellSelected(index, columnIndex)}
                isFocused={selection.isCellFocused(index, columnIndex)}
              />
            ))}
          </>
        )
      }
      return null
    }

    return (
      <>
        {enhancedColumns.map((column, columnIndex) => (
          <UltraTableCell
            key={column.key}
            row$={row$}
            column={column}
            rowIndex={index}
            columnIndex={columnIndex}
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
            isSelected={selection.isCellSelected(index, columnIndex)}
            isFocused={selection.isCellFocused(index, columnIndex)}
          />
        ))}
      </>
    )
  }, [tableData, enhancedColumns, actions, handleCellClick, handleCellDoubleClick])

  // Header component - returns only header cells for TableVirtuoso fixedHeaderContent
  const HeaderComponent = useCallback(() => {
    if (!showHeader) return null

    return (
      <>
        {enhancedColumns.map((column) => {
          const isSorted = currentSorting?.field === column.field
          const sortDirection = isSorted ? currentSorting?.direction : null

          return (
            <th
              key={column.key}
              className={cn(
                'px-2 py-1 text-left text-xs font-medium text-muted-foreground',
                'border-b border-border',
                column.sortable && 'cursor-pointer hover:text-foreground transition-colors',
                isSorted && 'text-foreground'
              )}
              style={{ 
                width: column.width, 
                minWidth: column.minWidth || column.width,
                maxWidth: column.width 
              }}
              onClick={() => column.sortable && handleHeaderClick(column)}
              role="columnheader"
              aria-sort={
                isSorted 
                  ? sortDirection === 'asc' ? 'ascending' : 'descending'
                  : undefined
              }
            >
              <div className="flex items-center justify-between">
                <span>{column.header}</span>
                {column.sortable && (
                  <div className="ml-2 flex flex-col">
                    {isSorted && sortDirection === 'asc' && (
                      <ChevronUp className="h-3 w-3" />
                    )}
                    {isSorted && sortDirection === 'desc' && (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {!isSorted && (
                      <div className="h-3 w-3 opacity-30">
                        <ChevronUp className="h-2 w-3" />
                        <ChevronDown className="h-2 w-3 -mt-1" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </th>
          )
        })}
      </>
    )
  }, [enhancedColumns, currentSorting, showHeader, handleHeaderClick])

  // Loading state
  if (loading) {
    return (
      <div 
        className={cn('border rounded-lg bg-background', className)}
        style={{ height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading {entityName} data...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div 
        className={cn('border rounded-lg bg-background', className)}
        style={{ height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-destructive">
            <p className="font-medium">Error loading table data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (tableData.length === 0) {
    return (
      <div 
        className={cn('border rounded-lg bg-background', className)}
        style={{ height }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <p className="font-medium">No {entityName} records found</p>
            <p className="text-sm mt-1">
              {totalCount > 0 ? 'All records are filtered out' : 'Add some data to get started'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={selection.tableRef} className={cn('border rounded-lg bg-background overflow-hidden relative', className)}>
      {/* CSS for cell selection - global scope */}
      <style dangerouslySetInnerHTML={{__html: `
        table td[data-selected="true"] {
          background-color: red !important;
          border: 5px solid blue !important;
          box-sizing: border-box !important;
        }
        table td[data-focused="true"] {
          border: 3px solid purple !important;
          box-sizing: border-box !important;
          position: relative !important;
          z-index: 10 !important;
        }
        table td[data-in-range="true"] {
          background-color: yellow !important;
          border: 1px solid orange !important;
          box-sizing: border-box !important;
        }
      `}} />
      
      {/* Table Stats */}
      <div className="px-4 py-2 border-b border-border/50 bg-muted/10 text-xs text-muted-foreground">
        Showing {filteredCount} of {totalCount} records
        {selection.stats.rowCount > 0 && ` • ${selection.stats.rowCount} rows selected`}
        {selection.stats.cellCount > 0 && ` • ${selection.stats.cellCount} cells selected`}
      </div>

      {/* Virtualized Table */}
      <TableVirtuoso
        ref={tableRef}
        style={{ 
          height: Math.max(height - 40, 300), 
          width: '100%',
          contain: 'layout style paint'
        }}
        data={tableData}
        fixedHeaderContent={showHeader ? () => (
          <tr>
            {HeaderComponent()}
          </tr>
        ) : undefined}
        components={{
          Table: ({ style, ...props }) => (
            <table
              {...props}
              ref={tableElementRef}
              style={{
                ...style,
                width: '100%',
                height: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed'
              }}
              className="w-full h-full"
              role="grid"
            />
          ),
          TableHead: ({ style, ...props }) => (
            <thead {...props} style={{ ...style, backgroundColor: 'rgb(249 250 251 / 0.8)' }} />
          ),
          TableBody: ({ style, ...props }) => (
            <tbody {...props} style={style} role="rowgroup" />
          ),
          TableRow: ({ index, style, ...props }) => {
            const row = tableData[index]
            if (!row) return <tr {...props} style={style} />
            
            const rowId = String(row.id || index)
            const isSelected = selection.isRowSelected(rowId)
            
            return (
              <tr
                {...props}
                style={style}
                className={cn(
                  'border-b border-border/50 transition-colors duration-75',
                  isSelected && 'bg-accent/10',
                  'hover:bg-muted/20'
                )}
                data-row-index={index}
                data-row-id={rowId}
                data-selected={isSelected}
              />
            )
          }
        }}
        itemContent={(index) => RowComponent(index)}
        // Performance optimizations
        overscan={5} // Render a few extra rows for smooth scrolling
        increaseViewportBy={200} // Increase viewport for better UX
        // Portal scroll tracking
        onScroll={(location) => portalRef.current?.updateScroll(location)}
      />


      {/* Selection Overlay */}
      {options.enableSelection !== false && selection.stats.rowCount > 0 && (
        <UltraTableSelection
          selectedCount={selection.stats.rowCount}
          totalCount={filteredCount}
          onSelectAll={() => {
            const allIds = tableData.map(row => String(row.id)).filter(Boolean)
            allIds.forEach(id => selection.selectRow(id))
          }}
          onClearSelection={selection.clearSelection}
        />
      )}

      {/* Selection Overlay - Temporarily disabled due to React hooks issue */}
      {/* <SelectionOverlay tableElement={tableElementRef.current} /> */}

      {/* Edit Overlay */}
      {editingCell && (() => {
        const columnConfig = enhancedColumns[editingCell.columnIndex]
        console.log('Rendering UltraTableEditor:', { editingCell, columnConfig })
        return (
          <UltraTableEditor
            value={editingCell.value}
            field={editingCell.field}
            rowIndex={editingCell.rowIndex}
            columnIndex={editingCell.columnIndex}
            type={columnConfig?.type}
            options={columnConfig?.options}
            onComplete={handleEditComplete}
            onCancel={handleEditCancel}
          />
        )
      })()}

    </div>
  )
}

/**
 * Format a field key into a proper header name
 * Removes underscores and capitalizes words
 */
function formatHeaderName(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}