import { setup, assign, fromPromise, sendParent } from 'xstate';
import type { TableRow, OptimisticOperation } from '../types';

// ====================================
// HELPER FUNCTIONS
// ====================================

const createRowSnapshot = (row: TableRow): TableRow => ({
  id: row.id,
  data: { ...row.data },
  metadata: { ...row.metadata }
});

const calculateRowHash = (row: TableRow): string => {
  const dataStr = JSON.stringify(row.data);
  const metaStr = JSON.stringify(row.metadata);
  return btoa(dataStr + metaStr).slice(0, 16);
};

const shouldUpdateRow = (current: TableRow, incoming: TableRow): boolean => {
  // Version-based comparison
  if (current.metadata.version !== incoming.metadata.version) {
    return incoming.metadata.version > current.metadata.version;
  }
  
  // Timestamp-based comparison
  return incoming.metadata.updatedAt > current.metadata.updatedAt;
};

// ====================================
// ASYNC ACTORS
// ====================================

const syncRowToServer = fromPromise(async ({ input }: {
  input: { row: TableRow; operation: 'update' | 'create' | 'delete' }
}) => {
  const { row, operation } = input;
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 150));
  
  // Mock server response
  switch (operation) {
    case 'create':
      return {
        row: {
          ...row,
          id: `server_${Date.now()}`,
          metadata: {
            ...row.metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isNew: false
          }
        },
        operation: 'create',
        success: true
      };
      
    case 'update':
      return {
        row: {
          ...row,
          metadata: {
            ...row.metadata,
            updatedAt: new Date(),
            version: row.metadata.version + 1,
            isDirty: false
          }
        },
        operation: 'update',
        success: true
      };
      
    case 'delete':
      return {
        row: null,
        operation: 'delete',
        success: true
      };
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
});

const validateRowData = fromPromise(async ({ input }: {
  input: { row: TableRow; columns: any[] }
}) => {
  const { row, columns } = input;
  const errors: Record<string, string[]> = {};
  
  // Simulate validation delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Basic validation
  columns.forEach(column => {
    const value = row.data[column.field];
    const fieldErrors: string[] = [];
    
    // Required field validation
    if (column.required && (value === null || value === undefined || value === '')) {
      fieldErrors.push(`${column.name} is required`);
    }
    
    // Type validation
    if (value !== null && value !== undefined && value !== '') {
      switch (column.type) {
        case 'number':
          if (isNaN(Number(value))) {
            fieldErrors.push(`${column.name} must be a number`);
          }
          break;
        case 'email':
          if (!value.includes('@')) {
            fieldErrors.push(`${column.name} must be a valid email`);
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            fieldErrors.push(`${column.name} must be a valid URL`);
          }
          break;
      }
    }
    
    if (fieldErrors.length > 0) {
      errors[column.field] = fieldErrors;
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
});

// ====================================
// ROW ACTOR MACHINE
// ====================================

interface RowActorContext {
  id: string;
  row: TableRow;
  previousRow: TableRow | null;
  hash: string;
  
  // State tracking
  isVisible: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isHovered: boolean;
  
  // Change tracking
  optimisticOperations: Map<string, OptimisticOperation>;
  validationErrors: Record<string, string[]>;
  isDirty: boolean;
  
  // Performance
  renderCount: number;
  lastRenderTime: number;
  lastUpdateTime: number;
  
  // Sync state
  syncStatus: 'idle' | 'pending' | 'success' | 'error';
  syncError: string | null;
  retryCount: number;
  maxRetries: number;
}

type RowActorEvents = 
  | { type: 'UPDATE_ROW'; row: TableRow }
  | { type: 'SET_VISIBILITY'; visible: boolean }
  | { type: 'SET_SELECTION'; selected: boolean }
  | { type: 'SET_EDITING'; editing: boolean }
  | { type: 'SET_HOVER'; hovered: boolean }
  | { type: 'APPLY_OPTIMISTIC_OPERATION'; operation: OptimisticOperation }
  | { type: 'ROLLBACK_OPTIMISTIC_OPERATION'; operationId: string }
  | { type: 'SYNC_TO_SERVER'; operation: 'update' | 'create' | 'delete' }
  | { type: 'VALIDATE_DATA'; columns: any[] }
  | { type: 'MARK_DIRTY'; field?: string }
  | { type: 'MARK_CLEAN' }
  | { type: 'RESET_TO_CLEAN' }
  | { type: 'FORCE_RERENDER' }
  | { type: 'CLEANUP' }
  // Internal events
  | { type: 'SYNC_COMPLETE'; result: any }
  | { type: 'SYNC_FAILED'; error: string }
  | { type: 'VALIDATION_COMPLETE'; result: any }
  | { type: 'RETRY_SYNC' };

export const rowActorMachine = setup({
  types: {
    context: {} as RowActorContext,
    events: {} as RowActorEvents,
    input: {} as { id: string; row?: TableRow }
  },
  
  actors: {
    syncRowToServer,
    validateRowData
  },
  
  actions: {
    // Row data management
    updateRow: assign({
      previousRow: ({ context }) => context.row,
      row: ({ event }) => 
        event.type === 'UPDATE_ROW' ? event.row : context.row,
      hash: ({ event }) => 
        event.type === 'UPDATE_ROW' ? calculateRowHash(event.row) : context.hash,
      lastUpdateTime: () => Date.now(),
      isDirty: ({ context, event }) => {
        if (event.type === 'UPDATE_ROW') {
          return context.previousRow 
            ? calculateRowHash(context.previousRow) !== calculateRowHash(event.row)
            : false;
        }
        return context.isDirty;
      }
    }),
    
    // State management
    setVisibility: assign({
      isVisible: ({ event }) => 
        event.type === 'SET_VISIBILITY' ? event.visible : false
    }),
    
    setSelection: assign({
      isSelected: ({ event }) => 
        event.type === 'SET_SELECTION' ? event.selected : false
    }),
    
    setEditing: assign({
      isEditing: ({ event }) => 
        event.type === 'SET_EDITING' ? event.editing : false
    }),
    
    setHover: assign({
      isHovered: ({ event }) => 
        event.type === 'SET_HOVER' ? event.hovered : false
    }),
    
    // Optimistic operations
    applyOptimisticOperation: assign({
      optimisticOperations: ({ context, event }) => {
        if (event.type !== 'APPLY_OPTIMISTIC_OPERATION') return context.optimisticOperations;
        
        const operations = new Map(context.optimisticOperations);
        operations.set(event.operation.id, event.operation);
        return operations;
      },
      row: ({ context, event }) => {
        if (event.type !== 'APPLY_OPTIMISTIC_OPERATION') return context.row;
        
        const operation = event.operation;
        const newRow = { ...context.row };
        
        switch (operation.type) {
          case 'update':
            newRow.data = {
              ...newRow.data,
              [operation.field]: operation.newValue
            };
            newRow.metadata = {
              ...newRow.metadata,
              isDirty: true,
              updatedAt: new Date()
            };
            break;
        }
        
        return newRow;
      },
      isDirty: true
    }),
    
    rollbackOptimisticOperation: assign({
      optimisticOperations: ({ context, event }) => {
        if (event.type !== 'ROLLBACK_OPTIMISTIC_OPERATION') return context.optimisticOperations;
        
        const operations = new Map(context.optimisticOperations);
        operations.delete(event.operationId);
        return operations;
      },
      row: ({ context, event }) => {
        if (event.type !== 'ROLLBACK_OPTIMISTIC_OPERATION') return context.row;
        
        // Restore from previous row if available
        return context.previousRow || context.row;
      },
      isDirty: ({ context }) => context.optimisticOperations.size > 1
    }),
    
    // Validation
    updateValidationErrors: assign({
      validationErrors: ({ event }) => 
        event.type === 'VALIDATION_COMPLETE' ? event.result.errors : {}
    }),
    
    // Sync state
    setSyncStatus: assign({
      syncStatus: ({ event }) => {
        switch (event.type) {
          case 'SYNC_TO_SERVER':
            return 'pending' as const;
          case 'SYNC_COMPLETE':
            return 'success' as const;
          case 'SYNC_FAILED':
            return 'error' as const;
          default:
            return 'idle' as const;
        }
      },
      syncError: ({ event }) => 
        event.type === 'SYNC_FAILED' ? event.error : null,
      retryCount: ({ context, event }) => 
        event.type === 'SYNC_FAILED' ? context.retryCount + 1 : context.retryCount
    }),
    
    // State management
    markDirty: assign({
      isDirty: true,
      row: ({ context, event }) => ({
        ...context.row,
        metadata: {
          ...context.row.metadata,
          isDirty: true,
          updatedAt: new Date()
        }
      })
    }),
    
    markClean: assign({
      isDirty: false,
      optimisticOperations: new Map(),
      row: ({ context }) => ({
        ...context.row,
        metadata: {
          ...context.row.metadata,
          isDirty: false
        }
      })
    }),
    
    resetToClean: assign({
      row: ({ context }) => context.previousRow || context.row,
      isDirty: false,
      optimisticOperations: new Map(),
      validationErrors: {}
    }),
    
    // Performance tracking
    incrementRenderCount: assign({
      renderCount: ({ context }) => context.renderCount + 1,
      lastRenderTime: () => Date.now()
    }),
    
    // Cleanup
    cleanup: assign({
      isVisible: false,
      isSelected: false,
      isEditing: false,
      isHovered: false,
      optimisticOperations: new Map(),
      validationErrors: {},
      isDirty: false
    }),
    
    // Parent communication
    notifyParent: sendParent(({ context, event }) => ({
      type: 'ROW_STATE_CHANGED',
      rowId: context.id,
      state: {
        isVisible: context.isVisible,
        isSelected: context.isSelected,
        isEditing: context.isEditing,
        isDirty: context.isDirty,
        syncStatus: context.syncStatus
      },
      event: event.type
    }))
  },
  
  guards: {
    isDirty: ({ context }) => context.isDirty,
    hasValidationErrors: ({ context }) => Object.keys(context.validationErrors).length > 0,
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
    isVisible: ({ context }) => context.isVisible,
    hasOptimisticOperations: ({ context }) => context.optimisticOperations.size > 0
  }
  
}).createMachine({
  id: 'rowActor',
  
  initial: 'initializing',
  
  context: ({ input }) => ({
    id: input.id,
    row: input.row || {
      id: input.id,
      data: {},
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isNew: true,
        isDirty: false
      }
    },
    previousRow: null,
    hash: '',
    
    isVisible: false,
    isSelected: false,
    isEditing: false,
    isHovered: false,
    
    optimisticOperations: new Map(),
    validationErrors: {},
    isDirty: false,
    
    renderCount: 0,
    lastRenderTime: 0,
    lastUpdateTime: 0,
    
    syncStatus: 'idle',
    syncError: null,
    retryCount: 0,
    maxRetries: 3
  }),
  
  states: {
    initializing: {
      entry: [
        assign({
          hash: ({ context }) => calculateRowHash(context.row)
        }),
        'notifyParent'
      ],
      always: 'idle'
    },
    
    idle: {
      on: {
        UPDATE_ROW: {
          actions: ['updateRow', 'notifyParent']
        },
        
        SET_VISIBILITY: {
          actions: ['setVisibility', 'notifyParent']
        },
        
        SET_SELECTION: {
          actions: ['setSelection', 'notifyParent']
        },
        
        SET_EDITING: {
          actions: ['setEditing', 'notifyParent']
        },
        
        SET_HOVER: {
          actions: 'setHover'
        },
        
        APPLY_OPTIMISTIC_OPERATION: {
          actions: ['applyOptimisticOperation', 'notifyParent']
        },
        
        ROLLBACK_OPTIMISTIC_OPERATION: {
          actions: ['rollbackOptimisticOperation', 'notifyParent']
        },
        
        MARK_DIRTY: {
          actions: ['markDirty', 'notifyParent']
        },
        
        MARK_CLEAN: {
          actions: ['markClean', 'notifyParent']
        },
        
        RESET_TO_CLEAN: {
          actions: ['resetToClean', 'notifyParent']
        },
        
        FORCE_RERENDER: {
          actions: ['incrementRenderCount', 'notifyParent']
        },
        
        SYNC_TO_SERVER: {
          guard: 'isDirty',
          target: 'syncing',
          actions: 'setSyncStatus'
        },
        
        VALIDATE_DATA: {
          target: 'validating'
        },
        
        CLEANUP: {
          actions: ['cleanup', 'notifyParent']
        }
      }
    },
    
    validating: {
      invoke: {
        src: 'validateRowData',
        input: ({ context, event }) => ({
          row: context.row,
          columns: event.type === 'VALIDATE_DATA' ? event.columns : []
        }),
        onDone: {
          target: 'idle',
          actions: ['updateValidationErrors', 'notifyParent']
        },
        onError: {
          target: 'idle',
          actions: assign({
            validationErrors: { general: ['Validation failed'] }
          })
        }
      }
    },
    
    syncing: {
      invoke: {
        src: 'syncRowToServer',
        input: ({ context, event }) => ({
          row: context.row,
          operation: event.type === 'SYNC_TO_SERVER' ? event.operation : 'update'
        }),
        onDone: {
          target: 'idle',
          actions: [
            assign({
              row: ({ event }) => event.output.row,
              syncStatus: 'success',
              syncError: null,
              retryCount: 0
            }),
            'markClean',
            'notifyParent'
          ]
        },
        onError: {
          target: 'idle',
          actions: [
            assign({
              syncStatus: 'error',
              syncError: ({ event }) => event.error.message,
              retryCount: ({ context }) => context.retryCount + 1
            }),
            'notifyParent'
          ]
        }
      }
    }
  }
});