/**
 * Columns Observable - Single Source of Truth for Column Management
 *
 * This observable manages ALL column-related state including:
 * - Column widths (with persistence)
 * - Column visibility
 * - Column order
 * - Column operations (resize, reorder, toggle)
 *
 * All components should read column dimensions from this observable only.
 */

import { observable, computed, batch } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { log } from '@/logger';
import type { Column } from '../types';

const fileLog = log('components/custom/vibegrid/stores/columns-observable.ts');

// ====================================
// TYPES
// ====================================

export interface ColumnState {
  // Core column data (from schema)
  columns: Column[];

  // User preferences (persisted)
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];

  // Metadata
  entityType: string;
  orgId: string;
  userId: string;
}

// ====================================
// DEFAULT STATE
// ====================================

const createDefaultColumnState = (
  columns: Column[],
  entityType: string,
  orgId: string,
  userId: string
): ColumnState => ({
  columns,
  columnWidths: Object.fromEntries(columns.map(col => [col.id, col.width || 150])),
  columnVisibility: Object.fromEntries(columns.map(col => [col.id, true])),
  columnOrder: columns.map(col => col.id),
  entityType,
  orgId,
  userId
});

// ====================================
// OBSERVABLE STATE
// ====================================

export const columns$ = observable<ColumnState>({
  columns: [],
  columnWidths: {},
  columnVisibility: {},
  columnOrder: [],
  entityType: '',
  orgId: '',
  userId: ''
});

// ====================================
// COMPUTED VALUES
// ====================================

/**
 * Get all visible columns in display order
 */
export const visibleColumns$ = computed(() => {
  const { columns, columnVisibility, columnOrder } = columns$.get();

  return columnOrder
    .map(id => columns.find(col => col.id === id))
    .filter((col): col is Column => col !== undefined && columnVisibility[col.id] !== false);
});

/**
 * Get total width of all visible columns
 */
export const totalColumnsWidth$ = computed(() => {
  const visibleCols = visibleColumns$.get();
  const columnWidths = columns$.columnWidths.get();

  return visibleCols.reduce((total, col) => {
    const width = columnWidths[col.id] || col.width || 150;
    return total + width;
  }, 0);
});

// ====================================
// COLUMN OPERATIONS
// ====================================

export const columnOperations = {

  /**
   * Initialize columns with data and user/org context
   */
  initialize(
    columns: Column[],
    entityType: string,
    orgId: string,
    userId: string
  ) {
    const defaultState = createDefaultColumnState(columns, entityType, orgId, userId);

    // Set up persistence based on entity type, org, and user
    const persistKey = `vibeGrid-columns-${entityType}-${orgId}-${userId}`;

    syncObservable(columns$, {
      persist: {
        plugin: ObservablePersistLocalStorage,
        name: persistKey,
        transform: {
          load: (value: any) => {
            if (!value) return defaultState;

            // Merge with current columns (in case schema changed)
            const merged = {
              ...defaultState,
              ...value,
              columns: defaultState.columns, // Always use fresh columns from schema
              // Preserve user preferences but add defaults for new columns
              columnWidths: {
                ...defaultState.columnWidths,
                ...value.columnWidths
              },
              columnVisibility: {
                ...defaultState.columnVisibility,
                ...value.columnVisibility
              },
              columnOrder: value.columnOrder?.length ? value.columnOrder : defaultState.columnOrder
            };

            fileLog.info('📁 Columns state loaded from persistence', {
              persistKey,
              columnsCount: merged.columns.length,
              persistedWidths: Object.keys(merged.columnWidths).length,
              visibleColumns: Object.values(merged.columnVisibility).filter(Boolean).length
            });

            return merged;
          }
        }
      }
    });

    // Initialize with default state (persistence will override if available)
    columns$.set(defaultState);

    fileLog.info('🎯 Columns observable initialized', {
      entityType,
      orgId,
      userId,
      columnsCount: columns.length,
      persistKey
    });
  },

  /**
   * Get effective width for a column - SINGLE SOURCE OF TRUTH
   */
  getWidth(columnId: string): number {
    const { columnWidths, columns } = columns$.get();

    // 1. Try persisted user preference
    if (columnWidths[columnId] != null) {
      return columnWidths[columnId];
    }

    // 2. Fall back to column schema default
    const column = columns.find(c => c.id === columnId);
    if (column?.width != null) {
      return column.width;
    }

    // 3. Final fallback
    return 150;
  },

  /**
   * Set column width (user preference)
   */
  setWidth(columnId: string, width: number) {
    const currentWidths = columns$.columnWidths.get();
    columns$.columnWidths.set({
      ...currentWidths,
      [columnId]: width
    });

    fileLog.info('📏 Column width set', { columnId, width });
  },

  /**
   * Update column width during resize (with batching)
   */
  updateWidth(columnId: string, width: number) {
    batch(() => {
      const currentWidths = columns$.columnWidths.get();
      columns$.columnWidths.set({
        ...currentWidths,
        [columnId]: width
      });
    });

    fileLog.debug('📏 Column width updated', { columnId, width });
  },

  /**
   * Toggle column visibility
   */
  toggleVisibility(columnId: string) {
    const currentVisibility = columns$.columnVisibility.get();
    const newVisibility = !currentVisibility[columnId];

    columns$.columnVisibility.set({
      ...currentVisibility,
      [columnId]: newVisibility
    });

    fileLog.info('👁️ Column visibility toggled', { columnId, visible: newVisibility });
  },

  /**
   * Reorder columns
   */
  reorder(sourceColumnId: string, targetColumnId: string, insertBefore: boolean = true) {
    batch(() => {
      const currentOrder = [...columns$.columnOrder.get()];
      const sourceIndex = currentOrder.indexOf(sourceColumnId);
      const targetIndex = currentOrder.indexOf(targetColumnId);

      if (sourceIndex === -1 || targetIndex === -1) {
        fileLog.warn('⚠️ Column reorder failed: column not found', {
          sourceColumnId,
          targetColumnId,
          sourceIndex,
          targetIndex
        });
        return;
      }

      // Remove source column
      const [sourceColumn] = currentOrder.splice(sourceIndex, 1);

      // Recalculate target index after removal
      const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

      // Insert at appropriate position
      const insertIndex = insertBefore ? adjustedTargetIndex : adjustedTargetIndex + 1;
      currentOrder.splice(insertIndex, 0, sourceColumn);

      columns$.columnOrder.set(currentOrder);

      fileLog.info('🔄 Column reordered', {
        sourceColumnId,
        targetColumnId,
        insertBefore,
        newOrder: currentOrder
      });
    });
  },

  /**
   * Reset all column preferences to defaults
   */
  reset() {
    const { columns, entityType, orgId, userId } = columns$.get();
    const defaultState = createDefaultColumnState(columns, entityType, orgId, userId);

    batch(() => {
      columns$.columnWidths.set(defaultState.columnWidths);
      columns$.columnVisibility.set(defaultState.columnVisibility);
      columns$.columnOrder.set(defaultState.columnOrder);
    });

    fileLog.info('🔄 Columns reset to defaults', {
      columnsCount: columns.length
    });
  }
};

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Get column widths for a list of columns (bulk operation)
 */
export const getColumnWidths = (columnIds: string[]): Record<string, number> => {
  return Object.fromEntries(
    columnIds.map(id => [id, columnOperations.getWidth(id)])
  );
};

/**
 * Check if a column is visible
 */
export const isColumnVisible = (columnId: string): boolean => {
  return columns$.columnVisibility.get()[columnId] !== false;
};

/**
 * Get visible column count
 */
export const getVisibleColumnCount = (): number => {
  const visibility = columns$.columnVisibility.get();
  return Object.values(visibility).filter(Boolean).length;
};