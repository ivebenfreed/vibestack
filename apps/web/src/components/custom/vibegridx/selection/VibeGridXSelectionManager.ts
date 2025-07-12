// ====================================
// VIBEGRIDX SELECTION MANAGER
// ====================================
//
// Manages selection state for the table, similar to CoordinateManager.
// Provides direct methods for selection operations and updates the
// canvas overlay directly, avoiding complex event flows.
//
// This replaces the SelectionCoordinator XState machine for simpler,
// more performant selection handling.
//
// ====================================

import type { CellRef, SelectionRange, Column } from '../types';
import type { VibeGridXCoordinateManager } from '../coordinates/VibeGridXCoordinateManager';
import type { CanvasOverlay } from '../overlays/CanvasOverlay';

export interface SelectionState {
  selectedCells: Set<string>;
  selectedRows: Set<string>;
  activeCell: CellRef | null;
  anchor: CellRef | null;
}

type SelectionChangeCallback = (state: SelectionState) => void;

export class VibeGridXSelectionManager {
  // Selection state
  private selectedCells = new Set<string>();
  private selectedRows = new Set<string>();
  private activeCell: CellRef | null = null;
  private anchor: CellRef | null = null;
  
  // References
  private coordinateManager: VibeGridXCoordinateManager | null = null;
  private canvasOverlay: CanvasOverlay | null = null;
  private columns: Column[] = [];
  private visibleRowIds: string[] = [];
  private allRowIds: string[] = [];
  
  // Callbacks
  private changeCallbacks = new Set<SelectionChangeCallback>();
  
  constructor() {
    // Initialize empty
  }
  
  // ====================================
  // SETUP METHODS
  // ====================================
  
  setCoordinateManager(manager: VibeGridXCoordinateManager): void {
    this.coordinateManager = manager;
  }
  
  setCanvasOverlay(overlay: CanvasOverlay): void {
    this.canvasOverlay = overlay;
  }
  
  updateColumns(columns: Column[]): void {
    this.columns = columns;
  }
  
  updateVisibleRows(rowIds: string[]): void {
    this.visibleRowIds = rowIds;
  }
  
  updateAllRows(rowIds: string[]): void {
    this.allRowIds = rowIds;
  }
  
  // ====================================
  // SELECTION METHODS
  // ====================================
  
  selectCell(rowId: string, columnId: string, ctrlKey = false, shiftKey = false): void {
    const cellKey = this.createCellKey(rowId, columnId);
    const cellRef = { rowId, columnId };
    
    if (shiftKey && this.anchor) {
      // Range selection
      this.selectRange(this.anchor, cellRef);
    } else if (ctrlKey) {
      // Toggle selection
      if (this.selectedCells.has(cellKey)) {
        this.selectedCells.delete(cellKey);
        if (this.activeCell?.rowId === rowId && this.activeCell?.columnId === columnId) {
          this.activeCell = null;
        }
      } else {
        this.selectedCells.add(cellKey);
        this.activeCell = cellRef;
      }
    } else {
      // Single selection
      this.selectedCells.clear();
      this.selectedCells.add(cellKey);
      this.activeCell = cellRef;
      this.anchor = cellRef;
    }
    
    this.notifyChange();
  }
  
  selectRange(start: CellRef, end: CellRef): void {
    const selection = this.calculateRangeSelection(start, end);
    this.selectedCells = selection;
    this.activeCell = end;
    this.notifyChange();
  }
  
  clearSelection(): void {
    this.selectedCells.clear();
    this.selectedRows.clear();
    this.activeCell = null;
    this.anchor = null;
    this.notifyChange();
  }
  
  // ====================================
  // ROW SELECTION (CHECKBOXES)
  // ====================================
  
  toggleRowSelection(rowId: string): void {
    if (this.selectedRows.has(rowId)) {
      this.selectedRows.delete(rowId);
    } else {
      this.selectedRows.add(rowId);
    }
    this.notifyChange();
  }
  
  selectAllRows(): void {
    this.selectedRows = new Set(this.visibleRowIds);
    this.notifyChange();
  }
  
  clearRowSelection(): void {
    this.selectedRows.clear();
    this.notifyChange();
  }
  
  selectRowRange(startRowId: string, endRowId: string): void {
    const startIndex = this.visibleRowIds.indexOf(startRowId);
    const endIndex = this.visibleRowIds.indexOf(endRowId);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    for (let i = minIndex; i <= maxIndex; i++) {
      this.selectedRows.add(this.visibleRowIds[i]);
    }
    
    this.notifyChange();
  }
  
  // ====================================
  // KEYBOARD NAVIGATION
  // ====================================
  
  moveSelection(direction: 'up' | 'down' | 'left' | 'right', extend = false): void {
    if (!this.activeCell) {
      // Select first cell if none selected
      if (this.visibleRowIds.length > 0 && this.columns.length > 0) {
        this.selectCell(this.visibleRowIds[0], this.columns[0].id);
      }
      return;
    }
    
    const newCell = this.moveCell(this.activeCell, direction);
    
    if (extend && this.anchor) {
      this.selectRange(this.anchor, newCell);
    } else {
      this.selectCell(newCell.rowId, newCell.columnId);
    }
  }
  
  // ====================================
  // DRAG SELECTION
  // ====================================
  
  startDragSelection(rowId: string, columnId: string): void {
    this.anchor = { rowId, columnId };
    this.selectCell(rowId, columnId);
  }
  
  updateDragSelection(rowId: string, columnId: string): void {
    if (!this.anchor) {
      console.warn('VibeGridXSelectionManager.updateDragSelection: No anchor set');
      return;
    }
    console.log('VibeGridXSelectionManager.updateDragSelection:', {
      anchor: this.anchor,
      currentCell: { rowId, columnId },
      visibleRowIdsLength: this.visibleRowIds.length,
      columnsLength: this.columns.length
    });
    this.selectRange(this.anchor, { rowId, columnId });
  }
  
  endDragSelection(): void {
    // Drag ended, anchor remains for shift+click
  }
  
  // ====================================
  // GETTERS
  // ====================================
  
  getState(): SelectionState {
    return {
      selectedCells: new Set(this.selectedCells),
      selectedRows: new Set(this.selectedRows),
      activeCell: this.activeCell,
      anchor: this.anchor
    };
  }
  
  getSelectedCells(): Set<string> {
    return new Set(this.selectedCells);
  }
  
  getSelectedRows(): Set<string> {
    return new Set(this.selectedRows);
  }
  
  getActiveCell(): CellRef | null {
    return this.activeCell;
  }
  
  hasSelection(): boolean {
    return this.selectedCells.size > 0 || this.selectedRows.size > 0;
  }
  
  // ====================================
  // CHANGE NOTIFICATION
  // ====================================
  
  onChange(callback: SelectionChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }
  
  private notifyChange(): void {
    const state = this.getState();
    
    // Notify all callbacks
    this.changeCallbacks.forEach(callback => {
      callback(state);
    });
    
    // Update canvas overlay directly if available
    if (this.canvasOverlay) {
      // Direct update - no event flow needed
      this.canvasOverlay.updateSelection(this.selectedCells);
    }
  }
  
  // ====================================
  // HELPER METHODS
  // ====================================
  
  private createCellKey(rowId: string, columnId: string): string {
    return `${rowId}:${columnId}`;
  }
  
  private parseCellKey(cellKey: string): CellRef {
    const [rowId, columnId] = cellKey.split(':');
    return { rowId, columnId };
  }
  
  private calculateRangeSelection(start: CellRef, end: CellRef): Set<string> {
    const selection = new Set<string>();
    
    const startRowIndex = this.visibleRowIds.indexOf(start.rowId);
    const endRowIndex = this.visibleRowIds.indexOf(end.rowId);
    const startColIndex = this.columns.findIndex(col => col.id === start.columnId);
    const endColIndex = this.columns.findIndex(col => col.id === end.columnId);
    
    console.log('VibeGridXSelectionManager.calculateRangeSelection:', {
      start,
      end,
      startRowIndex,
      endRowIndex,
      startColIndex,
      endColIndex,
      visibleRowIds: this.visibleRowIds.slice(0, 5),
      columns: this.columns.map(c => c.id)
    });
    
    if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
      console.warn('VibeGridXSelectionManager.calculateRangeSelection: Invalid indices');
      return selection;
    }
    
    const minRow = Math.min(startRowIndex, endRowIndex);
    const maxRow = Math.max(startRowIndex, endRowIndex);
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);
    
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const rowId = this.visibleRowIds[row];
        const columnId = this.columns[col].id;
        if (rowId && columnId) {
          selection.add(this.createCellKey(rowId, columnId));
        }
      }
    }
    
    return selection;
  }
  
  private moveCell(current: CellRef, direction: string): CellRef {
    const currentRowIndex = this.visibleRowIds.indexOf(current.rowId);
    const currentColIndex = this.columns.findIndex(col => col.id === current.columnId);
    
    if (currentRowIndex === -1 || currentColIndex === -1) {
      return current;
    }
    
    switch (direction) {
      case 'up':
        const upRowIndex = Math.max(0, currentRowIndex - 1);
        return {
          rowId: this.visibleRowIds[upRowIndex],
          columnId: current.columnId
        };
        
      case 'down':
        const downRowIndex = Math.min(this.visibleRowIds.length - 1, currentRowIndex + 1);
        return {
          rowId: this.visibleRowIds[downRowIndex],
          columnId: current.columnId
        };
        
      case 'left':
        const leftColIndex = Math.max(0, currentColIndex - 1);
        return {
          rowId: current.rowId,
          columnId: this.columns[leftColIndex].id
        };
        
      case 'right':
        const rightColIndex = Math.min(this.columns.length - 1, currentColIndex + 1);
        return {
          rowId: current.rowId,
          columnId: this.columns[rightColIndex].id
        };
        
      default:
        return current;
    }
  }
}

// Factory function
export function createVibeGridXSelectionManager(): VibeGridXSelectionManager {
  return new VibeGridXSelectionManager();
}