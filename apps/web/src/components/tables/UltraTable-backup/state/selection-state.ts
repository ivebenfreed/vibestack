/**
 * UltraTable Selection State using Legend State
 * 
 * Provides reactive selection management with:
 * - Individual cell/row selection tracking
 * - Range selection with Shift+click
 * - Bulk operations (select all, clear)
 * - Keyboard navigation support
 * - Performance optimized observables
 */

import { observable, batch } from '@legendapp/state'
import { uiLog } from '@/logger';
const log = uiLog('components/tables/UltraTable-backup/state/selection-state.ts');

export interface SelectionRange {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export interface CellPosition {
  row: number
  col: number
}

/**
 * Selection state observable
 * Uses Legend State for optimal reactivity and performance
 */
export const selectionState$ = observable({
  // Individual cell selections (for copy/paste operations)
  selectedCells: new Set<string>(), // "row:col" format
  
  // Row-level selections (for bulk operations)
  selectedRows: new Set<string>(), // row IDs
  
  // Range selection state
  activeRange: null as SelectionRange | null,
  isRangeSelecting: false,
  rangeStart: null as CellPosition | null,
  
  // Focus state for keyboard navigation
  focusedCell: null as CellPosition | null,
  
  // Computed helpers
  hasSelection: () => selectionState$.selectedCells.get().size > 0 || selectionState$.selectedRows.get().size > 0,
  cellCount: () => selectionState$.selectedCells.get().size,
  rowCount: () => selectionState$.selectedRows.get().size,
  
  // Actions
  actions: {
    // Cell-level selection
    selectCell: (row: number, col: number) => {
      const cellKey = `${row}:${col}`
      log.info('[SelectionState] selectCell called:', { row, col, cellKey })
      
      // Force reactivity by using assign() instead of set()
      selectionState$.selectedCells.assign(current => {
        const newSet = new Set(current)
        newSet.add(cellKey)
        log.info('[SelectionState] Current cells before:', Array.from(current))
        log.info('[SelectionState] New cells after add:', Array.from(newSet))
        log.info('[SelectionState] Selection state after update:', {
          selectedCells: Array.from(newSet),
          hasSelection: newSet.size > 0
        })
        return newSet
      })
    },
    
    deselectCell: (row: number, col: number) => {
      const cellKey = `${row}:${col}`
      selectionState$.selectedCells.assign(current => {
        const newSet = new Set(current)
        newSet.delete(cellKey)
        return newSet
      })
    },
    
    toggleCell: (row: number, col: number) => {
      const cellKey = `${row}:${col}`
      const isSelected = selectionState$.selectedCells.peek().has(cellKey)
      if (isSelected) {
        selectionState$.actions.deselectCell(row, col)
      } else {
        selectionState$.actions.selectCell(row, col)
      }
    },
    
    // Row-level selection
    selectRow: (rowId: string) => {
      selectionState$.selectedRows.assign(current => {
        const newSet = new Set(current)
        newSet.add(rowId)
        return newSet
      })
    },
    
    deselectRow: (rowId: string) => {
      selectionState$.selectedRows.assign(current => {
        const newSet = new Set(current)
        newSet.delete(rowId)
        return newSet
      })
    },
    
    toggleRow: (rowId: string) => {
      const isSelected = selectionState$.selectedRows.peek().has(rowId)
      if (isSelected) {
        selectionState$.actions.deselectRow(rowId)
      } else {
        selectionState$.actions.selectRow(rowId)
      }
    },
    
    // Range selection
    startRangeSelection: (row: number, col: number) => {
      batch(() => {
        selectionState$.isRangeSelecting.set(true)
        selectionState$.rangeStart.set({ row, col })
        selectionState$.activeRange.set(null)
      })
    },
    
    updateRangeSelection: (row: number, col: number) => {
      const start = selectionState$.rangeStart.peek()
      if (!start || !selectionState$.isRangeSelecting.peek()) return
      
      batch(() => {
        const range: SelectionRange = {
          startRow: Math.min(start.row, row),
          endRow: Math.max(start.row, row),
          startCol: Math.min(start.col, col),
          endCol: Math.max(start.col, col)
        }
        selectionState$.activeRange.set(range)
        
        // Select all cells in range
        selectionState$.selectedCells.assign(current => {
          const newSet = new Set(current)
          for (let r = range.startRow; r <= range.endRow; r++) {
            for (let c = range.startCol; c <= range.endCol; c++) {
              newSet.add(`${r}:${c}`)
            }
          }
          return newSet
        })
      })
    },
    
    finishRangeSelection: () => {
      batch(() => {
        selectionState$.isRangeSelecting.set(false)
        selectionState$.rangeStart.set(null)
        // Keep activeRange for visual indication
      })
    },
    
    // Focus management
    setFocus: (row: number, col: number) => {
      selectionState$.focusedCell.set({ row, col })
    },
    
    clearFocus: () => {
      selectionState$.focusedCell.set(null)
    },
    
    // Bulk operations
    selectAll: (totalRows: number, totalCols: number) => {
      batch(() => {
        const newCells = new Set<string>()
        for (let r = 0; r < totalRows; r++) {
          for (let c = 0; c < totalCols; c++) {
            newCells.add(`${r}:${c}`)
          }
        }
        selectionState$.selectedCells.set(newCells)
        selectionState$.activeRange.set({
          startRow: 0,
          endRow: totalRows - 1,
          startCol: 0,
          endCol: totalCols - 1
        })
      })
    },
    
    selectAllRows: (rowIds: string[]) => {
      batch(() => {
        selectionState$.selectedRows.set(new Set(rowIds))
      })
    },
    
    clearSelection: () => {
      batch(() => {
        selectionState$.selectedCells.set(new Set())
        selectionState$.selectedRows.set(new Set())
        selectionState$.activeRange.set(null)
        selectionState$.isRangeSelecting.set(false)
        selectionState$.rangeStart.set(null)
      })
    },
    
    // Keyboard navigation
    moveFocus: (direction: 'up' | 'down' | 'left' | 'right', totalRows: number, totalCols: number) => {
      const current = selectionState$.focusedCell.peek()
      if (!current) return
      
      let newRow = current.row
      let newCol = current.col
      
      switch (direction) {
        case 'up':
          newRow = Math.max(0, current.row - 1)
          break
        case 'down':
          newRow = Math.min(totalRows - 1, current.row + 1)
          break
        case 'left':
          newCol = Math.max(0, current.col - 1)
          break
        case 'right':
          newCol = Math.min(totalCols - 1, current.col + 1)
          break
      }
      
      batch(() => {
        // Set focus
        selectionState$.focusedCell.set({ row: newRow, col: newCol })
        
        // Also select the focused cell for copy operations
        selectionState$.actions.clearSelection()
        selectionState$.actions.selectCell(newRow, newCol)
      })
    }
  }
})

// Helper functions for selection queries
export const isRowSelected = (rowId: string): boolean => {
  return selectionState$.selectedRows.peek().has(rowId)
}

export const isCellSelected = (row: number, col: number): boolean => {
  return selectionState$.selectedCells.peek().has(`${row}:${col}`)
}

export const isCellInRange = (row: number, col: number): boolean => {
  const range = selectionState$.activeRange.peek()
  if (!range) return false
  
  return row >= range.startRow && row <= range.endRow &&
         col >= range.startCol && col <= range.endCol
}

export const isCellFocused = (row: number, col: number): boolean => {
  const focused = selectionState$.focusedCell.peek()
  return focused?.row === row && focused?.col === col
}

// Export the state for external use
export default selectionState$