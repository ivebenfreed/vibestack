// ====================================
// EDIT EVENT HANDLERS
// ====================================

import { sendTo, assign, emit } from 'xstate';
import { editActions } from '../slices/edit-slice';

export const editHandlers = {
  'edit.cell.start': {
    actions: [
      // Create cell ref from event
      ({ context, event, self }) => {
        const cell = {
          rowId: event.rowId,
          columnId: event.columnId,
          field: context.columns.find(c => c.id === event.columnId)?.field || event.columnId
        };
        
        // Get current value from row data
        const row = context.rows.find(r => r.id === event.rowId);
        const value = row?.data[cell.field];
        
        // Send the edit.start event with proper structure
        self.send({
          type: 'edit.start',
          cell,
          value
        });
      }
    ]
  },
  
  'edit.start': {
    actions: [
      editActions.startEdit,
      
      // Update overlay state to show editing cell
      assign({
        editingCell: ({ event }) => event.cell
      }),
      
      // Send to canvas for positioning the editing overlay
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        ({ context, event }) => ({
          type: 'UPDATE_EDITING',
          editingCell: event.cell,
          editValue: event.value,
          column: context.columns.find(c => c.id === event.cell.columnId),
          coordinateMapping: context.coordinateMapping,
          viewport: context.viewport,
          rowHeight: context.rowHeight
        })
      ),
      
      // Emit edit start event
      emit(({ event }) => ({
        type: 'vibegridx.cell.edit.start',
        cell: event.cell,
        value: event.value
      })),
      
      ({ event }) => {
        console.log('TableMachine: Edit started', {
          cell: event.cell,
          value: event.value
        });
      }
    ]
  },

  'edit.update': {
    actions: [
      editActions.updateEditValue,
      
      // Update canvas overlay with new value
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        ({ context, event }) => ({
          type: 'UPDATE_EDITING',
          editingCell: context.editingCell,
          editValue: event.value,
          column: context.columns.find(c => c.id === context.editingCell?.columnId),
          coordinateMapping: context.coordinateMapping,
          viewport: context.viewport,
          rowHeight: context.rowHeight,
          validationErrors: context.validationErrors
        })
      ),
      
      ({ context, event }) => {
        console.log('TableMachine: Edit value updated', {
          cell: context.editingCell,
          newValue: event.value,
          isDirty: context.isDirty
        });
      }
    ]
  },

  'edit.commit': {
    actions: [
      // Store editing cell info before clearing it
      ({ context, event, self }) => {
        if (!context.editingCell) return;
        
        const editingCell = context.editingCell;
        const { rowId, columnId, field } = editingCell;
        
        // Store optimistic operation for tracking
        const operationId = `edit-${rowId}-${columnId}-${Date.now()}`;
        const newOperations = new Map(context.optimisticOperations);
        newOperations.set(operationId, {
          id: operationId,
          type: 'update',
          entityId: rowId,
          field: field,
          newValue: event.value,
          oldValue: context.originalValue,
          timestamp: Date.now()
        });
        
        // Update optimistic operations
        Object.assign(context, { optimisticOperations: newOperations });
        
        // Tell renderer to apply optimistic update to just the edited cell
        if (context.actors?.rendererActor) {
          context.actors.rendererActor.send({
            type: 'UPDATE_CELL',
            rowId,
            columnId,
            field,
            value: event.value,
            oldValue: context.originalValue
          });
        }
        
        // Call entity update handler if provided (fire and forget)
        if (context.onEntityUpdate) {
          const updates = { [field]: event.value };
          
          console.log('TableMachine: Calling onEntityUpdate', {
            rowId,
            updates,
            field
          });
          
          // Fire and forget - don't await
          context.onEntityUpdate(rowId, updates);
        }
      },
      
      editActions.commitEdit,
      
      // Clear editing state after commit
      editActions.clearEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Hide canvas editing overlay
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'UPDATE_EDITING',
          editingCell: null
        })
      )
    ]
  },

  'edit.cancel': {
    actions: [
      editActions.cancelEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Hide canvas editing overlay
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'UPDATE_EDITING',
          editingCell: null
        })
      ),
      
      ({ context }) => {
        console.log('TableMachine: Edit cancelled', {
          cell: context.editingCell
        });
      }
    ]
  },

  'edit.validate': {
    actions: [
      // Validation logic would go here
      // For now, just log the validation request
      ({ context, event }) => {
        console.log('TableMachine: Edit validation requested', {
          cell: context.editingCell,
          value: event.value
        });
      }
    ]
  },

  'edit.error': {
    actions: [
      editActions.setValidationErrors,
      
      // Update canvas to show validation errors
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        ({ context, event }) => ({
          type: 'UPDATE_EDITING',
          editingCell: context.editingCell,
          editValue: context.editValue,
          column: context.columns.find(c => c.id === context.editingCell?.columnId),
          coordinateMapping: context.coordinateMapping,
          viewport: context.viewport,
          rowHeight: context.rowHeight,
          validationErrors: event.errors
        })
      ),
      
      emit(({ event }) => ({
        type: 'vibegridx.error',
        error: new Error(event.message || 'Edit validation failed'),
        context: 'edit'
      })),
      
      ({ event }) => {
        console.error('TableMachine: Edit error', {
          errors: event.errors,
          message: event.message
        });
      }
    ]
  },

  // Optimistic operation management
  'edit.operation.remove': {
    actions: [
      editActions.removeOptimisticOperation,
      
      ({ event }) => {
        console.log('TableMachine: Optimistic operation removed', {
          operationId: event.operationId
        });
      }
    ]
  },

  'edit.operation.update': {
    actions: [
      editActions.updateOptimisticOperationStatus,
      
      ({ event }) => {
        console.log('TableMachine: Optimistic operation updated', {
          operationId: event.operationId,
          status: event.status
        });
      }
    ]
  },

  // Canvas actor responses
  'EDIT_UPDATE': {
    actions: [
      ({ event }) => {
        console.log('TableMachine: Edit update from canvas', {
          value: event.value
        });
      },
      
      // Forward the update to the edit slice
      ({ self, event }) => {
        self.send({
          type: 'edit.update',
          value: event.value
        });
      }
    ]
  },

  'EDIT_COMMIT': {
    actions: [
      ({ event }) => {
        console.log('TableMachine: Edit commit from canvas', {
          value: event.value
        });
      },
      
      // Forward the commit to the edit slice
      ({ self, event }) => {
        self.send({
          type: 'edit.commit',
          value: event.value
        });
      }
    ]
  },

  'EDIT_CANCEL': {
    actions: [
      ({ event }) => {
        console.log('TableMachine: Edit cancel from canvas');
      },
      
      // Forward the cancel to the edit slice
      ({ self }) => {
        self.send({
          type: 'edit.cancel'
        });
      }
    ]
  }
};