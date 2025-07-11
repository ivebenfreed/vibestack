import type { Column } from '../../types';

/**
 * Fast enum rendering function for table cells
 * Generates badge HTML without going through the cell registry
 */
export function renderEnum(value: any, column: Column): string {
  // Handle null/undefined
  if (value === null || value === undefined) return '';
  
  // Column must have options configured - no fallbacks
  if (!column.options || !Array.isArray(column.options)) {
    console.warn(`[renderEnum] Column ${column.id} is type 'enum' but missing options array`);
    return String(value);
  }
  
  // Find the option from column configuration
  const option = column.options.find(opt => opt.value === value);
  if (!option) {
    console.warn(`[renderEnum] Value '${value}' not found in column ${column.id} options`);
    return String(value);
  }
  
  // Use the exact class name from the option
  const cssClass = option.cssClass || `vibegridx-enum-badge-${String(value).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return `<span class="vibegridx-enum-badge ${cssClass}">${option.label}</span>`;
}