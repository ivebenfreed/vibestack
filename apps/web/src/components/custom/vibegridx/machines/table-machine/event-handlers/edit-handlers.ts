// ====================================
// EDIT EVENT HANDLERS
// ====================================

import { sendTo, assign, emit } from 'xstate';
import { editActions } from '../slices/edit-slice';

export const editHandlers = {
  'edit.start': {
    actions: [
      editActions.startEdit,
      
      // Update overlay state to show editing cell
      assign({
        editingCell: ({ event }) => event.cell
      }),
      
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
      editActions.commitEdit,
      
      // Clear editing state after commit
      editActions.clearEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Emit edit complete event
      emit(({ context, event }) => ({
        type: 'vibegridx.cell.edit',
        rowId: context.editingCell?.rowId,
        columnId: context.editingCell?.columnId,
        value: event.value,
        oldValue: context.originalValue
      })),
      
      ({ context, event }) => {
        console.log('TableMachine: Edit committed', {
          cell: context.editingCell,
          value: event.value,
          oldValue: context.originalValue
        });
      }
    ]
  },

  'edit.cancel': {
    actions: [
      editActions.cancelEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
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
  }
};