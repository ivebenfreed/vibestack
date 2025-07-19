import type { Column } from '../../../types';

/**
 * Fast single relationship renderer
 * Optimized for foreign key lookups with proper null state handling
 */
export function relationshipSingle(
  value: any,
  column: Column,
  rowData?: any
): string {
  // Debug logging disabled for performance
  // console.log('🔍 relationshipSingle: Called', { columnId: column.id, value });
  
  // First check for pre-resolved value from ViewActor
  if (rowData && rowData[`__resolved_${column.id}`]) {
    const resolvedValue = rowData[`__resolved_${column.id}`];
    if (resolvedValue) {
      return `<span class="vibegridx-relationship-badge">${resolvedValue}</span>`;
    }
  }
  
  // Handle null/undefined with proper empty state
  if (value == null) {
    const placeholder = column.placeholder || 'Select...';
    return `<div class="vibegridx-cell-empty-state">
      <svg class="h-3 w-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      <span class="text-xs text-muted-foreground">${placeholder}</span>
    </div>`;
  }
  
  // If we get here, we just have an ID with no resolved value
  // This should rarely happen if ViewActor is working correctly
  return `<span class="vibegridx-relationship-badge vibegridx-relationship-unresolved">${String(value)}</span>`;
}