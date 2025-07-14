// ====================================
// KEYBOARD EVENT HANDLERS
// ====================================

import { sendTo, assign } from 'xstate';
import { selectionActions } from '../slices/selection-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

export const keyboardHandlers = {
  'keyboard.arrow': {
    actions: [
      // Update selection based on arrow key
      selectionActions.moveSelection,
      
      // Send visual update to canvas
      ({ context, self }) => {
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
          
          // Also update fill handle position
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'RENDER_FILL_HANDLE',
              visualCells: visualPositions
            }
          });
        }
      },
      
      ({ event }) => {
        console.log('TableMachine: Arrow key navigation', {
          direction: event.direction,
          extend: event.extend
        });
      }
    ]
  },
  
  'keyboard.copy': {
    actions: [
      // TODO: Copy functionality not implemented
      // overlayActor was supposed to handle this but was never spawned
      // The ClipboardOverlay.ts exists but is not integrated
      
      ({ context }) => {
        console.log('TableMachine: Copy operation', {
          cellCount: context.selectedCells.size
        });
      }
    ]
  },
  
  'keyboard.paste': {
    actions: [
      // TODO: Paste functionality not implemented
      // overlayActor was supposed to handle this but was never spawned
      // The ClipboardOverlay.ts exists but is not integrated
      
      () => {
        console.log('TableMachine: Paste operation');
      }
    ]
  },
  
  'keyboard.delete': {
    actions: [
      // TODO: Delete functionality not implemented
      // editCoordinator was supposed to handle this but was never created
      // Need to implement cell deletion logic
      
      ({ context }) => {
        console.log('TableMachine: Delete operation', {
          cellCount: context.selectedCells.size
        });
      }
    ]
  },
  
  'keyboard.enter': {
    actions: [
      ({ context, event }) => {
        // Get active cell
        const activeCell = context.activeCell;
        if (!activeCell) return;
        
        if (event.shift) {
          // Shift+Enter: Move up
          context.self.send({
            type: 'keyboard.arrow',
            direction: 'up'
          });
        } else {
          // Enter: Start editing or move down
          if (context.editingCell) {
            // Commit edit and move down
            context.self.send({ type: 'edit.commit' });
            context.self.send({
              type: 'keyboard.arrow',
              direction: 'down'
            });
          } else {
            // Start editing
            context.self.send({
              type: 'edit.cell.start',
              rowId: activeCell.rowId,
              columnId: activeCell.columnId
            });
          }
        }
      }
    ]
  },
  
  'keyboard.tab': {
    actions: [
      ({ context, event }) => {
        // Tab navigation
        if (event.shift) {
          // Shift+Tab: Move left
          context.self.send({
            type: 'keyboard.arrow',
            direction: 'left'
          });
        } else {
          // Tab: Move right
          context.self.send({
            type: 'keyboard.arrow',
            direction: 'right'
          });
        }
      }
    ]
  },
  
  'keyboard.escape': {
    actions: [
      // Clear selection
      assign({
        selectedCells: () => new Set<string>()
      }),
      
      // Clear visual selection directly to avoid event loops
      ({ context }) => {
        if (context.actors.canvasActor) {
          context.actors.canvasActor.send({
            type: 'UPDATE_SELECTION_VISUAL',
            visualCells: []
          });
        }
      },
      
      () => {
        console.log('TableMachine: Escape - cleared selection and editing');
      }
    ]
  }
};