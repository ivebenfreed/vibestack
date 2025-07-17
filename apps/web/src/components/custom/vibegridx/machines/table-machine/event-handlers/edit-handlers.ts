// ====================================
// EDIT EVENT HANDLERS
// ====================================

import { sendTo, assign, emit } from 'xstate';
import { editActions } from '../slices/edit-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

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

  'edit.cell.start.single': {
    actions: [
      // Log single-click edit initiation
      ({ context, event }) => {
        console.log('🎯 Edit Handler: Single-click edit initiated', {
          rowId: event.rowId,
          columnId: event.columnId,
          immediate: event.immediate,
          timestamp: Date.now()
        });
      },
      
      // Validate that the column is editable
      ({ context, event, self }) => {
        const column = context.columns.find(c => c.id === event.columnId);
        if (!column) {
          console.warn('🎯 Edit Handler: Column not found', { columnId: event.columnId });
          return;
        }
        
        if (column.editable === false) {
          console.warn('🎯 Edit Handler: Column not editable', { columnId: event.columnId });
          return;
        }
        
        // Create cell ref from event
        const cell = {
          rowId: event.rowId,
          columnId: event.columnId,
          field: column.field || event.columnId
        };
        
        // Get current value from row data
        const row = context.rows.find(r => r.id === event.rowId);
        const value = row?.data[cell.field];
        
        console.log('🎯 Edit Handler: Starting single-click edit', {
          cell,
          value,
          column: column.name
        });
        
        // Send the edit.start event with proper structure and immediate flag
        self.send({
          type: 'edit.start',
          cell,
          value,
          mode: 'single-click',
          immediate: event.immediate
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
      
      // Send to editing actor for showing the editor
      sendTo(
        ({ context }) => context.actors.editingActor!,
        ({ context, event }) => {
          const column = context.columns.find(c => c.id === event.cell.columnId);
          if (!column) {
            console.error('EditHandlers: Column not found for cell', event.cell);
            return { type: 'SHOW_EDITOR', cell: event.cell, column: { id: 'unknown' }, value: event.value, position: { x: 0, y: 0, width: 100, height: 40 } };
          }
          
          // Use the same visual position calculation as canvas overlay
          const cellKey = `${event.cell.rowId}:${event.cell.columnId}`;
          const visualPositions = calculateVisualPositions(
            new Set([cellKey]),
            context.coordinateMapping,
            context.viewport,
            context.settings.rowHeight
          );
          
          const position = visualPositions[0] || { x: 0, y: 0, width: 100, height: 40 };
          
          return {
            type: 'SHOW_EDITOR',
            cell: event.cell,
            column,
            value: event.value,
            position,
            mode: event.mode || 'double-click'
          };
        }
      ),
      
      // Send to canvas actor to show editing overlay
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        ({ context, event }) => {
          const cellKey = `${event.cell.rowId}:${event.cell.columnId}`;
          const visualPositions = calculateVisualPositions(
            new Set([cellKey]),
            context.coordinateMapping,
            context.viewport,
            context.settings.rowHeight
          );
          
          const position = visualPositions[0] || { x: 0, y: 0, width: 100, height: 40 };
          
          return {
            type: 'SHOW_EDITING',
            position
          };
        }
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
      
      // No need to update editing actor on every keypress
      // The editor component manages its own state
      
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
    guard: ({ context, event }) => {
      // Don't commit if we're canceling
      if (context.isCanceling) {
        return false;
      }
      // Check if value has changed - either through isDirty flag or by comparing values
      const hasChanged = context.isDirty || (event.value !== context.originalValue);
      return hasChanged;
    },
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
        
        // CRITICAL: Update the row data in state optimistically
        const rowIndex = context.rows.findIndex(r => r.id === rowId);
        if (rowIndex !== -1) {
          const updatedRow = {
            ...context.rows[rowIndex],
            data: {
              ...context.rows[rowIndex].data,
              [field]: event.value
            }
          };
          const updatedRows = [...context.rows];
          updatedRows[rowIndex] = updatedRow;
          Object.assign(context, { rows: updatedRows });
          
          console.log('TableMachine: Updated row data optimistically', {
            rowId,
            field,
            newValue: event.value,
            oldValue: context.originalValue
          });
        }
        
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
      
      // Hide editing overlay
      sendTo(
        ({ context }) => context.actors.editingActor!,
        () => ({
          type: 'HIDE_EDITOR'
        })
      ),
      
      // Hide editing overlay in canvas
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'HIDE_EDITING'
        })
      )
    ]
  },

  'edit.cancel': {
    actions: [
      // Set canceling flag first
      assign({
        isCanceling: () => true
      }),
      
      editActions.cancelEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Hide editing overlay
      sendTo(
        ({ context }) => context.actors.editingActor!,
        () => ({
          type: 'HIDE_EDITOR'
        })
      ),
      
      // Hide editing overlay in canvas
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'HIDE_EDITING'
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
      
      // Update editing actor to show validation errors
      sendTo(
        ({ context }) => context.actors.editingActor!,
        ({ context, event }) => ({
          type: 'UPDATE_EDITOR_VALIDATION',
          errors: event.errors
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
  },

  'edit.ensure.end': {
    guard: ({ context }) => {
      // Only act if we're actually in edit mode
      return context.editingCell !== null;
    },
    actions: [
      ({ context }) => {
        console.log('TableMachine: Ensuring edit mode ends', {
          editingCell: context.editingCell,
          isDirty: context.isDirty
        });
      },
      
      // Clear editing state
      editActions.clearEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Hide editing overlay
      sendTo(
        ({ context }) => context.actors.editingActor!,
        () => ({
          type: 'HIDE_EDITOR'
        })
      ),
      
      // Hide editing overlay in canvas
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'HIDE_EDITING'
        })
      )
    ]
  },

};