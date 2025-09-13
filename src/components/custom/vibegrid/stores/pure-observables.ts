/**
 * Pure Observables Factory - Creates the 3-layer observable architecture
 *
 * This file now serves as a factory that combines the 3 core observables
 * after the surgical refactor split from the original monolithic file.
 *
 * The 3-layer architecture:
 * 1. tableCore$ - Data & Configuration (data-state.ts)
 * 2. tableInteraction$ - UI State (interaction-state.ts)
 * 3. tableViewport$ - Scroll State (visual-state.ts handles viewport now)
 */

import { observable, computed } from '@legendapp/state';
import { log } from '@/logger';
import type { Column } from '../types';

// Import the split layers
import { createTableCore$, createTableCoreSync$, type TableCore$, type TableCoreSync$ } from './data-state';
import { createTableInteraction$, type TableInteraction$ } from './interaction-state';
import { visualInputs$ } from './visual-state';

const fileLog = log('components/custom/vibegrid/stores/pure-observables.ts');

// ====================================
// VIEWPORT LAYER (Simplified)
// ====================================

export interface TableViewportState {
  scrollTop: number;
  scrollLeft: number;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
}

export function createTableViewport$(tableCore$?: any) {
  fileLog.info('🎯 Creating tableViewport$ observable (simplified, integrates with visual-state)');

  const tableViewport$ = observable({
    // Scroll position
    scrollTop: 0,
    scrollLeft: 0,

    // Viewport dimensions
    viewportWidth: 0,
    viewportHeight: 0,

    // Content dimensions
    contentWidth: 0,
    contentHeight: 0,

    // Visible range (computed from scroll)
    visibleRange: computed(() => {
      const top = tableViewport$.scrollTop.get();
      const height = tableViewport$.viewportHeight.get();
      const rowHeight = 40; // TODO: Make this configurable

      const start = Math.floor(top / rowHeight);
      const end = Math.ceil((top + height) / rowHeight);

      return {
        start: Math.max(0, start - 5), // 5 row buffer
        end: end + 5 // 5 row buffer
      };
    }),

    // Update scroll position and sync with visual-state
    updateScroll(scrollTop: number, scrollLeft: number) {
      tableViewport$.scrollTop.set(scrollTop);
      tableViewport$.scrollLeft.set(scrollLeft);

      // Sync with visual-state
      visualInputs$.scrollTop.set(scrollTop);
      visualInputs$.scrollLeft.set(scrollLeft);

      fileLog.debug('🎯 Scroll updated and synced', { scrollTop, scrollLeft });
    },

    // Update viewport size and sync with visual-state
    updateViewport(width: number, height: number) {
      tableViewport$.viewportWidth.set(width);
      tableViewport$.viewportHeight.set(height);

      // Sync with visual-state
      visualInputs$.viewportWidth.set(width);
      visualInputs$.viewportHeight.set(height);

      fileLog.debug('🎯 Viewport updated and synced', { width, height });
    },

    // Update content dimensions
    updateContent(width: number, height: number) {
      tableViewport$.contentWidth.set(width);
      tableViewport$.contentHeight.set(height);

      fileLog.debug('🎯 Content dimensions updated', { width, height });
    }
  });

  return tableViewport$;
}

export type TableViewport$ = ReturnType<typeof createTableViewport$>;

// ====================================
// FACTORY FUNCTION (API Preserved)
// ====================================

/**
 * Creates the complete 3-layer observable architecture
 *
 * This is the main entry point that maintains exact API compatibility
 * with the original monolithic implementation.
 */
export function createPureObservables(entityType: string, columns: Column[]) {
  fileLog.info('🎯 Creating pure observables for table (3-layer architecture)', {
    entityType,
    columns: columns.length
  });

  // Create the 3 core layers
  const { tableCore$, tableCoreSync$ } = createTableCore$(entityType, columns);
  const tableInteraction$ = createTableInteraction$(tableCore$);
  const tableViewport$ = createTableViewport$(tableCore$);

  // Initialize visual-state with column data and persisted visual settings
  visualInputs$.columns.set(columns);
  visualInputs$.entityType.set(entityType);

  // Initialize visual state with any persisted values from tableCore$ (one-time setup)
  const initialColumnWidths = tableCore$.columnWidths.get();
  const initialColumnVisibility = tableCore$.columnVisibility.get();
  const initialColumnOrder = tableCore$.columnOrder.get();

  visualInputs$.columnWidths.set(initialColumnWidths);
  visualInputs$.columnVisibility.set(initialColumnVisibility);
  visualInputs$.columnOrder.set(initialColumnOrder);

  fileLog.debug('🎯 Visual state initialized with persisted settings', {
    widthCount: Object.keys(initialColumnWidths).length,
    visibilityCount: Object.keys(initialColumnVisibility).length,
    orderCount: initialColumnOrder.length
  });

  // ARCHITECTURAL FIX: Visual state should be authoritative, not tableCore$
  // Sync visual configuration FROM visual-state TO tableCore$ for persistence only
  const syncVisualToTableCore = () => {
    const columnWidths = visualInputs$.columnWidths.get();
    const columnVisibility = visualInputs$.columnVisibility.get();
    const columnOrder = visualInputs$.columnOrder.get();

    // Update tableCore$ for persistence, but visualState$ remains authoritative
    tableCore$.columnWidths.set(columnWidths);
    tableCore$.columnVisibility.set(columnVisibility);
    tableCore$.columnOrder.set(columnOrder);

    fileLog.debug('🔄 Synced visual state to tableCore$ for persistence', {
      widthCount: Object.keys(columnWidths).length,
      visibilityCount: Object.keys(columnVisibility).length,
      orderCount: columnOrder.length
    });
  };

  // Set up reactive sync (visual changes update tableCore$ for persistence)
  visualInputs$.columnWidths.onChange(syncVisualToTableCore);
  visualInputs$.columnVisibility.onChange(syncVisualToTableCore);
  visualInputs$.columnOrder.onChange(syncVisualToTableCore);

  fileLog.info('✅ Pure observables created successfully', {
    entityType,
    layers: {
      dataState: !!tableCore$,
      interactionState: !!tableInteraction$,
      viewportState: !!tableViewport$,
      visualStateSync: true
    }
  });

  return {
    tableCore$,
    tableCoreSync$,
    tableInteraction$,
    tableViewport$
  };
}

// ====================================
// TYPE EXPORTS (API Compatibility)
// ====================================

// Re-export types for compatibility with existing code
export type { TableCore$, TableCoreSync$ } from './data-state';
export type { TableInteraction$ } from './interaction-state';

// Export the combined observable types
export type PureObservables = ReturnType<typeof createPureObservables>;

// Legacy state type exports (for components that import these)
export type { PersistedTableState, TableCoreState } from './data-state';
export type { TableInteractionState } from './interaction-state';