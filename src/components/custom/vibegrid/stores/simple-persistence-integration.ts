/**
 * Simple Persistence Integration Example
 *
 * Shows how to integrate the simplified persistence with existing VibeGrid
 * This can be used alongside the complex system or as a replacement
 */

import { createVibeGridPreferences, inspectVibeGridPersistence } from './simple-persistence';
import { log } from '@/logger';

const integrationLog = log('vibegrid/simple-persistence-integration');

// Example of how to integrate simple persistence into VibeGrid
export function createVibeGridWithSimplePersistence(entityType: string, columns: Array<{ id: string; width?: number }>) {
  integrationLog.info('🎯 Creating VibeGrid with simple persistence', { entityType });

  // Create the simple preferences store
  const { preferences$, operations } = createVibeGridPreferences(entityType);

  // Initialize with column defaults
  operations.initializeColumns(columns);

  // Return interface that VibeGrid can use
  return {
    // Observable for reactive updates
    preferences$,

    // Simple operations that VibeGrid can call
    onColumnResize: (columnId: string, width: number) => {
      integrationLog.debug('📏 Column resized', { columnId, width });
      operations.setColumnWidth(columnId, width);
    },

    onColumnReorder: (newOrder: string[]) => {
      integrationLog.debug('🔄 Columns reordered', { newOrder });
      operations.setColumnOrder(newOrder);
    },

    onColumnVisibilityToggle: (columnId: string, visible: boolean) => {
      integrationLog.debug('👁️ Column visibility toggled', { columnId, visible });
      operations.setColumnVisibility(columnId, visible);
    },

    onSortChange: (sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>) => {
      integrationLog.debug('📊 Sort changed', { sortBy });
      operations.setSortBy(sortBy);
    },

    onFilterChange: (filters: Array<{ field: string; operator: string; value: any }>) => {
      integrationLog.debug('🔍 Filters changed', { filters });
      operations.setFilters(filters);
    },

    // Utility methods
    resetPreferences: () => operations.reset(columns),
    getSnapshot: () => operations.getSnapshot(),
    clearPersistence: () => operations.clearPersistence(),

    // Debug helpers
    inspect: () => inspectVibeGridPersistence(entityType),

    // Check if preferences were loaded from storage
    hasPersistedData: () => {
      const prefs = operations.getSnapshot();
      return Object.keys(prefs.columnWidths).length > 0 ||
             prefs.columnOrder.length > 0 ||
             prefs.sortBy.length > 0 ||
             prefs.filters.length > 0;
    }
  };
}

// Example usage in a React component or VibeGrid initialization:
export function exampleUsage() {
  const columns = [
    { id: 'title', width: 200 },
    { id: 'status', width: 120 },
    { id: 'priority', width: 100 },
    { id: 'assignee', width: 150 }
  ];

  // Create the persistence system
  const vibeGridPersistence = createVibeGridWithSimplePersistence('tasks', columns);

  // Check if we have persisted preferences
  if (vibeGridPersistence.hasPersistedData()) {
    integrationLog.info('✅ Loaded existing user preferences');
  } else {
    integrationLog.info('🆕 Using default preferences for new user');
  }

  // Use in VibeGrid event handlers:
  const handleColumnResize = (columnId: string, width: number) => {
    vibeGridPersistence.onColumnResize(columnId, width);
  };

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    vibeGridPersistence.onSortChange([{ field, direction }]);
  };

  // React to preference changes
  vibeGridPersistence.preferences$.onChange(() => {
    const prefs = vibeGridPersistence.getSnapshot();
    integrationLog.debug('💾 Preferences updated', {
      lastUpdated: prefs.lastUpdated,
      hasSort: prefs.sortBy.length > 0,
      hasFilters: prefs.filters.length > 0
    });
  });

  return vibeGridPersistence;
}

// Helper to migrate from complex to simple persistence (if needed)
export function migrateFromComplexPersistence(entityType: string, complexPrefs: any) {
  integrationLog.info('🔄 Migrating from complex to simple persistence', { entityType });

  const { operations } = createVibeGridPreferences(entityType);

  // Extract the essential data from complex preferences
  if (complexPrefs.columnWidths) {
    Object.entries(complexPrefs.columnWidths).forEach(([columnId, width]) => {
      operations.setColumnWidth(columnId, width as number);
    });
  }

  if (complexPrefs.columnOrder) {
    operations.setColumnOrder(complexPrefs.columnOrder);
  }

  if (complexPrefs.columnVisibility) {
    Object.entries(complexPrefs.columnVisibility).forEach(([columnId, visible]) => {
      operations.setColumnVisibility(columnId, visible as boolean);
    });
  }

  if (complexPrefs.sortBy) {
    operations.setSortBy(complexPrefs.sortBy);
  }

  if (complexPrefs.filters) {
    operations.setFilters(complexPrefs.filters);
  }

  integrationLog.info('✅ Migration completed', { entityType });
}