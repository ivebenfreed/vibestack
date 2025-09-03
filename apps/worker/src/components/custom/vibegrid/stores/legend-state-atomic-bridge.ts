/**
 * Legend State Atomic Bridge for ViBegrid
 * 
 * Optimal integration pattern that combines:
 * 1. Legend State observe() for atomic change detection  
 * 2. XState Store for table coordination state
 * 3. Efficient selective updates without manual comparison
 */

import React from 'react';
import { observe, when, batch } from '@legendapp/state';
import { getEntity$, getUniverseEntity$, orgContext$ } from '@/legend-state/observables';
import { fromStore } from '@xstate/store';
import { uiLog } from '@/logger';

const log = uiLog('components/custom/vibegrid/stores/legend-state-atomic-bridge.ts');

// ====================================
// ATOMIC OBSERVABLE BRIDGE
// ====================================

/**
 * Creates an atomic bridge between Legend State observables and XState table machine
 * Uses Legend State's built-in reactivity instead of manual change detection
 */
export function createAtomicObservableBridge(
  entityTableName: string,
  tableSend: (event: any) => void
) {
  log.info(`🔗 AtomicBridge: Creating for ${entityTableName}`);
  
  let isInitialized = false;
  
  // PATTERN 1: Manual change tracking with observe() - fixes Legend State reactivity issues
  // This manually tracks previous state since Legend State's 'previous' parameter isn't reliable
  let previousEntityData: any = null;
  let observerRunCount = 0;
  
  const entityDataDisposer = observe(() => {
    observerRunCount++;
    log.info(`🔗 AtomicBridge: Manual change tracking observer running for ${entityTableName}`, {
      runCount: observerRunCount,
      timestamp: Date.now(),
      hasPreviousData: !!previousEntityData
    });
    
    try {
      // CRITICAL FIX: Handle org-prefixed entity names in universe context
      // When we're in org routes like /org/123/entities/Task, the entity is stored as "123_Task" in universe mode
      let actualEntityName = entityTableName;
      
      // Check if we're in universe mode and need to construct org-prefixed name
      const orgContextData = orgContext$.get();
      if (orgContextData.orgId === 'universe' && orgContextData.schema?.entities) {
        // Find the org-prefixed version of this entity in the schema
        const entityKeys = Object.keys(orgContextData.schema.entities);
        const orgPrefixedKey = entityKeys.find(key => {
          // Look for pattern: "{orgId}_{entityName}" where entityName matches our target
          const parts = key.split('_');
          return parts.length === 2 && parts[1] === entityTableName;
        });
        
        if (orgPrefixedKey) {
          actualEntityName = orgPrefixedKey;
          log.info(`🔗 AtomicBridge: Using org-prefixed entity name ${actualEntityName} instead of ${entityTableName}`);
        }
      }
      
      // Use the getUniverseEntity$ function which handles org-prefixed names correctly
      const entityObservable = actualEntityName.includes('_') ? 
        getUniverseEntity$(actualEntityName) : 
        getEntity$(actualEntityName);
      
      if (!entityObservable) {
        log.info(`🔗 AtomicBridge: Entity observable ${actualEntityName} (original: ${entityTableName}) not available yet`);
        return;
      }
      
      // CRITICAL: Call .get() to both access data AND enable Legend State tracking
      let currentEntityData: any;
      
      try {
        // This .get() call enables Legend State tracking in the observe()
        currentEntityData = entityObservable.get();
      } catch (accessError) {
        log.warn(`🔗 AtomicBridge: Could not access entity data (likely still initializing):`, accessError?.message || accessError);
        return;
      }
      
      if (!currentEntityData || (typeof currentEntityData === 'object' && Object.keys(currentEntityData).length === 0)) {
        log.info(`🔗 AtomicBridge: Entity data ${entityTableName} is empty or null`);
        return;
      }
      
      // FIXED: Manual change detection with proper state tracking
      const isInitialLoad = !isInitialized || !previousEntityData;
      
      log.info(`🔗 AtomicBridge: Manual change detection analysis`, {
        entityTableName,
        isInitialLoad,
        currentDataType: typeof currentEntityData,
        currentKeys: currentEntityData && typeof currentEntityData === 'object' ? Object.keys(currentEntityData).length : 'not-object',
        previousDataType: typeof previousEntityData,
        previousKeys: previousEntityData && typeof previousEntityData === 'object' ? Object.keys(previousEntityData).length : 'not-object',
        observerRunCount
      });
      
      if (isInitialLoad) {
        // Initial load - send all data and store current state as previous
        let entities: any[];
        if (typeof currentEntityData === 'object' && !Array.isArray(currentEntityData)) {
          entities = Object.values(currentEntityData);
        } else if (Array.isArray(currentEntityData)) {
          entities = currentEntityData;
        } else {
          log.info(`🔗 AtomicBridge: Unexpected entity data format for ${entityTableName}:`, typeof currentEntityData);
          return;
        }
        
        log.info('🚀 AtomicBridge: INITIAL LOAD - Sending all entities to table', {
          entityTableName,
          entityCount: entities.length,
          timestamp: Date.now()
        });
        
        tableSend({
          type: 'STORE_DATA_UPDATED',
          entities,
          loading: false,
          source: 'atomic_bridge_initial'
        });
        
        // Store current state for next comparison
        previousEntityData = JSON.parse(JSON.stringify(currentEntityData));
        isInitialized = true;
        log.info(`✅ AtomicBridge: ${entityTableName} bridge initialized and working`);
        return;
      }
      
      // FIXED: Incremental change detection with manual comparison
      const changedEntities: any[] = [];
      const currentEntities = typeof currentEntityData === 'object' && !Array.isArray(currentEntityData) 
        ? currentEntityData 
        : {};
      const previousEntities = typeof previousEntityData === 'object' && !Array.isArray(previousEntityData) 
        ? previousEntityData 
        : {};
      
      // Find new and updated entities
      Object.keys(currentEntities).forEach(entityId => {
        const currentEntity = currentEntities[entityId];
        const previousEntity = previousEntities[entityId];
        
        if (!previousEntity) {
          // New entity
          log.info(`🔗 AtomicBridge: NEW entity detected`, { entityId, entityTableName });
          changedEntities.push(currentEntity);
        } else {
          // Check if entity actually changed (deep comparison)
          const hasChanged = JSON.stringify(currentEntity) !== JSON.stringify(previousEntity);
          if (hasChanged) {
            log.info(`🔗 AtomicBridge: UPDATED entity detected`, { 
              entityId, 
              entityTableName,
              currentName: currentEntity.name,
              previousName: previousEntity.name,
              currentUpdatedAt: currentEntity.updated_at,
              previousUpdatedAt: previousEntity.updated_at
            });
            changedEntities.push(currentEntity);
          }
        }
      });
      
      // Find deleted entities (present in previous but not in current)
      const deletedEntityIds: string[] = [];
      Object.keys(previousEntities).forEach(entityId => {
        if (!currentEntities[entityId]) {
          log.info(`🔗 AtomicBridge: DELETED entity detected`, { entityId, entityTableName });
          deletedEntityIds.push(entityId);
        }
      });
      
      // Process changes
      if (changedEntities.length > 0) {
        log.info('🚀 AtomicBridge: INCREMENTAL CHANGES DETECTED - Using atomic updates', {
          entityTableName,
          changedCount: changedEntities.length,
          totalEntities: Object.keys(currentEntities).length,
          timestamp: Date.now(),
          changedEntityIds: changedEntities.map(e => e.id),
          trigger: 'MANUAL_CHANGE_DETECTION'
        });
        
        if (changedEntities.length === 1) {
          // Single entity update - use atomic update
          tableSend({
            type: 'updateEntityAtomic',
            entity: changedEntities[0],
            source: 'atomic_bridge_incremental'
          });
        } else {
          // Multiple entities - use batch atomic update
          tableSend({
            type: 'batchUpdateEntitiesAtomic',
            entities: changedEntities,
            source: 'atomic_bridge_batch'
          });
        }
      }
      
      if (deletedEntityIds.length > 0) {
        log.info('🚀 AtomicBridge: DELETIONS DETECTED - Sending full refresh', {
          entityTableName,
          deletedCount: deletedEntityIds.length,
          deletedIds: deletedEntityIds
        });
        
        // For deletions, send full data update since table needs to remove rows
        const entities = Object.values(currentEntities);
        tableSend({
          type: 'STORE_DATA_UPDATED',
          entities,
          loading: false,
          source: 'atomic_bridge_deletion'
        });
      }
      
      if (changedEntities.length === 0 && deletedEntityIds.length === 0) {
        log.info(`🔗 AtomicBridge: No actual changes detected for ${entityTableName} (observer run ${observerRunCount})`);
      }
      
      // Always update previous state for next comparison
      previousEntityData = JSON.parse(JSON.stringify(currentEntityData));
      
    } catch (error) {
      console.error(`🔗 AtomicBridge: Error in manual change tracking observer for ${entityTableName}:`, error);
    }
  });
  
  // PATTERN 2: Schema readiness observer
  // Ensures we react when the schema becomes available
  const schemaReadinessDisposer = when(
    () => {
      const context = orgContext$.get();
      return context.schema && !context.loading && context.orgId;
    },
    () => {
      log.info('🔗 AtomicBridge: Schema ready, triggering initial load');
      // Schema is ready - the entity observer above will now have data
    }
  );
  
  // PATTERN 3: Error state observer
  const errorStateDisposer = observe(() => {
    const context = orgContext$.get();
    if (context.error) {
      log.info('🔗 AtomicBridge: Error state detected', context.error);
      tableSend({
        type: 'STORE_ERROR',
        error: context.error
      });
    }
  });
  
  // Return cleanup function that disposes all observers
  return () => {
    log.info(`🔗 AtomicBridge: Cleaning up observers for ${entityTableName}`);
    
    // Safely dispose of observers only if they are functions
    if (typeof entityDataDisposer === 'function') {
      entityDataDisposer();
    }
    
    if (typeof schemaReadinessDisposer === 'function') {
      schemaReadinessDisposer();
    }
    
    if (typeof errorStateDisposer === 'function') {
      errorStateDisposer();
    }
  };
}

// ====================================
// ENHANCED ATOMIC STORE LOGIC
// ====================================

/**
 * Enhanced atomic store that works optimally with Legend State observables
 * Removes manual change detection in favor of Legend State's built-in reactivity
 */
export const createLegendStateAtomicStore = (entityType: string, columns?: any[]) => {
  const persistedState = loadDisplayState(entityType);
  
  // Initialize columns with correct order
  let initialColumns = columns || [];
  if (persistedState?.columnOrder && columns) {
    const columnMap = new Map(columns.map(col => [col.id, col]));
    initialColumns = persistedState.columnOrder
      .map(id => columnMap.get(id))
      .filter(Boolean) as any[];
    
    const orderedIds = new Set(persistedState.columnOrder);
    const newColumns = columns.filter(col => !orderedIds.has(col.id));
    initialColumns.push(...newColumns);
  }
  
  return fromStore({
    context: {
      entityType,
      columns: initialColumns,
      entities: {} as Record<string, any>,
      relationships: {} as Record<string, Record<string, any>>,
      processedRows: [] as any[],
      sortBy: persistedState?.sortBy || [],
      filters: persistedState?.filters || [],
      columnVisibility: persistedState?.columnVisibility || {},
      columnWidths: persistedState?.columnWidths || {},
      loading: true,
      error: null as string | null,
      lastProcessedAt: 0,
      
      // Legend State integration metadata
      legendStateObserver: null as any,
      atomicUpdateCount: 0,
      lastAtomicUpdate: 0
    },
    
    on: {
      // ATOMIC: Set initial data from Legend State
      setInitialDataAtomic: {
        entities: (context, event: { entities: Record<string, any>, relationships: Record<string, Record<string, any>> }) => {
          log.info('📊 AtomicStore: Setting entities atomically', {
            entityCount: Object.keys(event.entities).length,
            source: 'legend_state_atomic'
          });
          return event.entities;
        },
        relationships: (context, event) => event.relationships,
        processedRows: (context, event) => {
          const entityValues = Object.values(event.entities);
          let processedRows = entityValues.map((entity: any) => ({
            id: entity.id,
            data: entity,
            metadata: {
              isSelected: false,
              isDirty: false,
              isGroup: false,
              level: 0
            }
          }));
          
          // Apply persisted sort atomically
          if (context.sortBy.length > 0) {
            processedRows = applySortAtomic(processedRows, context.sortBy);
          }
          
          return processedRows;
        },
        loading: false,
        error: null,
        lastProcessedAt: Date.now(),
        atomicUpdateCount: (context) => context.atomicUpdateCount + 1,
        lastAtomicUpdate: Date.now()
      },
      
      // ATOMIC: Update single entity with optimal performance
      updateEntityAtomic: {
        entities: (context, event: { entity: any }) => {
          log.info('📊 AtomicStore: Atomic entity update', {
            entityId: event.entity.id,
            entityType: context.entityType
          });
          
          return {
            ...context.entities,
            [event.entity.id]: event.entity
          };
        },
        processedRows: (context, event) => {
          const rowIndex = context.processedRows.findIndex(row => row.id === event.entity.id);
          let updatedRows: any[];
          
          if (rowIndex !== -1) {
            // Update existing row atomically
            updatedRows = [...context.processedRows];
            updatedRows[rowIndex] = {
              ...updatedRows[rowIndex],
              data: event.entity
            };
          } else {
            // Add new entity
            updatedRows = [...context.processedRows, {
              id: event.entity.id,
              data: event.entity,
              metadata: { isSelected: false, isDirty: false, isGroup: false, level: 0 }
            }];
          }
          
          // Re-sort if needed (atomic sort application)
          if (context.sortBy.length > 0) {
            const needsResort = context.sortBy.some(sort => 
              sort.field === 'updatedAt' || 
              (rowIndex !== -1 && context.processedRows[rowIndex].data[sort.field] !== event.entity[sort.field])
            );
            
            if (needsResort) {
              updatedRows = applySortAtomic(updatedRows, context.sortBy);
            }
          }
          
          return updatedRows;
        },
        lastProcessedAt: Date.now(),
        atomicUpdateCount: (context) => context.atomicUpdateCount + 1,
        lastAtomicUpdate: Date.now()
      },
      
      // ATOMIC: Batch entity updates for optimal performance
      batchUpdateEntitiesAtomic: {
        entities: (context, event: { entities: any[] }) => {
          log.info('📊 AtomicStore: Batch atomic update', {
            entityCount: event.entities.length,
            entityType: context.entityType
          });
          
          // Use batch() for optimal Legend State performance
          const newEntities = { ...context.entities };
          event.entities.forEach(entity => {
            newEntities[entity.id] = entity;
          });
          
          return newEntities;
        },
        processedRows: (context, event) => {
          // Batch update processed rows atomically
          let updatedRows = [...context.processedRows];
          const entityMap = new Map(event.entities.map(e => [e.id, e]));
          
          // Update existing rows and track new ones
          const existingIds = new Set(updatedRows.map(r => r.id));
          const newEntities: any[] = [];
          
          event.entities.forEach(entity => {
            if (existingIds.has(entity.id)) {
              const rowIndex = updatedRows.findIndex(r => r.id === entity.id);
              if (rowIndex !== -1) {
                updatedRows[rowIndex] = {
                  ...updatedRows[rowIndex],
                  data: entity
                };
              }
            } else {
              newEntities.push({
                id: entity.id,
                data: entity,
                metadata: { isSelected: false, isDirty: false, isGroup: false, level: 0 }
              });
            }
          });
          
          // Add new entities
          updatedRows.push(...newEntities);
          
          // Re-sort if needed
          if (context.sortBy.length > 0) {
            updatedRows = applySortAtomic(updatedRows, context.sortBy);
          }
          
          return updatedRows;
        },
        lastProcessedAt: Date.now(),
        atomicUpdateCount: (context) => context.atomicUpdateCount + 1,
        lastAtomicUpdate: Date.now()
      },
      
      // Keep all existing events but mark them as non-atomic for tracking
      setInitialData: {
        // Redirect to atomic version
        entities: (context, event) => context.entities,
        relationships: (context, event) => context.relationships,
        processedRows: (context, event) => context.processedRows,
        loading: false,
        error: null,
        lastProcessedAt: Date.now()
      }
    }
  });
};

// ====================================
// OPTIMIZED UTILITY FUNCTIONS
// ====================================

/**
 * Atomic sort application - optimized for Legend State reactive patterns
 */
function applySortAtomic(rows: any[], sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>) {
  if (sortBy.length === 0) return rows;
  
  return [...rows].sort((a, b) => {
    for (const sort of sortBy) {
      const aValue = a.data[sort.field];
      const bValue = b.data[sort.field];
      
      // Handle null/undefined
      if (aValue == null && bValue == null) continue;
      if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sort.direction === 'asc' ? -1 : 1;
      
      // Compare values based on type
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
}

/**
 * Display state persistence (same as before but with atomic metadata)
 */
const STORAGE_KEY_PREFIX = 'vibegridx_atomic_';

export function saveDisplayState(entityType: string, state: any) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${entityType}`;
    const displayState = {
      columnOrder: state.columns ? state.columns.map(c => c.id) : state.columnOrder,
      columnVisibility: state.columnVisibility,
      columnWidths: state.columnWidths,
      sortBy: state.sortBy,
      filters: state.filters,
      savedAt: new Date().toISOString(),
      atomicBridge: true, // Mark as atomic bridge version
      version: '1.0.0'
    };
    localStorage.setItem(key, JSON.stringify(displayState));
    log.info('📊 AtomicStore: Saved atomic display state', { entityType });
  } catch (error) {
    console.error('Failed to save atomic display state:', error);
  }
}

export function loadDisplayState(entityType: string): any | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${entityType}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      log.info('📊 AtomicStore: Loaded atomic display state', { entityType });
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load atomic display state:', error);
  }
  return null;
}

// ====================================
// LEGEND STATE INTEGRATION HELPERS
// ====================================

/**
 * Hook for components to use atomic observable bridge
 * Replaces manual useEntityRowChanges with atomic Legend State patterns
 */
export function useAtomicEntityBridge(
  entityTableName: string,
  tableSend: (event: any) => void,
  options: {
    enableBatching?: boolean;
    enableOptimisticUpdates?: boolean;
  } = {}
) {
  const { enableBatching = true, enableOptimisticUpdates = true } = options;
  
  React.useEffect(() => {
    log.info(`🔗 AtomicBridge: Setting up atomic bridge for ${entityTableName}`);
    
    // Create the atomic bridge with proper cleanup
    const cleanup = createAtomicObservableBridge(entityTableName, (event) => {
      if (enableBatching) {
        // Use Legend State batching for optimal performance
        batch(() => tableSend(event));
      } else {
        tableSend(event);
      }
    });
    
    return cleanup;
  }, [entityTableName, tableSend, enableBatching]);
  
  // Enhanced API for components
  return {
    // Trigger manual refresh if needed
    refresh: React.useCallback(() => {
      const entityObservable = getEntity$(entityTableName);
      if (entityObservable && typeof entityObservable.refresh === 'function') {
        entityObservable.refresh();
      }
    }, [entityTableName]),
    
    // Get current entity count atomically
    getEntityCount: React.useCallback(() => {
      const entityObservable = getEntity$(entityTableName);
      if (!entityObservable) return 0;
      
      const data = entityObservable.peek();
      if (typeof data === 'object' && !Array.isArray(data)) {
        return Object.keys(data).length;
      }
      return Array.isArray(data) ? data.length : 0;
    }, [entityTableName]),
    
    // Check if entity is ready
    isReady: React.useCallback(() => {
      const context = orgContext$.peek();
      const entityObservable = getEntity$(entityTableName);
      return !context.loading && !!entityObservable;
    }, [entityTableName])
  };
}

/**
 * Optimistic update helper that works with Legend State
 * For single field updates with atomic rollback
 */
export function createOptimisticEntityUpdater(entityTableName: string) {
  return {
    async updateField(entityId: string, field: string, value: any) {
      const entity$ = getEntity$(entityTableName);
      if (!entity$) throw new Error(`Entity ${entityTableName} not available`);
      
      // Get current value for rollback using .get() pattern
      const currentData = entity$.get();
      const currentEntity = currentData[entityId];
      const originalValue = currentEntity?.[field];
      
      log.info('🔄 OptimisticUpdater: Applying optimistic update', {
        entityTableName, entityId, field, value, originalValue
      });
      
      // Apply optimistic update using .get() and .set() pattern
      try {
        if (!currentEntity) {
          throw new Error(`Entity ${entityId} not found in ${entityTableName}`);
        }
        
        // ✅ CORRECT: Use .get() and .set() pattern
        const updatedEntity = { 
          ...currentEntity, 
          [field]: value, 
          updated_at: new Date().toISOString() 
        };
        
        const newData = { 
          ...currentData, 
          [entityId]: updatedEntity 
        };
        
        entity$.set(newData);
        
        // Return rollback function using the same pattern
        return () => {
          log.info('🔄 OptimisticUpdater: Rolling back', { entityId, field, originalValue });
          const rollbackData = entity$.get();
          const rollbackEntity = { 
            ...rollbackData[entityId], 
            [field]: originalValue 
          };
          const rollbackNewData = { 
            ...rollbackData, 
            [entityId]: rollbackEntity 
          };
          entity$.set(rollbackNewData);
        };
      } catch (error) {
        console.error('🔄 OptimisticUpdater: Failed to apply optimistic update', error);
        throw error;
      }
    }
  };
}

export default {
  createAtomicObservableBridge,
  createLegendStateAtomicStore,
  useAtomicEntityBridge,
  createOptimisticEntityUpdater
};