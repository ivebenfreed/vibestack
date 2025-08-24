/**
 * Ultra-Performance Virtualized Table Component
 * 
 * Leverages react-virtuoso's TableVirtuoso for:
 * - Sub-50ms full screen renders (1000+ rows)
 * - Smooth 60fps scrolling with virtualization
 * - Legend State granular updates for changed cells only
 * - Minimal React reconciliation overhead
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { TableVirtuoso } from 'react-virtuoso'
import { use$ } from '@legendapp/state/react'
import { observable } from '@legendapp/state'
import { cn } from '@/lib/utils'
import { UltraTableCell } from './UltraTableCell'
import { UltraTableEditor } from './UltraTableEditor'
import { UltraTableSelection } from './UltraTableSelection'
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
  
  // Always call hooks in same order - conditionally use results
  const shouldUseLegendState = !externalData
  const legendStateResult = useTableEntity$(entityName, options)
  
  // Always call use$ hooks to maintain hook order consistency
  const legendStateData = use$(legendStateResult.tableData$)
  const legendStateColumns = use$(legendStateResult.columns$)
  const legendStateSorting = use$(legendStateResult.sorting$)
  const legendStateSelectedIds = use$(legendStateResult.selectedIds$)
  
  // Choose data source based on shouldUseLegendState flag
  const tableData = shouldUseLegendState ? legendStateData : (externalData || [])
  const loading = shouldUseLegendState ? legendStateResult.loading : false
  const error = shouldUseLegendState ? legendStateResult.error : null

  // Local state for editing
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number
    columnIndex: number
    field: string
    value: any
  } | null>(null)

  // Create simple columns from external data if provided
  const simpleColumns = useMemo(() => {
    if (!externalData || !externalData.length) return []
    
    const sampleRow = externalData[0]
    return Object.keys(sampleRow).map(key => {
      const value = sampleRow[key]
      const type = typeof value === 'number' ? 'number' : 
            typeof value === 'boolean' ? 'boolean' :
            value instanceof Date ? 'date' : 'string'
      
      // Default widths based on type and content
      let defaultWidth = 120 // Base width
      if (type === 'number') defaultWidth = 100
      else if (type === 'boolean') defaultWidth = 80
      else if (type === 'date') defaultWidth = 120
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
        sortable: true,
        filterable: true
      }
    })
  }, [externalData])

  // Choose data source based on shouldUseLegendState flag (hooks already called above)
  const columns = shouldUseLegendState ? legendStateColumns : simpleColumns
  const currentSorting = shouldUseLegendState ? legendStateSorting : null
  const selectedIds = shouldUseLegendState ? legendStateSelectedIds : new Set()
  const totalCount = shouldUseLegendState ? legendStateResult.totalCount : (externalData ? externalData.length : 0)
  const filteredCount = shouldUseLegendState ? legendStateResult.filteredCount : (externalData ? externalData.length : 0)
  const actions = shouldUseLegendState ? legendStateResult.actions : {
    setSorting: () => {},
    toggleRowSelection: () => {},
    selectAll: () => {},
    clearSelection: () => {},
    getRow$: (index: number) => externalData && externalData[index] ? observable(externalData[index]) : null
  }

  // Enhanced columns with custom renderers
  const enhancedColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      render: cellRenderers[col.key] || col.render
    }))
  }, [columns, cellRenderers])

  // Event handlers optimized for performance
  const handleCellClick = useCallback((rowIndex: number, columnIndex: number, field: string) => {
    if (options.enableSelection !== false) {
      const row = tableData[rowIndex]
      const id = row?.id
      if (id) {
        actions.toggleRowSelection(String(id))
      }
    }
  }, [tableData, actions, options.enableSelection])

  const handleCellDoubleClick = useCallback((rowIndex: number, columnIndex: number, field: string, currentValue: any) => {
    if (!enableEditing) return
    
    setEditingCell({
      rowIndex,
      columnIndex,
      field,
      value: currentValue
    })
  }, [enableEditing])

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

    // TODO: Implement Legend State mutation
    // This would typically update the entity observable directly
    console.log('Edit complete:', {
      rowIndex: editingCell.rowIndex,
      field: editingCell.field,
      oldValue: editingCell.value,
      newValue
    })

    setEditingCell(null)
  }, [editingCell])

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
    const isSelected = selectedIds.has(rowId)
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
                isSelected={isSelected}
                onCellClick={handleCellClick}
                onCellDoubleClick={handleCellDoubleClick}
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
            isSelected={isSelected}
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
          />
        ))}
      </>
    )
  }, [tableData, enhancedColumns, selectedIds, actions, handleCellClick, handleCellDoubleClick])

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
    <div className={cn('border rounded-lg bg-background overflow-hidden', className)}>
      {/* Table Stats */}
      <div className="px-4 py-2 border-b border-border/50 bg-muted/10 text-xs text-muted-foreground">
        Showing {filteredCount} of {totalCount} records
        {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
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
            const isSelected = selectedIds.has(rowId)
            
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
      />

      {/* Selection Overlay */}
      {options.enableSelection !== false && selectedIds.size > 0 && (
        <UltraTableSelection
          selectedCount={selectedIds.size}
          totalCount={filteredCount}
          onSelectAll={actions.selectAll}
          onClearSelection={actions.clearSelection}
        />
      )}

      {/* Edit Overlay */}
      {editingCell && (
        <UltraTableEditor
          value={editingCell.value}
          field={editingCell.field}
          rowIndex={editingCell.rowIndex}
          columnIndex={editingCell.columnIndex}
          onComplete={handleEditComplete}
          onCancel={handleEditCancel}
        />
      )}
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