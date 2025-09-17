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
import { getEntity$, entityOperations, universeSchema$, universeLoading$, universeOrgId$, universeUserId$, universeContext$ } from '@/legend-state/observables';
import { log } from '@/logger';
import type { Column, SortConfig, FilterConfig, GroupConfig } from '../types';
// Import moved to visual-state.ts as part of Phase 1 consolidation
import { visualOperations } from './visual-state';
import { GroupProcessor } from '../processors/GroupProcessor';

const fileLog = log('components/custom/vibegrid/stores/data-state.ts');

// ====================================
// TYPES
// ====================================

/**
 * Row ordering configuration for grouped mode drag and drop
 */
export interface GroupRowOrderConfig {
  groupId: string;
  rowIds: string[];
  lastModified: string;
}

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

  // Row ordering in grouped mode (persisted)
  groupRowOrders: Record<string, GroupRowOrderConfig>;

  // Row ordering in ungrouped/flat mode (persisted)
  flatRowOrder: string[];

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
  groupRowOrders: Record<string, GroupRowOrderConfig>;
  flatRowOrder: string[]; // Row IDs in custom order for ungrouped mode
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

/**
 * Apply custom flat row ordering for ungrouped state
 */
function applyFlatRowOrdering(rows: any[], flatRowOrder: string[]): any[] {
  if (!flatRowOrder || flatRowOrder.length === 0) return rows;

  // Create a map for quick lookup of row order
  const orderMap = new Map<string, number>();
  flatRowOrder.forEach((id, index) => {
    orderMap.set(id, index);
  });

  // Sort rows based on the custom order, with unordered rows at the end
  return [...rows].sort((a, b) => {
    const aId = a.id || a.data?.id;
    const bId = b.id || b.data?.id;

    const aOrder = orderMap.get(aId);
    const bOrder = orderMap.get(bId);

    // If both have order, use that
    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }

    // If only one has order, ordered item comes first
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    // Neither has order, maintain original order
    return 0;
  });
}

// ====================================
// PERSISTENCE HELPERS
// ====================================

/**
 * Generate simple storage key using entity name directly
 * EntityType already contains org prefix: "01920000-1000-7000-8000-000000000001_TaskV2"
 */
function generateTableStateKey(entityType: string): string {
  const storageKey = `vibegrid-${entityType}`;
  fileLog.debug('🔧 Generated simple storage key', { storageKey, entityType });
  return storageKey;
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
    groupRowOrders: {},
    flatRowOrder: [],
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

  // Create default state structure (without requiring orgId/userId yet)
  const defaultState = createDefaultTableState(entityType, columns);
  fileLog.info('<� Default state created', { entityType, defaultSortBy: defaultState.sortBy });

  // Generate simple storage key using entity name
  const storageKey = generateTableStateKey(entityType);
  let tableCoreSync$: any = null;

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
    groupRowOrders: defaultState.groupRowOrders,
    flatRowOrder: defaultState.flatRowOrder,

    // Computed groupConfig from visual state (for dropdown component)
    get groupConfig() {
      return visualOperations.getGroupConfig ? visualOperations.getGroupConfig() : null;
    },

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

      // Apply filters and sorting first
      rows = applyFilters(rows, filters);
      rows = applySorting(rows, sortBy);

      // Get grouping configuration from visual state
      const groupConfig = visualOperations.getGroupConfig ? visualOperations.getGroupConfig() : null;

      // Apply grouping if configured
      if (groupConfig && groupConfig.fields && groupConfig.fields.length > 0) {
        const groupRowOrders = tableCore$.groupRowOrders.get();
        const groupResult = GroupProcessor.processData(rows, columns, groupConfig, groupRowOrders);

        fileLog.info('✅ Processed rows with grouping', {
          entityObservable: !!entityObs,
          inputCount: Object.keys(data || {}).length,
          filteredAndSortedRows: rows.length,
          virtualRowsAfterGrouping: groupResult.virtualRows.length,
          groupCount: groupResult.groupCount,
          hasFilters: filters.length > 0,
          hasSorting: sortBy.length > 0,
          hasGrouping: true
        });

        // Update visual state with the processed row count
        visualOperations.setRowCount(groupResult.virtualRows.length);

        // Return virtual rows (mix of group headers and data rows)
        return groupResult.virtualRows;
      }

      fileLog.info('<� Processed rows computed (no grouping)', {
        entityObservable: !!entityObs,
        inputCount: Object.keys(data || {}).length,
        outputCount: rows.length,
        hasFilters: filters.length > 0,
        hasSorting: sortBy.length > 0,
        hasGrouping: false
      });

      // Apply flat row ordering if no grouping and no sorting
      const hasSorting = sortBy.length > 0;
      if (!hasSorting) {
        const flatRowOrder = tableCore$.flatRowOrder.get();
        if (flatRowOrder && flatRowOrder.length > 0) {
          rows = applyFlatRowOrdering(rows, flatRowOrder);
          fileLog.debug('✅ Applied flat row ordering', {
            flatOrderCount: flatRowOrder.length,
            totalRows: rows.length
          });
        }
      }

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
    },

    // Drag and drop row ordering methods for grouped mode
    setGroupRowOrder(groupId: string, rowIds: string[]) {
      const orders = tableCore$.groupRowOrders.get();
      tableCore$.groupRowOrders.set({
        ...orders,
        [groupId]: {
          groupId,
          rowIds,
          lastModified: new Date().toISOString()
        }
      });

      fileLog.info('🔄 Group row order set (auto-persistent)', {
        groupId,
        rowCount: rowIds.length
      });
    },

    moveRowInGroupByIndex(groupId: string, fromIndex: number, toIndex: number) {
      const orders = tableCore$.groupRowOrders.get();
      const groupOrder = orders[groupId];

      if (!groupOrder) {
        fileLog.warn('⚠️ No group order found for drag operation', { groupId });
        return false;
      }

      const newRowIds = [...groupOrder.rowIds];
      const [movedRowId] = newRowIds.splice(fromIndex, 1);
      newRowIds.splice(toIndex, 0, movedRowId);

      tableCore$.groupRowOrders.set({
        ...orders,
        [groupId]: {
          ...groupOrder,
          rowIds: newRowIds,
          lastModified: new Date().toISOString()
        }
      });

      fileLog.info('🔄 Row moved within group (auto-persistent)', {
        groupId,
        fromIndex,
        toIndex,
        movedRowId
      });

      return true;
    },

    getGroupRowOrder(groupId: string): string[] | null {
      const orders = tableCore$.groupRowOrders.get();
      return orders[groupId]?.rowIds || null;
    },

    clearGroupRowOrders() {
      tableCore$.groupRowOrders.set({});
      fileLog.info('🗑️ All group row orders cleared (auto-persistent)');
    },

    // Higher-level method for drag and drop that handles row movement by ID
    async moveRowInGroup(sourceGroupId: string, targetGroupId: string, draggedRowId: string, newIndex: number): Promise<boolean> {
      // Handle cross-group moves
      if (sourceGroupId !== targetGroupId) {
        return await this.moveRowBetweenGroups(sourceGroupId, targetGroupId, draggedRowId, newIndex);
      }

      const orders = tableCore$.groupRowOrders.get();
      let groupOrder = orders[sourceGroupId];

      // If no order exists yet, create one from current group data
      if (!groupOrder) {
        const processedRows = tableCore$.processedRows.get();
        const groupRows = processedRows.filter(row =>
          row.type === 'data' && (row.groupId === sourceGroupId || row.parentGroupId === sourceGroupId)
        );
        const initialOrder = groupRows.map(row => row.id).filter(Boolean);

        groupOrder = {
          groupId: sourceGroupId,
          rowIds: initialOrder,
          lastModified: new Date().toISOString()
        };

        tableCore$.groupRowOrders.set({
          ...orders,
          [sourceGroupId]: groupOrder
        });

        fileLog.info('🆕 Created initial group row order', {
          sourceGroupId,
          rowCount: initialOrder.length
        });
      }

      // Find current position of the dragged row
      const currentIndex = groupOrder.rowIds.indexOf(draggedRowId);
      if (currentIndex === -1) {
        fileLog.warn('⚠️ Dragged row not found in group order', {
          draggedRowId,
          sourceGroupId,
          currentOrder: groupOrder.rowIds
        });
        return false;
      }

      // If trying to move to the same position, no change needed
      if (currentIndex === newIndex) {
        return true;
      }

      // Move the row
      const newRowIds = [...groupOrder.rowIds];
      const [movedRowId] = newRowIds.splice(currentIndex, 1);
      newRowIds.splice(newIndex, 0, movedRowId);

      tableCore$.groupRowOrders.set({
        ...orders,
        [sourceGroupId]: {
          ...groupOrder,
          rowIds: newRowIds,
          lastModified: new Date().toISOString()
        }
      });

      fileLog.info('🔄 Row moved within group by ID (auto-persistent)', {
        sourceGroupId,
        draggedRowId,
        from: currentIndex,
        to: newIndex,
        newOrderLength: newRowIds.length
      });

      return true;
    },

    // Drag and drop row ordering methods for flat/ungrouped mode
    setFlatRowOrder(rowIds: string[]) {
      tableCore$.flatRowOrder.set([...rowIds]);
      fileLog.info('🔄 Flat row order set (auto-persistent)', {
        rowCount: rowIds.length
      });
    },

    // Move row between different groups - purely reactive approach
    async moveRowBetweenGroups(sourceGroupId: string, targetGroupId: string, draggedRowId: string, newIndex: number): Promise<boolean> {
      // Extract the status value from group IDs (e.g., "group_status_done" -> "done")
      const extractStatusFromGroupId = (groupId: string): string => {
        return groupId.replace('group_status_', '');
      };

      const newStatus = extractStatusFromGroupId(targetGroupId);
      const entityType = tableCore$.entityType.get();

      // Update the actual row data using the proper entity update system
      // The reactive system will automatically handle visual repositioning
      try {
        // Import the update helper and entity operations
        const { getUpdateFunction } = await import('../utils/entity-update-helpers');

        // Use the full org-prefixed entity type for entity operations
        const fullEntityType = entityType;

        // Get the update function and update the row's status
        const updateEntity = getUpdateFunction(fullEntityType as any);
        await updateEntity(draggedRowId, { status: newStatus });

        fileLog.info('🔄 Cross-group move completed via reactive status update', {
          draggedRowId,
          oldStatus: extractStatusFromGroupId(sourceGroupId),
          newStatus,
          sourceGroupId,
          targetGroupId,
          note: 'Row will appear in new group automatically via reactive system'
        });

        return true;
      } catch (error) {
        fileLog.error('❌ Failed to update row status for cross-group move', {
          draggedRowId,
          newStatus,
          entityType,
          fullEntityType: entityType,
          error: error.message
        });
        return false;
      }
    },

    moveRowInFlat(fromIndex: number, toIndex: number): boolean {
      const currentOrder = tableCore$.flatRowOrder.get();

      // If no flat order exists yet, create one from current row data
      if (!currentOrder || currentOrder.length === 0) {
        const processedRows = tableCore$.processedRows.get();
        const initialOrder = processedRows.map(row => row.id || row.data?.id).filter(Boolean);
        tableCore$.flatRowOrder.set(initialOrder);
        fileLog.info('🆕 Created initial flat row order', { rowCount: initialOrder.length });
        return false; // Let caller retry the operation
      }

      if (fromIndex < 0 || toIndex < 0 || fromIndex >= currentOrder.length || toIndex >= currentOrder.length) {
        fileLog.warn('⚠️ Invalid indices for flat row move', { fromIndex, toIndex, orderLength: currentOrder.length });
        return false;
      }

      const newOrder = [...currentOrder];
      const [movedRowId] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedRowId);

      tableCore$.flatRowOrder.set(newOrder);

      fileLog.info('🔄 Row moved in flat mode (auto-persistent)', {
        fromIndex,
        toIndex,
        movedRowId,
        newOrderLength: newOrder.length
      });

      return true;
    },

    getFlatRowOrder(): string[] {
      return tableCore$.flatRowOrder.get() || [];
    },

    clearFlatRowOrder() {
      tableCore$.flatRowOrder.set([]);
      fileLog.info('🗑️ Flat row order cleared (auto-persistent)');
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
    if (existingState.groupRowOrders) {
      tableCore$.groupRowOrders.set(existingState.groupRowOrders);
    }
    if (existingState.flatRowOrder) {
      tableCore$.flatRowOrder.set(existingState.flatRowOrder);
    }
  }

  // Create persistent sync observable for table state

  // Configure Legend State persistence (always available with simplified storage key)
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
            const persistedData = {
              columnOrder: value.columnOrder,
              columnWidths: value.columnWidths,
              columnVisibility: value.columnVisibility,
              sortBy: value.sortBy,
              filters: value.filters,
              groupRowOrders: value.groupRowOrders,
              flatRowOrder: value.flatRowOrder,
              version: '1.0',
              lastUpdated: new Date().toISOString(),
              entityType: value.entityType
            };

            fileLog.info('💾 Saving data state to persistence', {
              storageKey,
              entityType: value.entityType,
              columnOrder: persistedData.columnOrder,
              sortBy: persistedData.sortBy,
              filters: persistedData.filters
            });

            return persistedData;
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