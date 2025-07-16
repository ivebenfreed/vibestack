// ====================================
// KEYBOARD EVENT HANDLERS
// ====================================

import { sendTo, assign } from 'xstate';
import { selectionActions } from '../slices/selection-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

export const keyboardHandlers = {
  'keyboard.arrow': {
    guard: ({ context }) => {
      // Don't process arrow keys when editing a cell - let the input handle them
      return !context.editingCell;
    },
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
    guard: ({ context }) => {
      // Don't process copy when editing a cell - let the input handle Ctrl+C
      return !context.editingCell;
    },
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
    guard: ({ context }) => {
      // Don't process paste when editing a cell - let the input handle Ctrl+V
      return !context.editingCell;
    },
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
    guard: ({ context }) => {
      // Don't process delete when in editing mode
      return !context.editingCell;
    },
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
      ({ context, event, self }) => {
        if (context.editingCell) {
          // If editing, commit the edit and handle navigation if desired
          self.send({ 
            type: 'edit.commit',
            value: context.editValue // Use current edit value
          });
          
          // Navigate after committing if not Shift+Enter
          if (!event.shift) {
            self.send({
              type: 'keyboard.arrow',
              direction: 'down'
            });
          } else {
            self.send({
              type: 'keyboard.arrow',
              direction: 'up'
            });
          }
        } else {
          // If not editing, start editing the active cell
          const activeCell = context.activeCell;
          if (activeCell) {
            self.send({
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
    guard: ({ context }) => {
      // Don't process tab when editing a cell - let the input handle tab navigation
      return !context.editingCell;
    },
    actions: [
      ({ context, event, self }) => {
        // Tab navigation
        if (event.shift) {
          // Shift+Tab: Move left
          self.send({
            type: 'keyboard.arrow',
            direction: 'left'
          });
        } else {
          // Tab: Move right
          self.send({
            type: 'keyboard.arrow',
            direction: 'right'
          });
        }
      }
    ]
  },
  
  'keyboard.escape': {
    actions: [
      ({ context, self }) => {
        if (context.editingCell) {
          // If editing, cancel the edit
          self.send({ type: 'edit.cancel' });
          console.log('TableMachine: Escape - cancelled editing');
        } else {
          // If not editing, clear selection
          self.send({ type: 'selection.clear' });
          console.log('TableMachine: Escape - cleared selection');
        }
      }
    ]
  }
};