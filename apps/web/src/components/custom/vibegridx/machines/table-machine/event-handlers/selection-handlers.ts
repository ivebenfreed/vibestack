// ====================================
// SELECTION EVENT HANDLERS
// ====================================

import { sendTo, assign, emit } from 'xstate';
import { selectionActions } from '../slices/selection-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

export const selectionHandlers = {
  'selection.cell.select': {
    actions: [
      // Update selection state
      selectionActions.selectCell,
      
      
      // Send visual positions to canvas
      ({ context, self }) => {
        // Skip selection updates when editing
        if (context.editingCell) {
          console.log('SelectionHandler: Skipping selection update - editing in progress');
          return;
        }
        
        console.log('SelectionHandler: Preparing canvas update', {
          eventType: 'selection.cell.select',
          hasCoordinateMapping: !!context.coordinateMapping,
          hasCanvasActor: !!context.actors?.canvasActor,
          selectedCellsSize: context.selectedCells.size
        });
        
        // Only proceed if we have valid context
        if (!context.coordinateMapping) {
          console.warn('SelectionHandler: Missing coordinate mapping');
          return;
        }
        
        // PERFORMANCE: Spawn canvas actor on first selection if needed
        if (!context.actors?.canvasActor) {
          console.log('SelectionHandler: No canvas actor, sending spawn event');
          self.send({ type: 'SPAWN_CANVAS_ACTOR_FOR_SELECTION' });
          return;
        }
        
        const visualPositions = calculateVisualPositions(
          context.selectedCells,
          context.coordinateMapping,
          context.viewport,
          context.rowHeight || context.settings?.rowHeight || 40
        );
        
        console.log('SelectionHandler: Calculated visual positions', {
          count: visualPositions.length,
          positions: visualPositions
        });
        
        if (visualPositions.length > 0) {
          console.log('SelectionHandler: Sending FORWARD_TO_CANVAS event');
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: visualPositions
            }
          });
          
          // Also render fill handle using the same visual positions
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'RENDER_FILL_HANDLE',
              visualCells: visualPositions,
              selectedRows: context.selectedRows
            }
          });
        }
      },
      
      // Update renderer to clear selected rows when making cell selection
      ({ context, self }) => {
        if (context.actors?.rendererActor) {
          self.send({
            type: 'FORWARD_TO_RENDERER',
            event: {
              type: 'UPDATE_SELECTED_ROWS',
              selectedRows: context.selectedRows // Will be empty set from selectCell action
            }
          });
        }
      },
      
      // Emit selection change event
      emit(({ context }) => ({
        type: 'vibegridx.selection.change',
        selectedCells: context.selectedCells
      }))
    ]
  },
  
  'selection.range.select': {
    actions: [
      selectionActions.selectRange,
      
      // Send visual positions to canvas
      ({ context, self }) => {
        // Skip selection updates when editing
        if (context.editingCell) {
          console.log('SelectionHandler: Skipping range selection update - editing in progress');
          return;
        }
        
        const visualPositions = calculateVisualPositions(
          context.selectedCells,
          context.coordinateMapping,
          context.viewport,
          context.rowHeight
        );
        
        if (context.actors.canvasActor && visualPositions.length > 0) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: visualPositions
            }
          });
          
          // Also render fill handle for range selection
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'RENDER_FILL_HANDLE',
              visualCells: visualPositions,
              selectedRows: context.selectedRows
            }
          });
        }
      }
    ]
  },
  
  'selection.clear': {
    actions: [
      selectionActions.clearSelection,
      
      // Clear canvas selection
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({ type: 'UPDATE_SELECTION_VISUAL', visualCells: [] })
      ),
      
      // Hide fill handle when selection is cleared
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({ type: 'HIDE_FILL_HANDLE' })
      ),
      
      // Update renderer to clear selected rows when clearing all selection
      ({ context, self }) => {
        if (context.actors?.rendererActor) {
          self.send({
            type: 'FORWARD_TO_RENDERER',
            event: {
              type: 'UPDATE_SELECTED_ROWS',
              selectedRows: new Set<string>() // Clear all row selection
            }
          });
        }
      }
    ]
  },
  
  'selection.checkbox.toggle': {
    actions: [
      selectionActions.toggleRowSelection,
      
      // Log the selection change
      ({ context, event }) => {
        console.log('TableMachine: Checkbox selection toggled', {
          rowId: event.rowId,
          isSelected: context.selectedRows.has(event.rowId),
          totalSelected: context.selectedRows.size
        });
      },
      
      // Send visual positions to canvas (same pattern as cell selection)
      ({ context, self }) => {
        // Skip selection updates when editing
        if (context.editingCell) {
          console.log('SelectionHandler: Skipping row selection update - editing in progress');
          return;
        }
        
        // Only proceed if we have valid context
        if (!context.coordinateMapping) {
          console.warn('SelectionHandler: Missing coordinate mapping');
          return;
        }
        
        // PERFORMANCE: Spawn canvas actor on first selection if needed
        if (!context.actors?.canvasActor) {
          console.log('SelectionHandler: No canvas actor, sending spawn event');
          self.send({ type: 'SPAWN_CANVAS_ACTOR_FOR_SELECTION' });
          return;
        }
        
        const visualPositions = calculateVisualPositions(
          context.selectedCells, // Use the updated selectedCells from the action
          context.coordinateMapping,
          context.viewport,
          context.rowHeight || context.settings?.rowHeight || 40
        );
        
        console.log('SelectionHandler: Calculated visual positions for row selection', {
          selectedCellsSize: context.selectedCells.size,
          selectedRowsSize: context.selectedRows.size,
          visualPositionsCount: visualPositions.length
        });
        
        if (visualPositions.length > 0) {
          console.log('SelectionHandler: Sending row selection canvas events');
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: visualPositions
            }
          });
          
          // Render fill handle using selectedRows to determine positioning
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'RENDER_FILL_HANDLE',
              visualCells: visualPositions,
              selectedRows: context.selectedRows
            }
          });
        } else {
          // No visual positions means no selection - clear canvas overlays
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: []
            }
          });
          
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'HIDE_FILL_HANDLE'
            }
          });
        }
        
        // Update renderer with selected rows to sync checkbox states and row styles
        if (context.actors?.rendererActor) {
          self.send({
            type: 'FORWARD_TO_RENDERER',
            event: {
              type: 'UPDATE_SELECTED_ROWS',
              selectedRows: context.selectedRows
            }
          });
        }
      }
    ]
  },
  
  'selection.checkbox.all': {
    actions: [
      selectionActions.selectAllRows,
      
      ({ context }) => {
        console.log('TableMachine: All rows selected', {
          totalRows: context.allRowIds.length,
          selectedCount: context.selectedRows.size
        });
      },
      
      // Send visual positions to canvas (same pattern as cell selection)
      ({ context, self }) => {
        // Skip selection updates when editing
        if (context.editingCell) {
          console.log('SelectionHandler: Skipping select all update - editing in progress');
          return;
        }
        
        // Only proceed if we have valid context
        if (!context.coordinateMapping) {
          console.warn('SelectionHandler: Missing coordinate mapping');
          return;
        }
        
        if (!context.actors?.canvasActor) {
          console.log('SelectionHandler: No canvas actor, sending spawn event');
          self.send({ type: 'SPAWN_CANVAS_ACTOR_FOR_SELECTION' });
          return;
        }
        
        const visualPositions = calculateVisualPositions(
          context.selectedCells, // Use the updated selectedCells from the action
          context.coordinateMapping,
          context.viewport,
          context.rowHeight || context.settings?.rowHeight || 40
        );
        
        if (visualPositions.length > 0) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: visualPositions
            }
          });
          
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'RENDER_FILL_HANDLE',
              visualCells: visualPositions,
              selectedRows: context.selectedRows
            }
          });
        }
        
        // Update renderer with selected rows to sync checkbox states and row styles
        if (context.actors?.rendererActor) {
          self.send({
            type: 'FORWARD_TO_RENDERER',
            event: {
              type: 'UPDATE_SELECTED_ROWS',
              selectedRows: context.selectedRows
            }
          });
        }
      }
    ]
  },
  
  'selection.checkbox.none': {
    actions: [
      selectionActions.clearRowSelection,
      
      () => {
        console.log('TableMachine: All rows deselected');
      },
      
      // Clear selection visual and hide fill handle
      ({ context, self }) => {
        if (context.actors?.canvasActor) {
          // Clear selection visual
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: []
            }
          });
          
          // Hide fill handle
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'HIDE_FILL_HANDLE'
            }
          });
        }
        
        // Update renderer to clear selected rows and sync checkbox states
        if (context.actors?.rendererActor) {
          self.send({
            type: 'FORWARD_TO_RENDERER',
            event: {
              type: 'UPDATE_SELECTED_ROWS',
              selectedRows: new Set<string>() // Empty set to clear selection
            }
          });
        }
      }
    ]
  },
  
  'selection.checkbox.range': {
    actions: [
      selectionActions.selectRowRange,
      
      ({ context, event }) => {
        console.log('TableMachine: Range selection', {
          startRowId: event.startRowId,
          endRowId: event.endRowId,
          selectedCount: context.selectedRows.size
        });
      }
    ]
  },
  
  'selection.drag.start': {
    actions: [
      // Set anchor for drag selection
      assign({
        anchor: ({ event }) => event.startCell
      }),
      
      
      ({ event }) => {
        console.log('TableMachine: Selection drag started', {
          startCell: event.startCell
        });
      }
    ]
  },
  
  'selection.drag.move': {
    actions: [
      // Update selection based on drag from anchor to current cell
      assign({
        selectedCells: ({ context, event }) => {
          console.log('selection.drag.move: calculating range', {
            anchor: context.anchor,
            currentCell: event.currentCell,
            hasCoordinateMapping: !!context.coordinateMapping
          });
          
          if (!context.anchor || !event.currentCell) return context.selectedCells;
          
          // Calculate range selection from anchor to current cell
          const selectedCells = new Set<string>();
          const startRowId = context.anchor.rowId;
          const endRowId = event.currentCell.rowId;
          const startColId = context.anchor.columnId;
          const endColId = event.currentCell.columnId;
          
          // Find rows and columns arrays
          const rows = context.coordinateMapping?.rows;
          const columns = context.coordinateMapping?.columns;
          
          if (!rows || !columns) {
            console.warn('No coordinate mapping available');
            return context.selectedCells;
          }
          
          // Find indices by searching the arrays
          const startRowData = rows.find((r: any) => r.rowId === startRowId);
          const endRowData = rows.find((r: any) => r.rowId === endRowId);
          const startColData = columns.find((c: any) => c.columnId === startColId);
          const endColData = columns.find((c: any) => c.columnId === endColId);
          
          if (!startRowData || !endRowData || !startColData || !endColData) {
            console.warn('Could not find cells in coordinate mapping');
            return context.selectedCells;
          }
          
          const startRowIdx = startRowData.sortedIndex;
          const endRowIdx = endRowData.sortedIndex;
          const startColIdx = startColData.index;
          const endColIdx = endColData.index;
          
          // Calculate range
          const minRow = Math.min(startRowIdx, endRowIdx);
          const maxRow = Math.max(startRowIdx, endRowIdx);
          const minCol = Math.min(startColIdx, endColIdx);
          const maxCol = Math.max(startColIdx, endColIdx);
          
          // Add all cells in range
          for (const rowData of rows) {
            if (rowData.sortedIndex >= minRow && rowData.sortedIndex <= maxRow) {
              for (const colData of columns) {
                if (colData.index >= minCol && colData.index <= maxCol) {
                  selectedCells.add(`${rowData.rowId}:${colData.columnId}`);
                }
              }
            }
          }
          
          console.log('Selected cells after range calculation:', selectedCells.size);
          
          return selectedCells;
        }
      }),
      
      // Send visual positions to canvas
      ({ context, self }) => {
        // Skip selection updates when editing
        if (context.editingCell) {
          console.log('SelectionHandler: Skipping drag move update - editing in progress');
          return;
        }
        
        const visualPositions = calculateVisualPositions(
          context.selectedCells,
          context.coordinateMapping,
          context.viewport,
          context.rowHeight || context.settings?.rowHeight || 40
        );
        
        if (context.actors.canvasActor) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: visualPositions
            }
          });
          
          // Also update fill handle position during drag
          if (visualPositions.length > 0) {
            self.send({
              type: 'FORWARD_TO_CANVAS',
              event: {
                type: 'RENDER_FILL_HANDLE',
                visualCells: visualPositions
              }
            });
          }
        }
      },
      
      // Update renderer to clear selected rows when making range selection
      ({ context, self }) => {
        if (context.actors?.rendererActor) {
          self.send({
            type: 'FORWARD_TO_RENDERER',
            event: {
              type: 'UPDATE_SELECTED_ROWS',
              selectedRows: context.selectedRows // Will be empty set from selectRange action
            }
          });
        }
      }
    ]
  },
  
  'selection.drag.end': {
    actions: [
      // Selection already updated by drag.move, just emit the change
      emit(({ context }) => ({
        type: 'vibegridx.selection.change',
        selectedCells: context.selectedCells
      })),
      
      ({ context }) => {
        console.log('TableMachine: Selection drag ended', {
          selectedCells: context.selectedCells.size
        });
      }
    ]
  }
};