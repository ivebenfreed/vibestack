/**
 * Simple VibeGrid Persistence - Method 3 Approach
 *
 * Clean, reliable persistence for essential VibeGrid user preferences.
 * Uses the same approach as our working local storage debug page.
 */

import { observable } from '@legendapp/state';
import { configureSynced, syncObservable } from '@legendapp/state/sync';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { log } from '@/logger';
import type { GroupConfig, SortConfig, FilterConfig } from '../types';

// Serializable version of GroupConfig for persistence (Sets converted to arrays)
interface SerializableGroupConfig {
  fields: Array<{ field: string; displayName: string }>;
  sortBy: 'name' | 'count' | 'custom';
  sortDirection: 'asc' | 'desc';
  aggregations: Array<{
    field: string;
    function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'unique';
    displayName?: string;
  }>;
  expandedGroups: string[]; // Array instead of Set for serialization
  colorScheme?: 'auto' | 'none' | 'custom';
}
import type { GroupRowOrderConfig } from './data-state';

const persistLog = log('vibegrid/simple-persistence');

// Storage size management
const MAX_STORAGE_SIZE = 1024 * 1024 * 2; // 2MB limit for safety
const ROW_ORDER_LIMIT = 1000; // Limit row orders to prevent bloat

function checkStorageSize(key: string): boolean {
  try {
    const data = localStorage.getItem(key);
    if (data && data.length > MAX_STORAGE_SIZE) {
      persistLog.warn('🚨 Storage approaching quota limit', {
        key,
        size: data.length,
        limit: MAX_STORAGE_SIZE
      });
      return false;
    }
    return true;
  } catch (error) {
    persistLog.error('❌ Storage size check failed', { key, error });
    return false;
  }
}

function limitRowOrders(rowOrder: string[]): string[] {
  if (rowOrder.length > ROW_ORDER_LIMIT) {
    persistLog.warn('🚨 Row order truncated to prevent storage bloat', {
      original: rowOrder.length,
      limited: ROW_ORDER_LIMIT
    });
    return rowOrder.slice(0, ROW_ORDER_LIMIT);
  }
  return rowOrder;
}

// Configure global persistence plugin using configureSynced (Method 3)
const persistOptions = configureSynced({
  persist: {
    plugin: ObservablePersistLocalStorage
  }
});

// Complete interface for all VibeGrid visual state persistence
export interface VibeGridPreferences {
  // Column layout
  columnWidths: Record<string, number>;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;

  // Data display
  sortBy: SortConfig[];
  filters: FilterConfig[];

  // Grouping configuration (serializable version)
  groupConfig: SerializableGroupConfig | null;

  // Row ordering state
  groupRowOrders: Record<string, GroupRowOrderConfig>;
  flatRowOrder: string[];

  // Viewport state (optional - may not want to persist scroll position)
  scrollPosition?: { top: number; left: number };

  // Selection state (transient - usually not persisted)
  selectedCells?: string[];

  // Metadata
  entityType: string;
  lastUpdated: string;
}

// Factory function to create isolated preferences store for each VibeGrid instance
export function createVibeGridPreferences(entityType: string) {
  persistLog.info('🎯 Creating simple VibeGrid preferences store', { entityType });

  // Create observable with default structure
  const preferences$ = observable<VibeGridPreferences>({
    columnWidths: {},
    columnOrder: [],
    columnVisibility: {},
    sortBy: [],
    filters: [],
    groupConfig: null,
    groupRowOrders: {},
    flatRowOrder: [],
    scrollPosition: { top: 0, left: 0 },
    selectedCells: [],
    entityType,
    lastUpdated: new Date().toISOString()
  });

  // Apply persistence using Method 3 approach - clean and simple
  syncObservable(preferences$, persistOptions({
    persist: {
      name: `vibegrid-simple-${entityType}`
    }
  }));

  persistLog.info('✅ Simple VibeGrid preferences initialized', {
    entityType,
    storageKey: `vibegrid-simple-${entityType}`
  });

  return {
    preferences$,

    // Simple operations to update preferences
    operations: {
      // Update column width
      setColumnWidth(columnId: string, width: number) {
        const current = preferences$.columnWidths.get();
        preferences$.columnWidths.set({
          ...current,
          [columnId]: width
        });
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('📏 Column width saved', { columnId, width });
      },

      // Update column order
      setColumnOrder(order: string[]) {
        preferences$.columnOrder.set(order);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('🔄 Column order saved', { order });
      },

      // Update column visibility
      setColumnVisibility(columnId: string, visible: boolean) {
        const current = preferences$.columnVisibility.get();
        preferences$.columnVisibility.set({
          ...current,
          [columnId]: visible
        });
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('👁️ Column visibility saved', { columnId, visible });
      },

      // Update sort configuration
      setSortBy(sortBy: SortConfig[]) {
        preferences$.sortBy.set(sortBy);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('📊 Sort configuration saved', { sortBy });
      },

      // Update filters
      setFilters(filters: FilterConfig[]) {
        preferences$.filters.set(filters);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('🔍 Filters saved', { filters });
      },

      // Update group configuration
      setGroupConfig(groupConfig: GroupConfig | null) {
        // Convert runtime GroupConfig to serializable version
        const serializableConfig: SerializableGroupConfig | null = groupConfig ? {
          fields: groupConfig.fields,
          sortBy: groupConfig.sortBy,
          sortDirection: groupConfig.sortDirection,
          aggregations: groupConfig.aggregations,
          expandedGroups: Array.from(groupConfig.expandedGroups || new Set()), // Convert Set to Array
          colorScheme: groupConfig.colorScheme
        } : null;

        preferences$.groupConfig.set(serializableConfig);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.info('👥 Group configuration saved to localStorage', {
          hasConfig: !!groupConfig,
          originalConfig: groupConfig,
          serializableConfig: serializableConfig,
          fields: groupConfig?.fields?.length || 0,
          expandedGroupsCount: groupConfig?.expandedGroups?.size || 0,
          hasFields: !!serializableConfig?.fields,
          fieldsArray: serializableConfig?.fields
        });
      },

      // Update scroll position (optional - usually not persisted for UX reasons)
      setScrollPosition(position: { top: number; left: number }) {
        preferences$.scrollPosition.set(position);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('📜 Scroll position saved', { position });
      },

      // Update selected cells (transient - usually not persisted)
      setSelectedCells(cells: string[]) {
        preferences$.selectedCells.set(cells);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('🎯 Selected cells saved', { count: cells.length });
      },

      // Update group row orders for a specific group
      setGroupRowOrder(groupId: string, rowOrder: GroupRowOrderConfig) {
        if (!rowOrder || !rowOrder.rowIds) {
          persistLog.error('❌ Invalid rowOrder passed to setGroupRowOrder', { groupId, rowOrder });
          return;
        }

        // Limit row order size to prevent storage bloat
        const limitedRowOrder: GroupRowOrderConfig = {
          ...rowOrder,
          rowIds: limitRowOrders(rowOrder.rowIds)
        };

        const current = preferences$.groupRowOrders.get();
        preferences$.groupRowOrders.set({
          ...current,
          [groupId]: limitedRowOrder
        });
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('📋 Group row order saved', {
          groupId,
          originalCount: rowOrder.rowIds.length,
          savedCount: limitedRowOrder.rowIds.length
        });
      },

      // Update flat row order (ungrouped mode)
      setFlatRowOrder(rowOrder: string[]) {
        const limitedRowOrder = limitRowOrders(rowOrder);
        preferences$.flatRowOrder.set(limitedRowOrder);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('📋 Flat row order saved', {
          originalCount: rowOrder.length,
          savedCount: limitedRowOrder.length
        });
      },

      // Clear all row ordering (useful when switching modes)
      clearRowOrdering() {
        preferences$.groupRowOrders.set({});
        preferences$.flatRowOrder.set([]);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('🗑️ All row ordering cleared');
      },

      // Initialize with column defaults
      initializeColumns(columns: Array<{ id: string; width?: number }>) {
        const defaultWidths = Object.fromEntries(
          columns.map(col => [col.id, col.width || 150])
        );
        const defaultVisibility = Object.fromEntries(
          columns.map(col => [col.id, true])
        );
        const defaultOrder = columns.map(col => col.id);

        // Only set defaults if not already persisted
        const currentWidths = preferences$.columnWidths.get();
        const currentVisibility = preferences$.columnVisibility.get();
        const currentOrder = preferences$.columnOrder.get();

        if (Object.keys(currentWidths).length === 0) {
          preferences$.columnWidths.set(defaultWidths);
        }
        if (Object.keys(currentVisibility).length === 0) {
          preferences$.columnVisibility.set(defaultVisibility);
        }
        if (currentOrder.length === 0) {
          preferences$.columnOrder.set(defaultOrder);
        }

        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.info('🎯 Columns initialized with defaults', {
          entityType,
          columnsCount: columns.length,
          hadPersistedState: Object.keys(currentWidths).length > 0
        });
      },

      // Reset all preferences to defaults
      reset(columns: Array<{ id: string; width?: number }>) {
        const defaultWidths = Object.fromEntries(
          columns.map(col => [col.id, col.width || 150])
        );
        const defaultVisibility = Object.fromEntries(
          columns.map(col => [col.id, true])
        );
        const defaultOrder = columns.map(col => col.id);

        preferences$.assign({
          columnWidths: defaultWidths,
          columnOrder: defaultOrder,
          columnVisibility: defaultVisibility,
          sortBy: [],
          filters: [],
          groupConfig: null,
          groupRowOrders: {},
          flatRowOrder: [],
          scrollPosition: { top: 0, left: 0 },
          selectedCells: [],
          lastUpdated: new Date().toISOString()
        });

        persistLog.info('🔄 Preferences reset to defaults', { entityType });
      },

      // Get current preferences as plain object
      getSnapshot(): VibeGridPreferences {
        return preferences$.get();
      },

      // Debug: Clear all persistence
      clearPersistence() {
        const storageKey = `vibegrid-simple-${entityType}`;
        localStorage.removeItem(storageKey);
        persistLog.info('🗑️ Persistence cleared', { entityType, storageKey });
      },

      // Emergency cleanup for quota exceeded errors
      emergencyCleanup() {
        const storageKey = `vibegrid-simple-${entityType}`;
        try {
          // Clear large data arrays that might be causing bloat
          const currentPrefs = preferences$.get();
          const cleanedPrefs = {
            ...currentPrefs,
            groupRowOrders: {}, // Clear all row orders
            flatRowOrder: [], // Clear flat order
            selectedCells: [] // Clear selections
          };

          // Try to save cleaned version
          localStorage.setItem(storageKey, JSON.stringify(cleanedPrefs));

          // Update observables
          preferences$.groupRowOrders.set({});
          preferences$.flatRowOrder.set([]);
          preferences$.selectedCells.set([]);
          preferences$.lastUpdated.set(new Date().toISOString());

          persistLog.info('🧹 Emergency cleanup completed', {
            entityType,
            storageKey,
            clearedArrays: ['groupRowOrders', 'flatRowOrder', 'selectedCells']
          });
        } catch (error) {
          persistLog.error('❌ Emergency cleanup failed', { entityType, error });
          // Last resort: clear everything
          localStorage.removeItem(storageKey);
        }
      }
    }
  };
}

// Utility to inspect what's saved in localStorage for debugging
export function inspectVibeGridPersistence(entityType: string) {
  const storageKey = `vibegrid-simple-${entityType}`;
  const stored = localStorage.getItem(storageKey);

  if (!stored) {
    persistLog.info('🔍 No persistence found', { entityType, storageKey });
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    persistLog.info('🔍 Persistence inspection', {
      entityType,
      storageKey,
      data: parsed,
      lastUpdated: parsed.lastUpdated,
      hasColumnWidths: !!parsed.columnWidths && Object.keys(parsed.columnWidths).length > 0,
      hasColumnOrder: !!parsed.columnOrder && parsed.columnOrder.length > 0,
      hasSortBy: !!parsed.sortBy && parsed.sortBy.length > 0,
      hasFilters: !!parsed.filters && parsed.filters.length > 0,
      hasGroupConfig: !!parsed.groupConfig,
      hasGroupRowOrders: !!parsed.groupRowOrders && Object.keys(parsed.groupRowOrders).length > 0,
      hasFlatRowOrder: !!parsed.flatRowOrder && parsed.flatRowOrder.length > 0,
      hasScrollPosition: !!parsed.scrollPosition,
      hasSelectedCells: !!parsed.selectedCells && parsed.selectedCells.length > 0
    });
    return parsed;
  } catch (error) {
    persistLog.error('🚨 Failed to parse persistence data', { entityType, storageKey, error });
    return null;
  }
}

// Export types for use in other files
export type { VibeGridPreferences };