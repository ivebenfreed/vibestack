// ====================================
// EDIT ACTOR - Pure Actor for Edit Operations
// ====================================

import { fromPromise } from 'xstate';
import type { Column } from '../types';

// ====================================
// VALIDATION HELPERS
// ====================================

const validateCellValue = (value: any, column: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (column.editable === false) {
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
      
    default:
      // String validation
      if (column.maxLength && String(value).length > column.maxLength) {
        errors.push(`Must be ${column.maxLength} characters or less`);
      }
      if (column.minLength && String(value).length < column.minLength) {
        errors.push(`Must be at least ${column.minLength} characters`);
      }
      break;
  }
  
  // Required field validation
  if (column.required && (value === null || value === undefined || value === '')) {
    errors.push('This field is required');
  }
  
  return { isValid: errors.length === 0, errors };
};

const formatCellValue = (value: any, column: any): any => {
  if (value === null || value === undefined || value === '') {
    return column.defaultValue || null;
  }
  
  switch (column.type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === true || value === 'true';
    case 'date':
      return new Date(value);
    default:
      return String(value);
  }
};

// ====================================
// ASYNC OPERATIONS
// ====================================

const performEditValidation = fromPromise(async ({ input }: {
  input: { value: any; column: any; rowId: string }
}) => {
  const { value, column, rowId } = input;
  
  console.log('EditActor: Validating cell value', {
    value,
    columnId: column.id,
    columnType: column.type,
    rowId
  });
  
  // Perform validation
  const validation = validateCellValue(value, column);
  
  // Simulate async validation (e.g., server-side validation)
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Format the value
  const formattedValue = formatCellValue(value, column);
  
  console.log('EditActor: Validation successful', {
    originalValue: value,
    formattedValue,
    columnId: column.id
  });
  
  return {
    isValid: true,
    formattedValue,
    errors: []
  };
});

const performEditCommit = fromPromise(async ({ input }: {
  input: { 
    value: any; 
    formattedValue: any; 
    cell: { rowId: string; columnId: string; field: string }; 
    oldValue: any 
  }
}) => {
  const { value, formattedValue, cell, oldValue } = input;
  
  console.log('EditActor: Committing edit', {
    cell,
    oldValue,
    newValue: formattedValue
  });
  
  // Simulate async save operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // In a real implementation, this would:
  // 1. Send to server
  // 2. Update local state
  // 3. Handle optimistic updates
  // 4. Manage operation queue
  
  const operationId = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    operationId,
    success: true,
    cell,
    oldValue,
    newValue: formattedValue,
    timestamp: Date.now()
  };
});

const performBatchEdit = fromPromise(async ({ input }: {
  input: { 
    operations: Array<{
      cell: { rowId: string; columnId: string; field: string };
      value: any;
      oldValue: any;
    }>
  }
}) => {
  const { operations } = input;
  
  console.log('EditActor: Performing batch edit', {
    operationCount: operations.length
  });
  
  // Simulate batch processing
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const results = operations.map(op => ({
    operationId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    success: true,
    cell: op.cell,
    oldValue: op.oldValue,
    newValue: op.value
  }));
  
  return {
    success: true,
    results,
    timestamp: Date.now()
  };
});

// ====================================
// PURE EDIT ACTOR
// ====================================

export const editActor = fromPromise(async ({ input }: {
  input: { 
    event?: { type: string; [key: string]: any };
    columns?: any[];
  }
}) => {
  // Handle initial spawn input
  if (!input.event) {
    console.log('EditActor: Initial spawn with columns', { columns: input.columns });
    return { type: 'INITIALIZED' };
  }
  
  const { event } = input;
  const { type } = event;
  
  console.log('EditActor: Processing operation', { type, event });
  
  switch (type) {
    case 'VALIDATE':
      return await performEditValidation({ input: event });
      
    case 'COMMIT':
      return await performEditCommit({ input: event });
      
    case 'BATCH_EDIT':
      return await performBatchEdit({ input: event });
      
    case 'COLUMNS_CHANGED':
      console.log('EditActor: Columns updated', {
        columnCount: event.columns?.length || 0
      });
      return { success: true, columns: event.columns };
      
    case 'ENTITY_TYPE_CHANGED':
      console.log('EditActor: Entity type updated', {
        entityType: event.entityType
      });
      return { success: true, entityType: event.entityType };
      
    default:
      console.warn('EditActor: Unknown operation type', { type });
      return { success: false, error: `Unknown operation: ${type}` };
  }
});