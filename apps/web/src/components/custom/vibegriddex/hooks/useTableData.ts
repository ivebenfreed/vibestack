import { useEffect, useRef } from 'react';
import { db } from '@repo/dataforge/dexie-schema';
import { createTableStoreActor, setupDexieSubscriptions } from '../stores/table-data-store';
import { createActor } from 'xstate';
import type { TableDataResult } from '../stores/types';
import { discoverRelationships, getUniqueRelationshipTables, resolveEntityRelationships } from '../utils/relationship-discovery';
import type { Column } from '../types';
import { domainServices } from '@/domain';

// ====================================
// CACHE MANAGEMENT
// ====================================

// Cache for promises to enable Suspense
const promiseCache = new Map<string, Promise<TableDataResult>>();
const resultCache = new Map<string, TableDataResult>();

// ====================================
// OPTIMIZED DATA FETCHING
// ====================================

/**
 * Fetch table data with optimized Dexie queries
 * Only fetches id/name for relationships
 */
async function fetchTableData(entityType: string, columns?: Column[]): Promise<TableDataResult> {
  console.log('🔍 useTableData: Fetching data for', entityType);
  const startTime = performance.now();
  
  try {
    // Fetch main entities
    const entityTableName = `${entityType}s`;
    const entities = await db[entityTableName].toArray();
    
    console.log('🔍 useTableData: Entities fetched', {
      table: entityTableName,
      count: entities.length
    });
    
    // Dynamic relationship data based on columns
    const relationshipData: Record<string, any> = {};
    let resolvedEntities = entities;
    
    if (columns) {
      // Discover relationships from columns
      const relationshipConfigs = discoverRelationships(columns);
      const uniqueTables = getUniqueRelationshipTables(columns);
      
      console.log('🔍 useTableData: Discovered relationships', {
        tables: uniqueTables,
        configs: relationshipConfigs.length
      });
      
      // 1. First, handle junction tables for many-to-many relationships
      const junctionDataMap = new Map<string, Map<string, string[]>>();
      
      // Find columns with junction tables
      const junctionColumns = columns.filter(col => 
        col.cellType === 'relationship-multi' && col.junctionTable
      );
      
      console.log('🔍 useTableData: Processing junction tables', {
        junctionColumns: junctionColumns.map(col => ({
          columnId: col.id,
          junctionTable: col.junctionTable,
          sourceField: col.junctionSourceField,
          targetField: col.junctionTargetField
        }))
      });
      
      // Load junction table data using domain services
      for (const column of junctionColumns) {
        if (!column.junctionTable || !column.junctionSourceField || !column.junctionTargetField) {
          console.warn('⚠️ useTableData: Missing junction table config for column:', column.id);
          continue;
        }
        
        let relationshipMap: Map<string, string[]>;
        
        // Use appropriate domain service based on the relationship type
        if (column.junctionTable === 'task_tags' && entityType === 'task') {
          const entityIds = entities.map(e => e.id);
          console.log(`🔍 useTableData: Loading task tags for ${entityIds.length} tasks:`, entityIds);
          relationshipMap = await domainServices.task.getTagsForTasks(entityIds);
          console.log(`🔍 useTableData: Loaded task tags using domain service:`, relationshipMap);
        } else if (column.junctionTable === 'project_members' && entityType === 'project') {
          const entityIds = entities.map(e => e.id);
          console.log(`🔍 useTableData: Loading project members for ${entityIds.length} projects:`, entityIds);
          relationshipMap = await domainServices.project.getMembersForProjects(entityIds);
          console.log(`🔍 useTableData: Loaded project members using domain service:`, relationshipMap);
        } else {
          // Fallback to raw query for unsupported junction tables
          console.warn('⚠️ useTableData: No domain service for junction table:', column.junctionTable);
          const junctionTable = (db as any)[column.junctionTable];
          if (!junctionTable) {
            console.warn('⚠️ useTableData: Junction table not found:', column.junctionTable);
            continue;
          }
          
          const junctionRecords = await junctionTable.toArray();
          relationshipMap = new Map<string, string[]>();
          junctionRecords.forEach((record: any) => {
            const sourceId = record[column.junctionSourceField];
            const targetId = record[column.junctionTargetField];
            
            if (!relationshipMap.has(sourceId)) {
              relationshipMap.set(sourceId, []);
            }
            relationshipMap.get(sourceId)!.push(targetId);
          });
        }
        
        junctionDataMap.set(column.field || column.id, relationshipMap);
      }
      
      // 2. Apply junction data to entities
      const entitiesWithJunctions = entities.map(entity => {
        const enhanced = { ...entity };
        
        junctionDataMap.forEach((relationshipMap, fieldName) => {
          const relatedIds = relationshipMap.get(entity.id) || [];
          enhanced[fieldName] = relatedIds;
          
          // Only log if debugging specific entities
          if (fieldName === 'tags' && relatedIds.length > 0 && entity.id.startsWith('debug')) {
            console.log(`🔍 useTableData: Applied tags to task ${entity.id}:`, relatedIds);
          }
        });
        
        return enhanced;
      });
      
      // 3. Extract unique IDs for each relationship (now including junction relationships)
      const idsByTable = new Map<string, Set<string>>();
      
      relationshipConfigs.forEach(config => {
        if (!idsByTable.has(config.relationshipTable)) {
          idsByTable.set(config.relationshipTable, new Set());
        }
        const ids = idsByTable.get(config.relationshipTable)!;
        
        entitiesWithJunctions.forEach(entity => {
          const value = entity[config.fieldName];
          if (value) {
            if (Array.isArray(value)) {
              value.forEach(id => ids.add(id));
            } else {
              ids.add(value);
            }
          }
        });
      });
      
      // 4. Fetch all relationship data in parallel
      const fetchPromises = Array.from(idsByTable.entries()).map(async ([tableName, ids]) => {
        if (ids.size === 0) return { tableName, data: [] };
        
        const table = (db as any)[tableName];
        if (!table) {
          console.warn('⚠️ useTableData: No table found for:', tableName);
          return { tableName, data: [] };
        }
        
        const data = await table
          .where('id')
          .anyOf(Array.from(ids))
          .toArray();
          
        console.log(`🔍 useTableData: Loaded ${data.length} records from ${tableName} for ${ids.size} IDs`);
        return { tableName, data };
      });
      
      const results = await Promise.all(fetchPromises);
      
      // 5. Build relationship maps
      results.forEach(({ tableName, data }) => {
        relationshipData[tableName] = {};
        data.forEach((item: any) => {
          relationshipData[tableName][item.id] = item;
        });
      });
      
      // 6. Pre-resolve entities (using entities with junction data)
      resolvedEntities = entitiesWithJunctions.map(entity => 
        resolveEntityRelationships(entity, relationshipData, relationshipConfigs)
      );
      
      console.log('🔍 useTableData: Relationship resolution complete', {
        resolvedEntitiesCount: resolvedEntities.length,
        relationshipTablesLoaded: Object.keys(relationshipData).length
      });
    }
    
    const fetchTime = performance.now() - startTime;
    console.log('🔍 useTableData: Data fetched in', fetchTime.toFixed(2) + 'ms', {
      entities: entities.length,
      relationshipTables: Object.keys(relationshipData).length
    });
    
    // Create store actor with columns for initial state
    const storeLogic = createTableStoreActor(entityType, columns);
    const storeActor = createActor(storeLogic);
    
    // Add snapshot listener for debugging
    storeActor.subscribe({
      next: (snapshot) => {
        console.log('🔍 useTableData: Store actor snapshot emitted', {
          entityType,
          entitiesCount: snapshot.context?.entities ? Object.keys(snapshot.context.entities).length : 0,
          loading: snapshot.context?.loading,
          snapshotEmittedAt: performance.now()
        });
      },
      error: (error) => {
        console.error('❌ useTableData: Store actor error', error);
      }
    });
    
    // Start the actor
    console.log('🔍 useTableData: Starting store actor');
    storeActor.start();
    console.log('🔍 useTableData: Store actor started', {
      status: storeActor.getSnapshot().status
    });
    
    // Send initial entities to store
    storeActor.send({
      type: 'ENTITIES_LOADED',
      entities: resolvedEntities
    });
    
    // Send relationship data to store
    Object.entries(relationshipData).forEach(([tableName, tableData]) => {
      const dataArray = Object.values(tableData);
      if (dataArray.length > 0) {
        storeActor.send({
          type: 'RELATIONSHIP_DATA_UPDATED',
          table: tableName,
          data: dataArray
        });
      }
    });
    
    // Set up Dexie subscriptions with columns for dynamic relationships
    const cleanup = setupDexieSubscriptions(storeActor, entityType, columns);
    
    // Store cleanup function for later
    (storeActor as any).__cleanup = cleanup;
    
    const result = {
      store: storeActor, // Pass the started actor with initial data loaded
      relationshipData
    };
    
    // Cache the result
    resultCache.set(entityType, result);
    
    return result;
  } catch (error) {
    console.error('❌ useTableData: Error fetching data', error);
    throw error;
  }
}

// ====================================
// SUSPENSE HOOK
// ====================================

/**
 * Suspense-enabled hook for fetching table data
 * Throws a promise during loading for Suspense boundary
 */
export function useTableData(entityType: string, columns?: Column[]): TableDataResult {
  const cacheKey = entityType;
  const promiseRef = useRef<Promise<TableDataResult>>();
  
  // Check if we have a cached result
  if (resultCache.has(cacheKey)) {
    return resultCache.get(cacheKey)!;
  }
  
  // Check if we already have a promise for this entity type
  let promise = promiseCache.get(cacheKey);
  
  if (!promise) {
    // Create a new promise and cache it
    promise = fetchTableData(entityType, columns);
    promiseCache.set(cacheKey, promise);
    
    // Clean up promise cache on resolution
    promise.then(() => {
      promiseCache.delete(cacheKey);
    }).catch(() => {
      promiseCache.delete(cacheKey);
    });
  }
  
  // Store promise in ref to avoid recreating
  promiseRef.current = promise;
  
  // Throw the promise for React Suspense
  throw promise;
}

// ====================================
// PREFETCH HELPER
// ====================================

/**
 * Prefetch table data to warm the cache
 * Useful for optimistic navigation
 */
export function prefetchTableData(entityType: string): void {
  // Start fetching but don't await
  fetchTableData(entityType).catch(error => {
    console.error('❌ prefetchTableData: Error', error);
  });
}

// ====================================
// CACHE INVALIDATION
// ====================================

/**
 * Clear cached data for a specific entity type
 */
export function invalidateTableData(entityType: string): void {
  const cacheKey = entityType;
  promiseCache.delete(cacheKey);
  resultCache.delete(cacheKey);
}