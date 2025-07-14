import type { Column } from '../types';

/**
 * Fast date rendering function for table cells
 * Converts dates to locale-specific date strings
 */
export function date(value: any, column: Column): string {
  if (value === null || value === undefined) return '';
  
  try {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString();
  } catch {
    return String(value);
  }
}