import { fromStore } from '@xstate/store';
import { db } from '@repo/dataforge/dexie-schema';
import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';
import { 
  discoverRelationships, 
  getUniqueRelationshipTables,
  resolveEntityRelationships,
  type RelationshipConfig
} from '../utils/relationship-discovery';

// ====================================
// TYPES
// ====================================

export interface EntityChange {
  id: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  resolved?: any;
  changedFields?: string[];
}

export interface RelationshipMap {
  [id: string]: {
    id: string;
    name: string;
    [key: string]: any;
  };
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 
            'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in' | 'regex';
  value: any;
  negate?: boolean;
  caseSensitive?: boolean;
}

export interface TableRow {
  id: string;
  data: Record<string, any>;
  metadata: {
    isSelected: boolean;
    isDirty: boolean;
    isGroup: boolean;
    level: number;
  };
}

export interface TableStoreContext {
  entityType: string;
  
  // Raw data
  entities: Record<string, any>;
  relationships: Record<string, Record<string, any>>; // Dynamic relationship tables
  
  // View configuration
  sortBy: SortConfig[];
  filters: FilterConfig[];
  groupBy: string[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  
  // Processed data (computed)
  processedRows: TableRow[];
  visibleRows: TableRow[];
  totalRowCount: number;
  
  // Metadata
  loading: boolean;
  error: string | null;
  lastProcessedAt: number;
}

// ====================================
// EVENTS
// ====================================

export type TableStoreEvent = 
  | { type: 'ENTITIES_LOADED'; entities: any[] }
  | { type: 'ENTITY_CHANGED'; change: EntityChange }
  | { type: 'ENTITIES_CHANGED'; changes: EntityChange[] }
  | { type: 'RELATIONSHIP_DATA_UPDATED'; table: string; data: any[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_SORT_BY'; sortBy: SortConfig[] }
  | { type: 'SET_FILTERS'; filters: FilterConfig[] }
  | { type: 'SET_GROUP_BY'; groupBy: string[] }
  | { type: 'SET_COLUMN_VISIBILITY'; columnVisibility: Record<string, boolean> }
  | { type: 'SET_COLUMN_ORDER'; columnOrder: string[] }
  | { type: 'TOGGLE_COLUMN_VISIBILITY'; columnId: string }
  | { type: 'REPROCESS_DATA' };

// ====================================
// HELPERS
// ====================================

/**
 * Check if entity content has changed (excluding timestamps)
 */
function hasContentChanged(oldEntity: any, newEntity: any): boolean {
  if (!oldEntity || !newEntity) return true;
  
  const ignoredFields = ['updatedAt', 'syncedAt', 'createdAt'];
  const oldKeys = Object.keys(oldEntity).filter(k => !ignoredFields.includes(k));
  const newKeys = Object.keys(newEntity).filter(k => !ignoredFields.includes(k));
  
  if (oldKeys.length !== newKeys.length) return true;
  
  for (const key of oldKeys) {
    if (oldEntity[key] !== newEntity[key]) return true;
  }
  
  return false;
}

/**
 * Get list of changed fields
 */
function getChangedFields(oldEntity: any, newEntity: any): string[] {
  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(oldEntity), ...Object.keys(newEntity)]);
  
  for (const key of allKeys) {
    if (key !== 'updatedAt' && oldEntity[key] !== newEntity[key]) {
      changedFields.push(key);
    }
  }
  
  return changedFields;
}

/**
 * Apply sorting to rows
 */
function applySorting(rows: TableRow[], sortBy: SortConfig[]): TableRow[] {
  if (sortBy.length === 0) return rows;
  
  const sortedRows = rows.slice();
  
  sortedRows.sort((a, b) => {
    for (const sort of sortBy) {
      const aValue = a.data[sort.field];
      const bValue = b.data[sort.field];
      
      // Handle null/undefined
      const aIsEmpty = aValue == null || aValue === '';
      const bIsEmpty = bValue == null || bValue === '';
      
      if (aIsEmpty && bIsEmpty) continue;
      if (aIsEmpty) return sort.direction === 'asc' ? 1 : -1;
      if (bIsEmpty) return sort.direction === 'asc' ? -1 : 1;
      
      // Compare values
      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        comparison = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      }
      
      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
  
  return sortedRows;
}

/**
 * Apply filters to rows
 */
function applyFilters(rows: TableRow[], filters: FilterConfig[]): TableRow[] {
  if (filters.length === 0) return rows;
  
  return rows.filter(row => {
    return filters.every(filter => {
      const value = row.data[filter.field];
      let matches = false;
      
      switch (filter.operator) {
        case 'equals':
          matches = value === filter.value;
          break;
        case 'not_equals':
          matches = value !== filter.value;
          break;
        case 'contains':
          matches = String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          break;
        case 'not_contains':
          matches = !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          break;
        case 'starts_with':
          matches = String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
          break;
        case 'ends_with':
          matches = String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
          break;
        case 'greater_than':
          matches = Number(value) > Number(filter.value);
          break;
        case 'less_than':
          matches = Number(value) < Number(filter.value);
          break;
        case 'is_empty':
          matches = value == null || value === '';
          break;
        case 'is_not_empty':
          matches = value != null && value !== '';
          break;
        case 'in':
          matches = Array.isArray(filter.value) && filter.value.includes(value);
          break;
        case 'not_in':
          matches = Array.isArray(filter.value) && !filter.value.includes(value);
          break;
        case 'regex':
          try {
            const regex = new RegExp(filter.value, filter.caseSensitive ? 'g' : 'gi');
            matches = regex.test(String(value));
          } catch {
            matches = false;
          }
          break;
        default:
          matches = true;
      }
      
      return filter.negate ? !matches : matches;
    });
  });
}

/**
 * Process entities into table rows with all transformations
 */
function processEntities(
  entities: Record<string, any>,
  sortBy: SortConfig[],
  filters: FilterConfig[]
): { processedRows: TableRow[], totalRowCount: number } {
  // Convert entities to table rows
  const allRows: TableRow[] = Object.values(entities).map(entity => ({
    id: entity.id,
    data: entity,
    metadata: {
      isSelected: false,
      isDirty: false,
      isGroup: false,
      level: 0
    }
  }));
  
  // Apply filters
  const filteredRows = applyFilters(allRows, filters);
  
  // Apply sorting
  const sortedRows = applySorting(filteredRows, sortBy);
  
  return {
    processedRows: sortedRows,
    totalRowCount: filteredRows.length
  };
}

// ====================================
// STORE LOGIC
// ====================================

/**
 * Create XState Store logic for table data with atomic updates
 * This returns actor logic that can be used with createActor
 */
export const createTableStoreLogic = (entityType: string, columns?: any[]) => {
  return fromStore<TableStoreContext, TableStoreEvent>({
    context: {
      entityType,
      entities: {},
      relationships: {}, // Dynamic - will be populated based on columns
      sortBy: [],
      filters: [],
      groupBy: [],
      columnVisibility: columns ? Object.fromEntries(columns.map(col => [col.id, true])) : {},
      columnOrder: columns ? columns.map(col => col.id) : [],
      processedRows: [],
      visibleRows: [],
      totalRowCount: 0,
      loading: true,
      error: null,
      lastProcessedAt: 0
    },
    on: {
      ENTITIES_LOADED: (context, event) => {
        console.log('📊 TableStore: Entities loaded', {
          count: event.entities.length,
          entityType: context.entityType,
          willEmitSnapshot: true
        });
        
        const entities: Record<string, any> = {};
        event.entities.forEach(entity => {
          entities[entity.id] = entity;
        });
        
        // Process entities with current view settings
        const { processedRows, totalRowCount } = processEntities(
          entities,
          context.sortBy,
          context.filters
        );
        
        return {
          ...context,
          entities,
          processedRows,
          visibleRows: processedRows, // For now, all processed rows are visible
          totalRowCount,
          loading: false,
          error: null,
          lastProcessedAt: Date.now()
        };
      },
      
      ENTITY_CHANGED: (context, event) => {
        const { change } = event;
        const { id, operation, data } = change;
        
        console.log('📊 TableStore: Entity changed', {
          id,
          operation,
          entityType: context.entityType
        });
        
        let newEntities = context.entities;
        
        if (operation === 'delete') {
          const { [id]: removed, ...rest } = context.entities;
          newEntities = rest;
        } else {
          newEntities = {
            ...context.entities,
            [id]: data
          };
        }
        
        // Reprocess data with updated entities
        const { processedRows, totalRowCount } = processEntities(
          newEntities,
          context.sortBy,
          context.filters
        );
        
        return {
          ...context,
          entities: newEntities,
          processedRows,
          visibleRows: processedRows,
          totalRowCount,
          lastProcessedAt: Date.now()
        };
      },
      
      ENTITIES_CHANGED: (context, event) => {
        console.log('📊 TableStore: Multiple entities changed', {
          count: event.changes.length,
          entityType: context.entityType
        });
        
        const newEntities = { ...context.entities };
        
        event.changes.forEach(change => {
          if (change.operation === 'delete') {
            delete newEntities[change.id];
          } else {
            newEntities[change.id] = change.data;
          }
        });
        
        // Reprocess data with updated entities
        const { processedRows, totalRowCount } = processEntities(
          newEntities,
          context.sortBy,
          context.filters
        );
        
        return {
          ...context,
          entities: newEntities,
          processedRows,
          visibleRows: processedRows,
          totalRowCount,
          lastProcessedAt: Date.now()
        };
      },
      
      RELATIONSHIP_DATA_UPDATED: (context, event) => {
        console.log('📊 TableStore: Relationship data updated', {
          table: event.table,
          count: event.data.length
        });
        
        const relationshipMap: Record<string, any> = {};
        event.data.forEach(item => {
          relationshipMap[item.id] = item;
        });
        
        return {
          ...context,
          relationships: {
            ...context.relationships,
            [event.table]: relationshipMap
          }
        };
      },
      
      SET_LOADING: (context, event) => ({
        ...context,
        loading: event.loading
      }),
      
      SET_ERROR: (context, event) => ({
        ...context,
        error: event.error,
        loading: false
      }),
      
      SET_SORT_BY: (context, event) => {
        console.log('📊 TableStore: Setting sort by', event.sortBy);
        
        // Reprocess data with new sort
        const { processedRows, totalRowCount } = processEntities(
          context.entities,
          event.sortBy,
          context.filters
        );
        
        return {
          ...context,
          sortBy: event.sortBy,
          processedRows,
          visibleRows: processedRows,
          totalRowCount,
          lastProcessedAt: Date.now()
        };
      },
      
      SET_FILTERS: (context, event) => {
        console.log('📊 TableStore: Setting filters', event.filters);
        
        // Reprocess data with new filters
        const { processedRows, totalRowCount } = processEntities(
          context.entities,
          context.sortBy,
          event.filters
        );
        
        return {
          ...context,
          filters: event.filters,
          processedRows,
          visibleRows: processedRows,
          totalRowCount,
          lastProcessedAt: Date.now()
        };
      },
      
      SET_GROUP_BY: (context, event) => ({
        ...context,
        groupBy: event.groupBy
      }),
      
      SET_COLUMN_VISIBILITY: (context, event) => ({
        ...context,
        columnVisibility: event.columnVisibility
      }),
      
      SET_COLUMN_ORDER: (context, event) => ({
        ...context,
        columnOrder: event.columnOrder
      }),
      
      TOGGLE_COLUMN_VISIBILITY: (context, event) => {
        const currentVisibility = context.columnVisibility[event.columnId] ?? true;
        return {
          ...context,
          columnVisibility: {
            ...context.columnVisibility,
            [event.columnId]: !currentVisibility
          }
        };
      },
      
      REPROCESS_DATA: (context) => {
        console.log('📊 TableStore: Reprocessing data');
        
        const { processedRows, totalRowCount } = processEntities(
          context.entities,
          context.sortBy,
          context.filters
        );
        
        return {
          ...context,
          processedRows,
          visibleRows: processedRows,
          totalRowCount,
          lastProcessedAt: Date.now()
        };
      }
    }
  });
};

// ====================================
// DEXIE SUBSCRIPTION MANAGER
// ====================================

/**
 * Setup Dexie subscriptions for a store actor created from fromStore logic
 */
export function setupDexieSubscriptions(
  storeActor: any,
  entityType: string,
  columns?: any[]
): () => void {
  console.log('📊 TableStore: Setting up Dexie subscriptions for', entityType);
  
  const subscriptions: Subscription[] = [];
  const entityTableName = `${entityType}s`;
  
  // Helper to resolve entity relationships dynamically based on columns
  const resolveEntity = (entity: any, relationships: any) => {
    if (!columns) return entity;
    
    // Discover relationships from columns
    const relationshipConfigs = discoverRelationships(columns);
    
    // Use the relationship discovery utility to resolve all relationships
    return resolveEntityRelationships(entity, relationships, relationshipConfigs);
  };
  
  // Subscribe to main entity changes
  const entitySub = liveQuery(() => db[entityTableName].toArray()).subscribe({
    next: (entities) => {
      console.log('📊 TableStore: Entities subscription update', {
        table: entityTableName,
        count: entities.length
      });
      
      // Load initial entities
      storeActor.send({ type: 'ENTITIES_LOADED', entities });
      
      // Get current state from the store actor
      const storeSnapshot = storeActor.getSnapshot();
      if (!storeSnapshot) {
        console.error('❌ TableStore: Could not get store snapshot');
        return;
      }
      
      const resolved = entities.map(entity => 
        resolveEntity(entity, storeSnapshot.context.relationships)
      );
      
      // Detect changes
      const changes: EntityChange[] = [];
      const currentEntities = storeSnapshot.context.entities;
      
      // Check for new or updated entities
      resolved.forEach(entity => {
        const oldEntity = currentEntities[entity.id];
        if (!oldEntity || hasContentChanged(oldEntity, entity)) {
          changes.push({
            id: entity.id,
            operation: oldEntity ? 'update' : 'insert',
            data: entity,
            resolved: entity,
            changedFields: oldEntity ? getChangedFields(oldEntity, entity) : []
          });
        }
      });
      
      // Check for deleted entities
      Object.keys(currentEntities).forEach(id => {
        if (!entities.find(e => e.id === id)) {
          changes.push({
            id,
            operation: 'delete',
            data: currentEntities[id]
          });
        }
      });
      
      // Send changes if any
      if (changes.length > 0) {
        storeActor.send({ type: 'ENTITIES_CHANGED', changes });
      }
    },
    error: (error) => {
      console.error('❌ TableStore: Entity subscription error', error);
      storeActor.send({ type: 'SET_ERROR', error: error.message });
    }
  });
  
  subscriptions.push(entitySub);
  
  // Subscribe to relationship data dynamically based on columns
  if (columns) {
    const uniqueTables = getUniqueRelationshipTables(columns);
    console.log('📊 TableStore: Subscribing to relationship tables:', uniqueTables);
    
    uniqueTables.forEach(tableName => {
      const table = (db as any)[tableName];
      if (!table) {
        console.warn('⚠️ TableStore: No table found for relationship:', tableName);
        return;
      }
      
      const sub = liveQuery(() => table.toArray()).subscribe({
        next: (data) => {
          storeActor.send({ type: 'RELATIONSHIP_DATA_UPDATED', table: tableName, data });
          
          // After updating relationship data, re-resolve all entities
          // This ensures UI updates when related data changes
          const storeSnapshot = storeActor.getSnapshot();
          if (storeSnapshot && storeSnapshot.context.entities) {
            const entities = Object.values(storeSnapshot.context.entities);
            const relationships = {
              ...storeSnapshot.context.relationships,
              [tableName]: data.reduce((acc: any, item: any) => {
                acc[item.id] = item;
                return acc;
              }, {})
            };
            
            // Re-resolve all entities with updated relationship data
            const relationshipConfigs = discoverRelationships(columns);
            const resolvedEntities = entities.map(entity => 
              resolveEntityRelationships(entity, relationships, relationshipConfigs)
            );
            
            // Send updated entities
            storeActor.send({ type: 'ENTITIES_LOADED', entities: resolvedEntities });
          }
        },
        error: (error) => {
          console.error(`❌ TableStore: ${tableName} subscription error`, error);
        }
      });
      
      subscriptions.push(sub);
    });
  }
  
  // Return cleanup function
  return () => {
    console.log('📊 TableStore: Cleaning up subscriptions');
    subscriptions.forEach(sub => sub.unsubscribe());
  };
}

// ====================================
// FACTORY FUNCTION
// ====================================

/**
 * Create table store actor logic that can be used with createActor
 * Returns XState-compatible actor logic from fromStore
 */
export function createTableStoreActor(entityType: string, columns?: any[]) {
  console.log('📊 TableStore: Creating store logic for', entityType, {
    columnCount: columns?.length || 0
  });
  
  // fromStore returns actor logic, not a store instance
  // This logic can be passed to createActor
  return createTableStoreLogic(entityType, columns);
}

// ====================================
// STORE SELECTORS
// ====================================

/**
 * Get visible columns from store context
 */
export function getVisibleColumns(context: TableStoreContext, allColumns: any[]): any[] {
  if (!allColumns || allColumns.length === 0) return [];
  
  // Filter by visibility
  const visibleColumns = allColumns.filter(col => 
    context.columnVisibility[col.id] !== false && col.id !== '__selection'
  );
  
  // Apply column order
  if (context.columnOrder && context.columnOrder.length > 0) {
    const orderedColumns = context.columnOrder
      .filter(colId => colId !== '__selection')
      .map(colId => visibleColumns.find(col => col.id === colId))
      .filter(Boolean);
    
    // Add any columns not in the order at the end
    const orderedIds = new Set(orderedColumns.map(col => col.id));
    const unorderedColumns = visibleColumns.filter(col => !orderedIds.has(col.id));
    
    return [...orderedColumns, ...unorderedColumns];
  }
  
  return visibleColumns;
}
