/**
 * Portal-based Selection Overlay
 * Renders selection rectangles in a portal outside the table DOM tree
 * Avoids TableVirtuoso virtualization interference
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { use$ } from '@legendapp/state/react'
import { selectionState$ } from '../state/selection-state'

export interface PortalSelectionOverlayProps {
  /** Table element to track for positioning */
  tableElement: HTMLElement | null
}

interface PortalSelectionRef {
  updateScroll: (location: any) => void
}

export const PortalSelectionOverlay = React.forwardRef<
  PortalSelectionRef,
  PortalSelectionOverlayProps
>(function PortalSelectionOverlay({ tableElement }, ref) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const [scrollState, setScrollState] = useState({ scrollTop: 0 })
  const measurementsRef = useRef({
    rowHeight: 47, // Default fallback
    columnWidths: [] as number[]
  })
  
  // Subscribe to selection state
  const selectedCells = use$(selectionState$.selectedCells)
  const focusedCell = use$(selectionState$.focusedCell)
  
  
  // Create portal container
  useEffect(() => {
    const container = document.createElement('div')
    container.id = 'table-selection-overlay'
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1000;
    `
    document.body.appendChild(container)
    setPortalContainer(container)
    
    return () => {
      document.body.removeChild(container)
    }
  }, [])
  
  // Expose scroll update method via ref
  React.useImperativeHandle(ref, () => ({
    updateScroll: (location: any) => {
      if (location && typeof location.listOffset === 'number') {
        setScrollState({ scrollTop: Math.abs(location.listOffset) })
      }
    }
  }), [])
  
  // Measure table when it loads
  useEffect(() => {
    if (!tableElement) return
    
    const measureTable = () => {
      const headerRow = tableElement.querySelector('thead tr')
      const firstDataRow = tableElement.querySelector('tbody tr')
      
      if (headerRow && firstDataRow) {
        const headerCells = headerRow.querySelectorAll('th, td')
        const columnWidths = Array.from(headerCells).map(cell => cell.getBoundingClientRect().width)
        
        // Get row height from first cell, with fallback
        const firstCell = firstDataRow.querySelector('td')
        let rowHeight = firstCell ? firstCell.getBoundingClientRect().height : 0
        
        // If measurement failed, use fallback and retry
        if (rowHeight === 0) {
          rowHeight = 47 // Fallback height
          // Retry measurement after another delay
          setTimeout(() => {
            const retryHeight = firstCell?.getBoundingClientRect().height
            if (retryHeight && retryHeight > 0) {
              setTableMeasurements(prev => ({ ...prev, rowHeight: retryHeight }))
            }
          }, 500)
        }
        // Don't store tableRect in state - get it fresh each time
        // Update measurements in ref to avoid re-renders
        measurementsRef.current = { rowHeight, columnWidths }
      } else {
      }
    }
    
    // Measure after a delay to ensure DOM is ready
    setTimeout(measureTable, 100)
  }, [tableElement])
  
  // Calculate cell position even for virtualized cells
  const getCellGlobalRect = useCallback((row: number, col: number) => {
    if (!tableElement) return null
    
    // Try to find actual cell first (if visible)
    const cell = tableElement.querySelector(`td[data-row="${row}"][data-col="${col}"]`)
    if (cell) {
      return cell.getBoundingClientRect()
    }
    
    // Calculate position for virtualized cells
    const { rowHeight, columnWidths } = measurementsRef.current
    if (rowHeight === 0 || columnWidths.length === 0) return null
    
    // Get fresh table position
    const tableRect = tableElement.getBoundingClientRect()
    const headerHeight = tableElement.querySelector('thead')?.getBoundingClientRect().height || 0
    const x = columnWidths.slice(0, col).reduce((sum, width) => sum + width, 0)
    const y = (row * rowHeight) - scrollState.scrollTop + headerHeight
    
    return {
      left: tableRect.left + x,
      top: tableRect.top + y,
      width: columnWidths[col] || 100,
      height: rowHeight,
      right: tableRect.left + x + (columnWidths[col] || 100),
      bottom: tableRect.top + y + rowHeight
    } as DOMRect
  }, [tableElement, tableMeasurements, scrollState])
  
  if (!portalContainer || !tableElement) return null
  
  return createPortal(
    <>
      {/* Render selected cells */}
      {Array.from(selectedCells).map(cellKey => {
        const [row, col] = cellKey.split(':').map(Number)
        const rect = getCellGlobalRect(row, col)
        
        if (!rect) return null
        
        return (
          <div
            key={cellKey}
            style={{
              position: 'fixed',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              backgroundColor: 'rgba(0, 100, 255, 0.2)',
              border: '2px solid rgba(0, 100, 255, 0.8)',
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 1001
            }}
          />
        )
      })}
      
      {/* Render focused cell */}
      {focusedCell && (() => {
        const rect = getCellGlobalRect(focusedCell.row, focusedCell.col)
        if (!rect) return null
        
        return (
          <div
            key="focused"
            style={{
              position: 'fixed',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              border: '3px solid hsl(var(--primary))',
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 1002
            }}
          />
        )
      })()}
    </>,
    portalContainer
  )
}