import { useEffect, useRef } from 'react';
import { db } from '@repo/dataforge/dexie-schema';
import { createTableStoreActor, setupDexieSubscriptions } from '../stores/table-data-store';
import { createActor } from 'xstate';
import type { TableDataResult } from '../stores/types';
import { discoverRelationships, getUniqueRelationshipTables, resolveEntityRelationships } from '../utils/relationship-discovery';
import type { Column } from '../types';

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
      
      // Extract unique IDs for each relationship
      const idsByTable = new Map<string, Set<string>>();
      
      relationshipConfigs.forEach(config => {
        if (!idsByTable.has(config.relationshipTable)) {
          idsByTable.set(config.relationshipTable, new Set());
        }
        const ids = idsByTable.get(config.relationshipTable)!;
        
        entities.forEach(entity => {
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
      
      // Fetch all relationship data in parallel
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
          
        return { tableName, data };
      });
      
      const results = await Promise.all(fetchPromises);
      
      // Build relationship maps
      results.forEach(({ tableName, data }) => {
        relationshipData[tableName] = {};
        data.forEach((item: any) => {
          relationshipData[tableName][item.id] = item;
        });
      });
      
      // Pre-resolve entities
      resolvedEntities = entities.map(entity => 
        resolveEntityRelationships(entity, relationshipData, relationshipConfigs)
      );
    }
    
    const fetchTime = performance.now() - startTime;
    console.log('🔍 useTableData: Data fetched in', fetchTime.toFixed(2) + 'ms', {
      entities: entities.length,
      relationshipTables: Object.keys(relationshipData).length
    });
    
    // Create store actor (fromCallback doesn't use input)
    const storeLogic = createTableStoreActor(entityType);
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