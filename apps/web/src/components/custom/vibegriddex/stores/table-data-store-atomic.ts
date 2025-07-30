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
  
  // Initialize columns with the correct order if persisted
  let initialColumns = columns || [];
  if (persistedState?.columnOrder && persistedState.columnOrder.length > 0 && columns) {
    // Reorder columns based on persisted order
    const columnMap = new Map(columns.map(col => [col.id, col]));
    initialColumns = persistedState.columnOrder
      .map(id => columnMap.get(id))
      .filter(Boolean) as any[];
    
    // Add any new columns that weren't in the persisted order
    const orderedIds = new Set(persistedState.columnOrder);
    const newColumns = columns.filter(col => !orderedIds.has(col.id));
    initialColumns.push(...newColumns);
  }
  
  return fromStore({
    context: {
      entityType,
      columns: initialColumns, // Full column objects in order
      entities: {} as Record<string, any>, // Raw resolved entities
      relationships: {} as Record<string, Record<string, any>>, // Lookup tables
      processedRows: [] as any[], // Table-ready rows for renderer
      originalRows: [] as any[], // Original unsorted order for restoration
      sortBy: persistedState?.sortBy || [] as Array<{ field: string; direction: 'asc' | 'desc' }>,
      filters: persistedState?.filters || [] as Array<{ field: string; operator: string; value: any }>,
      columnVisibility: persistedState?.columnVisibility || {} as Record<string, boolean>,
      columnOrder: persistedState?.columnOrder || [] as string[], // Keep for backward compatibility during transition
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
          let processedRows = entityValues.map((entity: any) => ({
            id: entity.id,
            data: entity, // This should contain fully resolved relationship data
            metadata: {
              isSelected: false,
              isDirty: false,
              isGroup: false,
              level: 0
            }
          }));
          
          // Apply persisted sort if it exists
          if (context.sortBy.length > 0) {
            processedRows = [...processedRows].sort((a, b) => {
              for (const sort of context.sortBy) {
                const aValue = a.data[sort.field];
                const bValue = b.data[sort.field];
                
                // Handle null/undefined
                if (aValue == null && bValue == null) continue;
                if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
                if (bValue == null) return sort.direction === 'asc' ? -1 : 1;
                
                // Compare values normally
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
                  const result = sort.direction === 'desc' ? -comparison : comparison;
                  
                  // Debug logging for initial sort
                  if (process.env.NODE_ENV === 'development' && sort.field === 'title') {
                    console.log('📊 TableStore: Initial sort application', {
                      field: sort.field,
                      direction: sort.direction,
                      aValue: String(aValue).substring(0, 20),
                      bValue: String(bValue).substring(0, 20),
                      comparison,
                      result,
                      shouldABeFirst: result < 0
                    });
                  }
                  
                  return result;
                }
              }
              return 0;
            });
            
            if (process.env.NODE_ENV === 'development' && context.sortBy[0]?.field === 'title') {
              console.log('📊 TableStore: Initial data sorted with persisted state', {
                sortBy: context.sortBy,
                firstThree: processedRows.slice(0, 3).map(row => ({
                  id: row.id,
                  title: row.data.title
                }))
              });
            }
          }
          
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
        originalRows: (context, event) => {
          // Store the original unsorted order for restoration when sort is cleared
          const entityValues = Object.values(event.entities);
          return entityValues.map((entity: any) => ({
            id: entity.id,
            data: entity,
            metadata: {
              isSelected: false,
              isDirty: false,
              isGroup: false,
              level: 0
            }
          }));
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
              entityType: context.entityType,
              hasTagsField: 'tags' in event.entity,
              tagsValue: event.entity.tags,
              entityKeys: Object.keys(event.entity).sort()
            });
          }
          
          // Resolve entity with current relationships
          const relationshipConfigs = discoverRelationships(columns || []);
          const resolvedEntity = resolveEntityRelationships(event.entity, context.relationships, relationshipConfigs);
          
          if (process.env.NODE_ENV === 'development' && event.entity.tags) {
            console.log('📊 TableStore: Entity resolution result', {
              entityId: event.entity.id,
              originalTags: event.entity.tags,
              resolvedTags: resolvedEntity.__resolved_tags,
              hasRelationshipData: !!context.relationships.tags,
              tagCount: context.relationships.tags ? Object.keys(context.relationships.tags).length : 0
            });
          }
          
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
          let updatedRows: any[];
          
          if (rowIndex !== -1) {
            updatedRows = [...context.processedRows];
            updatedRows[rowIndex] = {
              ...updatedRows[rowIndex],
              data: resolvedEntity
            };
          } else {
            // New entity - add to processed rows
            updatedRows = [...context.processedRows, {
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
          
          // Check if we need to re-sort
          if (context.sortBy.length > 0) {
            // Check if any sorted field was updated or if sorting by updatedAt
            const needsResort = context.sortBy.some(sort => {
              // Always re-sort if sorting by updatedAt since it likely changed
              if (sort.field === 'updatedAt') return true;
              
              // Check if the sorted field value changed
              if (rowIndex !== -1) {
                const oldValue = context.processedRows[rowIndex].data[sort.field];
                const newValue = resolvedEntity[sort.field];
                return oldValue !== newValue;
              }
              
              return false; // New entity, no need to re-sort existing
            });
            
            if (needsResort) {
              if (process.env.NODE_ENV === 'development') {
                console.log('📊 TableStore: Re-sorting after entity update', {
                  entityId: event.entity.id,
                  sortBy: context.sortBy,
                  reason: context.sortBy.some(s => s.field === 'updatedAt') ? 'updatedAt field' : 'sorted field changed'
                });
              }
              
              // Re-apply sort
              updatedRows = [...updatedRows].sort((a, b) => {
                for (const sort of context.sortBy) {
                  const aValue = a.data[sort.field];
                  const bValue = b.data[sort.field];
                  
                  // Handle null/undefined
                  if (aValue == null && bValue == null) continue;
                  if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
                  if (bValue == null) return sort.direction === 'asc' ? -1 : 1;
                  
                  let comparison = 0;
                  
                  // Date comparison
                  if (aValue instanceof Date || (typeof aValue === 'string' && !isNaN(Date.parse(aValue)))) {
                    const aDate = aValue instanceof Date ? aValue : new Date(aValue);
                    const bDate = bValue instanceof Date ? bValue : new Date(bValue);
                    comparison = aDate.getTime() - bDate.getTime();
                  }
                  // Number comparison
                  else if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                  }
                  // String comparison (case-insensitive)
                  else {
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
          }
          
          return updatedRows;
        },
        originalRows: (context, event) => {
          // Also update originalRows to maintain unsorted order consistency
          const relationshipConfigs = discoverRelationships(columns || []);
          const resolvedEntity = resolveEntityRelationships(event.entity, context.relationships, relationshipConfigs);
          
          const rowIndex = context.originalRows.findIndex(row => row.id === event.entity.id);
          if (rowIndex !== -1) {
            const updatedRows = [...context.originalRows];
            updatedRows[rowIndex] = {
              ...updatedRows[rowIndex],
              data: resolvedEntity
            };
            return updatedRows;
          } else {
            // New entity - add to original rows (append to maintain insertion order)
            return [...context.originalRows, {
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
            // Create updated relationships with the new data
            const relationshipLookup: Record<string, any> = {};
            event.data.forEach((item: any) => {
              relationshipLookup[item.id] = item;
            });
            
            const updatedRelationships = {
              ...context.relationships,
              [event.table]: relationshipLookup
            };
            
            // Re-resolve affected entities with the NEW relationships
            const updatedEntities = { ...context.entities };
            let changedCount = 0;
            Object.keys(updatedEntities).forEach(entityId => {
              const originalEntity = updatedEntities[entityId];
              const newResolvedEntity = resolveEntityRelationships(originalEntity, updatedRelationships, relationshipConfigs);
              
              // Check if resolution actually changed anything
              const oldResolved = resolveEntityRelationships(originalEntity, context.relationships, relationshipConfigs);
              const hasChanges = JSON.stringify(oldResolved) !== JSON.stringify(newResolvedEntity);
              if (hasChanges) {
                changedCount++;
                if (process.env.NODE_ENV === 'development' && changedCount <= 3) {
                  console.log('📊 TableStore: Entity resolution changed', {
                    entityId,
                    table: event.table,
                    affectedColumns: affectedConfigs.map(c => c.columnId),
                    oldValue: oldResolved[`__resolved_${affectedConfigs[0]?.columnId}`],
                    newValue: newResolvedEntity[`__resolved_${affectedConfigs[0]?.columnId}`]
                  });
                }
              }
              
              updatedEntities[entityId] = newResolvedEntity;
            });
            
            if (process.env.NODE_ENV === 'development') {
              console.log('📊 TableStore: Re-resolved entities after relationship change', {
                table: event.table,
                totalEntities: Object.keys(updatedEntities).length,
                changedEntities: changedCount
              });
            }
            
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
            // First, we need to get the updated entities from the entities assignment
            // Create updated relationships with the new data
            const relationshipLookup: Record<string, any> = {};
            event.data.forEach((item: any) => {
              relationshipLookup[item.id] = item;
            });
            
            const updatedRelationships = {
              ...context.relationships,
              [event.table]: relationshipLookup
            };
            
            if (process.env.NODE_ENV === 'development') {
              console.log('📊 TableStore: Re-processing rows due to relationship change', {
                table: event.table,
                affectedColumns: affectedConfigs.map(c => c.columnId),
                rowCount: context.processedRows.length,
                sampleBeforeUpdate: context.processedRows[0]?.data,
                relationshipDataCount: event.data.length
              });
            }
            
            // Re-resolve ALL entities with the new relationships and update processedRows
            return context.processedRows.map(row => {
              const originalEntity = context.entities[row.id];
              const newResolvedEntity = resolveEntityRelationships(originalEntity, updatedRelationships, relationshipConfigs);
              
              return {
                ...row,
                data: newResolvedEntity
              };
            });
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
            console.log('📊 TableStore: Setting sort configuration', { 
              oldSortBy: context.sortBy,
              newSortBy: event.sortBy,
              isClearing: event.sortBy.length === 0,
              timestamp: Date.now()
            });
          }
          return event.sortBy;
        },
        processedRows: (context, event) => {
          // If clearing sort, restore original order
          if (event.sortBy.length === 0) {
            if (process.env.NODE_ENV === 'development') {
              console.log('📊 TableStore: Clearing sort, restoring original order', {
                originalRowCount: context.originalRows.length,
                currentRowCount: context.processedRows.length
              });
            }
            return [...context.originalRows];
          }
          
          // Re-sort processed rows
          if (event.sortBy.length > 0 && context.processedRows.length > 0) {
            const sortedRows = [...context.processedRows].sort((a, b) => {
              for (const sort of event.sortBy) {
                // Find the column to check if it's a relationship type
                const column = context.columns.find(col => col.field === sort.field || col.id === sort.field);
                const isRelationship = column?.cellType?.startsWith('relationship') || column?.type?.startsWith('relationship');
                
                // For relationship columns, use resolved values
                let aValue, bValue;
                if (isRelationship) {
                  const resolvedFieldName = `__resolved_${column.id}`;
                  aValue = a.data[resolvedFieldName];
                  bValue = b.data[resolvedFieldName];
                  // Fallback to raw value if resolved not available
                  if (aValue === undefined) aValue = a.data[sort.field];
                  if (bValue === undefined) bValue = b.data[sort.field];
                } else {
                  aValue = a.data[sort.field];
                  bValue = b.data[sort.field];
                }
                
                // Handle null/undefined
                if (aValue == null && bValue == null) continue;
                if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
                if (bValue == null) return sort.direction === 'asc' ? -1 : 1;
                
                // Special handling for statusId - use sortOrder from relationship data
                if (sort.field === 'statusId' && context.relationships?.status_definitions) {
                  const aStatus = context.relationships.status_definitions[aValue];
                  const bStatus = context.relationships.status_definitions[bValue];
                  
                  if (aStatus?.sortOrder != null && bStatus?.sortOrder != null) {
                    const comparison = aStatus.sortOrder - bStatus.sortOrder;
                    if (comparison !== 0) {
                      return sort.direction === 'desc' ? -comparison : comparison;
                    }
                  }
                }
                
                // Handle array fields (multi-relationships) - sort by count or first item
                if (Array.isArray(aValue) && Array.isArray(bValue)) {
                  // Sort by count of items
                  const comparison = aValue.length - bValue.length;
                  if (comparison !== 0) {
                    return sort.direction === 'desc' ? -comparison : comparison;
                  }
                  // If counts are equal, compare first items if they exist
                  if (aValue.length > 0 && bValue.length > 0) {
                    const aFirst = String(aValue[0]).toLowerCase();
                    const bFirst = String(bValue[0]).toLowerCase();
                    const firstComparison = aFirst < bFirst ? -1 : aFirst > bFirst ? 1 : 0;
                    if (firstComparison !== 0) {
                      return sort.direction === 'desc' ? -firstComparison : firstComparison;
                    }
                  }
                  continue;
                }
                
                // Compare values normally
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
                  const result = sort.direction === 'desc' ? -comparison : comparison;
                  
                  // Debug logging for sort verification
                  if (process.env.NODE_ENV === 'development' && sort.field === 'title') {
                    console.log('📊 TableStore: Sort comparison debug', {
                      field: sort.field,
                      direction: sort.direction,
                      aValue: String(aValue).substring(0, 20),
                      bValue: String(bValue).substring(0, 20),
                      comparison,
                      result,
                      shouldABeFirst: result < 0
                    });
                  }
                  
                  return result;
                }
              }
              return 0;
            });
            
            // Debug logging for sort result
            if (process.env.NODE_ENV === 'development' && event.sortBy[0]?.field === 'title') {
              console.log('📊 TableStore: Sort applied, first 3 results', {
                sortBy: event.sortBy,
                firstThree: sortedRows.slice(0, 3).map(row => ({
                  id: row.id,
                  title: row.data.title
                }))
              });
            }
            
            return sortedRows;
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
        columns: (context, event: { fromIndex: number; toIndex: number }) => {
          console.log('🔄 Store: reorderColumns called', {
            fromIndex: event.fromIndex,
            toIndex: event.toIndex,
            currentColumns: context.columns.map(c => c.id),
            visibility: context.columnVisibility
          });
          
          // Get visible columns only (excluding selection column)
          const visibleColumns = context.columns.filter((col: any) => 
            col.id !== '__selection' && context.columnVisibility[col.id] !== false
          );
          
          console.log('🔄 Store: Visible columns before reorder', visibleColumns.map(c => c.id));
          
          // Apply reorder to visible columns
          const newVisibleOrder = [...visibleColumns];
          const [removed] = newVisibleOrder.splice(event.fromIndex, 1);
          newVisibleOrder.splice(event.toIndex, 0, removed);
          
          console.log('🔄 Store: Visible columns after reorder', {
            moved: removed.id,
            from: event.fromIndex,
            to: event.toIndex,
            newOrder: newVisibleOrder.map(c => c.id)
          });
          
          // Create a new columns array maintaining hidden columns in their positions
          const newColumns: any[] = [];
          const addedColumns = new Set<string>();
          
          // Process each column in the original order
          for (const column of context.columns) {
            // Special handling for selection column - skip it
            if (column.id === '__selection') {
              continue;
            }
            
            // If this column is hidden, add it in its original position
            if (context.columnVisibility[column.id] === false) {
              newColumns.push(column);
              addedColumns.add(column.id);
              continue;
            }
            
            // For visible columns, add the next one from our reordered list
            if (!addedColumns.has(column.id)) {
              const nextVisible = newVisibleOrder.find(col => !addedColumns.has(col.id));
              if (nextVisible) {
                newColumns.push(nextVisible);
                addedColumns.add(nextVisible.id);
              }
            }
          }
          
          // Add any remaining visible columns that weren't added
          // (this shouldn't happen but is a safety check)
          newVisibleOrder.forEach(col => {
            if (!addedColumns.has(col.id)) {
              newColumns.push(col);
              addedColumns.add(col.id);
            }
          });
          
          console.log('🔄 Store: Final column order', {
            oldOrder: context.columns.map(c => c.id),
            newOrder: newColumns.map(c => c.id),
            changed: JSON.stringify(newColumns.map(c => c.id)) !== JSON.stringify(context.columns.map(c => c.id))
          });
          
          // Save the new column order to persistence
          saveDisplayState(context.entityType, {
            ...context,
            columns: newColumns,
            columnOrder: newColumns.map(c => c.id) // Keep for backward compatibility
          });
          
          return newColumns;
        },
        // Also update columnOrder for backward compatibility
        columnOrder: (context, event: { fromIndex: number; toIndex: number }) => {
          // This will be computed from the new columns array
          return context.columns.map(c => c.id);
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
    
    // Debug tag loading
    if (tableName === 'tags' && process.env.NODE_ENV === 'development') {
      console.log('📊 TableStore: Loaded tags into relationships', {
        tagCount: relationshipDataArrays[index].length,
        sampleTags: relationshipDataArrays[index].slice(0, 3).map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          tagSetId: tag.tagSetId,
          color: tag.color
        }))
      });
    }
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
    
    // Debug tag loading
    if (tableName === 'tags' && process.env.NODE_ENV === 'development') {
      console.log('📊 TableStore: Loaded tags into relationships', {
        tagCount: relationshipDataArrays[index].length,
        sampleTags: relationshipDataArrays[index].slice(0, 3).map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          tagSetId: tag.tagSetId,
          color: tag.color
        }))
      });
    }
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
  const relationshipConfigs = columns ? discoverRelationships(columns) : [];
  
  const entitySub = liveQuery(async () => {
    // Fetch entities
    const entities = await db[entityTableName].toArray();
    
    // Fetch junction table data (like task_tags)
    const junctionTables = columns ? getUniqueJunctionTables(columns) : [];
    const junctionDataArrays = await Promise.all(
      junctionTables.map(tableName => (db as any)[tableName].toArray())
    );
    
    // Process junction data to add to entities
    const junctionsByEntity: Record<string, Record<string, string[]>> = {};
    junctionTables.forEach((tableName, index) => {
      const junctionData = junctionDataArrays[index];
      const config = relationshipConfigs.find(c => c.junctionTable === tableName);
      
      if (config) {
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
      }
    });
    
    // Add junction data to entities
    let entitiesWithJunctions = 0;
    entities.forEach(entity => {
      const junctions = junctionsByEntity[entity.id];
      if (junctions) {
        Object.entries(junctions).forEach(([fieldName, targetIds]) => {
          entity[fieldName] = targetIds;
          entitiesWithJunctions++;
        });
      }
    });
    
    if (process.env.NODE_ENV === 'development' && junctionTables.length > 0) {
      console.log('📊 TableStore: LiveQuery junction processing', {
        junctionTables,
        totalEntities: entities.length,
        entitiesWithJunctions,
        sampleEntity: entities.find(e => e.tags?.length > 0)
      });
    }
    
    return entities;
  }).subscribe({
    next: (entities) => {
      if (!initialLoadComplete) return;
      
      // Get current relationships from store for resolution
      const storeSnapshot = storeActor.getSnapshot();
      const currentRelationships = storeSnapshot?.context?.relationships || {};
      
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
        } else {
          // Deep comparison of resolved entities
          const prevStr = JSON.stringify(previousEntity);
          const currStr = JSON.stringify(resolvedEntity);
          if (prevStr !== currStr) {
            // Debug what changed
            if (process.env.NODE_ENV === 'development' && changedIds.length < 3) {
              const prevKeys = Object.keys(previousEntity).sort();
              const currKeys = Object.keys(resolvedEntity).sort();
              
              // Find missing and added keys
              const missingKeys = prevKeys.filter(k => !currKeys.includes(k));
              const addedKeys = currKeys.filter(k => !prevKeys.includes(k));
              
              console.log('📊 UpdateCheck: Entity change detected', {
                entityId,
                previousKeys: prevKeys,
                currentKeys: currKeys,
                missingKeys,
                addedKeys,
                // Show first difference
                sample: (() => {
                  // Check all keys from both objects
                  const allKeys = new Set([...prevKeys, ...currKeys]);
                  for (const key of allKeys) {
                    const prevVal = previousEntity[key];
                    const currVal = resolvedEntity[key];
                    if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
                      return {
                        key,
                        prev: prevVal,
                        curr: currVal,
                        prevType: prevVal === undefined ? 'undefined' : prevVal === null ? 'null' : typeof prevVal,
                        currType: currVal === undefined ? 'undefined' : currVal === null ? 'null' : typeof currVal
                      };
                    }
                  }
                  return null;
                })()
              });
            }
            changedIds.push(entityId);
            storeActor.send({ type: 'updateEntity', entity: resolvedEntity });
          }
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
        console.log('📊 UpdateCheck: Granular entity update summary', {
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
          console.log('📊 TableStore: Relationship subscription fired for', tableName, {
            initialLoadComplete,
            dataCount: data.length,
            timestamp: new Date().toISOString()
          });
          
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
            // Enhanced logging to show what changed
            let changeDetails = {
              added: [] as string[],
              updated: [] as string[],
              removed: [] as string[]
            };
            
            // Find added and updated items
            data.forEach((item: any) => {
              const previousItem = previousData[item.id];
              if (!previousItem) {
                changeDetails.added.push(item.id);
              } else if (JSON.stringify(previousItem) !== JSON.stringify(item)) {
                changeDetails.updated.push(item.id);
              }
            });
            
            // Find removed items
            Object.keys(previousData).forEach(id => {
              if (!currentDataMap[id]) {
                changeDetails.removed.push(id);
              }
            });
            
            console.log('📊 TableStore: Granular relationship update detected', {
              tableName,
              count: data.length,
              previousCount: Object.keys(previousData).length,
              changes: changeDetails,
              sampleItem: data[0]
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
      columnOrder: state.columns ? state.columns.map(c => c.id) : state.columnOrder,
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