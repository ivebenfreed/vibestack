/**
 * Simple VibeGrid Persistence - Method 3 Approach
 *
 * Clean, reliable persistence for essential VibeGrid user preferences.
 * Uses the same approach as our working local storage debug page.
 */

import { observable } from '@legendapp/state';
import { configureSynced, syncObservable } from '@legendapp/state/sync';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { observablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb';
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
const MAX_LOCALSTORAGE_SIZE = 1024 * 512; // 512KB threshold to switch to IndexedDB

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

// Validate column visibility data to prevent corruption
function validateColumnVisibility(columnVisibility: Record<string, boolean>): Record<string, boolean> {
  const stringified = JSON.stringify(columnVisibility);

  // Check for abnormal size (should be small for boolean values)
  if (stringified.length > 10000) { // 10KB threshold for column visibility
    persistLog.error('🚨 Column visibility data abnormally large, resetting to safe defaults', {
      size: stringified.length,
      keys: Object.keys(columnVisibility).length
    });

    // Return only boolean values, strip any corrupted data
    const cleaned: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(columnVisibility)) {
      if (typeof key === 'string' && typeof value === 'boolean') {
        cleaned[key] = value;
      }
    }

    // If still too large after cleaning, return empty object
    if (JSON.stringify(cleaned).length > 10000) {
      persistLog.error('🚨 Column visibility still corrupted after cleaning, returning empty state');
      return {};
    }

    return cleaned;
  }

  return columnVisibility;
}

// Configure IndexedDB persistence as primary storage
const indexedDBOptions = configureSynced({
  persist: {
    plugin: observablePersistIndexedDB({
      databaseName: "VibeGrid",
      version: 1,
      tableNames: ["preferences"]
    })
  }
});

// Configure localStorage persistence as fallback
const localStorageOptions = configureSynced({
  persist: {
    plugin: ObservablePersistLocalStorage
  }
});

// Smart persistence: Use IndexedDB for large data, localStorage for small data
function getOptimalPersistenceConfig(entityType: string, estimatedSize?: number): any {
  // Check if we should use IndexedDB based on size or previous quota issues
  const forceIndexedDB = localStorage.getItem(`vibegrid-force-indexeddb-${entityType}`);

  if (forceIndexedDB || (estimatedSize && estimatedSize > MAX_LOCALSTORAGE_SIZE)) {
    persistLog.info('🗄️ Using IndexedDB for large data persistence', {
      entityType,
      estimatedSize,
      forceIndexedDB: !!forceIndexedDB
    });
    return indexedDBOptions;
  }

  persistLog.info('💾 Using localStorage for small data persistence', {
    entityType,
    estimatedSize
  });
  return localStorageOptions;
}

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

  // Viewport state (intentionally excluded - scroll position should not persist for better UX)
  // scrollPosition?: { top: number; left: number };

  // Selection state (transient - usually not persisted)
  selectedCells?: string[];

  // Metadata
  entityType: string;
  lastUpdated: string;
}

// Factory function to create isolated preferences store for each VibeGrid instance
export function createVibeGridPreferences(entityType: string) {
  persistLog.info('🎯 Creating simple VibeGrid preferences store', { entityType });

  const storageKey = `vibegrid-simple-${entityType}`;

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
    // scrollPosition: { top: 0, left: 0 }, // Intentionally excluded for better UX
    selectedCells: [],
    entityType,
    lastUpdated: new Date().toISOString()
  });

  // Load initial data from localStorage manually
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      preferences$.assign(parsed);
      persistLog.info('📖 Loaded preferences from localStorage', { entityType, size: stored.length });
    }
  } catch (error) {
    persistLog.warn('⚠️ Failed to load stored preferences, using defaults', { entityType, error });
  }

  // Manual save function
  const saveToStorage = () => {
    try {
      // Extract only the plain values, not the observable metadata
      const columnWidths = preferences$.columnWidths.get();
      const columnOrder = preferences$.columnOrder.get();
      const columnVisibility = preferences$.columnVisibility.get();

      // Debug what's causing the huge size
      persistLog.debug('🔍 Analyzing storage size', {
        columnWidthsSize: JSON.stringify(columnWidths).length,
        columnOrderSize: JSON.stringify(columnOrder).length,
        columnVisibilitySize: JSON.stringify(columnVisibility).length,
        columnWidthsKeys: Object.keys(columnWidths || {}).length,
        columnWidthsPreview: JSON.stringify(columnWidths).substring(0, 100)
      });

      const data: VibeGridPreferences = {
        columnWidths: columnWidths,
        columnOrder: columnOrder,
        columnVisibility: columnVisibility,
        sortBy: preferences$.sortBy.get(),
        filters: preferences$.filters.get(),
        groupConfig: preferences$.groupConfig.get(),
        groupRowOrders: preferences$.groupRowOrders.get(),
        flatRowOrder: preferences$.flatRowOrder.get(),
        // scrollPosition: preferences$.scrollPosition.get(), // Intentionally excluded for better UX
        selectedCells: preferences$.selectedCells.get(),
        entityType: preferences$.entityType.get(),
        lastUpdated: preferences$.lastUpdated.get()
      };

      const serialized = JSON.stringify(data);

      // Safety check - should be small
      if (serialized.length > 100000) { // 100KB warning
        persistLog.warn('🚨 Preferences unusually large, truncating', {
          entityType,
          size: serialized.length,
          preview: serialized.substring(0, 200)
        });
        return;
      }

      localStorage.setItem(storageKey, serialized);
      persistLog.debug('💾 Preferences saved', { entityType, size: serialized.length });
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        persistLog.error('🚨 QuotaExceededError during manual save', { entityType, error });
        // Trigger emergency cleanup but don't throw
        operations.emergencyCleanup();
      } else {
        persistLog.error('❌ Failed to save preferences', { entityType, error });
      }
    }
  };

  persistLog.info('✅ Simple VibeGrid preferences initialized', {
    entityType,
    storageKey
  });

  const operations = {
    // Update column width (individual)
    setColumnWidth(columnId: string, width: number) {
      const current = preferences$.columnWidths.get();
      preferences$.columnWidths.set({
        ...current,
        [columnId]: width
      });
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
      persistLog.debug('📏 Column width saved', { columnId, width });
    },

    // Update all column widths (bulk - preferred for onChange handlers)
    setAllColumnWidths(columnWidths: Record<string, number>) {
      // Defensive filtering - only save actual width numbers
      const filteredWidths: Record<string, number> = {};
      for (const [key, value] of Object.entries(columnWidths || {})) {
        if (typeof value === 'number' && isFinite(value) && value > 0) {
          filteredWidths[key] = value;
        }
      }

      preferences$.columnWidths.set(filteredWidths);
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
      persistLog.debug('📏 All column widths saved', {
        originalCount: Object.keys(columnWidths || {}).length,
        filteredCount: Object.keys(filteredWidths).length,
        filteredWidths
      });
    },

    // Update column order
    setColumnOrder(order: string[]) {
      preferences$.columnOrder.set(order);
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
      persistLog.debug('🔄 Column order saved', { order });
    },

    // Update column visibility (individual)
    setColumnVisibility(columnId: string, visible: boolean) {
      const current = preferences$.columnVisibility.get();
      preferences$.columnVisibility.set({
        ...current,
        [columnId]: visible
      });
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
      persistLog.debug('👁️ Column visibility saved', { columnId, visible });
    },

    // Update all column visibility (bulk - preferred for onChange handlers)
    setAllColumnVisibility(columnVisibility: Record<string, boolean>) {
      // Defensive filtering - only save actual boolean values
      const filteredVisibility: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(columnVisibility || {})) {
        if (typeof value === 'boolean') {
          filteredVisibility[key] = value;
        }
      }

      preferences$.columnVisibility.set(filteredVisibility);
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
      persistLog.debug('👁️ All column visibility saved', {
        originalCount: Object.keys(columnVisibility || {}).length,
        filteredCount: Object.keys(filteredVisibility).length,
        filteredVisibility
      });
    },

    // Update sort configuration
    setSortBy(sortBy: SortConfig[]) {
      preferences$.sortBy.set(sortBy);
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
      persistLog.debug('📊 Sort configuration saved', { sortBy });
    },

    // Update filters
    setFilters(filters: FilterConfig[]) {
      preferences$.filters.set(filters);
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
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
      saveToStorage();
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

    // Update scroll position (disabled - scroll position should not persist for better UX)
    // setScrollPosition(position: { top: number; left: number }) {
    //   preferences$.scrollPosition.set(position);
    //   preferences$.lastUpdated.set(new Date().toISOString());
    //   saveToStorage();
    //   persistLog.debug('📜 Scroll position saved', { position });
    // },

    // Update selected cells (transient - usually not persisted)
    setSelectedCells(cells: string[]) {
      preferences$.selectedCells.set(cells);
      preferences$.lastUpdated.set(new Date().toISOString());
      saveToStorage();
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
      saveToStorage();
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
      saveToStorage();
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
      saveToStorage();
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
      saveToStorage();
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
        // scrollPosition: { top: 0, left: 0 }, // Intentionally excluded for better UX
        selectedCells: [],
        lastUpdated: new Date().toISOString()
      });

      saveToStorage();
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
        persistLog.warn('🧹 Starting emergency cleanup for quota exceeded error', { entityType, storageKey });

        // Clear localStorage completely for this key
        localStorage.removeItem(storageKey);

        // Reset to minimal state
        preferences$.assign({
          columnWidths: {},
          columnOrder: [],
          columnVisibility: {},
          sortBy: [],
          filters: [],
          groupConfig: null,
          groupRowOrders: {},
          flatRowOrder: [],
          // scrollPosition: { top: 0, left: 0 }, // Intentionally excluded for better UX
          selectedCells: [],
          entityType,
          lastUpdated: new Date().toISOString()
        });

        persistLog.info('🧹 Emergency cleanup completed', { entityType });
      } catch (error) {
        persistLog.error('❌ Emergency cleanup failed', { entityType, error });
      }
    },

    // Switch to IndexedDB persistence (for when localStorage fails)
    switchToIndexedDB() {
      try {
        // Mark this entity to use IndexedDB
        localStorage.setItem(`vibegrid-force-indexeddb-${entityType}`, 'true');

        // Clear localStorage to free up space
        const storageKey = `vibegrid-simple-${entityType}`;
        localStorage.removeItem(storageKey);

        persistLog.info('🗄️ Switched to IndexedDB persistence', { entityType });
      } catch (error) {
        persistLog.error('❌ Failed to switch to IndexedDB', { entityType, error });
      }
    }
  };

  return {
    preferences$,
    operations
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
      // hasScrollPosition: !!parsed.scrollPosition, // Intentionally excluded for better UX
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