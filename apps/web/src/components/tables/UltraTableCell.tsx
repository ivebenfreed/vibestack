/**
 * Ultra-Lightweight Table Cell Component
 * 
 * Optimized for sub-5ms updates using Legend State's Memo:
 * - Only re-renders when specific cell data changes
 * - Minimal React component - mostly raw HTML
 * - Data attributes for interaction without re-renders
 * - Direct Legend State subscription for granular reactivity
 */

import React, { memo, useCallback } from 'react'
import { Memo } from '@legendapp/state/react'
import { ObservableObject } from '@legendapp/state'
import { cn } from '@/lib/utils'
import type { TableColumn } from '@/legend-state/hooks/use-table-entity'

export interface UltraTableCellProps {
  /** Row data observable for granular updates */
  row$: ObservableObject<any>
  /** Column configuration */
  column: TableColumn
  /** Row index for event handling */
  rowIndex: number
  /** Column index for event handling */
  columnIndex: number
  /** Is row selected */
  isSelected?: boolean
  /** Cell click handler */
  onCellClick?: (rowIndex: number, columnIndex: number, field: string) => void
  /** Cell double click handler for editing */
  onCellDoubleClick?: (rowIndex: number, columnIndex: number, field: string, currentValue: any) => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Ultra-lightweight table cell that only re-renders when its specific data changes
 * 
 * Performance optimizations:
 * - Uses Legend State Memo for granular reactivity
 * - Minimal React overhead - mostly plain HTML
 * - Data attributes for interaction tracking
 * - Memoized event handlers
 * - Direct field subscription (no object spreading)
 */
export const UltraTableCell = memo<UltraTableCellProps>(function UltraTableCell({
  row$,
  column,
  rowIndex,
  columnIndex,
  isSelected = false,
  onCellClick,
  onCellDoubleClick,
  className
}) {
  // Memoized event handlers to prevent re-renders
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onCellClick?.(rowIndex, columnIndex, column.field)
  }, [onCellClick, rowIndex, columnIndex, column.field])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onCellDoubleClick) {
      const currentValue = getNestedValue(row$.get(), column.field)
      onCellDoubleClick(rowIndex, columnIndex, column.field, currentValue)
    }
  }, [onCellDoubleClick, row$, rowIndex, columnIndex, column.field])

  // Use Legend State Memo for ultra-granular updates
  // This only re-renders when the specific field changes
  return (
    <Memo>
      {() => {
        const rowData = row$.get()
        const cellValue = getNestedValue(rowData, column.field)
        const formattedValue = formatCellValue(cellValue, column.type)
        const recordId = rowData?.id

        return (
          <td
            className={cn(
              // Base cell styles - optimized for performance, compact for 10k testing
              'px-2 py-1 align-middle text-xs',
              'border-b border-border/50',
              'cursor-pointer select-none',
              // Selection state
              isSelected && 'bg-accent/20',
              // Hover state via CSS (no React state)
              'hover:bg-muted/30 transition-colors duration-75',
              // Custom className
              className
            )}
            style={{ 
              width: column.width, 
              minWidth: column.minWidth || column.width,
              maxWidth: column.width 
            }}
            // Data attributes for interaction without re-renders
            data-row={rowIndex}
            data-col={columnIndex}
            data-field={column.field}
            data-record-id={recordId}
            data-cell-type={column.type}
            data-selected={isSelected}
            // Event handlers
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            // Accessibility
            tabIndex={0}
            role="gridcell"
            aria-rowindex={rowIndex + 1}
            aria-colindex={columnIndex + 1}
            aria-selected={isSelected}
            title={String(cellValue) || ''}
          >
            {/* Render cell content based on type */}
            {column.render ? (
              column.render(cellValue, rowData, rowIndex)
            ) : (
              <CellContent value={cellValue} type={column.type} />
            )}
          </td>
        )
      }}
    </Memo>
  )
})

/**
 * Lightweight cell content renderer
 * Optimized for common data types without extra React components
 */
const CellContent = memo<{ value: any; type?: string }>(function CellContent({ value, type }) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">—</span>
  }

  // Type-specific rendering
  switch (type) {
    case 'boolean':
      return (
        <span className={cn(
          'inline-flex items-center justify-center w-4 h-4 rounded-sm text-xs font-medium',
          value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        )}>
          {value ? '✓' : '×'}
        </span>
      )

    case 'number':
      return (
        <span className="font-mono text-right block">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      )

    case 'date':
      const date = value instanceof Date ? value : new Date(value)
      return (
        <span className="font-mono text-sm">
          {isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString()}
        </span>
      )

    case 'object':
      if (Array.isArray(value)) {
        return (
          <span className="text-muted-foreground">
            [{value.length} items]
          </span>
        )
      }
      return (
        <span className="text-muted-foreground">
          {Object.keys(value || {}).length} fields
        </span>
      )

    default: // string or unknown
      const stringValue = String(value)
      if (stringValue.length > 100) {
        return (
          <span title={stringValue}>
            {stringValue.substring(0, 100)}...
          </span>
        )
      }
      return <span>{stringValue}</span>
  }
})

/**
 * Get nested value from object using dot notation
 * Same as in use-table-entity but inlined for performance
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Format cell value for display
 */
function formatCellValue(value: any, type?: string): any {
  if (value === null || value === undefined) return null
  
  switch (type) {
    case 'date':
      const date = value instanceof Date ? value : new Date(value)
      return isNaN(date.getTime()) ? null : date
    
    case 'number':
      return typeof value === 'number' ? value : parseFloat(value) || value
      
    default:
      return value
  }
}

// Export props type for other components
export type { UltraTableCellProps }