import { fromStore } from '@xstate/store';
import { db } from '../../../../db/dexie-schema';
import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';
import { 
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/stores/table-data-store.ts');
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
      // Check for resolved relationship values first
      const resolvedFieldName = `__resolved_${sort.field}`;
      const aValue = a.data[resolvedFieldName] !== undefined ? a.data[resolvedFieldName] : a.data[sort.field];
      const bValue = b.data[resolvedFieldName] !== undefined ? b.data[resolvedFieldName] : b.data[sort.field];
      
      // Debug logging for relationship sorting
      if (sort.field === 'projectId' && Math.random() < 0.05) {
        log.info('🔍 Sorting by project:', {
          field: sort.field,
          aRaw: a.data[sort.field],
          aResolved: a.data[resolvedFieldName],
          aUsed: aValue,
          bRaw: b.data[sort.field],
          bResolved: b.data[resolvedFieldName],
          bUsed: bValue
        });
      }
      
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
        log.info('📊 TableStore: Entities loaded', {
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
        
        log.info('📊 TableStore: Entity changed', {
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
        log.info('📊 TableStore: Multiple entities changed', {
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
        log.info('📊 TableStore: Relationship data updated', {
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
        log.info('📊 TableStore: Setting sort by', event.sortBy);
        
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
        log.info('📊 TableStore: Setting filters', event.filters);
        
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
        log.info('📊 TableStore: Reprocessing data with relationship updates');
        
        // Re-resolve all entities with current relationship data
        let entitiesWithUpdatedRelationships = context.entities;
        if (columns) {
          const relationshipConfigs = discoverRelationships(columns);
          entitiesWithUpdatedRelationships = Object.fromEntries(
            Object.entries(context.entities).map(([id, entity]) => [
              id,
              resolveEntityRelationships(entity, context.relationships, relationshipConfigs)
            ])
          );
        }
        
        const { processedRows, totalRowCount } = processEntities(
          entitiesWithUpdatedRelationships,
          context.sortBy,
          context.filters
        );
        
        return {
          ...context,
          entities: entitiesWithUpdatedRelationships,
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
  log.info('📊 TableStore: Setting up Dexie subscriptions for', entityType);
  
  const subscriptions: Subscription[] = [];
  
  // Debounce reprocessing to prevent excessive calls
  let reprocessTimeout: NodeJS.Timeout | null = null;
  const debounceReprocess = () => {
    if (reprocessTimeout) {
      clearTimeout(reprocessTimeout);
    }
    reprocessTimeout = setTimeout(() => {
      storeActor.send({ type: 'REPROCESS_DATA' });
      reprocessTimeout = null;
    }, 50); // 50ms debounce
  };
  
  // Track first change events to ignore them
  const firstChangeFlags = new Map<string, boolean>();
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
      // Ignore the first change event as data is already loaded in useTableData
      if (!firstChangeFlags.has(entityTableName)) {
        firstChangeFlags.set(entityTableName, true);
        log.info('📊 TableStore: Ignoring first entities subscription event for', entityTableName);
        return;
      }
      
      log.info('📊 TableStore: Entities subscription update', {
        table: entityTableName,
        count: entities.length
      });
      
      // Get current state from the store actor
      const storeSnapshot = storeActor.getSnapshot();
      if (!storeSnapshot) {
        log.error('❌ TableStore: Could not get store snapshot');
        return;
      }
      
      // Don't override existing entities if they're already loaded and resolved
      // This prevents losing junction table data that was loaded in useTableData
      const currentEntities = storeSnapshot.context.entities;
      const hasExistingData = Object.keys(currentEntities).length > 0;
      
      if (!hasExistingData) {
        log.info('📊 TableStore: No existing entities, loading initial data');
        storeActor.send({ type: 'ENTITIES_LOADED', entities });
        return;
      }
      
      // For subsequent updates, only process entities that have actually changed
      // This preserves junction table data loaded elsewhere
      const resolved = entities.map(entity => 
        resolveEntity(entity, storeSnapshot.context.relationships)
      );
      
      // Detect changes
      const changes: EntityChange[] = [];
      
      // Check for new or updated entities
      resolved.forEach(entity => {
        const oldEntity = currentEntities[entity.id];
        if (!oldEntity) {
          // New entity - add it but preserve any existing junction data if available
          const existingResolved = currentEntities[entity.id];
          const finalEntity = existingResolved || entity;
          changes.push({
            id: entity.id,
            operation: 'insert',
            data: finalEntity,
            resolved: finalEntity,
            changedFields: []
          });
        } else if (hasContentChanged(oldEntity, entity)) {
          // Updated entity - merge with existing to preserve junction data
          const preservedJunctionFields = ['tags', 'members']; // Common junction fields
          const mergedEntity = { ...entity };
          
          // Preserve junction fields that exist in the old entity but not in the new raw entity
          preservedJunctionFields.forEach(field => {
            if (oldEntity[field] && !entity[field]) {
              mergedEntity[field] = oldEntity[field];
              log.info(`📊 TableStore: Preserving junction field '${field}' for entity ${entity.id}`);
            }
          });
          
          const finalEntity = resolveEntity(mergedEntity, storeSnapshot.context.relationships);
          
          changes.push({
            id: entity.id,
            operation: 'update',
            data: finalEntity,
            resolved: finalEntity,
            changedFields: getChangedFields(oldEntity, finalEntity)
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
        log.info('📊 TableStore: Sending entity changes', { changeCount: changes.length });
        storeActor.send({ type: 'ENTITIES_CHANGED', changes });
      }
    },
    error: (error) => {
      log.error('❌ TableStore: Entity subscription error', error);
      storeActor.send({ type: 'SET_ERROR', error: error.message });
    }
  });
  
  subscriptions.push(entitySub);
  
  // Subscribe to relationship data dynamically based on columns
  if (columns) {
    const uniqueTables = getUniqueRelationshipTables(columns);
    log.info('📊 TableStore: Subscribing to relationship tables:', uniqueTables);
    
    uniqueTables.forEach(tableName => {
      const table = (db as any)[tableName];
      if (!table) {
        log.warn('⚠️ TableStore: No table found for relationship:', tableName);
        return;
      }
      
      const sub = liveQuery(() => table.toArray()).subscribe({
        next: (data) => {
          // Ignore the first change event as relationship data is already loaded in useTableData
          if (!firstChangeFlags.has(tableName)) {
            firstChangeFlags.set(tableName, true);
            log.info('📊 TableStore: Ignoring first relationship subscription event for', tableName);
            return;
          }
          
          storeActor.send({ type: 'RELATIONSHIP_DATA_UPDATED', table: tableName, data });
          
          // Only reprocess if this relationship table actually affects the display
          // Check if any of the relationship configs use this table
          if (columns) {
            const relationshipConfigs = discoverRelationships(columns);
            const usesThisTable = relationshipConfigs.some(config => config.relationshipTable === tableName);
            
            if (usesThisTable) {
              const storeSnapshot = storeActor.getSnapshot();
              if (storeSnapshot && storeSnapshot.context.entities && Object.keys(storeSnapshot.context.entities).length > 0) {
                log.info(`📊 TableStore: Relationship table ${tableName} affects display, debouncing reprocess`);
                debounceReprocess();
              }
            }
          }
        },
        error: (error) => {
          log.error(`❌ TableStore: ${tableName} subscription error`, error);
        }
      });
      
      subscriptions.push(sub);
    });
  }
  
  // Return cleanup function
  return () => {
    log.info('📊 TableStore: Cleaning up subscriptions');
    if (reprocessTimeout) {
      clearTimeout(reprocessTimeout);
    }
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
  log.info('📊 TableStore: Creating store logic for', entityType, {
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
