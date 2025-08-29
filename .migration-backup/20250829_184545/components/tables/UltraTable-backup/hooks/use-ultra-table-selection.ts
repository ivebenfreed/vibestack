/**
 * UltraTable Selection Hook
 * 
 * Integrates Legend State selection with existing table functionality:
 * - Bridges selection state with table events
 * - Handles keyboard navigation and shortcuts
 * - Provides copy/paste operations
 * - Manages focus and range selection
 */

import { useCallback, useEffect, useRef } from 'react'
import { use$ } from '@legendapp/state/react'
import { selectionState$, type CellPosition } from '../state/selection-state'
import { copyToClipboard, pasteFromClipboard } from '../utils/clipboard'
import { setupUndoRedoShortcuts, trackCellEdit } from '../state/undo-redo'

export interface UseUltraTableSelectionOptions {
  tableData: any[]
  columns: any[]
  onCellEdit?: (rowIndex: number, field: string, newValue: any, oldValue: any) => void
  enableKeyboardShortcuts?: boolean
}

export function useUltraTableSelection({
  tableData,
  columns,
  onCellEdit,
  enableKeyboardShortcuts = true,
  selectedIds = new Set() // Add selectedIds from main table
}: UseUltraTableSelectionOptions & { selectedIds?: Set<string> }) {
  const tableRef = useRef<HTMLElement>(null)
  
  // Subscribe to selection state
  const selectedCells = use$(selectionState$.selectedCells)
  const selectedRows = use$(selectionState$.selectedRows)
  const activeRange = use$(selectionState$.activeRange)
  const focusedCell = use$(selectionState$.focusedCell)
  const isRangeSelecting = use$(selectionState$.isRangeSelecting)
  
  // Enhanced cell click handler with selection logic
  const handleCellClick = useCallback((
    rowIndex: number, 
    columnIndex: number, 
    field: string,
    event?: MouseEvent
  ) => {
    // Defensive check - don't handle clicks if data isn't ready
    if (tableData.length === 0 || columns.length === 0) return
    
    const isShiftClick = event?.shiftKey
    const isCtrlClick = event?.ctrlKey || event?.metaKey
    
    // Capture cell position from the click event
    const cellRect = event?.target ? (event.target as HTMLElement).getBoundingClientRect() : null
    
    console.log('[Selection] Cell click:', { 
      rowIndex, 
      columnIndex, 
      field, 
      isShiftClick, 
      isCtrlClick,
      cellRect: cellRect ? {
        top: cellRect.top,
        left: cellRect.left,
        width: cellRect.width,
        height: cellRect.height
      } : null
    })
    
    if (isShiftClick && !selectionState$.rangeStart.peek()) {
      // Start range selection if none active
      selectionState$.actions.startRangeSelection(rowIndex, columnIndex)
      selectionState$.actions.updateRangeSelection(rowIndex, columnIndex)
    } else if (isShiftClick && selectionState$.rangeStart.peek()) {
      // Extend existing range
      selectionState$.actions.updateRangeSelection(rowIndex, columnIndex)
      selectionState$.actions.finishRangeSelection()
    } else if (isCtrlClick) {
      // Toggle individual cell
      selectionState$.actions.toggleCell(rowIndex, columnIndex)
    } else {
      // Single selection (clear others and select this cell)
      selectionState$.actions.clearSelection()
      selectionState$.actions.selectCell(rowIndex, columnIndex)
      selectionState$.actions.setFocus(rowIndex, columnIndex)
    }
    
    // Also select the row for compatibility with existing table selection
    const row = tableData[rowIndex]
    if (row?.id && !isCtrlClick) {
      // Only select row if not doing multi-selection
      console.log('[Selection] Also selecting row:', row.id)
    }
  }, [tableData])
  
  // Enhanced double-click handler for editing
  const handleCellDoubleClick = useCallback((
    rowIndex: number,
    columnIndex: number,
    field: string,
    currentValue: any
  ) => {
    // Defensive check - don't handle double-clicks if data isn't ready
    if (tableData.length === 0 || columns.length === 0) return
    
    // Set focus and clear selection for editing
    selectionState$.actions.setFocus(rowIndex, columnIndex)
    
    // Trigger edit mode (this would integrate with existing editor)
    // The existing UltraTable editor logic can stay the same
  }, [])
  
  // Copy selected data to clipboard
  const handleCopy = useCallback(async () => {
    // Defensive check - don't copy if data isn't ready
    if (tableData.length === 0 || columns.length === 0) return
    
    const success = await copyToClipboard(tableData, columns, {
      format: 'all',
      includeHeaders: true,
      onlySelected: true
    }, selectedIds) // Pass external selectedIds for row-level selection
    
    if (success) {
      // Could show toast notification here
      console.log('[Selection] Data copied to clipboard')
    }
  }, [tableData, columns, selectedIds])
  
  // Paste data from clipboard
  const handlePaste = useCallback(async () => {
    // Defensive check - don't paste if data isn't ready
    if (tableData.length === 0 || columns.length === 0) return
    
    const result = await pasteFromClipboard()
    
    if (result.success && result.data) {
      const focusedCell = selectionState$.focusedCell.peek()
      if (!focusedCell) {
        console.warn('[Selection] No focused cell for paste operation')
        return
      }
      
      // Apply pasted data starting from focused cell
      result.data.forEach((row, rowOffset) => {
        row.forEach((value, colOffset) => {
          const targetRow = focusedCell.row + rowOffset
          const targetCol = focusedCell.col + colOffset
          
          if (targetRow < tableData.length && targetCol < columns.length) {
            const column = columns[targetCol]
            const rowData = tableData[targetRow]
            const oldValue = rowData[column.field]
            
            // Track for undo/redo
            trackCellEdit(targetRow, column.field, oldValue, value)
            
            // Apply the change
            onCellEdit?.(targetRow, column.field, value, oldValue)
          }
        })
      })
      
      console.log(`[Selection] Pasted ${result.data.length} rows`)
    }
  }, [tableData, columns, onCellEdit])
  
  // Keyboard shortcut handlers
  useEffect(() => {
    if (!enableKeyboardShortcuts || tableData.length === 0 || columns.length === 0) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Debug: Log all keyboard events to see if handler is running
      console.log('[Selection] Keyboard event:', e.key, 'target:', e.target)
      
      // Check if we have any selection or focus - if so, handle keyboard events globally
      const focused = selectionState$.focusedCell.peek()
      const hasSelection = selectionState$.selectedCells.peek().size > 0 || 
                          selectionState$.selectedRows.peek().size > 0 ||
                          selectedIds.size > 0 // Also check existing table selection
      
      // Accept events if:
      // 1. We have a focused cell, OR
      // 2. We have any selection, OR  
      // 3. The event target is within the table
      const shouldHandle = focused || 
                          hasSelection || 
                          (tableRef.current && e.target && tableRef.current.contains(e.target as Node)) ||
                          (e.target as Element)?.closest?.('table')
      
      if (!shouldHandle) {
        console.log('[Selection] Keyboard event ignored - no focus/selection')
        return
      }
      
      console.log('[Selection] Processing keyboard event:', e.key, 'focused:', focused, 'hasSelection:', hasSelection)
      
      // Arrow key navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        if (!focused) {
          // Focus first cell if none focused
          selectionState$.actions.setFocus(0, 0)
          return
        }
        
        const direction = e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right'
        selectionState$.actions.moveFocus(direction, tableData.length, columns.length)
        return
      }
      
      // Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        console.log('[Selection] Copy shortcut triggered')
        handleCopy()
        return
      }
      
      // Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        handlePaste()
        return
      }
      
      // Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectionState$.actions.selectAll(tableData.length, columns.length)
        return
      }
      
      // Escape - Clear selection
      if (e.key === 'Escape') {
        console.log('[Selection] Escape key - clearing selection')
        selectionState$.actions.clearSelection()
        return
      }
      
      // Enter - Start editing focused cell
      if (e.key === 'Enter' && focused) {
        // This would trigger the existing edit flow
        const column = columns[focused.col]
        const rowData = tableData[focused.row]
        const currentValue = rowData[column.field]
        
        // Could trigger existing double-click logic
        handleCellDoubleClick(focused.row, focused.col, column.field, currentValue)
        return
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    // Setup undo/redo shortcuts
    const cleanupUndoRedo = setupUndoRedoShortcuts(tableRef.current || undefined)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      cleanupUndoRedo()
    }
  }, [enableKeyboardShortcuts, tableData, columns, handleCopy, handlePaste, handleCellDoubleClick])
  
  // Helper to check if a cell is selected
  const isCellSelected = useCallback((row: number, col: number): boolean => {
    const cellKey = `${row}:${col}`
    return selectedCells.has(cellKey) || 
           (activeRange && 
            row >= activeRange.startRow && row <= activeRange.endRow &&
            col >= activeRange.startCol && col <= activeRange.endCol)
  }, [selectedCells, activeRange])
  
  // Helper to check if a row is selected
  const isRowSelected = useCallback((rowId: string): boolean => {
    return selectedRows.has(rowId)
  }, [selectedRows])
  
  // Helper to check if a cell is focused
  const isCellFocused = useCallback((row: number, col: number): boolean => {
    return focusedCell?.row === row && focusedCell?.col === col
  }, [focusedCell])
  
  return {
    // State
    selectedCells,
    selectedRows,
    activeRange,
    focusedCell,
    isRangeSelecting,
    
    // Helpers
    isCellSelected,
    isRowSelected,
    isCellFocused,
    
    // Actions
    handleCellClick,
    handleCellDoubleClick,
    handleCopy,
    handlePaste,
    
    // Selection state actions
    selectCell: selectionState$.actions.selectCell,
    selectRow: selectionState$.actions.selectRow,
    selectAll: () => selectionState$.actions.selectAll(tableData.length, columns.length),
    clearSelection: selectionState$.actions.clearSelection,
    
    // Ref for keyboard handling
    tableRef,
    
    // Stats for UI
    stats: {
      cellCount: selectedCells.size,
      rowCount: selectedRows.size,
      hasSelection: selectedCells.size > 0 || selectedRows.size > 0
    }
  }
}