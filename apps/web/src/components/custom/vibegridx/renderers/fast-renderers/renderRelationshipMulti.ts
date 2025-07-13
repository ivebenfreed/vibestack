import type { Column } from '../../types';

/**
 * Fast multi-relationship renderer
 * Optimized for many-to-many relationships (e.g., task.tags -> tag names)
 */
export function renderRelationshipMulti(
  value: any,
  column: Column,
  rowData?: any
): string {
  // First check for pre-resolved value from ViewActor
  if (rowData && rowData[`__resolved_${column.id}`]) {
    return rowData[`__resolved_${column.id}`];
  }
  
  // Handle null/undefined/empty
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return column.placeholder || '';
  }
  
  // If we have an array of IDs with no resolved values
  if (Array.isArray(value)) {
    // Show count as fallback
    return `${value.length} items`;
  }
  
  // Single value treated as array
  return '1 item';
}