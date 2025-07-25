import { fromStore } from '@xstate/store';
import { db } from '@repo/dataforge/dexie-schema';
import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';
import { 
  discoverRelationships, 
  getUniqueRelationshipTables,
  getUniqueJunctionTables,
  resolveEntityRelationships,
  type RelationshipConfig
} from '../utils/relationship-discovery';

// ====================================
// MEMORY LIMITS FOR IN-MEMORY VS PAGINATION MODE
// ====================================

const MEMORY_LIMITS = {
  MAX_ROWS: 1000,        // Maximum rows to keep in memory
  MAX_CELLS: 10000,      // Maximum total cells (rows * columns)
  DEFAULT_PAGE_SIZE: 100 // Default page size when pagination is needed
};

// ====================================
// ATOMIC STORE WITH EVENT-BASED MUTATIONS
// ====================================

export const createTableStoreLogic = (entityType: string, columns?: any[]) => {
  // Load persisted display state
  const persistedState = loadDisplayState(entityType);
  
  return fromStore({
    context: {
      entityType,
      entities: {} as Record<string, any>, // Raw resolved entities
      relationships: {} as Record<string, Record<string, any>>, // Lookup tables
      processedRows: [] as any[], // Table-ready rows for renderer
      sortBy: persistedState?.sortBy || [] as Array<{ field: string; direction: 'asc' | 'desc' }>,
      filters: persistedState?.filters || [] as Array<{ field: string; operator: string; value: any }>,
      columnVisibility: persistedState?.columnVisibility || {} as Record<string, boolean>,
      columnOrder: persistedState?.columnOrder || [] as string[],
      columnWidths: persistedState?.columnWidths || {} as Record<string, number>, // Column width persistence
      hiddenColumnCount: 0, // Track number of hidden columns
      groupBy: persistedState?.groupBy || [] as string[], // Grouping configuration
      loading: true,
      error: null as string | null,
      lastProcessedAt: 0,
      // Pagination state - null when all data fits in memory
      pagination: null as {
        enabled: boolean,
        currentPage: number,
        pageSize: number,
        totalRows: number,
        totalPages: number,
      } | null
    },
    
    on: {
      // Event-based mutations for XState compatibility
      setInitialData: {
        entities: (context, event: { entities: Record<string, any>, relationships: Record<string, Record<string, any>> }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 TableStore: Setting entities', {
              entityCount: Object.keys(event.entities).length
            });
          }
          return event.entities;
        },
        relationships: (context, event) => event.relationships,
        processedRows: (context, event) => {
          // Convert entities to table rows
          const entityValues = Object.values(event.entities);
          const processedRows = entityValues.map((entity: any) => ({
            id: entity.id,
            data: entity, // This should contain fully resolved relationship data
            metadata: {
              isSelected: false,
              isDirty: false,
              isGroup: false,
              level: 0
            }
          }));
          
          // Debug: Show sample resolved entity to verify relationship resolution
          if (process.env.NODE_ENV === 'development' && entityValues.length > 0) {
            const sampleEntity = entityValues[0];
            console.log('📊 TableStore: Sample resolved entity:', {
              id: sampleEntity.id,
              title: sampleEntity.title,
              projectId: sampleEntity.projectId,
              projectName: sampleEntity.projectName || sampleEntity.__resolved_projectId,
              assigneeId: sampleEntity.assigneeId,
              assigneeName: sampleEntity.assigneeName || sampleEntity.__resolved_assigneeId,
              hasResolvedFields: Object.keys(sampleEntity).filter(k => k.includes('resolved') || k.includes('Name')).length > 0
            });
          }
          
          return processedRows;
        },
        loading: false,
        error: null,
        lastProcessedAt: Date.now(),
        // Initialize column visibility/order from columns if not already set
        columnVisibility: (context, event) => {
          if (columns && Object.keys(context.columnVisibility).length === 0) {
            return Object.fromEntries(columns.map(col => [col.id, true]));
          }
          return context.columnVisibility;
        },
        columnOrder: (context, event) => {
          if (columns && context.columnOrder.length === 0) {
            return columns.map(col => col.id);
          }
          return context.columnOrder;
        },
        hiddenColumnCount: (context) => {
          return Object.values(context.columnVisibility).filter(v => !v).length;
        }
      },
      
      updateEntity: {
        entities: (context, event: { entity: any }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 TableStore: Updating single entity atomically', {
              entityId: event.entity.id,
              entityType: context.entityType
            });
          }
          
          // Resolve entity with current relationships
          const relationshipConfigs = discoverRelationships(columns || []);
          const resolvedEntity = resolveEntityRelationships(event.entity, context.relationships, relationshipConfigs);
          
          return {
            ...context.entities,
            [event.entity.id]: resolvedEntity
          };
        },
        processedRows: (context, event) => {
          // Resolve entity with current relationships
          const relationshipConfigs = discoverRelationships(columns || []);
          const resolvedEntity = resolveEntityRelationships(event.entity, context.relationships, relationshipConfigs);
          
          // Update corresponding row in processedRows
          const rowIndex = context.processedRows.findIndex(row => row.id === event.entity.id);
          if (rowIndex !== -1) {
            const updatedRows = [...context.processedRows];
            updatedRows[rowIndex] = {
              ...updatedRows[rowIndex],
              data: resolvedEntity
            };
            return updatedRows;
          } else {
            // New entity - add to processed rows
            return [...context.processedRows, {
              id: event.entity.id,
              data: resolvedEntity,
              metadata: {
                isSelected: false,
                isDirty: false,
                isGroup: false,
                level: 0
              }
            }];
          }
        },
        lastProcessedAt: Date.now()
      },
      
      updateRelationshipTable: {
        relationships: (context, event: { table: string, data: any[] }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 TableStore: Updating relationship table atomically', {
              table: event.table,
              dataCount: event.data.length
            });
          }
          
          // Update relationship lookup table
          const relationshipLookup: Record<string, any> = {};
          event.data.forEach((item: any) => {
            relationshipLookup[item.id] = item;
          });
          
          return {
            ...context.relationships,
            [event.table]: relationshipLookup
          };
        },
        entities: (context, event) => {
          // Find entities that use this relationship and re-resolve them
          const relationshipConfigs = discoverRelationships(columns || []);
          const affectedConfigs = relationshipConfigs.filter(config => 
            config.relationshipTable === event.table
          );
          
          if (affectedConfigs.length > 0) {
            // Re-resolve affected entities
            const updatedEntities = { ...context.entities };
            Object.keys(updatedEntities).forEach(entityId => {
              const originalEntity = updatedEntities[entityId];
              const newResolvedEntity = resolveEntityRelationships(originalEntity, context.relationships, relationshipConfigs);
              updatedEntities[entityId] = newResolvedEntity;
            });
            return updatedEntities;
          }
          
          return context.entities;
        },
        processedRows: (context, event) => {
          // Re-process all rows if relationship affects entities
          const relationshipConfigs = discoverRelationships(columns || []);
          const affectedConfigs = relationshipConfigs.filter(config => 
            config.relationshipTable === event.table
          );
          
          if (affectedConfigs.length > 0) {
            return context.processedRows.map(row => ({
              ...row,
              data: context.entities[row.id] // Use re-resolved entities
            }));
          }
          
          return context.processedRows;
        },
        lastProcessedAt: Date.now()
      },
      
      deleteEntity: {
        entities: (context, event: { entityId: string }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 TableStore: Deleting entity atomically', {
              entityId: event.entityId,
              entityType: context.entityType
            });
          }
          
          const { [event.entityId]: deleted, ...rest } = context.entities;
          return rest;
        },
        processedRows: (context, event) => {
          return context.processedRows.filter(row => row.id !== event.entityId);
        },
        lastProcessedAt: Date.now()
      },
      
      setError: {
        error: (context, event: { error: string }) => event.error,
        loading: false
      },
      
      setLoading: {
        loading: (context, event: { loading: boolean }) => event.loading
      },
      
      setSortBy: {
        sortBy: (context, event: { sortBy: Array<{ field: string; direction: 'asc' | 'desc' }> }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 TableStore: Setting sort configuration', { sortBy: event.sortBy });
          }
          return event.sortBy;
        },
        processedRows: (context, event) => {
          // Re-sort processed rows
          if (event.sortBy.length > 0 && context.processedRows.length > 0) {
            return [...context.processedRows].sort((a, b) => {
              for (const sort of event.sortBy) {
                const aValue = a.data[sort.field];
                const bValue = b.data[sort.field];
                
                // Handle null/undefined
                if (aValue == null && bValue == null) continue;
                if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
                if (bValue == null) return sort.direction === 'asc' ? -1 : 1;
                
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
          }
          return context.processedRows;
        },
        lastProcessedAt: Date.now()
      },
      
      setFilters: {
        filters: (context, event: { filters: Array<{ field: string; operator: string; value: any }> }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 TableStore: Setting filters', { filters: event.filters });
          }
          return event.filters;
        },
        lastProcessedAt: Date.now()
      },
      
      setColumnVisibility: {
        columnVisibility: (context, event: { columnVisibility: Record<string, boolean> }) => event.columnVisibility,
        hiddenColumnCount: (context, event) => {
          const visibility = event.columnVisibility;
          return Object.values(visibility).filter(v => !v).length;
        }
      },
      
      toggleColumnVisibility: {
        columnVisibility: (context, event: { columnId: string }) => {
          const newVisibility = {
            ...context.columnVisibility,
            [event.columnId]: !context.columnVisibility[event.columnId]
          };
          return newVisibility;
        },
        hiddenColumnCount: (context, event) => {
          const newVisibility = {
            ...context.columnVisibility,
            [event.columnId]: !context.columnVisibility[event.columnId]
          };
          return Object.values(newVisibility).filter(v => !v).length;
        }
      },
      
      showAllColumns: {
        columnVisibility: (context) => {
          const allVisible: Record<string, boolean> = {};
          // Set all columns to visible
          if (columns) {
            columns.forEach(col => {
              allVisible[col.id] = true;
            });
          }
          // Also ensure any existing columns are visible
          Object.keys(context.columnVisibility).forEach(id => {
            allVisible[id] = true;
          });
          return allVisible;
        },
        hiddenColumnCount: 0
      },
      
      hideAllColumns: {
        columnVisibility: (context) => {
          const allHidden: Record<string, boolean> = {};
          // Set all columns to hidden except selection column
          if (columns) {
            columns.forEach(col => {
              allHidden[col.id] = col.id === '__selection' ? true : false;
            });
          }
          // Also hide any existing columns except selection
          Object.keys(context.columnVisibility).forEach(id => {
            allHidden[id] = id === '__selection' ? true : false;
          });
          return allHidden;
        },
        hiddenColumnCount: (context) => {
          let count = 0;
          if (columns) {
            count = columns.filter(col => col.id !== '__selection').length;
          }
          return count;
        }
      },
      
      setColumnOrder: {
        columnOrder: (context, event: { columnOrder: string[] }) => event.columnOrder
      },
      
      reorderColumns: {
        columnOrder: (context, event: { fromIndex: number; toIndex: number }) => {
          const newOrder = [...context.columnOrder];
          const [removed] = newOrder.splice(event.fromIndex, 1);
          newOrder.splice(event.toIndex, 0, removed);
          return newOrder;
        }
      },
      
      setColumnWidths: {
        columnWidths: (context, event: { columnWidths: Record<string, number> }) => event.columnWidths
      },
      
      setColumnWidth: {
        columnWidths: (context, event: { columnId: string; width: number }) => ({
          ...context.columnWidths,
          [event.columnId]: event.width
        })
      },
      
      setGroupBy: {
        // Group by not implemented yet - just store the value
        groupBy: (context, event: { groupBy: string[] }) => event.groupBy || []
      },
      
      setPagination: {
        pagination: (context, event: { pagination: typeof context.pagination }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('📊 TableStore: Setting pagination', { pagination: event.pagination });
          }
          return event.pagination;
        }
      },
      
      changePage: {
        pagination: (context, event: { page: number }) => {
          if (!context.pagination) return null;
          return {
            ...context.pagination,
            currentPage: event.page
          };
        },
        loading: true
      }
    }
  });
};

// ====================================
// INITIAL DATA LOADER (Promise-based)
// ====================================

export async function loadInitialData(entityType: string, columns?: any[], page?: number) {
  const entityTableName = `${entityType}s`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 TableStore: Loading initial data', {
      entityType,
      entityTable: entityTableName,
      page: page || 'all'
    });
  }
  
  // First, check if we need pagination
  const totalCount = await db[entityTableName].count();
  const columnCount = columns?.length || 10;
  const totalCells = totalCount * columnCount;
  
  // Determine if pagination is needed
  const needsPagination = totalCount > MEMORY_LIMITS.MAX_ROWS || totalCells > MEMORY_LIMITS.MAX_CELLS;
  
  let entities: any[];
  let paginationInfo = null;
  
  if (needsPagination) {
    // Calculate page size to respect cell limit
    const pageSize = Math.min(
      MEMORY_LIMITS.DEFAULT_PAGE_SIZE,
      Math.floor(MEMORY_LIMITS.MAX_CELLS / columnCount)
    );
    const currentPage = page || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Load only current page
    entities = await db[entityTableName]
      .offset(currentPage * pageSize)
      .limit(pageSize)
      .toArray();
    
    paginationInfo = {
      enabled: true,
      currentPage,
      pageSize,
      totalRows: totalCount,
      totalPages
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 TableStore: Pagination enabled', paginationInfo);
    }
  } else {
    // Load all data
    entities = await db[entityTableName].toArray();
  }
  
  // Get relationship tables and junction tables we need to load
  const relationshipTables = columns ? getUniqueRelationshipTables(columns) : [];
  const junctionTables = columns ? getUniqueJunctionTables(columns) : [];
  const relationshipConfigs = columns ? discoverRelationships(columns) : [];
  
  // Load relationships and junctions in parallel
  const [relationshipDataArrays, junctionDataArrays] = await Promise.all([
    Promise.all(relationshipTables.map(tableName => (db as any)[tableName].toArray())),
    Promise.all(junctionTables.map(tableName => (db as any)[tableName].toArray()))
  ]);
  
  // Build relationship lookup tables
  const relationships: Record<string, Record<string, any>> = {};
  relationshipTables.forEach((tableName, index) => {
    const relationshipLookup: Record<string, any> = {};
    relationshipDataArrays[index].forEach((item: any) => {
      relationshipLookup[item.id] = item;
    });
    relationships[tableName] = relationshipLookup;
  });
  
  // Process junction data to add to entities
  const junctionsByEntity: Record<string, Record<string, string[]>> = {};
  junctionTables.forEach((tableName, index) => {
    const junctionData = junctionDataArrays[index];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 TableStore: Processing junction table', {
        tableName,
        junctionDataCount: junctionData.length,
        sampleJunction: junctionData[0]
      });
    }
    
    // Find which relationship config uses this junction table
    const config = relationshipConfigs.find(c => c.junctionTable === tableName);
    if (config) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 TableStore: Found config for junction table', {
          tableName,
          fieldName: config.fieldName,
          sourceField: config.junctionSourceField,
          targetField: config.junctionTargetField
        });
      }
      
      junctionData.forEach((junction: any) => {
        // For task_tags, the fields are taskId and tagId
        const entityId = tableName === 'task_tags' ? junction.taskId : junction[config.junctionSourceField!];
        const targetId = tableName === 'task_tags' ? junction.tagId : junction[config.junctionTargetField!];
        
        if (entityId && targetId) {
          if (!junctionsByEntity[entityId]) {
            junctionsByEntity[entityId] = {};
          }
          if (!junctionsByEntity[entityId][config.fieldName]) {
            junctionsByEntity[entityId][config.fieldName] = [];
          }
          junctionsByEntity[entityId][config.fieldName].push(targetId);
        }
      });
    } else {
      console.warn('📊 TableStore: No config found for junction table', tableName);
    }
  });
  
  if (process.env.NODE_ENV === 'development') {
    const entitiesWithJunctions = Object.keys(junctionsByEntity).length;
    console.log('📊 TableStore: Junction data processed', {
      entitiesWithJunctionData: entitiesWithJunctions,
      sampleEntityId: Object.keys(junctionsByEntity)[0],
      sampleJunctionData: junctionsByEntity[Object.keys(junctionsByEntity)[0]]
    });
  }
  
  // Resolve all entities to final table shape
  const resolvedEntities: Record<string, any> = {};
  entities.forEach(entity => {
    // Merge junction data into entity
    const entityWithJunctions = {
      ...entity,
      ...(junctionsByEntity[entity.id] || {})
    };
    
    const resolvedEntity = resolveEntityRelationships(entityWithJunctions, relationships, relationshipConfigs);
    resolvedEntities[entity.id] = resolvedEntity;
  });
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 TableStore: Initial data loaded', {
      entityCount: entities.length,
      totalCount,
      relationshipTables: Object.keys(relationships),
      junctionTables,
      resolvedEntityCount: Object.keys(resolvedEntities).length,
      paginationEnabled: needsPagination
    });
    
    // Debug: Check if any entities have tags
    const entitiesWithTags = Object.values(resolvedEntities).filter((e: any) => e.tags && e.tags.length > 0);
    if (entitiesWithTags.length > 0) {
      console.log('📊 TableStore: Found entities with tags', {
        count: entitiesWithTags.length,
        sample: entitiesWithTags[0],
        sampleTags: entitiesWithTags[0].tags,
        sampleResolvedTags: entitiesWithTags[0].__resolved_tags
      });
    }
  }
  
  return { 
    entities: resolvedEntities, 
    relationships,
    pagination: paginationInfo
  };
}

// ====================================
// PAGE LOADER FOR PAGINATION
// ====================================

export async function loadPage(
  entityType: string, 
  columns: any[], 
  page: number,
  pageSize: number
) {
  const entityTableName = `${entityType}s`;
  
  console.log('📊 TableStore: Loading page', {
    entityType,
    page,
    pageSize
  });
  
  // Load entities for current page
  const entities = await db[entityTableName]
    .offset(page * pageSize)
    .limit(pageSize)
    .toArray();
  
  // Get relationship tables and junction tables we need to load
  const relationshipTables = columns ? getUniqueRelationshipTables(columns) : [];
  const junctionTables = columns ? getUniqueJunctionTables(columns) : [];
  const relationshipConfigs = columns ? discoverRelationships(columns) : [];
  
  // Load relationships and junctions in parallel
  const [relationshipDataArrays, junctionDataArrays] = await Promise.all([
    Promise.all(relationshipTables.map(tableName => (db as any)[tableName].toArray())),
    Promise.all(junctionTables.map(tableName => (db as any)[tableName].toArray()))
  ]);
  
  // Build relationship lookup tables
  const relationships: Record<string, Record<string, any>> = {};
  relationshipTables.forEach((tableName, index) => {
    const relationshipLookup: Record<string, any> = {};
    relationshipDataArrays[index].forEach((item: any) => {
      relationshipLookup[item.id] = item;
    });
    relationships[tableName] = relationshipLookup;
  });
  
  // Process junction data to add to entities
  const junctionsByEntity: Record<string, Record<string, string[]>> = {};
  junctionTables.forEach((tableName, index) => {
    const junctionData = junctionDataArrays[index];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 TableStore: Processing junction table', {
        tableName,
        junctionDataCount: junctionData.length,
        sampleJunction: junctionData[0]
      });
    }
    
    // Find which relationship config uses this junction table
    const config = relationshipConfigs.find(c => c.junctionTable === tableName);
    if (config) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 TableStore: Found config for junction table', {
          tableName,
          fieldName: config.fieldName,
          sourceField: config.junctionSourceField,
          targetField: config.junctionTargetField
        });
      }
      
      junctionData.forEach((junction: any) => {
        // For task_tags, the fields are taskId and tagId
        const entityId = tableName === 'task_tags' ? junction.taskId : junction[config.junctionSourceField!];
        const targetId = tableName === 'task_tags' ? junction.tagId : junction[config.junctionTargetField!];
        
        if (entityId && targetId) {
          if (!junctionsByEntity[entityId]) {
            junctionsByEntity[entityId] = {};
          }
          if (!junctionsByEntity[entityId][config.fieldName]) {
            junctionsByEntity[entityId][config.fieldName] = [];
          }
          junctionsByEntity[entityId][config.fieldName].push(targetId);
        }
      });
    } else {
      console.warn('📊 TableStore: No config found for junction table', tableName);
    }
  });
  
  if (process.env.NODE_ENV === 'development') {
    const entitiesWithJunctions = Object.keys(junctionsByEntity).length;
    console.log('📊 TableStore: Junction data processed', {
      entitiesWithJunctionData: entitiesWithJunctions,
      sampleEntityId: Object.keys(junctionsByEntity)[0],
      sampleJunctionData: junctionsByEntity[Object.keys(junctionsByEntity)[0]]
    });
  }
  
  // Resolve all entities to final table shape
  const resolvedEntities: Record<string, any> = {};
  entities.forEach(entity => {
    // Merge junction data into entity
    const entityWithJunctions = {
      ...entity,
      ...(junctionsByEntity[entity.id] || {})
    };
    
    const resolvedEntity = resolveEntityRelationships(entityWithJunctions, relationships, relationshipConfigs);
    resolvedEntities[entity.id] = resolvedEntity;
  });
  
  return { entities: resolvedEntities, relationships };
}

// ====================================
// GRANULAR LIVEQUERY SUBSCRIPTIONS
// ====================================

export function setupGranularSubscriptions(
  storeActor: any,
  entityType: string,
  columns?: any[]
): () => void {
  const subscriptions: Subscription[] = [];
  const entityTableName = `${entityType}s`;
  let initialLoadComplete = false;
  
  // Check if pagination is enabled
  const snapshot = storeActor.getSnapshot();
  if (snapshot?.context?.pagination?.enabled) {
    console.log('📊 TableStore: Skipping granular subscriptions - pagination mode active');
    return () => {}; // Return empty cleanup function
  }
  
  console.log('📊 TableStore: Setting up granular subscriptions', {
    entityType,
    entityTable: entityTableName,
    columnCount: columns?.length || 0
  });
  
  // Track previous entity data for proper change detection
  let previousEntities: Record<string, any> = {};
  
  // Track previous relationship data for proper change detection
  const previousRelationships: Record<string, Record<string, any>> = {};
  
  // Mark as ready after initial load and populate previous state
  setTimeout(() => {
    // Get initial entities from store to establish baseline
    const snapshot = storeActor.getSnapshot();
    if (snapshot && snapshot.context.entities) {
      previousEntities = { ...snapshot.context.entities };
      console.log('📊 TableStore: Initial load complete, baseline established', {
        entityCount: Object.keys(previousEntities).length
      });
    }
    
    // Also establish baseline for relationships
    if (snapshot && snapshot.context.relationships) {
      Object.keys(snapshot.context.relationships).forEach(tableName => {
        previousRelationships[tableName] = { ...snapshot.context.relationships[tableName] };
      });
    }
    
    initialLoadComplete = true;
    console.log('📊 TableStore: Initial load complete, enabling live updates');
  }, 100);
  
  // Entity changes - send events to store
  console.log('📊 TableStore: Creating entity subscription for', entityTableName);
  const entitySub = liveQuery(() => db[entityTableName].toArray()).subscribe({
    next: (entities) => {
      if (!initialLoadComplete) return;
      
      // Get current relationships from store for resolution
      const storeSnapshot = storeActor.getSnapshot();
      const currentRelationships = storeSnapshot?.context?.relationships || {};
      const relationshipConfigs = columns ? discoverRelationships(columns) : [];
      
      // Create lookup map for current entities (resolved)
      const currentEntityMap: Record<string, any> = {};
      entities.forEach(entity => {
        // Resolve entity before comparison
        const resolvedEntity = resolveEntityRelationships(entity, currentRelationships, relationshipConfigs);
        currentEntityMap[entity.id] = resolvedEntity;
      });
      
      // Detect actual changes by comparing with previous state
      const changedIds: string[] = [];
      const addedIds: string[] = [];
      const deletedIds: string[] = [];
      
      // Check for additions and modifications
      Object.entries(currentEntityMap).forEach(([entityId, resolvedEntity]) => {
        const previousEntity = previousEntities[entityId];
        if (!previousEntity) {
          addedIds.push(entityId);
          storeActor.send({ type: 'updateEntity', entity: resolvedEntity });
        } else if (JSON.stringify(previousEntity) !== JSON.stringify(resolvedEntity)) {
          changedIds.push(entityId);
          storeActor.send({ type: 'updateEntity', entity: resolvedEntity });
        }
      });
      
      // Check for deletions
      Object.keys(previousEntities).forEach(entityId => {
        if (!currentEntityMap[entityId]) {
          deletedIds.push(entityId);
          storeActor.send({ type: 'deleteEntity', entityId });
        }
      });
      
      // Only log if there were actual changes
      if (addedIds.length > 0 || changedIds.length > 0 || deletedIds.length > 0) {
        console.log('📊 TableStore: Granular entity update', {
          table: entityTableName,
          totalEntities: entities.length,
          added: addedIds.length,
          changed: changedIds.length,
          deleted: deletedIds.length,
          changedIds: changedIds.slice(0, 5), // Show first 5 for debugging
          addedIds: addedIds.slice(0, 5),
          deletedIds: deletedIds.slice(0, 5)
        });
      }
      
      // Update previous state for next comparison
      previousEntities = currentEntityMap;
    },
    error: (error) => {
      console.error('❌ TableStore: Entity subscription error', error);
      storeActor.send({ type: 'setError', error: error.message });
    }
  });
  
  subscriptions.push(entitySub);
  
  // Relationship changes - send events to store
  if (columns) {
    const relationshipTables = getUniqueRelationshipTables(columns);
    console.log('📊 TableStore: Setting up relationship subscriptions for tables:', relationshipTables);
    
    relationshipTables.forEach(tableName => {
      const table = (db as any)[tableName];
      if (!table) {
        console.warn('⚠️ TableStore: No table found for relationship:', tableName);
        return;
      }
      
      // Initialize previous state for this table
      previousRelationships[tableName] = {};
      
      console.log('📊 TableStore: Creating relationship subscription for', tableName);
      const sub = liveQuery(() => table.toArray()).subscribe({
        next: (data) => {
          if (!initialLoadComplete) return;
          
          // Create lookup map for current data
          const currentDataMap: Record<string, any> = {};
          data.forEach((item: any) => {
            currentDataMap[item.id] = item;
          });
          
          // Detect actual changes
          const previousData = previousRelationships[tableName] || {};
          let hasChanges = false;
          
          // Check if the number of items changed
          if (Object.keys(previousData).length !== data.length) {
            hasChanges = true;
          } else {
            // Check for modifications
            for (const item of data) {
              const previousItem = previousData[item.id];
              if (!previousItem || JSON.stringify(previousItem) !== JSON.stringify(item)) {
                hasChanges = true;
                break;
              }
            }
          }
          
          // Only send update if there were actual changes
          if (hasChanges) {
            console.log('📊 TableStore: Granular relationship update', {
              tableName,
              count: data.length,
              previousCount: Object.keys(previousData).length
            });
            
            // Send event to update relationship table
            storeActor.send({ type: 'updateRelationshipTable', table: tableName, data });
          }
          
          // Update previous state for next comparison
          previousRelationships[tableName] = currentDataMap;
        },
        error: (error) => {
          console.error(`❌ TableStore: ${tableName} subscription error`, error);
        }
      });
      
      subscriptions.push(sub);
    });
  }
  
  console.log('📊 TableStore: Granular subscriptions setup complete', {
    totalSubscriptions: subscriptions.length,
    entitySubscription: 1,
    relationshipSubscriptions: subscriptions.length - 1
  });
  
  // Return cleanup function
  return () => {
    console.log('📊 TableStore: Cleaning up granular subscriptions');
    subscriptions.forEach(sub => sub.unsubscribe());
  };
}

// ====================================
// PERSISTENCE HELPERS
// ====================================

const STORAGE_KEY_PREFIX = 'vibegridx_display_';

export function saveDisplayState(entityType: string, state: any) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${entityType}`;
    const displayState = {
      columnOrder: state.columnOrder,
      columnVisibility: state.columnVisibility,
      columnWidths: state.columnWidths,
      sortBy: state.sortBy,
      filters: state.filters,
      groupBy: state.groupBy,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(displayState));
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 TableStore: Saved display state', { entityType, displayState });
    }
  } catch (error) {
    console.error('Failed to save display state:', error);
  }
}

export function loadDisplayState(entityType: string): any | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${entityType}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 TableStore: Loaded display state', { entityType, parsed });
      }
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load display state:', error);
  }
  return null;
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createTableStoreActor(entityType: string, columns?: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 TableStore: Creating atomic store logic for', entityType, {
      columnCount: columns?.length || 0
    });
  }
  
  return createTableStoreLogic(entityType, columns);
}