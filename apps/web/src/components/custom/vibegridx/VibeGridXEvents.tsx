import { useCallback, MutableRefObject, useRef } from 'react';
import type { CellRef, ViewportInfo, Column } from './types';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from './machines/table-machine';
import type { CanvasOverlay } from './overlays/CanvasOverlay';

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
  dragStateRef: MutableRefObject<{
    isDragging: boolean;
    startCell: CellRef | null;
    startPos: { x: number; y: number } | null;
  }>;
  columns: Column[];
  coordinateManagerRef?: MutableRefObject<any | null>; // VibeGridXCoordinateManager
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
    // This handler is no longer used since we handle clicks in mousedown/mouseup
    // Keeping it for compatibility but it shouldn't be called
    console.warn('VibeGridXEvents: Unexpected call to createCellClickHandler - this should not happen');
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
    console.log('[VibeGridXEvents] Column click handler called:', columnId, event);
    
    // Find the column definition
    const column = refs.columns.find(c => c.id === columnId);
    console.log('[VibeGridXEvents] Found column:', column);
    
    if (!column || column.sortable === false) {
      console.log('[VibeGridXEvents] Column not sortable, returning');
      return; // Column not sortable
    }
    
    console.log('[VibeGridXEvents] Sending view.column.click event to XState');
    
    // Just send the column click event to XState - let it handle the logic
    tableSend({
      type: 'view.column.click',
      columnId,
      field: column.field || columnId,
      shiftKey: event.shiftKey
    });
  }, [tableSend, refs.columns]);
};

// ====================================
// KEYBOARD HANDLERS
// ====================================

export const createKeyboardHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((event: React.KeyboardEvent | KeyboardEvent) => {
    // Only log special key combinations
    if ((event.ctrlKey || event.metaKey) && event.key !== 'Control' && event.key !== 'Meta' && event.key !== 'Alt') {
      console.log('VibeGridX handleKeyDown:', {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey
      });
    }
    
    // Handle arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      
      // Arrow key navigation handled by selection coordinator
      
      // Send to XState selection coordinator which will handle all the logic
      tableSend({
        type: 'keyboard.arrow',
        direction: event.key.replace('Arrow', '').toLowerCase() as any,
        extend: event.shiftKey
      });
      
      // The selection coordinator will:
      // 1. Calculate the new position based on current active cell
      // 2. Update selection (single cell or extend range with shift)
      // 3. Update anchor cell appropriately
      // 4. Trigger canvas update through subscription
      
      // TODO: Add scrollIntoView after selection update completes
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
        
      case 'Tab':
        event.preventDefault();
        console.log(`${event.shiftKey ? 'Shift+' : ''}Tab: Tab navigation`);
        
        // Send tab navigation to XState
        tableSend({
          type: 'keyboard.tab',
          reverse: event.shiftKey
        });
        break;
        
      case 'Escape':
        event.preventDefault();
        console.log('Escape key pressed');
        
        // Send escape event to state machine - let it handle the priority logic
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
          console.log('Ctrl+A: Select all');
          
          // Send to XState to select all
          tableSend({
            type: 'keyboard.selectAll'
          });
        }
        break;
        
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Ctrl+C: Copy');
          tableSend({
            type: 'keyboard.copy'
          });
        }
        break;
        
      case 'x':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Ctrl+X: Cut');
          tableSend({
            type: 'keyboard.cut'
          });
        }
        break;
        
      case 'v':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Ctrl+V: Paste');
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
  return useCallback((viewport: ViewportInfo) => {
    // Send viewport update to table machine, which will route to canvas actor for smooth scrolling
    tableSend({
      type: 'view.viewport.update',
      viewport
    });
  }, [tableSend]);
};

// ====================================
// RENDERER STATE CHANGE HANDLER
// ====================================

export const createRendererStateChangeHandler = (
  refs: EventHandlerRefs,
  callbacks: EventHandlerCallbacks,
  tableSend?: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((event: any) => {
    console.log('[VibeGridXEvents] Renderer state change event:', {
      type: event.type,
      typeofType: typeof event.type,
      exactType: JSON.stringify(event.type),
      hasRows: !!event.rows,
      rowCount: event.rows?.length,
      isMatchingSortedRowsReady: event.type === 'sorted.rows.ready'
    });
    
    // Handle renderer-specific events
    if (event.type === 'render.complete') {
      if (event.renderTime > 100) {
        console.warn('Slow render detected:', event);
      }
      
      // Note: We don't need to re-render selection after DOM updates anymore
      // because the canvas is inside the scrollable container and moves with the content.
      // The selection will be automatically updated via the selection coordinator subscription.
    } else if (event.type === 'canvas.container.ready') {
      // Forward canvas container ready event to table machine
      console.log('[VibeGridXEvents] Canvas container ready, forwarding to table machine');
      if (tableSend) {
        tableSend({
          type: 'CANVAS_CONTAINER_READY',
          container: event.container
        });
      }
    } else if (event.type === 'rows.sorted') {
      // Forward the sorted row IDs to the table machine
      // This event is no longer needed - sorting is handled by the table machine
      console.log('Rows sorted event (deprecated):', event);
    }
  }, [refs, tableSend]);
};

// ====================================
// COLUMN DRAG HANDLERS
// ====================================

export const createColumnDragStartHandler = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((columnId: string, x: number, y: number) => {
    tableSend({ type: 'view.columns.drag.start', columnId, x, y });
  }, [tableSend]);
};

export const createColumnDragMoveHandler = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  const lastUpdateRef = useRef(0);
  const throttleMs = 16; // ~60fps for smooth visual updates
  
  return useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) {
      return; // Skip this update
    }
    lastUpdateRef.current = now;
    
    tableSend({ type: 'view.columns.drag.move', x, y });
  }, [tableSend]);
};

export const createColumnDragEndHandler = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((targetIndex: number) => {
    tableSend({ type: 'view.columns.drag.end', targetIndex });
  }, [tableSend]);
};

// ====================================
// COLUMN RESIZE HANDLERS
// ====================================

export const createColumnResizeStartHandler = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((columnId: string, x: number, width: number) => {
    console.log('[VibeGridXEvents] Column resize start', { columnId, x, width });
    tableSend({ type: 'view.columns.resize.start', columnId, x, width });
  }, [tableSend]);
};

export const createColumnResizeMoveHandler = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  const lastUpdateRef = useRef(0);
  const throttleMs = 32; // ~30fps - more conservative for resize operations
  
  return useCallback((x: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) {
      return; // Skip this update
    }
    lastUpdateRef.current = now;
    
    console.log('[VibeGridXEvents] Column resize move', { x });
    tableSend({ type: 'view.columns.resize.move', x });
  }, [tableSend]);
};

export const createColumnResizeEndHandler = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback(() => {
    console.log('[VibeGridXEvents] Column resize end');
    tableSend({ type: 'view.columns.resize.end' });
  }, [tableSend]);
};


// ====================================
// CELL SELECTION DRAG HANDLERS
// ====================================

export const createMouseDownHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
) => {
  return useCallback((event: MouseEvent) => {
    // Find the cell under the mouse
    const cellElement = (event.target as Element).closest('.vibegridx-cell') as HTMLElement;
    if (!cellElement) {
      return;
    }
    
    const rowId = cellElement.dataset.rowId;
    const columnId = cellElement.dataset.columnId;
    if (!rowId || !columnId) return;
    
    // Skip if clicking on a checkbox - let the checkbox handler deal with it
    if (columnId === '__selection' || (event.target as Element).closest('.vibegridx-checkbox-wrapper')) {
      return;
    }
    
    // Focus the grid container to enable keyboard events
    const gridContainer = cellElement.closest('.vibegridx-container') as HTMLElement;
    if (gridContainer && document.activeElement !== gridContainer) {
      gridContainer.focus();
    }
    
    // Store drag start state
    refs.dragStateRef.current = {
      isDragging: false,
      startCell: { rowId, columnId },
      startPos: { x: event.clientX, y: event.clientY }
    };
    
    // Immediately handle the selection on mousedown
    const cellKey = `${rowId}:${columnId}`;
    
    if (!event.ctrlKey && !event.shiftKey) {
      // Single cell selection - send event to XState
      // Don't update DOM directly - let XState handle it for consistency
      tableSend({
        type: 'selection.cell.select',
        rowId,
        columnId,
        ctrlKey: false,
        shiftKey: false
      });
      
      // Also send drag start for potential drag selection
      tableSend({
        type: 'selection.drag.start',
        startCell: { rowId, columnId }
      });
    }
    // For ctrl/shift clicks, let the click handler deal with it
    
    // Prevent text selection
    event.preventDefault();
  }, [tableSend]);
};

export const createMouseMoveHandler = (
  refs: EventHandlerRefs,
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send']
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
        // Don't send drag.start here - already sent in mousedown
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
          
          // Only send update if we've moved to a different cell
          if (currentCellKey !== lastCellKey) {
            console.log('[VibeGridXEvents] Sending drag move event', { from: lastCellKey, to: currentCellKey });
            lastCellKey = currentCellKey;
            
            // Just send the current cell - let selection coordinator calculate the range
            tableSend({
              type: 'selection.drag.move',
              currentCell: { rowId, columnId }
            });
          }
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
      // Just send drag end - selection coordinator already has the selection
      tableSend({
        type: 'selection.drag.end'
      });
    } else if (dragState.startCell) {
      // It was a click (not a drag), handle selection
      const cellElement = (event.target as Element).closest('.vibegridx-cell') as HTMLElement;
      if (cellElement) {
        const rowId = cellElement.dataset.rowId;
        const columnId = cellElement.dataset.columnId;
        
        if (rowId && columnId) {
          // Send selection event - let XState handle all selection logic
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

