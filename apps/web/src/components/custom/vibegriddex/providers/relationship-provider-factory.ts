/**
 * Relationship Provider Factory
 * 
 * Creates relationship options providers that read from the XState store
 * This ensures editing dropdowns get their data from the same source as the display
 */

import type { RelationshipOptionsProvider, EnumOption } from '../types';

/**
 * Creates a relationship options provider that reads from the store
 * @param relationshipTable - The table to read relationships from (e.g., 'users', 'projects')
 * @param getStore - Function to get the current store actor
 */
export function createStoreRelationshipProvider(
  relationshipTable: string,
  getStore: () => any
): RelationshipOptionsProvider {
  return async () => {
    const store = getStore();
    if (!store) {
      console.warn('RelationshipProvider: No store available');
      return [];
    }

    // Get current store snapshot
    const snapshot = store.getSnapshot();
    if (!snapshot?.context?.relationships) {
      console.warn('RelationshipProvider: No relationships in store context');
      return [];
    }

    // Get the relationship data for this table
    const relationshipData = snapshot.context.relationships[relationshipTable];
    if (!relationshipData) {
      console.warn(`RelationshipProvider: No data for table ${relationshipTable}`);
      return [];
    }

    // Convert to options format
    const options: EnumOption[] = Object.values(relationshipData).map((entity: any) => ({
      value: entity.id,
      label: entity.name || entity.displayName || entity.title || entity.id
    }));

    console.log('🔍 RelationshipProvider: Generated options from store', {
      relationshipTable,
      optionCount: options.length,
      sampleOptions: options.slice(0, 3)
    });

    return options;
  };
}

/**
 * Adds relationship providers to columns based on their type
 * @param columns - The column definitions
 * @param getStore - Function to get the current store actor
 */
export function addRelationshipProvidersToColumns(
  columns: any[],
  getStore: () => any
): any[] {
  return columns.map(column => {
    // Check if this is a relationship column
    const cellType = column.cellType || column.type;
    if (cellType?.startsWith('relationship') && column.relationshipTable) {
      // Add the provider if not already present
      if (!column.relationshipOptionsProvider) {
        return {
          ...column,
          relationshipOptionsProvider: createStoreRelationshipProvider(
            column.relationshipTable,
            getStore
          )
        };
      }
    }
    return column;
  });
}