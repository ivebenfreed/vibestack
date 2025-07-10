import type { Column } from '../../types';

/**
 * Fast enum rendering function for table cells
 * Generates badge HTML without going through the cell registry
 */
export function renderEnum(value: any, column: Column): string {
  // Handle null/undefined
  if (value === null || value === undefined) return '';
  
  // Use enumOptions if available
  if (column.enumOptions) {
    const option = column.enumOptions.find(opt => opt.value === value);
    const label = option ? option.label : String(value);
    const sanitizedValue = String(value).toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `<span class="vibegridx-enum-badge vibegridx-enum-badge-${sanitizedValue}">${label}</span>`;
  }
  
  // Fallback to plain string
  return String(value);
}