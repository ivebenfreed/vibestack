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
  columns: Column[]; // Schema definition only
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
    groupRowOrders: Object.keys(merged.groupRowOrders || {}).length,
    flatRowOrderLength: merged.flatRowOrder?.length || 0
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

export function createTableCore$(entityType: string, columns: Column[], visualInputs$?: any) {
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

    // Initialization flag to prevent saves during init
    isInitializing: true,
    // Timestamp when persistence was set up (for grace period)
    persistenceSetupTime: undefined as number | undefined,

    // Persistent configuration state (will be synchronized with localStorage)
    // NOTE: Column concerns moved to visual-state (columnOrder, columnWidths, columnVisibility, sortBy, filters)
    groupRowOrders: defaultState.groupRowOrders,
    flatRowOrder: defaultState.flatRowOrder,

    // Computed groupConfig - will be provided by external visual state
    get groupConfig() {
      return null; // Default - will be overridden by visual state integration
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

      // TODO: These should be provided by visual state integration
      // For now, use empty arrays as fallback until visual state integration is complete
      const sortBy: SortConfig[] = [];
      const filters: FilterConfig[] = [];

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

      // Get grouping configuration from visual state (if available) or fallback to data state
      const visualGroupConfig = visualInputs$?.groupConfig?.get();
      const dataGroupConfig = tableCore$.groupConfig.get();
      const groupConfig = visualGroupConfig || dataGroupConfig;

      fileLog.info('📊 Group config sources', {
        hasVisualInputs: !!visualInputs$,
        hasVisualGroupConfig: !!visualGroupConfig,
        hasDataGroupConfig: !!dataGroupConfig,
        usingVisualConfig: !!visualGroupConfig,
        expandedGroupsFromVisual: visualGroupConfig?.expandedGroups ? Array.from(visualGroupConfig.expandedGroups) : 'none',
        expandedGroupsFromData: dataGroupConfig?.expandedGroups ? Array.from(dataGroupConfig.expandedGroups) : 'none',
        finalExpandedGroups: groupConfig?.expandedGroups ? Array.from(groupConfig.expandedGroups) : 'none'
      });

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

        // Note: Row count will be handled by visual state integration

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

      // Note: Row count will be handled by visual state integration

      return rows;
    },

    // NOTE: Column manipulation methods moved to visual-state
    // (toggleSort, setFilter, clearFilter, setColumnWidth)

    setGroupConfig(config: GroupConfig | null) {
      // Delegate to visual operations which handles the actual grouping state
      tableCore$.groupConfig.set(config);
      fileLog.info('🎯 Group config delegated to visual state', { config });
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
      try {
        const flatData = tableCore$.flatData.peek();
        if (fromIndex < 0 || fromIndex >= flatData.length || toIndex < 0 || toIndex >= flatData.length) {
          return false;
        }

        const newFlatData = [...flatData];
        const [movedItem] = newFlatData.splice(fromIndex, 1);
        newFlatData.splice(toIndex, 0, movedItem);

        tableCore$.flatData.set(newFlatData);
        return true;
      } catch (error) {
        console.error('Error moving row in flat data:', error);
        return false;
      }
    },

    getFlatRowOrder(): string[] {
      return tableCore$.flatRowOrder.get() || [];
    },

    clearFlatRowOrder() {
      tableCore$.flatRowOrder.set([]);
      fileLog.info('🗑️ Flat row order cleared (auto-persistent)');
    }
  });

  // Load existing display state if available (only row ordering state for data-state)
  const existingState = loadDisplayState(entityType);
  if (existingState) {
    fileLog.info('🔧 Applying existing row ordering state', { entityType });

    // Apply only row ordering state (columns handled by visual state)
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
    // Set persistence setup timestamp IMMEDIATELY to start grace period
    tableCore$.persistenceSetupTime.set(Date.now());

    // Configure syncObservable for Legend State persistence
    tableCoreSync$ = syncObservable(tableCore$, {
      persist: {
        name: storageKey,
        plugin: ObservablePersistLocalStorage,
        // Only persist configuration, not computed data
        transform: {
          load: (value: any) => {
            if (!value) {
              // IMPORTANT: Preserve initialization state and set timestamp even when no persisted state
              const isCurrentlyInitializing = tableCore$.isInitializing.get();
              return {
                isInitializing: isCurrentlyInitializing, // Preserve current initialization state
                initializationCompleteTime: Date.now() // Always set timestamp to start grace period
              };
            }
            // Transform loaded data and preserve initialization state
            const transformed = transformTableState(value, defaultState);

            // IMPORTANT: Always preserve initialization state from current observable state
            // The transformed state might have isInitializing: false from persisted data
            return {
              ...transformed,
              isInitializing: tableCore$.isInitializing.get(), // Preserve current initialization state
              initializationCompleteTime: tableCore$.isInitializing.get() ? undefined : Date.now()
            };
          },
          save: (value: any) => {
            // Skip saving during initialization - check for the isInitializing flag
            if (value.isInitializing) {
              fileLog.info('⏸️ SAVE BLOCKED: Skipping data state save during initialization', {
                storageKey,
                entityType: value.entityType,
                stack: new Error().stack?.split('\n').slice(1, 4).join('\n')
              });
              // Return false to prevent save according to Legend State docs
              return false;
            }

            // Add grace period after persistence setup to prevent rapid saves
            const now = Date.now();
            const gracePeriod = 1000; // 1 second grace period
            const persistenceSetupTime = tableCore$.persistenceSetupTime.get() || 0;
            const timeSincePersistenceSetup = now - persistenceSetupTime;

            if (persistenceSetupTime && timeSincePersistenceSetup < gracePeriod) {
              fileLog.info('⏸️ SAVE DEFERRED: Grace period active after persistence setup', {
                storageKey,
                entityType: value.entityType,
                timeSincePersistenceSetup,
                gracePeriod,
                deferredMs: gracePeriod - timeSincePersistenceSetup
              });
              return false;
            }

            // Save only row ordering fields (columns handled by visual state)
            const persistedData = {
              groupRowOrders: value.groupRowOrders,
              flatRowOrder: value.flatRowOrder,
              version: '1.0',
              lastUpdated: new Date().toISOString(),
              entityType: value.entityType
            };

            fileLog.info('💾 Saving data state to persistence', {
              storageKey,
              entityType: value.entityType,
              groupRowOrderCount: Object.keys(persistedData.groupRowOrders || {}).length,
              flatRowOrderLength: persistedData.flatRowOrder?.length || 0
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
    // TODO: Remove circular dependency - column initialization should be handled elsewhere
    // visualOperations.initializeColumns(columns, entityType, orgId, userId);
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