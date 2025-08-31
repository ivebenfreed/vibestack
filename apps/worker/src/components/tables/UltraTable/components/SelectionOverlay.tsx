/**
 * Selection Visual Overlay for UltraTable
 * 
 * React Portal-based overlay that shows:
 * - Individual cell selections with borders
 * - Range selection with filled background
 * - Focus indicator with thick border
 * - Copy/paste visual feedback
 * - Zero impact on table performance
 */

import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { use$ } from '@legendapp/state/react'
import { cn } from '@/lib/utils'
import { selectionState$ } from '../state/selection-state'

export interface SelectionOverlayProps {
  /** Table container element for positioning */
  tableElement?: HTMLElement | null
}

interface CellRect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Visual overlay for table selections using React Portal
 * 
 * Performance features:
 * - Rendered outside table DOM tree
 * - Only updates when selection changes
 * - Uses CSS transforms for smooth animations
 * - Batched DOM measurements
 */
export function SelectionOverlay({ tableElement }: SelectionOverlayProps) {
  // Subscribe to selection state
  const selectedCells = use$(selectionState$.selectedCells)
  const focusedCell = use$(selectionState$.focusedCell)
  
  // Apply CSS-based selection highlighting directly to cells
  useEffect(() => {
    if (!tableElement) return
    
    // Clear all previous highlights
    const allCells = tableElement.querySelectorAll('td[data-selected]')
    allCells.forEach(cell => {
      cell.removeAttribute('data-selected')
      cell.classList.remove('ultra-table-selected', 'ultra-table-focused')
    })
    
    // Apply selection highlights
    selectedCells.forEach(cellKey => {
      const [row, col] = cellKey.split(':').map(Number)
      const cellElement = tableElement.querySelector(`td[data-row="${row}"][data-col="${col}"]`)
      if (cellElement) {
        cellElement.setAttribute('data-selected', 'true')
        cellElement.classList.add('ultra-table-selected')
      }
    })
    
    // Apply focus highlight
    if (focusedCell) {
      const cellElement = tableElement.querySelector(
        `td[data-row="${focusedCell.row}"][data-col="${focusedCell.col}"]`
      )
      if (cellElement) {
        cellElement.classList.add('ultra-table-focused')
      }
    }
  }, [tableElement, selectedCells, focusedCell])

  // Don't render portal - use CSS classes instead
  return null
}

/**
 * Range selection visual component
 */
const RangeSelectionOverlay = React.memo(function RangeSelectionOverlay({ 
  range, 
  tableElement, 
  containerRect 
}: { 
  range: any
  tableElement: HTMLElement
  containerRect: DOMRect 
}) {
  const [rangeRect, setRangeRect] = useState<CellRect | null>(null)
  
  useEffect(() => {
    if (!containerRect) return
    
    const startCell = tableElement.querySelector(
      `td[data-row="${range.startRow}"][data-col="${range.startCol}"]`
    ) as HTMLElement
    
    const endCell = tableElement.querySelector(
      `td[data-row="${range.endRow}"][data-col="${range.endCol}"]`
    ) as HTMLElement
    
    if (startCell && endCell) {
      const startRect = startCell.getBoundingClientRect()
      const endRect = endCell.getBoundingClientRect()
      
      setRangeRect({
        top: Math.min(startRect.top, endRect.top) - containerRect.top,
        left: Math.min(startRect.left, endRect.left) - containerRect.left,
        width: Math.max(startRect.right, endRect.right) - Math.min(startRect.left, endRect.left),
        height: Math.max(startRect.bottom, endRect.bottom) - Math.min(startRect.top, endRect.top)
      })
    }
  }, [range, tableElement, containerRect])
  
  if (!rangeRect) return null
  
  return (
    <div
      className={cn(
        'absolute border-2 border-primary bg-primary/20',
        'transition-all duration-200 ease-out',
        'animate-in fade-in zoom-in-98'
      )}
      style={{
        top: rangeRect.top,
        left: rangeRect.left,
        width: rangeRect.width,
        height: rangeRect.height
      }}
    />
  )
})

/**
 * Focus indicator component
 */
const FocusIndicator = React.memo(function FocusIndicator({ 
  cell, 
  tableElement, 
  containerRect 
}: { 
  cell: any
  tableElement: HTMLElement
  containerRect: DOMRect 
}) {
  const [focusRect, setFocusRect] = useState<CellRect | null>(null)
  
  useEffect(() => {
    if (!containerRect) return
    
    const cellElement = tableElement.querySelector(
      `td[data-row="${cell.row}"][data-col="${cell.col}"]`
    ) as HTMLElement
    
    if (cellElement) {
      const rect = cellElement.getBoundingClientRect()
      setFocusRect({
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
        height: rect.height
      })
    }
  }, [cell, tableElement, containerRect])
  
  if (!focusRect) return null
  
  return (
    <div
      className={cn(
        'absolute border-4 border-blue-500 bg-transparent',
        'transition-all duration-150 ease-out',
        'animate-in fade-in'
      )}
      style={{
        top: focusRect.top - 2, // Offset for border
        left: focusRect.left - 2,
        width: focusRect.width + 4,
        height: focusRect.height + 4
      }}
    />
  )
})