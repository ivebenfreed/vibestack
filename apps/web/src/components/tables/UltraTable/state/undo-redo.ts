/**
 * UltraTable Undo/Redo State
 * 
 * Simple manual implementation for:
 * - Operation tracking for table edits
 * - Keyboard shortcut support (Ctrl+Z, Ctrl+Y)
 * - Granular undo for cell edits and bulk operations
 */

import { observable } from '@legendapp/state'
import { uiLog } from '@/logger';
const log = uiLog('components/tables/UltraTable/state/undo-redo.ts');

export interface UndoRedoOperation {
  type: 'cell-edit' | 'bulk-edit' | 'selection-change' | 'row-delete' | 'row-insert'
  timestamp: number
  description: string
  affectedCells?: { row: number; col: string; oldValue: any; newValue: any }[]
  affectedRows?: string[]
}

/**
 * Simple undo/redo state implementation
 */
export const undoRedoState$ = observable({
  operations: [] as UndoRedoOperation[],
  currentIndex: -1,
  maxOperations: 50
})

/**
 * Add a new operation to the undo stack
 */
export function addOperation(operation: Omit<UndoRedoOperation, 'timestamp'>) {
  const ops = undoRedoState$.operations.peek()
  const currentIndex = undoRedoState$.currentIndex.peek()
  
  // Remove any operations after current index (when undoing and making new changes)
  const newOps = ops.slice(0, currentIndex + 1)
  
  // Add new operation
  const newOperation: UndoRedoOperation = {
    ...operation,
    timestamp: Date.now()
  }
  newOps.push(newOperation)
  
  // Limit history size
  const maxOps = undoRedoState$.maxOperations.peek()
  if (newOps.length > maxOps) {
    newOps.splice(0, newOps.length - maxOps)
  }
  
  undoRedoState$.operations.set(newOps)
  undoRedoState$.currentIndex.set(newOps.length - 1)
}

/**
 * Check if undo is available
 */
export function canUndo(): boolean {
  return undoRedoState$.currentIndex.get() >= 0
}

/**
 * Check if redo is available  
 */
export function canRedo(): boolean {
  const ops = undoRedoState$.operations.get()
  const index = undoRedoState$.currentIndex.get()
  return index < ops.length - 1
}

/**
 * Undo the last operation
 */
export function undoLastOperation(): boolean {
  if (!canUndo()) return false
  
  try {
    // For now, just update the index - actual undo logic would be implemented here
    const newIndex = undoRedoState$.currentIndex.get() - 1
    undoRedoState$.currentIndex.set(newIndex)
    log.info('[UndoRedo] Undo successful')
    return true
  } catch (error) {
    log.error('[UndoRedo] Undo failed:', error)
    return false
  }
}

/**
 * Redo the next operation
 */
export function redoLastOperation(): boolean {
  if (!canRedo()) return false
  
  try {
    // For now, just update the index - actual redo logic would be implemented here
    const newIndex = undoRedoState$.currentIndex.get() + 1
    undoRedoState$.currentIndex.set(newIndex)
    log.info('[UndoRedo] Redo successful')
    return true
  } catch (error) {
    log.error('[UndoRedo] Redo failed:', error)
    return false
  }
}

/**
 * Clear undo/redo history
 */
export function clearHistory() {
  undoRedoState$.operations.set([])
  undoRedoState$.currentIndex.set(-1)
}

/**
 * Batch multiple operations into a single undo/redo unit
 */
export function batchOperations<T>(
  description: string,
  operations: () => T
): T {
  // Legend State's batch() already groups operations
  // We just need to track it as a single operation
  const result = operations()
  
  addOperation({
    type: 'bulk-edit',
    description,
    affectedCells: [], // Would be populated by specific operation tracking
  })
  
  return result
}

/**
 * Keyboard shortcut handlers
 */
export function setupUndoRedoShortcuts(element?: HTMLElement) {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only handle if focus is within table (or specified element)
    if (element && !element.contains(e.target as Node)) return
    
    // Ctrl+Z or Cmd+Z - Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      const success = undoLastOperation()
      if (success) {
        log.info('[UndoRedo] Undo successful')
      }
      return
    }
    
    // Ctrl+Y or Cmd+Shift+Z - Redo
    if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
      e.preventDefault()
      const success = redoLastOperation()
      if (success) {
        log.info('[UndoRedo] Redo successful')
      }
      return
    }
  }
  
  const targetElement = element || document
  targetElement.addEventListener('keydown', handleKeyDown)
  
  // Return cleanup function
  return () => {
    targetElement.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Track cell edit operation for undo/redo
 */
export function trackCellEdit(
  row: number,
  field: string,
  oldValue: any,
  newValue: any
) {
  addOperation({
    type: 'cell-edit',
    description: `Edit ${field} in row ${row + 1}`,
    affectedCells: [{
      row,
      col: field,
      oldValue,
      newValue
    }]
  })
}

/**
 * Track bulk operation for undo/redo
 */
export function trackBulkOperation(
  type: UndoRedoOperation['type'],
  description: string,
  affectedData: { rows?: string[]; cells?: any[] } = {}
) {
  addOperation({
    type,
    description,
    affectedRows: affectedData.rows,
    affectedCells: affectedData.cells
  })
}