/**
 * VibeGrid Stores - Clean Re-exports for API Compatibility
 *
 * This file provides all the exports needed for backward compatibility
 * after the pure-observables.ts split into focused modules.
 */

// Main factory function and types (primary export)
export { createPureObservables } from './pure-observables';
export type {
  PureObservables,
  TableCore$,
  TableCoreSync$,
  TableInteraction$,
  TableViewport$,
  TableViewportState,
  PersistedTableState,
  TableCoreState,
  TableInteractionState
} from './pure-observables';

// Visual state system (already extracted)
export { visualInputs$, visualState$ } from './visual-state';
export type { ColumnLayout, ViewportGeometry, VisualState } from './visual-state';

// Individual layer factories (for advanced use cases)
export { createTableCore$, createTableCoreSync$ } from './data-state';
export { createTableInteraction$ } from './interaction-state';

// Column operations (existing)
export { columns$, columnOperations } from './columns-observable';

// Note: Individual cores are not exported to prevent direct usage
// All access should go through the main factory function or visual-state