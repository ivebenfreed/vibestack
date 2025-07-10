import { useCallback, MutableRefObject } from 'react';
import type { CellRef, ViewportInfo, Column } from './types';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from './machines/table-machine';
import type { CanvasOverlay } from './overlays/CanvasOverlay';
import type { EntityIntegrationLayer } from './integration/EntityIntegration';

// ====================================
// EVENT HANDLER TYPES
// ====================================

// Unified function to update overlay with DOM positions
const updateSelectionWithDOM = (
  overlayManager: CanvasOverlay | null,
  selectedCells: Set<string>
) => {
  if (!overlayManager) return;
  
  // For large selections, use requestAnimationFrame for better performance
  const updateFn = () => {
    const cellElements = new Map<string, DOMRect>();
    
    // Query DOM positions for selected cells
    selectedCells.forEach(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      const cellElement = document.querySelector(
        `.vibegridx-cell[data-row-id="${rowId}"][data-column-id="${columnId}"]`
      ) as HTMLElement;
      
      if (cellElement) {
        cellElements.set(cellKey, cellElement.getBoundingClientRect());
      }
    });
    
    // Update overlay with selection
    overlayManager.updateSelection(selectedCells);
  };
  
  // For small selections, update immediately
  // For large selections, defer to next frame
  if (selectedCells.size > 100) {
    requestAnimationFrame(updateFn);
  } else {
    updateFn();
  }
};

export interface EventHandlerRefs {
  selectedCellsRef: MutableRefObject<Set<string>>;
  anchorCellRef: MutableRefObject<CellRef | null>;
  canvasOverlayRef: MutableRefObject<CanvasOverlay | null>;
  integrationRef: MutableRefObject<EntityIntegrationLayer | null>;
  dragStateRef: MutableRefObject<{
    isDragging: boolean;
    startCell: CellRef | null;
    startPos: { x: number; y: number } | null;
  }>;
  columns: Column[];
}

export interface EventHandlerCallbacks {
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onEditingChange?: (editingCell: CellRef | null) => void;
  onPerformanceUpdate?: (metrics: any) => void;
}

// ====================================
// CELL CLICK HANDLERS
// ====================================

export const createCellClickHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'],
  callbacks: EventHandlerCallbacks
) => {
  return useCallback((rowId: string, columnId: string, event: MouseEvent) => {
    console.log('VibeGridX.handleCellClick:', { rowId, columnId, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey });
    console.log('VibeGridXEvents.handleCellClick DEBUG:', {
      hasCanvasOverlay: !!refs.canvasOverlayRef.current,
      canvasOverlayType: refs.canvasOverlayRef.current?.constructor.name,
      eventCoords: { x: event.clientX, y: event.clientY }
    });
    
    const cellKey = `${rowId}:${columnId}`;
    
    // Check if canvas overlay is available
    if (!refs.canvasOverlayRef.current) {
      console.warn('Canvas overlay ref not available - initialization may still be pending');
      
      // Still update selection state for when overlay becomes available
      if (event.ctrlKey || event.shiftKey) {
        // Handle multi-select without canvas overlay
        const newSelection = new Set<string>(refs.selectedCellsRef.current);
        if (event.ctrlKey && newSelection.has(cellKey)) {
          newSelection.delete(cellKey);
        } else if (event.ctrlKey) {
          newSelection.add(cellKey);
        }
        refs.selectedCellsRef.current = newSelection;
      } else {
        // Single select
        refs.selectedCellsRef.current = new Set([cellKey]);
        refs.anchorCellRef.current = { rowId, columnId };
      }
    }
    
    // Immediately update canvas overlay for instant feedback
    if (refs.canvasOverlayRef.current) {
      // Simple selection logic for immediate UI update
      const newSelection = new Set<string>();
      
      if (event.ctrlKey && refs.selectedCellsRef.current.has(cellKey)) {
        // Multi-select: copy current selection and toggle
        refs.selectedCellsRef.current.forEach(key => newSelection.add(key));
        newSelection.delete(cellKey);
      } else if (event.ctrlKey) {
        // Multi-select: copy current selection and add
        refs.selectedCellsRef.current.forEach(key => newSelection.add(key));
        newSelection.add(cellKey);
      } else if (event.shiftKey && refs.anchorCellRef.current) {
        // Range select
        const rangeSelection = calculateRangeSelection(
          refs.anchorCellRef.current,
          { rowId, columnId },
          refs.integrationRef.current,
          refs.columns
        );
        rangeSelection.forEach(key => newSelection.add(key));
      } else {
        // Single select - also set anchor for future shift+click
        newSelection.add(cellKey);
        refs.anchorCellRef.current = { rowId, columnId };
      }
      
      refs.selectedCellsRef.current = newSelection;
      console.log('Updating canvas overlay with selection:', newSelection.size);
      
      // Use unified function to update with DOM positions
      updateSelectionWithDOM(refs.canvasOverlayRef.current, newSelection);
      
      // Log selection action
      console.log(`Selection: ${newSelection.size} cells selected`, {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        cells: newSelection.size <= 5 ? Array.from(newSelection) : `${newSelection.size} cells`
      });
    } else {
      console.warn('Canvas overlay ref not available');
    }
    
    // Send selection event to table machine for state management
    tableSend({
      type: 'selection.cell.select',
      rowId,
      columnId,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey
    });
    
    callbacks.onCellClick?.(rowId, columnId);
  }, [tableSend, callbacks.onCellClick]);
};

export const createCellDoubleClickHandler = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'],
  callbacks: EventHandlerCallbacks
) => {
  return useCallback((rowId: string, columnId: string, event: MouseEvent) => {
    // Start editing
    tableSend({
      type: 'edit.cell.start',
      rowId,
      columnId
    });
    
    callbacks.onCellDoubleClick?.(rowId, columnId);
  }, [tableSend, callbacks.onCellDoubleClick]);
};

export const createColumnClickHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((columnId: string, event: MouseEvent) => {
    // Select entire column
    if (refs.integrationRef.current) {
      const entities = refs.integrationRef.current.getAllEntityData();
      const newSelection = new Set<string>();
      
      if (event.ctrlKey && refs.selectedCellsRef.current.size > 0) {
        // Add to existing selection
        refs.selectedCellsRef.current.forEach(key => newSelection.add(key));
      }
      
      // Add all cells in this column
      Object.keys(entities).forEach(rowId => {
        newSelection.add(`${rowId}:${columnId}`);
      });
      
      refs.selectedCellsRef.current = newSelection;
      updateSelectionWithDOM(refs.canvasOverlayRef.current, newSelection);
      
      console.log(`Column selection: ${columnId} - ${newSelection.size} cells selected`);
      
      // Send to XState
      tableSend({
        type: 'selection.column.select',
        columnId,
        extend: event.ctrlKey
      });
    }
  }, [tableSend]);
};

// ====================================
// KEYBOARD HANDLERS
// ====================================

export const createKeyboardHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((event: React.KeyboardEvent | KeyboardEvent) => {
    console.log('VibeGridX handleKeyDown:', {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      target: event.target,
      currentTarget: event.currentTarget
    });
    
    // Handle arrow key navigation directly for instant feedback
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      
      if (refs.selectedCellsRef.current.size === 1 && refs.integrationRef.current) {
        const currentCellKey = Array.from(refs.selectedCellsRef.current)[0];
        const [rowId, columnId] = currentCellKey.split(':');
        
        const entities = refs.integrationRef.current.getAllEntityData();
        const columns = refs.integrationRef.current.getColumns();
        
        const entityIds = Object.keys(entities);
        const columnIds = columns.map(c => c.id);
        
        const currentRowIndex = entityIds.indexOf(rowId);
        const currentColIndex = columnIds.indexOf(columnId);
        
        let newRowIndex = currentRowIndex;
        let newColIndex = currentColIndex;
        
        switch (event.key) {
          case 'ArrowUp':
            newRowIndex = Math.max(0, currentRowIndex - 1);
            break;
          case 'ArrowDown':
            newRowIndex = Math.min(entityIds.length - 1, currentRowIndex + 1);
            break;
          case 'ArrowLeft':
            newColIndex = Math.max(0, currentColIndex - 1);
            break;
          case 'ArrowRight':
            newColIndex = Math.min(columnIds.length - 1, currentColIndex + 1);
            break;
        }
        
        const newRowId = entityIds[newRowIndex];
        const newColumnId = columnIds[newColIndex];
        
        if (newRowId && newColumnId) {
          const newCellKey = `${newRowId}:${newColumnId}`;
          
          if (event.shiftKey) {
            // Extend selection
            const rangeSelection = calculateRangeSelection(
              refs.anchorCellRef.current || { rowId, columnId },
              { rowId: newRowId, columnId: newColumnId },
              refs.integrationRef.current,
              refs.columns
            );
            refs.selectedCellsRef.current = rangeSelection;
            updateSelectionWithDOM(refs.canvasOverlayRef.current, rangeSelection);
          } else {
            // Move selection
            refs.selectedCellsRef.current = new Set([newCellKey]);
            refs.anchorCellRef.current = { rowId: newRowId, columnId: newColumnId };
            updateSelectionWithDOM(refs.canvasOverlayRef.current, refs.selectedCellsRef.current);
          }
          
          console.log(`Keyboard nav: ${event.shiftKey ? 'Extended' : 'Moved'} to ${newCellKey}`);
        }
      }
      
      // Still send to XState for state management
      tableSend({
        type: 'keyboard.arrow',
        direction: event.key.replace('Arrow', '').toLowerCase() as any,
        extend: event.shiftKey
      });
      return;
    }
    
    // Handle other keys
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        tableSend({
          type: 'keyboard.enter',
          shift: event.shiftKey
        });
        break;
        
      case 'Escape':
        event.preventDefault();
        // Clear selection immediately
        refs.selectedCellsRef.current.clear();
        refs.anchorCellRef.current = null;
        updateSelectionWithDOM(refs.canvasOverlayRef.current, refs.selectedCellsRef.current);
        
        // Cancel any active fill operation
        if (refs.canvasOverlayRef.current?.overlayRenderer) {
          refs.canvasOverlayRef.current.overlayRenderer.cancelFill();
        }
        
        tableSend({
          type: 'keyboard.escape'
        });
        break;
        
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        tableSend({
          type: 'keyboard.delete'
        });
        break;
        
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Select all cells
          if (refs.integrationRef.current) {
            const entities = refs.integrationRef.current.getAllEntityData();
            const columns = refs.integrationRef.current.getColumns();
            const allCells = new Set<string>();
            
            Object.keys(entities).forEach(rowId => {
              columns.forEach(col => {
                allCells.add(`${rowId}:${col.id}`);
              });
            });
            
            refs.selectedCellsRef.current = allCells;
            updateSelectionWithDOM(refs.canvasOverlayRef.current, allCells);
            console.log(`Select All: ${allCells.size} cells selected`);
          }
        }
        break;
        
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Copy event triggered:', {
            selectedCells: refs.selectedCellsRef.current.size,
            cells: Array.from(refs.selectedCellsRef.current).slice(0, 5)
          });
          // Send copy event to overlay machine
          if (refs.canvasOverlayRef.current?.overlayRenderer) {
            refs.canvasOverlayRef.current.overlayRenderer.handleCopy(refs.selectedCellsRef.current);
          }
          console.log('Copy: Selected cells copied to clipboard');
          tableSend({
            type: 'keyboard.copy'
          });
        }
        break;
        
      case 'x':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Cut event triggered:', {
            selectedCells: refs.selectedCellsRef.current.size,
            cells: Array.from(refs.selectedCellsRef.current).slice(0, 5)
          });
          // Send cut event to overlay machine
          if (refs.canvasOverlayRef.current?.overlayRenderer) {
            refs.canvasOverlayRef.current.overlayRenderer.handleCut(refs.selectedCellsRef.current);
          }
          console.log('Cut: Selected cells cut to clipboard');
          tableSend({
            type: 'keyboard.cut'
          });
        }
        break;
        
      case 'v':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Paste event triggered:', {
            targetCell: refs.anchorCellRef.current,
            selectedCells: refs.selectedCellsRef.current.size
          });
          // Send paste event to overlay machine
          if (refs.canvasOverlayRef.current?.overlayRenderer) {
            refs.canvasOverlayRef.current.overlayRenderer.handlePaste();
          }
          console.log('Paste: Pasting clipboard content');
          tableSend({
            type: 'keyboard.paste'
          });
        }
        break;
    }
  }, [tableSend]);
};

// ====================================
// SCROLL HANDLER
// ====================================

export const createScrollHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  // Throttle scroll updates to prevent infinite loops
  let lastScrollTime = 0;
  const THROTTLE_MS = 16; // ~60fps
  
  return useCallback((viewport: ViewportInfo) => {
    const now = performance.now();
    if (now - lastScrollTime < THROTTLE_MS) {
      return; // Skip this update
    }
    lastScrollTime = now;
    
    // Update viewport in table machine
    tableSend({
      type: 'view.viewport.update',
      viewport
    });
    
    // DON'T update canvas overlay on every scroll - let it be handled by selection updates only
    // This breaks the infinite loop between scroll -> canvas update -> scroll
  }, [tableSend]);
};

// ====================================
// RENDERER STATE CHANGE HANDLER
// ====================================

export const createRendererStateChangeHandler = (
  refs: EventHandlerRefs,
  callbacks: EventHandlerCallbacks
) => {
  return useCallback((event: any) => {
    // Handle renderer-specific events
    if (event.type === 'render.complete') {
      if (event.renderTime > 100) {
        console.warn('Slow render detected:', event);
      }
      
      // Note: We don't need to re-render selection after DOM updates anymore
      // because the canvas is inside the scrollable container and moves with the content.
      // The selection will be automatically updated via the selection coordinator subscription.
    }
  }, []);
};

// ====================================
// DRAG HANDLERS
// ====================================

export const createMouseDownHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((event: MouseEvent) => {
    // Find the cell under the mouse
    const cellElement = (event.target as Element).closest('.vibegridx-cell') as HTMLElement;
    if (!cellElement) return;
    
    const rowId = cellElement.dataset.rowId;
    const columnId = cellElement.dataset.columnId;
    if (!rowId || !columnId) return;
    
    // Store drag start state
    refs.dragStateRef.current = {
      isDragging: false,
      startCell: { rowId, columnId },
      startPos: { x: event.clientX, y: event.clientY }
    };
    
    // Immediately handle the selection on mousedown
    const cellKey = `${rowId}:${columnId}`;
    
    if (!event.ctrlKey && !event.shiftKey) {
      // Single cell selection - clear and select immediately
      refs.selectedCellsRef.current = new Set([cellKey]);
      refs.anchorCellRef.current = { rowId, columnId };
      
      // Update overlay immediately
      updateSelectionWithDOM(refs.canvasOverlayRef.current, refs.selectedCellsRef.current);
      
      // Send selection event
      tableSend({
        type: 'selection.cell.select',
        rowId,
        columnId,
        ctrlKey: false,
        shiftKey: false
      });
    }
    // For ctrl/shift clicks, let the mouseup handler deal with it
    
    // Prevent text selection
    event.preventDefault();
  }, [tableSend]);
};

export const createMouseMoveHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
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
        console.log('VibeGridXEvents: Starting drag selection from', dragState.startCell);
        
        tableSend({
          type: 'selection.drag.start',
          startCell: dragState.startCell
        });
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
          // Calculate range selection
          const rangeSelection = calculateRangeSelection(
            dragState.startCell,
            { rowId, columnId },
            refs.integrationRef.current,
            refs.columns
          );
          
          // Update selection immediately for visual feedback
          refs.selectedCellsRef.current = rangeSelection;
          updateSelectionWithDOM(refs.canvasOverlayRef.current, rangeSelection);
          
          // Send drag move event to state machine
          tableSend({
            type: 'selection.drag.move',
            currentCell: { rowId, columnId },
            selectedCells: rangeSelection
          });
        }
      }
    }
  }, [tableSend]);
};

export const createMouseUpHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((event: MouseEvent) => {
    const dragState = refs.dragStateRef.current;
    
    if (dragState.isDragging) {
      // Complete drag selection
      console.log('VibeGridXEvents: Completing drag selection');
      
      tableSend({
        type: 'selection.drag.end',
        selectedCells: refs.selectedCellsRef.current
      });
    } else if (dragState.startCell && (event.ctrlKey || event.shiftKey)) {
      // It was a ctrl/shift click, handle special selection
      const cellElement = (event.target as Element).closest('.vibegridx-cell') as HTMLElement;
      if (cellElement) {
        const rowId = cellElement.dataset.rowId;
        const columnId = cellElement.dataset.columnId;
        
        if (rowId && columnId) {
          // Handle ctrl/shift click
          const cellKey = `${rowId}:${columnId}`;
          
          if (event.ctrlKey) {
            // Toggle selection
            const newSelection = new Set(refs.selectedCellsRef.current);
            if (newSelection.has(cellKey)) {
              newSelection.delete(cellKey);
            } else {
              newSelection.add(cellKey);
            }
            refs.selectedCellsRef.current = newSelection;
            updateSelectionWithDOM(refs.canvasOverlayRef.current, newSelection);
          } else if (event.shiftKey && refs.anchorCellRef.current) {
            // Range selection
            const rangeSelection = calculateRangeSelection(
              refs.anchorCellRef.current,
              { rowId, columnId },
              refs.integrationRef.current,
              refs.columns
            );
            refs.selectedCellsRef.current = rangeSelection;
            updateSelectionWithDOM(refs.canvasOverlayRef.current, rangeSelection);
          }
          
          // Send selection event
          tableSend({
            type: 'selection.cell.select',
            rowId,
            columnId,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey
          });
        }
      }
    }
    
    // Reset drag state
    refs.dragStateRef.current = {
      isDragging: false,
      startCell: null,
      startPos: null
    };
  }, [tableSend]);
};

// ====================================
// HELPER FUNCTIONS
// ====================================

export const calculateRangeSelection = (
  start: CellRef, 
  end: CellRef, 
  integration: EntityIntegrationLayer | null,
  columns?: Column[]
): Set<string> => {
  const selection = new Set<string>();
  
  if (!integration) return selection;
  
  // Get all entity IDs and column IDs
  const entities = integration.getAllEntityData();
  
  const entityIds = Object.keys(entities);
  
  // Use column IDs from column definitions passed as parameter
  const columnIds = (columns || []).map(c => c.id);
  
  // Find indices
  const startRowIndex = entityIds.indexOf(start.rowId);
  const endRowIndex = entityIds.indexOf(end.rowId);
  const startColIndex = columnIds.indexOf(start.columnId);
  const endColIndex = columnIds.indexOf(end.columnId);
  
  console.log('calculateRangeSelection:', {
    start,
    end,
    columnIds,
    startColIndex,
    endColIndex,
    entityCount: entityIds.length,
    startColumnId: start.columnId,
    endColumnId: end.columnId,
    columnsFromIntegration: columns
  });
  
  if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
    console.warn('Invalid indices in range selection:', { startRowIndex, endRowIndex, startColIndex, endColIndex });
    return selection;
  }
  
  // Calculate range
  const minRow = Math.min(startRowIndex, endRowIndex);
  const maxRow = Math.max(startRowIndex, endRowIndex);
  const minCol = Math.min(startColIndex, endColIndex);
  const maxCol = Math.max(startColIndex, endColIndex);
  
  // Add all cells in range
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const rowId = entityIds[row];
      const columnId = columnIds[col];
      if (rowId && columnId) {
        selection.add(`${rowId}:${columnId}`);
      }
    }
  }
  
  console.log('Range selection calculated:', {
    minRow, maxRow,
    minCol, maxCol,
    totalCells: selection.size,
    sample: Array.from(selection).slice(0, 5)
  });
  
  return selection;
};