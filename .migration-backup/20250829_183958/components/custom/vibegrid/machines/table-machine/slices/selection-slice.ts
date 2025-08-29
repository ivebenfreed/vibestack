// ====================================
// SELECTION SLICE
// ====================================
// Manages selection state in the table machine context

import { assign } from 'xstate';
import type { CellRef } from '../../../types';

// ====================================
// TYPES
// ====================================

export interface SelectionState {
  selectedCells: Set<string>;
  selectedRows: Set<string>; // For checkbox selection
  activeCell: CellRef | null;
  lastSelectedRowId: string | null;
  selectionMode: 'cell' | 'row' | 'range';
  anchor: CellRef | null; // For range selection
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialSelectionState = (): SelectionState => ({
  selectedCells: new Set<string>(),
  selectedRows: new Set<string>(),
  activeCell: null,
  lastSelectedRowId: null,
  selectionMode: 'cell',
  anchor: null
});

// ====================================
// HELPERS
// ====================================

const getCellKey = (rowId: string, columnId: string): string => {
  return `${rowId}:${columnId}`;
};

const parseCellKey = (cellKey: string): { rowId: string; columnId: string } | null => {
  const parts = cellKey.split(':');
  if (parts.length !== 2) return null;
  return { rowId: parts[0], columnId: parts[1] };
};

const calculateRangeSelection = (
  start: CellRef,
  end: CellRef,
  coordinateMapping: any
): Set<string> => {
  const selectedCells = new Set<string>();
  
  if (!coordinateMapping) return selectedCells;
  
  // Find row indices
  const startRowIndex = coordinateMapping.rows.findIndex((r: any) => r.rowId === start.rowId);
  const endRowIndex = coordinateMapping.rows.findIndex((r: any) => r.rowId === end.rowId);
  
  // Find column indices
  const startColIndex = coordinateMapping.columns.findIndex((c: any) => c.columnId === start.columnId);
  const endColIndex = coordinateMapping.columns.findIndex((c: any) => c.columnId === end.columnId);
  
  if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
    return selectedCells;
  }
  
  // Calculate range bounds
  const minRow = Math.min(startRowIndex, endRowIndex);
  const maxRow = Math.max(startRowIndex, endRowIndex);
  const minCol = Math.min(startColIndex, endColIndex);
  const maxCol = Math.max(startColIndex, endColIndex);
  
  // Select all cells in range
  for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
    const row = coordinateMapping.rows[rowIdx];
    if (!row) continue;
    
    for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
      const col = coordinateMapping.columns[colIdx];
      if (!col || col.columnId === '__selection') continue;
      
      selectedCells.add(getCellKey(row.rowId, col.columnId));
    }
  }
  
  return selectedCells;
};

// ====================================
// ACTIONS
// ====================================

export const selectionActions = {
  selectCell: assign({
    selectedCells: ({ context, event }) => {
      if (!event || event.type !== 'selection.cell.select') return context.selectedCells;
      const cellKey = getCellKey(event.rowId, event.columnId);
      const newSelection = new Set<string>();
      
      if (event.ctrlKey) {
        // Toggle selection with Ctrl
        newSelection.add(...context.selectedCells);
        if (newSelection.has(cellKey)) {
          newSelection.delete(cellKey);
        } else {
          newSelection.add(cellKey);
        }
      } else if (event.shiftKey && context.anchor && context.coordinateMapping) {
        // Range selection with Shift
        const end: CellRef = { rowId: event.rowId, columnId: event.columnId };
        return calculateRangeSelection(context.anchor, end, context.coordinateMapping);
      } else {
        // Single selection
        newSelection.add(cellKey);
      }
      
      return newSelection;
    },
    selectedRows: ({ event }) => {
      // Clear row selection when making a new cell selection (unless using Ctrl/Shift)
      if (!event || event.type !== 'selection.cell.select') return new Set<string>();
      if (event.ctrlKey || event.shiftKey) {
        // Keep existing row selection when extending selection
        return new Set<string>();
      }
      // Clear row selection for new single cell selection
      return new Set<string>();
    },
    activeCell: ({ event }) => {
      if (!event || event.type !== 'selection.cell.select') return null;
      return {
        rowId: event.rowId,
        columnId: event.columnId
      };
    },
    anchor: ({ context, event }) => {
      if (!event || event.type !== 'selection.cell.select') return context.anchor;
      // Set anchor for range selection
      if (!event.shiftKey) {
        return { rowId: event.rowId, columnId: event.columnId };
      }
      return context.anchor;
    }
  }),
  
  selectRange: assign({
    selectedCells: ({ context, event }) => {
      if (!event || event.type !== 'selection.range.select') return context.selectedCells;
      return calculateRangeSelection(event.start, event.end, context.coordinateMapping);
    },
    selectedRows: () => {
      // Clear row selection when making a range selection
      return new Set<string>();
    },
    anchor: ({ event }) => {
      if (!event || event.type !== 'selection.range.select') return null;
      return event.start;
    }
  }),
  
  clearSelection: assign({
    selectedCells: () => new Set<string>(),
    activeCell: () => null,
    anchor: () => null
  }),
  
  // Checkbox selection actions
  toggleRowSelection: assign({
    selectedRows: ({ context, event }) => {
      if (!event || event.type !== 'selection.checkbox.toggle') return context.selectedRows;
      const newSelection = new Set(context.selectedRows);
      if (newSelection.has(event.rowId)) {
        newSelection.delete(event.rowId);
      } else {
        newSelection.add(event.rowId);
      }
      return newSelection;
    },
    selectedCells: ({ context, event }) => {
      if (!event || event.type !== 'selection.checkbox.toggle') return context.selectedCells;
      
      // Update selectedCells to include all cells in selected rows
      const newSelectedCells = new Set<string>();
      
      // First, determine the new selectedRows state
      const newSelectedRows = new Set(context.selectedRows);
      if (newSelectedRows.has(event.rowId)) {
        newSelectedRows.delete(event.rowId);
      } else {
        newSelectedRows.add(event.rowId);
      }
      
      // If no rows are selected, clear all selectedCells
      if (newSelectedRows.size === 0) {
        return new Set<string>();
      }
      
      // Then generate selectedCells for all selected rows (including checkbox column)
      newSelectedRows.forEach(rowId => {
        if (context.coordinateMapping?.columns) {
          context.coordinateMapping.columns.forEach((col: any) => {
            // Include ALL columns including the selection column
            newSelectedCells.add(`${rowId}:${col.columnId}`);
          });
        }
      });
      
      return newSelectedCells;
    },
    lastSelectedRowId: ({ event }) => {
      if (!event || event.type !== 'selection.checkbox.toggle') return null;
      return event.rowId;
    }
  }),
  
  selectAllRows: assign({
    selectedRows: ({ context }) => new Set(context.allRowIds),
    selectedCells: ({ context }) => {
      // Generate selectedCells for all rows (including checkbox column)
      const newSelectedCells = new Set<string>();
      
      context.allRowIds.forEach(rowId => {
        if (context.coordinateMapping?.columns) {
          context.coordinateMapping.columns.forEach((col: any) => {
            // Include ALL columns including the selection column
            newSelectedCells.add(`${rowId}:${col.columnId}`);
          });
        }
      });
      
      return newSelectedCells;
    }
  }),
  
  clearRowSelection: assign({
    selectedRows: () => new Set<string>(),
    selectedCells: () => new Set<string>(), // Clear selectedCells as well
    lastSelectedRowId: () => null
  }),
  
  selectRowRange: assign({
    selectedRows: ({ context, event }) => {
      if (!event || event.type !== 'selection.checkbox.range') return context.selectedRows;
      const newSelection = new Set(context.selectedRows);
      
      // Find indices in allRowIds
      const startIndex = context.allRowIds.indexOf(event.startRowId);
      const endIndex = context.allRowIds.indexOf(event.endRowId);
      
      if (startIndex === -1 || endIndex === -1) return newSelection;
      
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      
      // Add all rows in range
      for (let i = minIndex; i <= maxIndex; i++) {
        newSelection.add(context.allRowIds[i]);
      }
      
      return newSelection;
    },
    selectedCells: ({ context, event }) => {
      if (!event || event.type !== 'selection.checkbox.range') return context.selectedCells;
      
      // Generate selectedCells for the updated selectedRows
      const newSelectedCells = new Set<string>();
      const newSelectedRows = new Set(context.selectedRows);
      
      // Find indices in allRowIds
      const startIndex = context.allRowIds.indexOf(event.startRowId);
      const endIndex = context.allRowIds.indexOf(event.endRowId);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        // Add all rows in range
        for (let i = minIndex; i <= maxIndex; i++) {
          newSelectedRows.add(context.allRowIds[i]);
        }
      }
      
      // Generate selectedCells for all selected rows (including checkbox column)
      newSelectedRows.forEach(rowId => {
        if (context.coordinateMapping?.columns) {
          context.coordinateMapping.columns.forEach((col: any) => {
            // Include ALL columns including the selection column
            newSelectedCells.add(`${rowId}:${col.columnId}`);
          });
        }
      });
      
      return newSelectedCells;
    }
  }),
  
  // Keyboard navigation
  moveSelection: assign({
    selectedCells: ({ context, event }) => {
      if (!event || event.type !== 'keyboard.arrow') return context.selectedCells;
      if (!context.coordinateMapping) return context.selectedCells;
      
      // If no active cell, try to use the first selected cell
      let currentCell = context.activeCell;
      if (!currentCell && context.selectedCells.size > 0) {
        const firstCellKey = context.selectedCells.values().next().value;
        const parsed = parseCellKey(firstCellKey);
        if (parsed) {
          currentCell = { rowId: parsed.rowId, columnId: parsed.columnId };
        }
      }
      
      if (!currentCell) return context.selectedCells;
      
      const { rowId, columnId } = currentCell;
      
      // Find current position
      const rowIndex = context.coordinateMapping.rows.findIndex((r: any) => r.rowId === rowId);
      const colIndex = context.coordinateMapping.columns.findIndex((c: any) => c.columnId === columnId);
      
      if (rowIndex === -1 || colIndex === -1) return context.selectedCells;
      
      // Calculate new position
      let newRowIndex = rowIndex;
      let newColIndex = colIndex;
      
      switch (event.direction) {
        case 'up':
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case 'down':
          newRowIndex = Math.min(context.coordinateMapping.rows.length - 1, rowIndex + 1);
          break;
        case 'left':
          newColIndex = Math.max(0, colIndex - 1);
          break;
        case 'right':
          newColIndex = Math.min(context.coordinateMapping.columns.length - 1, colIndex + 1);
          break;
      }
      
      const newRow = context.coordinateMapping.rows[newRowIndex];
      const newCol = context.coordinateMapping.columns[newColIndex];
      
      if (!newRow || !newCol) return context.selectedCells;
      
      const newCellKey = getCellKey(newRow.rowId, newCol.columnId);
      
      console.log('moveSelection: Calculated new position', {
        from: getCellKey(rowId, columnId),
        to: newCellKey,
        extend: event.extend,
        direction: event.direction
      });
      
      if (event.extend) {
        // Extend selection - for shift+arrow we should calculate range from anchor
        if (context.anchor) {
          const rangeSelection = calculateRangeSelection(
            context.anchor,
            { rowId: newRow.rowId, columnId: newCol.columnId },
            context.coordinateMapping
          );
          console.log('moveSelection: Extended selection with range', {
            anchor: context.anchor,
            newCell: { rowId: newRow.rowId, columnId: newCol.columnId },
            selectionSize: rangeSelection.size
          });
          return rangeSelection;
        } else {
          // No anchor, just add the new cell
          const newSelection = new Set(context.selectedCells);
          newSelection.add(newCellKey);
          return newSelection;
        }
      } else {
        // Move selection
        return new Set([newCellKey]);
      }
    },
    activeCell: ({ context, event }) => {
      if (!event || event.type !== 'keyboard.arrow') return context.activeCell;
      if (!context.coordinateMapping) return context.activeCell;
      
      // If no active cell, try to use the first selected cell
      let currentCell = context.activeCell;
      if (!currentCell && context.selectedCells.size > 0) {
        const firstCellKey = context.selectedCells.values().next().value;
        const parsed = parseCellKey(firstCellKey);
        if (parsed) {
          currentCell = { rowId: parsed.rowId, columnId: parsed.columnId };
        }
      }
      
      if (!currentCell) return context.activeCell;
      
      const { rowId, columnId } = currentCell;
      
      // Find current position
      const rowIndex = context.coordinateMapping.rows.findIndex((r: any) => r.rowId === rowId);
      const colIndex = context.coordinateMapping.columns.findIndex((c: any) => c.columnId === columnId);
      
      if (rowIndex === -1 || colIndex === -1) return context.activeCell;
      
      // Calculate new position
      let newRowIndex = rowIndex;
      let newColIndex = colIndex;
      
      switch (event.direction) {
        case 'up':
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case 'down':
          newRowIndex = Math.min(context.coordinateMapping.rows.length - 1, rowIndex + 1);
          break;
        case 'left':
          newColIndex = Math.max(0, colIndex - 1);
          break;
        case 'right':
          newColIndex = Math.min(context.coordinateMapping.columns.length - 1, colIndex + 1);
          break;
      }
      
      const newRow = context.coordinateMapping.rows[newRowIndex];
      const newCol = context.coordinateMapping.columns[newColIndex];
      
      if (!newRow || !newCol) return context.activeCell;
      
      return { rowId: newRow.rowId, columnId: newCol.columnId };
    },
    anchor: ({ context, event }) => {
      if (!event || event.type !== 'keyboard.arrow') return context.anchor;
      
      // Set anchor on first extend, keep it during extend
      if (event.extend && !context.anchor && context.activeCell) {
        return context.activeCell;
      }
      
      // Clear anchor when not extending
      if (!event.extend) {
        return null;
      }
      
      // Keep existing anchor during extend
      return context.anchor;
    }
  })
};

// ====================================
// SELECTORS
// ====================================

export const selectionSelectors = {
  getSelectedCells: (context: any): Set<string> => {
    return context.selectedCells;
  },
  
  getSelectedRows: (context: any): Set<string> => {
    return context.selectedRows;
  },
  
  isRowSelected: (context: any, rowId: string): boolean => {
    return context.selectedRows.has(rowId);
  },
  
  isCellSelected: (context: any, rowId: string, columnId: string): boolean => {
    return context.selectedCells.has(getCellKey(rowId, columnId));
  },
  
  getActiveCell: (context: any): CellRef | null => {
    return context.activeCell;
  },
  
  getSelectionCount: (context: any): number => {
    return context.selectedCells.size;
  },
  
  getSelectedRowCount: (context: any): number => {
    return context.selectedRows.size;
  }
};