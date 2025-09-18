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

const persistLog = log('vibegrid/simple-persistence');

// Configure global persistence plugin using configureSynced (Method 3)
const persistOptions = configureSynced({
  persist: {
    plugin: ObservablePersistLocalStorage
  }
});

// Simple interface for essential VibeGrid preferences
export interface VibeGridPreferences {
  // Column layout
  columnWidths: Record<string, number>;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;

  // Data display
  sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>;
  filters: Array<{ field: string; operator: string; value: any }>;

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
      setSortBy(sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>) {
        preferences$.sortBy.set(sortBy);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('📊 Sort configuration saved', { sortBy });
      },

      // Update filters
      setFilters(filters: Array<{ field: string; operator: string; value: any }>) {
        preferences$.filters.set(filters);
        preferences$.lastUpdated.set(new Date().toISOString());
        persistLog.debug('🔍 Filters saved', { filters });
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
      hasFilters: !!parsed.filters && parsed.filters.length > 0
    });
    return parsed;
  } catch (error) {
    persistLog.error('🚨 Failed to parse persistence data', { entityType, storageKey, error });
    return null;
  }
}

// Export types for use in other files
export type { VibeGridPreferences };