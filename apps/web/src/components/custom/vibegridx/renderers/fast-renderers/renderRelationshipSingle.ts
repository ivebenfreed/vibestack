import type { Column } from '../../types';

/**
 * Fast single relationship renderer
 * Optimized for foreign key lookups (e.g., task.projectId -> project.name)
 */
export function renderRelationshipSingle(
  value: any,
  column: Column,
  rowData?: any
): string {
  // First check for pre-resolved value from ViewActor
  if (rowData && rowData[`__resolved_${column.id}`]) {
    return rowData[`__resolved_${column.id}`];
  }
  
  // Handle null/undefined
  if (value == null) {
    return column.placeholder || '';
  }
  
  // If we get here, we just have an ID with no resolved value
  // This should rarely happen if ViewActor is working correctly
  return String(value);
}