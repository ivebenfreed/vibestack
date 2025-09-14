/**
 * Data State - tableCore$ and tableCoreSync$ observables
 * Extracted from pure-observables.ts lines 484-869
 *
 * This module handles data loading, persistence, and transformation
 * including sorting, filtering, and grouping operations.
 */

import { observable, computed, batch } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { getEntity$, entityOperations, universeSchema$, universeLoading$, universeOrgId$, universeUserId$ } from '@/legend-state/observables';
import { log } from '@/logger';
import type { Column, SortConfig, FilterConfig, GroupConfig } from '../types';
// Import moved to visual-state.ts as part of Phase 1 consolidation
import { visualOperations } from './visual-state';

const fileLog = log('components/custom/vibegrid/stores/data-state.ts');

// ====================================
// TYPES
// ====================================

/**
 * Persistent table state interface - only configuration data that should be saved
 * Excludes transient UI state like selection, editing, hover, etc.
 */
export interface PersistedTableState {
  // Column configuration (persisted)
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];

  // Data transformation configuration (persisted)
  sortBy: SortConfig[];
  filters: FilterConfig[];

  // Metadata
  version: string;
  lastUpdated: string;
  entityType: string;
  orgId: string;
  userId: string;
}

export interface TableCoreState {
  entityType: string;
  columns: Column[];
  columnOrder: string[];
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  sortBy: SortConfig[];
  filters: FilterConfig[];
}

// Re-export the observable types
export type TableCore$ = ReturnType<typeof createTableCore$>['tableCore$'];
export type TableCoreSync$ = ReturnType<typeof createTableCore$>['tableCoreSync$'];

// ====================================
// PURE TRANSFORMATION FUNCTIONS
// ====================================

function applyFilters(rows: any[], filters: FilterConfig[]): any[] {
  if (!filters || filters.length === 0) return rows;

  return rows.filter(row => {
    return filters.every(filter => {
      const value = row.data ? row.data[filter.field] : row[filter.field];

      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'starts_with':
          return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
        case 'ends_with':
          return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
        case 'gt':
          return Number(value) > Number(filter.value);
        case 'gte':
          return Number(value) >= Number(filter.value);
        case 'lt':
          return Number(value) < Number(filter.value);
        case 'lte':
          return Number(value) <= Number(filter.value);
        default:
          return true;
      }
    });
  });
}

function applySorting(rows: any[], sortBy: SortConfig[]): any[] {
  if (!sortBy || sortBy.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const sort of sortBy) {
      const aVal = a.data ? a.data[sort.field] : a[sort.field];
      const bVal = b.data ? b.data[sort.field] : b[sort.field];

      if (aVal === bVal) continue;

      const comparison = aVal < bVal ? -1 : 1;
      return sort.direction === 'asc' ? comparison : -comparison;
    }
    return 0;
  });
}

// ====================================
// PERSISTENCE HELPERS
// ====================================

/**
 * Generate storage key for table state persistence
 * Format: vibestack_table_state_{orgId}_{entityName}_{userId}
 */
function generateTableStateKey(entityType: string): string | null {
  try {
    const orgId = universeOrgId$.peek();
    const userId = universeUserId$.peek();

    if (!orgId || !userId || orgId === 'universe') {
      fileLog.debug('🔧 Cannot generate storage key - missing context', { orgId, userId });
      return null;
    }

    // Extract clean entity name without org prefix
    const cleanEntityName = entityType.includes('_')
      ? entityType.split('_').slice(1).join('_')
      : entityType;

    const storageKey = `vibestack_table_state_${orgId}_${cleanEntityName}_${userId}`;
    fileLog.debug('🔧 Generated table state storage key', { storageKey, entityType, orgId, userId });

    return storageKey;
  } catch (error) {
    fileLog.error('❌ Error generating storage key', { error: error.message, entityType });
    return null;
  }
}

/**
 * Create default table state from columns
 */
function createDefaultTableState(entityType: string, columns: Column[]): Partial<PersistedTableState> {
  const orgId = universeOrgId$.peek();
  const userId = universeUserId$.peek();

  return {
    columnOrder: columns.map(col => col.id),
    columnWidths: Object.fromEntries(columns.map(col => [col.id, col.width || 150])),
    columnVisibility: Object.fromEntries(columns.map(col => [col.id, true])),
    sortBy: [],
    filters: [],
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    entityType,
    orgId: orgId || 'unknown',
    userId: userId || 'unknown'
  };
}

/**
 * Transform function to handle data migration between versions
 */
function transformTableState(loaded: any, defaultState: Partial<PersistedTableState>): PersistedTableState {
  if (!loaded || typeof loaded !== 'object') {
    fileLog.info('🔧 No saved state found, using defaults');
    return defaultState as PersistedTableState;
  }

  // Handle version migrations
  if (loaded.version !== '1.0') {
    fileLog.info('🔧 Migrating table state from version', loaded.version, 'to 1.0');
    // Add migration logic here for future versions
  }

  // Merge loaded state with defaults to handle missing fields
  const merged = {
    ...defaultState,
    ...loaded,
    version: '1.0',
    lastUpdated: new Date().toISOString()
  };

  fileLog.info('🔧 Restored table state with', {
    columns: Object.keys(merged.columnWidths || {}).length,
    sorts: merged.sortBy.length,
    filters: merged.filters.length,
    hasGrouping: !!merged.groupConfig
  });

  return merged as PersistedTableState;
}

/**
 * Load display state from localStorage using VibeGrid compatible key format
 * Uses vibegridx_display_{entityName} format for compatibility
 */
function loadDisplayState(entityType: string): Partial<PersistedTableState> | null {
  try {
    // Extract entity name from org-prefixed entityType (e.g., "01920000-1000-7000-8000-000000000001_TaskV2" -> "TaskV2")
    const entityName = entityType.includes('_') ? entityType.split('_').pop() : entityType;
    const storageKey = `vibegridx_display_${entityName}`;

    fileLog.debug('🔧 Loading display state', { entityType, entityName, storageKey });

    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      fileLog.debug('🔧 No stored display state found', { storageKey });
      return null;
    }

    const parsed = JSON.parse(stored);
    fileLog.info('🔧 Loaded display state from localStorage', { storageKey, state: parsed });
    return parsed;

  } catch (error) {
    fileLog.error('L Error loading display state', { entityType, error: error.message });
    return null;
  }
}

/**
 * Save display state to localStorage using VibeGrid compatible key format
 * Uses vibegridx_display_{entityName} format for compatibility
 */
function saveDisplayState(entityType: string, tableState: any): void {
  try {
    // Extract entity name from org-prefixed entityType (e.g., "01920000-1000-7000-8000-000000000001_TaskV2" -> "TaskV2")
    const entityName = entityType.includes('_') ? entityType.split('_').pop() : entityType;
    const storageKey = `vibegridx_display_${entityName}`;

    // Create state object matching VibeGrid format
    const displayState = {
      columnOrder: tableState.columnOrder,
      columnWidths: tableState.columnWidths,
      columnVisibility: tableState.columnVisibility,
      sortBy: tableState.sortBy,
      filters: tableState.filters,
      version: '1.0',
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(storageKey, JSON.stringify(displayState));
    fileLog.info('<� TableCore: Saved persistent display state', { storageKey, displayState });

  } catch (error) {
    fileLog.error('L Error saving display state', { entityType, error: error.message });
  }
}

// ====================================
// DATA STATE CORE OBSERVABLE FACTORY
// ====================================

export function createTableCore$(entityType: string, columns: Column[]) {
  fileLog.info('<� Creating tableCore$ observable with Legend State localStorage persistence', { entityType, columnCount: columns.length });

  // Create default state structure
  const defaultState = createDefaultTableState(entityType, columns);
  fileLog.info('<� Default state created', { entityType, defaultSortBy: defaultState.sortBy });

  // Extract clean entity name for storage key (remove org prefix)
  const cleanEntityName = entityType.includes('_') ? entityType.split('_').pop() : entityType;
  const storageKey = `vibegridx_display_${cleanEntityName}`;

  // Create the core observable with default values
  const tableCore$ = observable({
    // Entity metadata
    entityType,
    columns,

    // Persistent configuration state (will be synchronized with localStorage)
    columnOrder: defaultState.columnOrder,
    columnWidths: defaultState.columnWidths,
    columnVisibility: defaultState.columnVisibility,
    sortBy: defaultState.sortBy,
    filters: defaultState.filters,

    // Computed processed data (lazy)
    get processedRows() {
      // Check if universe schema is ready before getting entity
      const loading = universeLoading$.get();
      const schema = universeSchema$.get();

      if (loading || !schema?.entities || !schema.entities[entityType]) {
        fileLog.debug('� Schema not ready for processedRows', { entityType, loading });
        return [];
      }

      // Get entity observable directly like atomic bridge does
      const entityObs = getEntity$(entityType);
      const sortBy = tableCore$.sortBy.get();
      const filters = tableCore$.filters.get();

      // Get the data from the entity observable
      let data = {};
      if (entityObs) {
        try {
          // Direct .get() call like atomic bridge
          data = entityObs.get() || {};
          fileLog.debug(' Got entity data', {
            entityType,
            recordCount: Object.keys(data || {}).length
          });
        } catch (error) {
          fileLog.error('L Failed to get entity data', { entityType, error: error.message });
          data = {};
        }
      } else {
        fileLog.warn('� Entity observable not available', { entityType });
      }

      let rows = Object.values(data || {});

      rows = applyFilters(rows, filters);
      rows = applySorting(rows, sortBy);

      fileLog.info('<� Processed rows computed', {
        entityObservable: !!entityObs,
        inputCount: Object.keys(data || {}).length,
        outputCount: rows.length,
        hasFilters: filters.length > 0,
        hasSorting: sortBy.length > 0
      });

      // Update visual state with the current row count
      visualOperations.setRowCount(rows.length);

      return rows;
    },

    // Direct manipulation methods with automatic persistence
    toggleSort(field: string, isMultiSort: boolean = false) {
      const current = tableCore$.sortBy.get();
      const index = current.findIndex(s => s.field === field);

      fileLog.debug('toggleSort called', {
        field,
        isMultiSort,
        currentSort: current,
        fieldIndex: index,
        beforeSort: JSON.stringify(current)
      });

      batch(() => {
        if (index === -1) {
          // Add new sort - either replace all or add to existing based on multi-sort mode
          if (isMultiSort) {
            const newSort = [...current, { field, direction: 'asc' }];
            fileLog.debug('Adding new sort field to multi-sort', { newSort });
            tableCore$.sortBy.set(newSort);
          } else {
            const newSort = [{ field, direction: 'asc' }];
            fileLog.debug('Setting single sort field', { newSort });
            tableCore$.sortBy.set(newSort);
          }
        } else if (current[index].direction === 'asc') {
          // Change to desc
          const newSort = [...current];
          newSort[index] = { ...current[index], direction: 'desc' };
          fileLog.debug('Changing sort direction to desc', { field, newSort });
          tableCore$.sortBy.set(newSort);
        } else {
          // Third click: remove this sort field entirely (allow unsorted state)
          const newSort = current.filter((_, i) => i !== index);
          fileLog.debug('Removing sort field', { field, newSort });
          tableCore$.sortBy.set(newSort);
        }

        // Save to localStorage using Legend State syncObservable
        // The persistence should happen automatically through syncObservable
      });

      const finalSort = tableCore$.sortBy.get();
      fileLog.info('Sort toggled - checking persistence', {
        field,
        isMultiSort,
        finalSort,
        afterSort: JSON.stringify(finalSort),
        storageKey: `vibestack-table-${entityType}`
      });

      // Check what's actually in localStorage
      try {
        const stored = localStorage.getItem(`vibestack-table-${entityType}`);
        fileLog.debug('Current localStorage content after sort change', {
          storageKey: `vibestack-table-${entityType}`,
          storedValue: stored,
          parsedValue: stored ? JSON.parse(stored) : null
        });
      } catch (e) {
        fileLog.error('Failed to read localStorage after sort change', { error: e.message });
      }
    },

    setFilter(field: string, value: any, operator: string = 'contains') {
      batch(() => {
        const filters = tableCore$.filters.get();
        const existingIndex = filters.findIndex(f => f.field === field);

        if (existingIndex !== -1) {
          filters[existingIndex] = { field, value, operator };
        } else {
          filters.push({ field, value, operator });
        }

        tableCore$.filters.set([...filters]);
        // persistObservable will automatically persist changes
      });

      fileLog.info('<� Filter set (auto-persistent)', { field, value, operator });
    },

    clearFilter(field: string) {
      const filters = tableCore$.filters.get();
      tableCore$.filters.set(filters.filter(f => f.field !== field));
      // persistObservable automatically persists changes
      fileLog.info('<� Filter cleared (auto-persistent)', { field });
    },

    toggleColumn(columnId: string) {
      const visibility = tableCore$.columnVisibility.get();
      tableCore$.columnVisibility.set({
        ...visibility,
        [columnId]: !visibility[columnId]
      });
      // Note: Selection clearing is handled by the calling component
      // persistObservable automatically persists changes

      fileLog.info('<� Column toggled (auto-persistent)', { columnId, visible: !visibility[columnId] });
    },

    setColumnWidth(columnId: string, width: number) {
      const widths = tableCore$.columnWidths.get();
      tableCore$.columnWidths.set({
        ...widths,
        [columnId]: width
      });
      // persistObservable automatically persists changes

      fileLog.info('<� Column width set (auto-persistent)', { columnId, width });
    },

    setGroupConfig(config: GroupConfig | null) {
      // Delegate to visual operations which handles the actual grouping state
      visualOperations.setGroupConfig(config);
      fileLog.info('<� Group config delegated to visual state', { config });
    }
  });

  // Load existing display state if available
  const existingState = loadDisplayState(entityType);
  if (existingState) {
    fileLog.info('🔧 Applying existing display state', { entityType });

    // Apply loaded state
    if (existingState.columnOrder) {
      tableCore$.columnOrder.set(existingState.columnOrder);
    }
    if (existingState.columnWidths) {
      tableCore$.columnWidths.set(existingState.columnWidths);
    }
    if (existingState.columnVisibility) {
      tableCore$.columnVisibility.set(existingState.columnVisibility);
    }
    if (existingState.sortBy) {
      tableCore$.sortBy.set(existingState.sortBy);
    }
    if (existingState.filters) {
      tableCore$.filters.set(existingState.filters);
    }
  }

  // Create persistent sync observable for table state
  let tableCoreSync$: any = null;

  try {
    // Configure syncObservable for Legend State persistence
    tableCoreSync$ = syncObservable(tableCore$, {
      persist: {
        name: storageKey,
        plugin: ObservablePersistLocalStorage,
        // Only persist configuration, not computed data
        transform: {
          load: (value: any) => {
            if (!value) return {};
            // Transform loaded data if needed
            return transformTableState(value, defaultState);
          },
          save: (value: any) => {
            // Save only persistent fields
            return {
              columnOrder: value.columnOrder,
              columnWidths: value.columnWidths,
              columnVisibility: value.columnVisibility,
              sortBy: value.sortBy,
              filters: value.filters,
              version: '1.0',
              lastUpdated: new Date().toISOString(),
              entityType: value.entityType
            };
          }
        }
      }
    });

    fileLog.info(' Legend State persistence configured successfully', {
      entityType,
      storageKey,
      hasPersistence: !!tableCoreSync$
    });

  } catch (error) {
    console.error('🔧 PERSISTENCE DEBUG: Failed to configure syncObservable', { entityType, error });
    fileLog.error('❌ Failed to configure Legend State persistence', { entityType, error: error.message });
  }

  // Initialize columns observable with current state
  const orgId = universeOrgId$.get();
  const userId = universeUserId$.get();
  if (orgId && userId) {
    visualOperations.initializeColumns(columns, entityType, orgId, userId);
    fileLog.info(' Columns observable initialized', { entityType, orgId, userId });
  } else {
    fileLog.warn('� Cannot initialize columns observable - missing orgId or userId', { orgId, userId });
  }

  // Return the observable with sync state
  return {
    tableCore$,
    tableCoreSync$ // syncObservable returns the sync state observable
  };
}

export function createTableCoreSync$(entityType: string, columns: Column[]) {
  // This function is kept for API compatibility - actual sync is handled in createTableCore$
  const { tableCoreSync$ } = createTableCore$(entityType, columns);
  return tableCoreSync$;
}