// ====================================
// TABLE MACHINE - PUBLIC EXPORTS
// ====================================

// Export the main table machine from the modular structure
export { tableBaseMachine } from './table-machine/index';

// Re-export any types or utilities that other components might need
export type { TableContext, TableEvents, TableConfig } from '../types';

// ====================================
// UTILITY FUNCTIONS
// ====================================

import type { TableEvents } from '../types';

export const createTableEvent = <T extends TableEvents['type']>(
  type: T,
  payload: Omit<Extract<TableEvents, { type: T }>, 'type'>
): Extract<TableEvents, { type: T }> => {
  return { type, ...payload } as Extract<TableEvents, { type: T }>;
};

// Performance measurement helper
export const measurePerformance = <T>(operation: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  // Can be used to send PERFORMANCE_MARK events
  if (duration > 5) {
    console.log(`${operation}: ${duration.toFixed(2)}ms`);
  }
  
  return result;
};