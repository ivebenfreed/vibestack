import { useCallback, MutableRefObject } from 'react';
import type { CellRef, ViewportInfo } from './types';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from './machines/table-machine';
import type { CanvasOverlayManager } from './overlays/CanvasOverlayManager';
import type { EntityIntegrationLayer } from './integration/EntityIntegration';

// ====================================
// EVENT HANDLER TYPES
// ====================================

export interface EventHandlerRefs {
  selectedCellsRef: MutableRefObject<Set<string>>;
  anchorCellRef: MutableRefObject<CellRef | null>;
  canvasOverlayRef: MutableRefObject<CanvasOverlayManager | null>;
  integrationRef: MutableRefObject<EntityIntegrationLayer | null>;
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
          refs.integrationRef.current
        );
        rangeSelection.forEach(key => newSelection.add(key));
      } else {
        // Single select - also set anchor for future shift+click
        newSelection.add(cellKey);
        refs.anchorCellRef.current = { rowId, columnId };
      }
      
      refs.selectedCellsRef.current = newSelection;
      console.log('Updating canvas overlay with selection:', newSelection.size);
      refs.canvasOverlayRef.current.updateSelection(newSelection);
      
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
      refs.canvasOverlayRef.current?.updateSelection(newSelection);
      
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
              refs.integrationRef.current
            );
            refs.selectedCellsRef.current = rangeSelection;
            refs.canvasOverlayRef.current?.updateSelection(rangeSelection);
          } else {
            // Move selection
            refs.selectedCellsRef.current = new Set([newCellKey]);
            refs.anchorCellRef.current = { rowId: newRowId, columnId: newColumnId };
            refs.canvasOverlayRef.current?.updateSelection(refs.selectedCellsRef.current);
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
        refs.canvasOverlayRef.current?.updateSelection(refs.selectedCellsRef.current);
        
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
            refs.canvasOverlayRef.current?.updateSelection(allCells);
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
          // Show copy indicator
          refs.canvasOverlayRef.current?.selectionManager?.showCopyIndicator(false);
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
          // Show cut indicator
          refs.canvasOverlayRef.current?.selectionManager?.showCopyIndicator(true);
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
          // Hide copy/cut indicator
          refs.canvasOverlayRef.current?.selectionManager?.hideCopyIndicator();
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
  return useCallback((viewport: ViewportInfo) => {
    // Update viewport in table machine
    tableSend({
      type: 'view.viewport.update',
      viewport
    });
    
    // Update canvas overlay viewport (this will automatically re-render selection)
    if (refs.canvasOverlayRef.current) {
      refs.canvasOverlayRef.current.updateViewport(viewport);
    }
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
// HELPER FUNCTIONS
// ====================================

export const calculateRangeSelection = (
  start: CellRef, 
  end: CellRef, 
  integration: EntityIntegrationLayer | null
): Set<string> => {
  const selection = new Set<string>();
  
  if (!integration) return selection;
  
  // Get all entity IDs and column IDs
  const entities = integration.getAllEntityData();
  const columns = integration.getColumns();
  
  const entityIds = Object.keys(entities);
  
  // Use column IDs from column definitions
  const columnIds = columns.map(c => c.id);
  
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