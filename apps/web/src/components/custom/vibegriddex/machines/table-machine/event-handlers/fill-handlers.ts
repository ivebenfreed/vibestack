// ====================================
// FILL EVENT HANDLERS - Pure Actors Approach
// ====================================

import { emit } from 'xstate';
import { overlayActions } from '../slices/overlay-slice';

export const fillHandlers = {
  'FILL_START': {
    actions: [
      // Update overlay state to start fill
      overlayActions.startFill,
      
      // Log fill start
      ({ event }: any) => {
        console.log('TableMachine: Fill operation started', {
          direction: event.direction
        });
      },

      // Emit fill start event
      emit(({ context, event }: any) => ({
        type: 'vibegridx.fill.start',
        originalCells: context.selectedCells,
        direction: event.direction
      }))
    ]
  },

  'FILL_PREVIEW': {
    actions: [
      // Update overlay state with preview cells
      overlayActions.updateFillPreview,
      
      // Log preview update
      ({ event }: any) => {
        console.log('TableMachine: Fill preview updated', {
          previewCellsCount: event.previewCells.size
        });
      },

      // Send fill preview to canvas actor for visual rendering
      ({ context, event }: any) => {
        if (context.actors.canvasActor && context.viewport) {
          context.actors.canvasActor.send({
            type: 'RENDER_FILL_PREVIEW',
            previewCells: event.previewCells,
            viewport: context.viewport
          });
        }
      }
    ]
  },

  'FILL_COMPLETE': {
    actions: [
      // Complete the fill operation in overlay state
      overlayActions.completeFill,
      
      // Clear fill preview from canvas
      ({ context }: any) => {
        if (context.actors.canvasActor) {
          context.actors.canvasActor.send({ type: 'CLEAR_FILL_PREVIEW' });
        }
      },
      
      // Apply the fill data to the actual cells
      ({ context, event }: any) => {
        // TODO: Implement actual cell data filling logic here
        // This would typically involve calling a data service to update cell values
        console.log('TableMachine: Fill operation completed', {
          originalCells: context.fillState?.originalSelection?.size || 0,
          fillCells: event.fillCells.size
        });
      },

      // Emit fill complete event
      emit(({ context, event }: any) => ({
        type: 'vibegridx.fill.complete',
        originalCells: context.fillState?.originalSelection || new Set(),
        fillCells: event.fillCells
      }))
    ]
  },

  'FILL_CANCEL': {
    actions: [
      // Cancel the fill operation in overlay state
      overlayActions.cancelFill,
      
      // Clear fill preview from canvas
      ({ context }: any) => {
        if (context.actors.canvasActor) {
          context.actors.canvasActor.send({ type: 'CLEAR_FILL_PREVIEW' });
        }
      },
      
      ({ context }: any) => {
        console.log('TableMachine: Fill operation cancelled');
      }
    ]
  }
};