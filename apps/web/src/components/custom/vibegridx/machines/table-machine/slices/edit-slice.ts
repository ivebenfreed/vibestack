// ====================================
// EDIT SLICE - State Management for Cell Editing
// ====================================

import { assign } from 'xstate';
import type { CellRef, OptimisticOperation } from '../../../types';

// ====================================
// STATE INTERFACE
// ====================================

export interface EditState {
  editingCell: CellRef | null;
  editValue: any;
  originalValue: any;
  validationErrors: Map<string, string>;
  optimisticOperations: Map<string, OptimisticOperation>;
  isDirty: boolean;
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialEditState = (): EditState => ({
  editingCell: null,
  editValue: null,
  originalValue: null,
  validationErrors: new Map(),
  optimisticOperations: new Map(),
  isDirty: false
});

// ====================================
// ACTIONS
// ====================================

export const editActions = {
  startEdit: assign({
    editingCell: (_, event: any) => event.cell,
    editValue: (_, event: any) => event.value,
    originalValue: (_, event: any) => event.value,
    isDirty: () => false,
    validationErrors: () => new Map()
  }),

  updateEditValue: assign({
    editValue: (_, event: any) => event.value,
    isDirty: ({ context, event }: any) => {
      const originalValue = context.originalValue;
      const newValue = event.value;
      return originalValue !== newValue;
    }
  }),

  commitEdit: assign({
    optimisticOperations: ({ context, event }: any) => {
      if (!context.editingCell) return context.optimisticOperations;
      
      const operationId = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const operation: OptimisticOperation = {
        id: operationId,
        type: 'update',
        cellRef: context.editingCell,
        newValue: event.value,
        oldValue: context.originalValue,
        timestamp: Date.now(),
        status: 'pending'
      };
      
      const newOperations = new Map(context.optimisticOperations);
      newOperations.set(operationId, operation);
      return newOperations;
    }
  }),

  cancelEdit: assign({
    editingCell: () => null,
    editValue: () => null,
    originalValue: () => null,
    isDirty: () => false,
    validationErrors: () => new Map()
  }),

  clearEdit: assign({
    editingCell: () => null,
    editValue: () => null,
    originalValue: () => null,
    isDirty: () => false
  }),

  setValidationErrors: assign({
    validationErrors: (_, event: any) => new Map(event.errors)
  }),

  clearValidationErrors: assign({
    validationErrors: () => new Map()
  }),

  removeOptimisticOperation: assign({
    optimisticOperations: ({ context, event }: any) => {
      const newOperations = new Map(context.optimisticOperations);
      newOperations.delete(event.operationId);
      return newOperations;
    }
  }),

  updateOptimisticOperationStatus: assign({
    optimisticOperations: ({ context, event }: any) => {
      const newOperations = new Map(context.optimisticOperations);
      const operation = newOperations.get(event.operationId);
      if (operation) {
        newOperations.set(event.operationId, {
          ...operation,
          status: event.status
        });
      }
      return newOperations;
    }
  })
};