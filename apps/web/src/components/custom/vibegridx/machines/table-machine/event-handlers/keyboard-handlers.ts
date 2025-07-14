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
      // Send copy event to overlay actor
      sendTo(
        ({ context }) => context.actors.overlayActor!,
        ({ context }) => ({
          type: 'COPY',
          cells: context.selectedCells
        })
      ),
      
      ({ context }) => {
        console.log('TableMachine: Copy operation', {
          cellCount: context.selectedCells.size
        });
      }
    ]
  },
  
  'keyboard.paste': {
    actions: [
      // Send paste event to overlay actor
      sendTo(
        ({ context }) => context.actors.overlayActor!,
        () => ({ type: 'PASTE' })
      ),
      
      () => {
        console.log('TableMachine: Paste operation');
      }
    ]
  },
  
  'keyboard.delete': {
    actions: [
      // Send delete event to edit coordinator
      sendTo(
        ({ context }) => context.actors.editCoordinator!,
        ({ context }) => ({
          type: 'DELETE_CELLS',
          cells: context.selectedCells
        })
      ),
      
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
      // Send to overlay actor first to clear any visual states
      sendTo(
        ({ context }) => context.actors.overlayActor!,
        () => ({ type: 'ESCAPE' })
      ),
      
      // Then to edit coordinator to cancel any editing
      sendTo(
        ({ context }) => context.actors.editCoordinator!,
        ({ event }) => event
      ),
      
      // Clear selection
      assign({
        selectedCells: () => new Set<string>()
      }),
      
      // Clear visual selection
      ({ context, self }) => {
        if (context.actors.canvasActor) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: []
            }
          });
        }
      },
      
      () => {
        console.log('TableMachine: Escape - cleared selection and editing');
      }
    ]
  }
};

// Import helpers
import { calculateVisualPositions } from '../helpers/visual-position-helpers';