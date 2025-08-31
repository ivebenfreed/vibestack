// ====================================
// LEGEND TABLE DRAG SELECTION HANDLERS
// ====================================

import { useCallback, MutableRefObject } from 'react';
import type { TableState } from '../state/table-state';
import type { ViewportInfo } from '../types';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/legendtable/events/DragSelectionHandlers.ts');

// ====================================
// TYPES
// ====================================

export interface CellRef {
  rowId: string;
  columnId: string;
}

export interface DragSelectionRefs {
  tableStateRef: MutableRefObject<TableState>;
  dragStateRef: MutableRefObject<{
    isDragging: boolean;
    startCell: CellRef | null;
    startPos: { x: number; y: number } | null;
  }>;
  canvasOverlayRef: MutableRefObject<any | null>;
}

// ====================================
// MOUSE DOWN HANDLER
// ====================================

export const createMouseDownHandler = (
  refs: DragSelectionRefs
) => {
  return useCallback((event: MouseEvent) => {
    // Handle fill handle specially - stop propagation to prevent conflicts
    const target = event.target as HTMLElement;
    if (target.classList.contains('vibegridx-fill-handle') || target.closest('.vibegridx-fill-handle')) {
      log.info('[DragSelectionHandlers] Fill handle detected - stopping propagation:', target.className);
      // Stop the event from propagating to prevent any conflicts
      event.stopPropagation();
      event.stopImmediatePropagation();
      // Don't process this as a cell selection
      return;
    }
    
    if (target.classList.contains('vibegridx-selection-overlay') ||
        target.closest('.vibegridx-selection-overlay')) {
      log.info('[DragSelectionHandlers] Ignoring mousedown on overlay element:', target.className);
      return;
    }
    
    // Find the cell under the mouse
    const cellElement = (event.target as Element).closest('.vibegridx-cell') as HTMLElement;
    if (!cellElement) {
      return;
    }
    
    const rowId = cellElement.dataset.rowId;
    const columnId = cellElement.dataset.columnId;
    
    if (!rowId || !columnId) {
      return;
    }
    
    log.info('[LegendTable] Mouse down on cell:', { rowId, columnId });
    
    // Initialize drag state
    refs.dragStateRef.current = {
      isDragging: false,
      startCell: { rowId, columnId },
      startPos: { x: event.clientX, y: event.clientY }
    };
    
    // Immediately handle the selection on mousedown
    const cellKey = `${rowId}:${columnId}`;
    
    if (!event.ctrlKey && !event.shiftKey) {
      // Single cell selection - update Legend State
      const tableState = refs.tableStateRef.current;
      tableState.selectCell(cellKey, false);
    }
    // For ctrl/shift clicks, let the click handler deal with it
    
    // Prevent text selection and default focus behavior that causes scrolling
    event.preventDefault();
    
    // Prevent focus which can cause unwanted scrolling
    if (event.target instanceof HTMLElement && event.target !== document.body) {
      event.target.blur();
    }
  }, []);
};

// ====================================
// MOUSE MOVE HANDLER
// ====================================

export const createMouseMoveHandler = (
  refs: DragSelectionRefs
) => {
  // Track last cell to avoid duplicate events
  let lastCellKey: string | null = null;
  
  return useCallback((event: MouseEvent) => {
    const dragState = refs.dragStateRef.current;
    if (!dragState.startCell || !dragState.startPos) return;
    
    // Check if we should start dragging
    if (!dragState.isDragging) {
      const deltaX = Math.abs(event.clientX - dragState.startPos.x);
      const deltaY = Math.abs(event.clientY - dragState.startPos.y);
      
      if (deltaX > 5 || deltaY > 5) {
        // Start drag selection
        dragState.isDragging = true;
        lastCellKey = `${dragState.startCell.rowId}:${dragState.startCell.columnId}`;
        log.info('[LegendTable] Starting drag selection from:', lastCellKey);
      }
    }
    
    if (dragState.isDragging) {
      // Find cell under current mouse position
      const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
      const targetCell = elementUnderMouse?.closest('.vibegridx-cell') as HTMLElement;
      
      if (targetCell) {
        const rowId = targetCell.dataset.rowId;
        const columnId = targetCell.dataset.columnId;
        
        if (rowId && columnId) {
          const currentCellKey = `${rowId}:${columnId}`;
          
          // Only update selection if we've moved to a different cell
          if (currentCellKey !== lastCellKey) {
            log.info('[LegendTable] Drag move:', { from: lastCellKey, to: currentCellKey });
            lastCellKey = currentCellKey;
            
            // Calculate range selection from start to current cell
            const tableState = refs.tableStateRef.current;
            const startCellKey = `${dragState.startCell.rowId}:${dragState.startCell.columnId}`;
            
            // Use Legend State's selectRange method
            tableState.selectRange(startCellKey, currentCellKey);
          }
        }
      }
    }
  }, []);
};

// ====================================
// MOUSE UP HANDLER
// ====================================

export const createMouseUpHandler = (
  refs: DragSelectionRefs
) => {
  return useCallback((event: MouseEvent) => {
    const dragState = refs.dragStateRef.current;
    
    if (dragState.isDragging) {
      log.info('[LegendTable] Drag selection complete');
      // Selection was already handled by drag move events
    } else if (dragState.startCell) {
      // It was a click (not a drag), handle selection
      const cellElement = (event.target as Element).closest('.vibegridx-cell') as HTMLElement;
      if (cellElement) {
        const rowId = cellElement.dataset.rowId;
        const columnId = cellElement.dataset.columnId;
        
        if (rowId && columnId) {
          const tableState = refs.tableStateRef.current;
          const cellKey = `${rowId}:${columnId}`;
          
          // Handle selection with modifiers
          if (event.ctrlKey) {
            // Add to selection
            tableState.selectCell(cellKey, true);
          } else if (event.shiftKey) {
            // Range selection from last anchor to current cell
            const anchorCell = tableState.selection.anchorCell.get();
            if (anchorCell) {
              const anchorKey = `${anchorCell.rowId}:${anchorCell.columnId}`;
              tableState.selectRange(anchorKey, cellKey);
            } else {
              tableState.selectCell(cellKey, false);
            }
          } else {
            // Single cell selection (already handled in mousedown)
          }
        }
      }
    }
    
    // Reset drag state
    refs.dragStateRef.current = {
      isDragging: false,
      startCell: null,
      startPos: null
    };
  }, []);
};