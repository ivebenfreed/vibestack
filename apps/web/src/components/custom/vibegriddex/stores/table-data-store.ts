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

export interface TableStoreContext {
  entityType: string;
  entities: Record<string, any>;
  relationships: Record<string, Record<string, any>>; // Dynamic relationship tables
  loading: boolean;
  error: string | null;
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
  | { type: 'SET_ERROR'; error: string | null };

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

// ====================================
// STORE LOGIC
// ====================================

/**
 * Create XState Store logic for table data with atomic updates
 * This returns actor logic that can be used with createActor
 */
export const createTableStoreLogic = (entityType: string) => {
  return fromStore<TableStoreContext, TableStoreEvent>({
    context: {
      entityType,
      entities: {},
      relationships: {}, // Dynamic - will be populated based on columns
      loading: true,
      error: null
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
        
        return {
          ...context,
          entities,
          loading: false,
          error: null
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
        
        if (operation === 'delete') {
          const { [id]: removed, ...rest } = context.entities;
          return {
            ...context,
            entities: rest
          };
        }
        
        return {
          ...context,
          entities: {
            ...context.entities,
            [id]: data
          }
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
        
        return {
          ...context,
          entities: newEntities
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
      })
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
export function createTableStoreActor(entityType: string) {
  console.log('📊 TableStore: Creating store logic for', entityType);
  
  // fromStore returns actor logic, not a store instance
  // This logic can be passed to createActor
  return createTableStoreLogic(entityType);
}
