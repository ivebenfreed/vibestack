import { setup, assign, fromPromise } from 'xstate';
import type { 
  EditContext, 
  CellRef, 
  OptimisticOperation,
  Column,
  TableEvents 
} from '../types';

// ====================================
// HELPER FUNCTIONS
// ====================================

const generateOperationId = (): string => {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const validateCellValue = (value: any, column: Column): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!column.editable) {
    errors.push('This field is not editable');
    return { isValid: false, errors };
  }
  
  // Type validation
  switch (column.type) {
    case 'number':
      if (isNaN(Number(value)) && value !== '') {
        errors.push('Must be a valid number');
      }
      break;
      
    case 'date':
      if (value && isNaN(Date.parse(value))) {
        errors.push('Must be a valid date');
      }
      break;
      
    case 'boolean':
      if (value !== true && value !== false && value !== 'true' && value !== 'false') {
        errors.push('Must be true or false');
      }
      break;
      
    case 'select':
      if (column.options && !column.options.includes(value)) {
        errors.push(`Must be one of: ${column.options.join(', ')}`);
      }
      break;
  }
  
  return { isValid: errors.length === 0, errors };
};

const normalizeValue = (value: any, column: Column): any => {
  switch (column.type) {
    case 'number':
      return value === '' ? null : Number(value);
    case 'boolean':
      return value === 'true' || value === true;
    case 'date':
      return value ? new Date(value) : null;
    default:
      return value;
  }
};

// ====================================
// ASYNC ACTORS
// ====================================

const saveEntityUpdate = fromPromise(async ({ input }: {
  input: { 
    entityType: string; 
    entityId: string; 
    field: string; 
    value: any;
    operationId: string;
  }
}) => {
  const { entityType, entityId, field, value, operationId } = input;
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock successful save - in real implementation this would call the domain service
  console.log(`Saving ${entityType} ${entityId}.${field} = ${value} (op: ${operationId})`);
  
  return {
    entityId,
    field,
    value: normalizeValue(value, { type: 'text' } as Column), // Simplified for POC
    operationId,
    timestamp: Date.now()
  };
});

const validateFieldAsync = fromPromise(async ({ input }: {
  input: { value: any; column: Column; entityId: string }
}) => {
  const { value, column, entityId } = input;
  
  // Basic validation
  const basicValidation = validateCellValue(value, column);
  
  // Simulate async validation (e.g., uniqueness check)
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Mock additional validation
  const additionalErrors: string[] = [];
  if (column.field === 'email' && value && !value.includes('@')) {
    additionalErrors.push('Invalid email format');
  }
  
  return {
    isValid: basicValidation.isValid && additionalErrors.length === 0,
    errors: [...basicValidation.errors, ...additionalErrors]
  };
});

const createNewRow = fromPromise(async ({ input }: {
  input: { 
    entityType: string; 
    data: Record<string, any>;
    insertAfter?: string;
  }
}) => {
  const { entityType, data, insertAfter } = input;
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const newRow = {
    id: `new_${Date.now()}`,
    data: {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isNew: false,
      isDirty: false
    }
  };
  
  console.log(`Created new ${entityType}:`, newRow);
  
  return newRow;
});

// ====================================
// EDIT COORDINATOR MACHINE
// ====================================

interface EditCoordinatorContext extends EditContext {
  entityType: string;
  columns: Column[];
  
  // New row creation
  newRowTemplate: Record<string, any>;
  activeNewRow: string | null;
  
  // Bulk operations
  bulkOperations: Map<string, OptimisticOperation>;
  isBulkMode: boolean;
  
  // Auto-save configuration
  autoSaveEnabled: boolean;
  autoSaveDelay: number;
}

type EditEvents = 
  | { type: 'edit.cell.start'; rowId: string; columnId: string }
  | { type: 'edit.value.update'; value: any }
  | { type: 'edit.commit' }
  | { type: 'edit.cancel' }
  | { type: 'edit.row.create' }
  | { type: 'keyboard.paste' }
  | { type: 'keyboard.delete' }
  | { type: 'keyboard.enter' }
  | { type: 'keyboard.escape' }
  // Internal events
  | { type: 'COLUMNS_CHANGED'; columns: Column[] }
  | { type: 'ENTITY_TYPE_CHANGED'; entityType: string }
  | { type: 'VALIDATION_COMPLETE'; isValid: boolean; errors: string[] }
  | { type: 'OPTIMISTIC_CONFIRM'; operationId: string }
  | { type: 'OPTIMISTIC_ROLLBACK'; operationId: string; error: string }
  | { type: 'AUTO_SAVE_TRIGGER' }
  | { type: 'BULK_START' }
  | { type: 'BULK_COMMIT' }
  | { type: 'BULK_CANCEL' };

export const editCoordinatorMachine = setup({
  types: {
    context: {} as EditCoordinatorContext,
    events: {} as EditEvents,
    input: {} as { columns: Column[] }
  },
  
  actors: {
    saveEntityUpdate,
    validateFieldAsync,
    createNewRow
  },
  
  actions: {
    // Start editing
    startEdit: assign({
      editingCell: ({ event }) => 
        event.type === 'edit.cell.start' 
          ? { rowId: event.rowId, columnId: event.columnId }
          : null,
      editValue: ({ context, event }) => {
        if (event.type !== 'edit.cell.start') return context.editValue;
        
        // Get current value (will be provided by entity integration)
        return ''; // Placeholder - real implementation will get from entity store
      },
      originalValue: ({ context, event }) => {
        if (event.type !== 'edit.cell.start') return context.originalValue;
        
        // Store original value for rollback
        return ''; // Placeholder
      },
      isDirty: false
    }),
    
    // Update edit value
    updateValue: assign({
      editValue: ({ event }) => 
        event.type === 'edit.value.update' ? event.value : undefined,
      isDirty: ({ context, event }) => {
        if (event.type !== 'edit.value.update') return context.isDirty;
        return event.value !== context.originalValue;
      }
    }),
    
    // Cancel editing
    cancelEdit: assign({
      editingCell: null,
      editValue: undefined,
      originalValue: undefined,
      isDirty: false,
      validationErrors: new Map()
    }),
    
    // Create optimistic operation
    createOptimisticOperation: assign({
      optimisticOperations: ({ context, event }) => {
        if (!context.editingCell || event.type !== 'edit.commit') {
          return context.optimisticOperations;
        }
        
        const operationId = generateOperationId();
        const operation: OptimisticOperation = {
          id: operationId,
          type: 'update',
          entityId: context.editingCell.rowId,
          field: context.editingCell.columnId,
          newValue: context.editValue,
          oldValue: context.originalValue,
          timestamp: Date.now()
        };
        
        return new Map(context.optimisticOperations.set(operationId, operation));
      }
    }),
    
    // Confirm optimistic operation
    confirmOptimistic: assign({
      optimisticOperations: ({ context, event }) => {
        if (event.type !== 'OPTIMISTIC_CONFIRM') return context.optimisticOperations;
        
        const operations = new Map(context.optimisticOperations);
        operations.delete(event.operationId);
        return operations;
      }
    }),
    
    // Rollback optimistic operation
    rollbackOptimistic: assign({
      optimisticOperations: ({ context, event }) => {
        if (event.type !== 'OPTIMISTIC_ROLLBACK') return context.optimisticOperations;
        
        const operations = new Map(context.optimisticOperations);
        operations.delete(event.operationId);
        return operations;
      },
      validationErrors: ({ context, event }) => {
        if (event.type !== 'OPTIMISTIC_ROLLBACK') return context.validationErrors;
        
        const errors = new Map(context.validationErrors);
        errors.set('save_error', event.error);
        return errors;
      }
    }),
    
    // Handle validation result
    updateValidation: assign({
      validationErrors: ({ context, event }) => {
        if (event.type !== 'VALIDATION_COMPLETE') return context.validationErrors;
        
        const errors = new Map(context.validationErrors);
        
        if (event.isValid) {
          errors.clear();
        } else {
          errors.set('validation', event.errors.join(', '));
        }
        
        return errors;
      }
    }),
    
    // New row creation
    initNewRow: assign({
      activeNewRow: generateOperationId,
      newRowTemplate: ({ context }) => {
        // Create default values based on column types
        const template: Record<string, any> = {};
        
        context.columns.forEach(column => {
          switch (column.type) {
            case 'text':
              template[column.field] = '';
              break;
            case 'number':
              template[column.field] = 0;
              break;
            case 'boolean':
              template[column.field] = false;
              break;
            case 'date':
              template[column.field] = new Date();
              break;
            case 'select':
              template[column.field] = column.options?.[0] || '';
              break;
            default:
              template[column.field] = '';
          }
        });
        
        return template;
      }
    }),
    
    updateNewRowField: assign({
      newRowTemplate: ({ context, event }) => {
        if (!context.editingCell || event.type !== 'edit.value.update') {
          return context.newRowTemplate;
        }
        
        return {
          ...context.newRowTemplate,
          [context.editingCell.columnId]: event.value
        };
      }
    }),
    
    cleanupNewRow: assign({
      activeNewRow: null,
      newRowTemplate: {}
    }),
    
    // Configuration updates
    updateColumns: assign({
      columns: ({ event }) => 
        event.type === 'COLUMNS_CHANGED' ? event.columns : []
    }),
    
    updateEntityType: assign({
      entityType: ({ event }) => 
        event.type === 'ENTITY_TYPE_CHANGED' ? event.entityType : ''
    }),
    
    // Bulk operations
    startBulk: assign({
      isBulkMode: true,
      bulkOperations: new Map()
    }),
    
    addToBulk: assign({
      bulkOperations: ({ context, event }) => {
        if (!context.editingCell || event.type !== 'edit.commit') {
          return context.bulkOperations;
        }
        
        const operationId = generateOperationId();
        const operation: OptimisticOperation = {
          id: operationId,
          type: 'update',
          entityId: context.editingCell.rowId,
          field: context.editingCell.columnId,
          newValue: context.editValue,
          oldValue: context.originalValue,
          timestamp: Date.now()
        };
        
        return new Map(context.bulkOperations.set(operationId, operation));
      }
    }),
    
    clearBulk: assign({
      isBulkMode: false,
      bulkOperations: new Map()
    })
  },
  
  guards: {
    isValidEdit: ({ context }) => 
      context.editingCell !== null && context.validationErrors.size === 0,
    hasChanges: ({ context }) => context.isDirty,
    isNewRow: ({ context }) => context.activeNewRow !== null,
    canSave: ({ context }) => 
      context.editingCell !== null && 
      context.isDirty && 
      context.validationErrors.size === 0,
    allRequiredFieldsComplete: ({ context }) => {
      // Check if all required fields in new row template are filled
      return context.columns
        .filter(col => col.editable !== false)
        .every(col => context.newRowTemplate[col.field] !== undefined && 
                     context.newRowTemplate[col.field] !== '');
    }
  }
  
}).createMachine({
  id: 'editCoordinator',
  
  initial: 'idle',
  
  context: ({ input }) => ({
    entityType: '',
    columns: input.columns,
    editingCell: null,
    editValue: undefined,
    originalValue: undefined,
    validationErrors: new Map(),
    optimisticOperations: new Map(),
    isDirty: false,
    newRowTemplate: {},
    activeNewRow: null,
    bulkOperations: new Map(),
    isBulkMode: false,
    autoSaveEnabled: true,
    autoSaveDelay: 2000
  }),
  
  states: {
    idle: {
      on: {
        // Start editing
        'edit.cell.start': {
          target: 'editing',
          actions: 'startEdit'
        },
        
        // Create new row
        'edit.row.create': {
          target: 'creatingRow',
          actions: 'initNewRow'
        },
        
        // Bulk operations
        BULK_START: {
          target: 'bulkEditing',
          actions: 'startBulk'
        },
        
        // Configuration updates
        COLUMNS_CHANGED: {
          actions: 'updateColumns'
        },
        
        ENTITY_TYPE_CHANGED: {
          actions: 'updateEntityType'
        },
        
        // Handle paste operation
        'keyboard.paste': {
          target: 'pasting'
        }
      }
    },
    
    editing: {
      on: {
        // Update value
        'edit.value.update': {
          actions: 'updateValue',
          target: 'validating'
        },
        
        // Commit changes
        'edit.commit': [
          {
            guard: 'canSave',
            target: 'saving',
            actions: 'createOptimisticOperation'
          },
          {
            // Stay in editing if validation failed
            target: 'editing'
          }
        ],
        
        // Cancel editing
        'edit.cancel': {
          target: 'idle',
          actions: 'cancelEdit'
        },
        
        'keyboard.escape': {
          target: 'idle',
          actions: 'cancelEdit'
        },
        
        'keyboard.enter': {
          guard: 'canSave',
          target: 'saving',
          actions: 'createOptimisticOperation'
        }
      },
      
      // Auto-save after delay
      after: {
        2000: [
          {
            guard: 'canSave',
            target: 'saving',
            actions: 'createOptimisticOperation'
          }
        ]
      }
    },
    
    validating: {
      invoke: {
        src: 'validateFieldAsync',
        input: ({ context }) => ({
          value: context.editValue,
          column: context.columns.find(col => col.id === context.editingCell?.columnId) || {} as Column,
          entityId: context.editingCell?.rowId || ''
        }),
        onDone: {
          target: 'editing',
          actions: 'updateValidation'
        },
        onError: {
          target: 'editing',
          actions: assign({
            validationErrors: new Map([['validation', 'Validation failed']])
          })
        }
      }
    },
    
    saving: {
      invoke: {
        src: 'saveEntityUpdate',
        input: ({ context }) => {
          const operation = Array.from(context.optimisticOperations.values())[0];
          return {
            entityType: context.entityType,
            entityId: operation.entityId,
            field: operation.field,
            value: operation.newValue,
            operationId: operation.id
          };
        },
        onDone: {
          target: 'idle',
          actions: [
            'confirmOptimistic',
            'cancelEdit'
          ]
        },
        onError: {
          target: 'idle',
          actions: [
            ({ context, event }) => {
              const operation = Array.from(context.optimisticOperations.values())[0];
              if (operation) {
                // Send rollback event
                console.error('Save failed, rolling back:', event.error);
              }
            },
            'rollbackOptimistic',
            'cancelEdit'
          ]
        }
      }
    },
    
    creatingRow: {
      on: {
        'edit.cell.start': {
          target: 'editingNewRow',
          actions: 'startEdit'
        },
        
        'edit.cancel': {
          target: 'idle',
          actions: ['cleanupNewRow', 'cancelEdit']
        }
      }
    },
    
    editingNewRow: {
      on: {
        'edit.value.update': {
          actions: ['updateValue', 'updateNewRowField']
        },
        
        'edit.commit': [
          {
            guard: 'allRequiredFieldsComplete',
            target: 'savingNewRow'
          },
          {
            // Move to next field or stay in current
            actions: 'updateNewRowField'
          }
        ],
        
        'keyboard.enter': [
          {
            guard: 'allRequiredFieldsComplete',
            target: 'savingNewRow'
          }
        ],
        
        'edit.cancel': {
          target: 'idle',
          actions: ['cleanupNewRow', 'cancelEdit']
        }
      }
    },
    
    savingNewRow: {
      invoke: {
        src: 'createNewRow',
        input: ({ context }) => ({
          entityType: context.entityType,
          data: context.newRowTemplate
        }),
        onDone: {
          target: 'idle',
          actions: [
            'cleanupNewRow',
            'cancelEdit',
            // Emit event for table to add new row
            ({ event }) => {
              console.log('New row created:', event.output);
            }
          ]
        },
        onError: {
          target: 'editingNewRow',
          actions: assign({
            validationErrors: ({ event }) => new Map([
              ['save_error', `Failed to create row: ${event.error.message}`]
            ])
          })
        }
      }
    },
    
    pasting: {
      entry: [
        // Handle paste operation
        ({ context, event }) => {
          console.log('Handling paste operation:', event);
          // Parse clipboard data and apply to cells
        }
      ],
      
      always: 'idle'
    },
    
    bulkEditing: {
      on: {
        'edit.cell.start': {
          target: 'bulkEditingCell',
          actions: 'startEdit'
        },
        
        BULK_COMMIT: {
          target: 'savingBulk'
        },
        
        BULK_CANCEL: {
          target: 'idle',
          actions: 'clearBulk'
        }
      }
    },
    
    bulkEditingCell: {
      on: {
        'edit.commit': {
          target: 'bulkEditing',
          actions: ['addToBulk', 'cancelEdit']
        },
        
        'edit.cancel': {
          target: 'bulkEditing',
          actions: 'cancelEdit'
        }
      }
    },
    
    savingBulk: {
      // This would invoke a bulk save operation
      always: {
        target: 'idle',
        actions: 'clearBulk'
      }
    }
  }
});