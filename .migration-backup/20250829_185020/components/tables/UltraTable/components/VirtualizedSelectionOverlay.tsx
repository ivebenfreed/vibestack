/**
 * High-Performance Selection Overlay for Virtualized Tables
 * 
 * Uses absolute positioning to avoid re-rendering table cells:
 * - Tracks scroll position via virtuoso onScroll events
 * - Calculates cell positions based on viewport offset
 * - Renders selection rectangles as overlay divs
 * - No cell component re-renders for selection changes
 */

import React, { useCallback, useState, useRef, useEffect } from 'react'
import { use$ } from '@legendapp/state/react'
import { selectionState$ } from '../state/selection-state'

export interface VirtualizedSelectionOverlayProps {
  /** Table container element for positioning calculations */
  tableContainer: HTMLElement | null
  /** Column widths for position calculation */
  columnWidths: number[]
  /** Row height (assumed uniform) */
  rowHeight: number
  /** Header height offset */
  headerHeight: number
}

interface VirtualizedSelectionRef {
  updateScroll: (location: any) => void
}

export const VirtualizedSelectionOverlay = React.forwardRef<
  VirtualizedSelectionRef,
  VirtualizedSelectionOverlayProps
>(function VirtualizedSelectionOverlay({
  tableContainer,
  columnWidths,
  rowHeight,
  headerHeight
}, ref) {
  const [scrollState, setScrollState] = useState({ scrollTop: 0, viewportHeight: 0 })
  
  // Subscribe to selection state
  const selectedCells = use$(selectionState$.selectedCells)
  const focusedCell = use$(selectionState$.focusedCell)
  const activeRange = use$(selectionState$.activeRange)
  
  
  // Expose scroll update method via ref
  React.useImperativeHandle(ref, () => ({
    updateScroll: (location: any) => {
      setScrollState(prev => {
        const newScrollTop = Math.abs(location.listOffset || 0)
        const newViewportHeight = location.viewportHeight || prev.viewportHeight || 400
        
        // Only update if values actually changed to prevent unnecessary renders
        if (prev.scrollTop === newScrollTop && prev.viewportHeight === newViewportHeight) {
          return prev
        }
        
        return {
          scrollTop: newScrollTop,
          viewportHeight: newViewportHeight
        }
      })
    }
  }), [])
  
  // Calculate visible row range based on scroll position
  const visibleRowStart = Math.floor(scrollState.scrollTop / rowHeight)
  const visibleRowEnd = Math.ceil((scrollState.scrollTop + scrollState.viewportHeight) / rowHeight)
  
  // Calculate cumulative column positions for x positioning
  const columnPositions = columnWidths.reduce((acc, width, index) => {
    acc[index] = index === 0 ? 0 : acc[index - 1] + columnWidths[index - 1]
    return acc
  }, {} as Record<number, number>)
  
  
  // Get exact cell position from DOM elements
  const getCellRect = useCallback((row: number, col: number) => {
    if (!tableContainer) return null
    
    // Find the actual cell in tbody, accounting for virtualization
    const tbody = tableContainer.querySelector('tbody')
    if (!tbody) return null
    
    const actualCell = tbody.querySelector(`tr:nth-child(${row + 1}) td:nth-child(${col + 1})`)
    if (actualCell) {
      const cellRect = actualCell.getBoundingClientRect()
      const tbodyRect = tbody.getBoundingClientRect()
      
      console.log('[VirtualizedOverlay] DOM positioning:', {
        row, col,
        cellRect: { x: cellRect.left - tbodyRect.left, y: cellRect.top - tbodyRect.top, width: cellRect.width, height: cellRect.height },
        tbodyTop: tbodyRect.top,
        cellTop: cellRect.top
      })
      
      return {
        x: cellRect.left - tbodyRect.left,
        y: cellRect.top - tbodyRect.top,
        width: cellRect.width,
        height: cellRect.height
      }
    }
    
    return null
  }, [tableContainer])
  
  if (!tableContainer) return null
  

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      {/* Render selected cells */}
      {Array.from(selectedCells).map(cellKey => {
        const [row, col] = cellKey.split(':').map(Number)
        const rect = getCellRect(row, col)
        
        if (!rect) return null // Cell not visible
        
        return (
          <div
            key={cellKey}
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: 'rgba(0, 100, 255, 0.2)', // Bright blue for debugging
              border: '3px solid rgba(0, 100, 255, 0.8)',
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 100
            }}
          />
        )
      })}
      
      {/* Render focused cell */}
      {focusedCell && (() => {
        const rect = getCellRect(focusedCell.row, focusedCell.col)
        if (!rect) return null
        
        return (
          <div
            key="focused"
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              border: '4px solid hsl(var(--primary))',
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 10
            }}
          />
        )
      })()}
      
      {/* Render active range */}
      {activeRange && (() => {
        const startRect = getCellRect(activeRange.startRow, activeRange.startCol)
        const endRect = getCellRect(activeRange.endRow, activeRange.endCol)
        
        if (!startRect || !endRect) return null
        
        return (
          <div
            key="range"
            style={{
              position: 'absolute',
              left: startRect.x,
              top: startRect.y,
              width: endRect.x + endRect.width - startRect.x,
              height: endRect.y + endRect.height - startRect.y,
              backgroundColor: 'hsl(var(--primary) / 0.08)',
              border: '2px solid hsl(var(--primary) / 0.4)',
              boxSizing: 'border-box',
              pointerEvents: 'none'
            }}
          />
        )
      })()}
    </div>
  )
})

// Hook to integrate with TableVirtuoso
export function useVirtualizedSelection(tableRef: React.RefObject<any>) {
  const [overlayProps, setOverlayProps] = useState<Partial<VirtualizedSelectionOverlayProps>>({})
  const overlayRef = useRef<VirtualizedSelectionRef>()
  
  // Extract table metrics when table mounts
  useEffect(() => {
    if (!tableRef.current) return
    
    const table = tableRef.current
    if (!table) return
    
    // Calculate column widths from first row
    const firstDataRow = table.querySelector('tbody tr td')?.parentElement
    const headerRow = table.querySelector('thead tr')
    const cells = headerRow?.querySelectorAll('th, td') || firstDataRow?.querySelectorAll('td')
    
    if (cells && firstDataRow && firstDataRow.querySelector('td')) {
      const columnWidths = Array.from(cells).map(cell => cell.getBoundingClientRect().width)
      // Use actual DOM row height but ensure it's for a single row
      const firstCell = firstDataRow.querySelector('td')!
      const actualRowHeight = firstDataRow.getBoundingClientRect().height
      const actualCellHeight = firstCell.getBoundingClientRect().height
      
      // Use the smaller of row or cell height to avoid multi-row spanning
      const rowHeight = Math.min(actualRowHeight, actualCellHeight)
      const headerHeight = headerRow?.getBoundingClientRect().height || 0
      
      console.log('[useVirtualizedSelection] Row height measurement:', {
        actualRowHeight,
        actualCellHeight,
        usingRowHeight: rowHeight,
        headerHeight
      })
      
      setOverlayProps({
        tableContainer: table.parentElement,
        columnWidths,
        rowHeight,
        headerHeight
      })
    }
  }, [tableRef])
  
  // Return scroll handler for virtuoso
  const handleScroll = useCallback((location: any) => {
    overlayRef.current?.updateScroll(location)
  }, [])
  
  // Enhanced overlay component with scroll integration
  const SelectionOverlayComponent = useCallback((props: any) => {
    if (!overlayProps.tableContainer) {
      return null
    }
    
    return (
      <VirtualizedSelectionOverlay
        ref={overlayRef}
        {...overlayProps}
        {...props}
      />
    )
  }, [overlayProps])
  
  
  return {
    overlayProps,
    handleScroll,
    SelectionOverlay: overlayProps.tableContainer ? SelectionOverlayComponent : null
  }
}