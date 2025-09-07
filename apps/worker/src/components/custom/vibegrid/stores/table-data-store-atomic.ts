import { fromStore } from '@xstate/store';
// NOTE: @repo/dataforge/dexie-schema was deprecated - using Legend State
import { getEntity$, getUniverseEntity$, entities$ } from '@/legend-state/observables';
import { when } from '@legendapp/state';
import { uiLog } from '@/logger';
import { 
  discoverRelationships, 
  getUniqueRelationshipTables,
  getUniqueJunctionTables,
  resolveEntityRelationships,
  type RelationshipConfig
} from '../utils/relationship-discovery';

const log = uiLog('components/custom/vibegrid/stores/table-data-store-atomic.ts');

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
    // Check if the incoming columns have system fields at the end (new correct order)
    // versus the persisted state which might have system fields at the beginning (old order)
    const systemFields = ['created_at', 'updated_at'];
    const incomingSystemFieldPositions = systemFields.map(field => columns.findIndex(col => col.id === field));
    const persistedSystemFieldPositions = systemFields.map(field => persistedState.columnOrder.findIndex(id => id === field));
    
    // If incoming columns have system fields at the end but persisted has them at the beginning,
    // prefer the incoming order (new schema-driven order)
    const incomingSystemFieldsAtEnd = incomingSystemFieldPositions.every(pos => pos === -1 || pos > columns.length / 2);
    const persistedSystemFieldsAtStart = persistedSystemFieldPositions.some(pos => pos >= 0 && pos < 3);
    
    log.info('🔍 Column order detection:', {
      incomingSystemFieldPositions,
      persistedSystemFieldPositions,
      incomingSystemFieldsAtEnd,
      persistedSystemFieldsAtStart,
      willUseIncomingOrder: incomingSystemFieldsAtEnd && persistedSystemFieldsAtStart
    });
    
    if (incomingSystemFieldsAtEnd && persistedSystemFieldsAtStart) {
      // Use the incoming order (new schema-driven order with system fields at end)
      log.info('🔄 Using incoming column order (system fields moved to end)');
      initialColumns = columns;
    } else {
      // Reorder columns based on persisted order (original behavior)
      const columnMap = new Map(columns.map(col => [col.id, col]));
      initialColumns = persistedState.columnOrder
        .map(id => columnMap.get(id))
        .filter(Boolean) as any[];
      
      // Add any new columns that weren't in the persisted order
      const orderedIds = new Set(persistedState.columnOrder);
      const newColumns = columns.filter(col => !orderedIds.has(col.id));
      initialColumns.push(...newColumns);
    }
  }
  
  return fromStore({
    context: {
      entityType,
      columns: initialColumns, // Full column objects in order
      // REMOVED DATA DUPLICATION: No entities, processedRows, originalRows
      // All data comes directly from Legend State via getEntity$()
      relationships: {} as Record<string, Record<string, any>>, // Keep for relationship lookups only
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
      // Initialize UI state only - no data duplication
      initializeUIState: {
        relationships: (context, event: { relationships: Record<string, Record<string, any>> }) => event.relationships,
        loading: false,
        error: null,
        lastProcessedAt: Date.now(),
        // Initialize column visibility from columns if not set
        columnVisibility: (context) => {
          if (columns && Object.keys(context.columnVisibility).length === 0) {
            return Object.fromEntries(columns.map(col => [col.id, true]));
          }
          return context.columnVisibility;
        },
        columnOrder: (context) => {
          if (columns && context.columnOrder.length === 0) {
            return columns.map(col => col.id);
          }
          return context.columnOrder;
        },
        hiddenColumnCount: (context) => {
          return Object.values(context.columnVisibility).filter(v => !v).length;
        }
      },
      
      // REMOVED updateEntity - data updates handled by Legend State directly
      
      updateRelationshipTable: {
        relationships: (context, event: { table: string, data: any[] }) => {
          if (process.env.NODE_ENV === 'development') {
            log.info('📊 TableStore: Updating relationship table atomically', {
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
                  log.info('📊 TableStore: Entity resolution changed', {
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
              log.info('📊 TableStore: Re-resolved entities after relationship change', {
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
              log.info('📊 TableStore: Re-processing rows due to relationship change', {
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
            log.info('📊 TableStore: Deleting entity atomically', {
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
            log.info('📊 TableStore: Setting sort configuration', { 
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
              log.info('📊 TableStore: Clearing sort, restoring original order', {
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
                    log.info('📊 TableStore: Sort comparison debug', {
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
              log.info('📊 TableStore: Sort applied, first 3 results', {
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
            log.info('📊 TableStore: Setting filters', { filters: event.filters });
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
        },
        // IMPORTANT: Preserve data during column visibility changes
        processedRows: (context) => context.processedRows || [],
        originalRows: (context) => context.originalRows || [],
        entities: (context) => context.entities || {}
      },
      
      toggleColumnVisibility: {
        columnVisibility: (context, event: { columnId: string }) => {
          const currentVisibility = context.columnVisibility[event.columnId];
          const isCurrentlyVisible = currentVisibility !== false;
          
          const newVisibility = {
            ...context.columnVisibility,
            [event.columnId]: !isCurrentlyVisible
          };
          
          log.info('📊 TableStore: toggleColumnVisibility (UI state only)', {
            columnId: event.columnId,
            wasVisible: isCurrentlyVisible,
            nowVisible: !isCurrentlyVisible
          });
          
          return newVisibility;
        },
        hiddenColumnCount: (context, event: { columnId: string }) => {
          const currentVisibility = context.columnVisibility[event.columnId];
          const isCurrentlyVisible = currentVisibility !== false;
          const newVisibility = {
            ...context.columnVisibility,
            [event.columnId]: !isCurrentlyVisible
          };
          return Object.values(newVisibility).filter(v => v === false).length;
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
        hiddenColumnCount: 0,
        // IMPORTANT: Preserve data during column visibility changes
        processedRows: (context) => context.processedRows || [],
        originalRows: (context) => context.originalRows || [],
        entities: (context) => context.entities || {}
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
        },
        // IMPORTANT: Preserve data during column visibility changes
        processedRows: (context) => context.processedRows || [],
        originalRows: (context) => context.originalRows || [],
        entities: (context) => context.entities || {}
      },
      
      setColumnOrder: {
        columnOrder: (context, event: { columnOrder: string[] }) => event.columnOrder,
        // IMPORTANT: Preserve data during column order changes
        processedRows: (context) => context.processedRows || [],
        originalRows: (context) => context.originalRows || [],
        entities: (context) => context.entities || {}
      },
      
      reorderColumns: {
        columns: (context, event: { fromIndex: number; toIndex: number }) => {
          log.info('🔄 Store: reorderColumns called', {
            fromIndex: event.fromIndex,
            toIndex: event.toIndex,
            currentColumns: context.columns.map(c => c.id),
            visibility: context.columnVisibility
          });
          
          // Check if we have a selection column
          const selectionColumn = context.columns.find((col: any) => col.id === '__selection');
          
          // Get visible columns only (excluding selection column)
          const visibleColumns = context.columns.filter((col: any) => 
            col.id !== '__selection' && context.columnVisibility[col.id] !== false
          );
          
          log.info('🔄 Store: Visible columns before reorder', visibleColumns.map(c => c.id));
          
          // Apply reorder to visible columns
          const newVisibleOrder = [...visibleColumns];
          const [removed] = newVisibleOrder.splice(event.fromIndex, 1);
          newVisibleOrder.splice(event.toIndex, 0, removed);
          
          log.info('🔄 Store: Visible columns after reorder', {
            moved: removed.id,
            from: event.fromIndex,
            to: event.toIndex,
            newOrder: newVisibleOrder.map(c => c.id)
          });
          
          // Create a new columns array maintaining hidden columns in their positions
          const newColumns: any[] = [];
          const addedColumns = new Set<string>();
          
          // Always add selection column first if it exists
          if (selectionColumn) {
            newColumns.push(selectionColumn);
            addedColumns.add(selectionColumn.id);
          }
          
          // Process each column in the original order
          for (const column of context.columns) {
            // Skip selection column as we already added it
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
          
          log.info('🔄 Store: Final column order', {
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
        },
        // IMPORTANT: Preserve processedRows during column reordering
        processedRows: (context) => {
          log.info('🔄 Store: Preserving processedRows during reorder', {
            rowCount: context.processedRows?.length || 0,
            hasRows: !!context.processedRows
          });
          return context.processedRows || [];
        },
        // Also preserve originalRows
        originalRows: (context) => context.originalRows || [],
        // Preserve entities as well
        entities: (context) => context.entities || {}
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
            log.info('📊 TableStore: Setting pagination', { pagination: event.pagination });
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
      },

      atomicEntityUpdate: {
        entities: (context, event: { entityId: string, entity: any, silent?: boolean }) => {
          if (process.env.NODE_ENV === 'development') {
            log.info('📊 TableStore: Processing atomic entity update', {
              entityId: event.entityId,
              entityType: context.entityType,
              entityName: event.entity?.name,
              source: 'render_chain_trigger',
              silent: event.silent || false
            });
          }
          
          // Resolve entity with current relationships
          const relationshipConfigs = discoverRelationships(columns || []);
          const resolvedEntity = resolveEntityRelationships(event.entity, context.relationships, relationshipConfigs);
          
          return {
            ...context.entities,
            [event.entityId]: resolvedEntity
          };
        },
        processedRows: (context, event: { entityId: string, entity: any, silent?: boolean }) => {
          // If silent update, skip processedRows update to prevent full re-render
          if (event.silent) {
            if (process.env.NODE_ENV === 'development') {
              log.info('📊 TableStore: Skipping processedRows update for silent atomic update', {
                entityId: event.entityId,
                reason: 'silent_mode_prevents_full_rerender'
              });
            }
            return context.processedRows;
          }
          
          // Resolve entity with current relationships
          const relationshipConfigs = discoverRelationships(columns || []);
          const resolvedEntity = resolveEntityRelationships(event.entity, context.relationships, relationshipConfigs);
          
          // Update the corresponding processed row
          const rowIndex = context.processedRows.findIndex(row => row.id === event.entityId);
          if (rowIndex !== -1) {
            const updatedRows = [...context.processedRows];
            updatedRows[rowIndex] = {
              ...updatedRows[rowIndex],
              data: resolvedEntity
            };
            
            if (process.env.NODE_ENV === 'development') {
              log.info('📊 TableStore: Updated processed row via atomic update', {
                entityId: event.entityId,
                rowIndex,
                newData: resolvedEntity
              });
            }
            
            return updatedRows;
          }
          return context.processedRows;
        },
        lastProcessedAt: Date.now()
      }
    }
  });
};

// ====================================
// INITIAL DATA LOADER (Promise-based)
// ====================================

export async function loadInitialData(entityType: string, columns?: any[], page?: number) {
  const entityTableName = entityType; // Legend State uses singular names
  
  if (process.env.NODE_ENV === 'development') {
    log.info('📊 TableStore: Loading initial data', {
      entityType,
      entityTable: entityTableName,
      page: page || 'all'
    });
  }
  
  // CRITICAL FIX: When in universe context with org-prefixed entities, always use getUniverseEntity$
  // Check if this is an org-prefixed entity (UUID_EntityName format)
  const isOrgPrefixed = entityTableName.includes('_') && entityTableName.match(/^[a-f0-9-]{36}_/);
  
  if (process.env.NODE_ENV === 'development') {
    log.info('📊 TableStore: Entity observable selection', {
      entityTableName,
      isOrgPrefixed,
      willUseUniverse: isOrgPrefixed
    });
  }
  
  // Check if getUniverseEntity$ is available (debug logging removed)
  
  const entity$ = getEntity$(entityTableName);
  
  if (!entity$) {
    // Entity observable not ready - this shouldn't happen since the bridge handles this
    log.warn('📊 TableStore: Entity observable not ready for', entityTableName);
    return { entities: {}, relationships: {}, pagination: null };
  }
  
  // Get entities from Legend State observable - wait for data to be loaded
  let entities: any[] = [];
  try {
    // ✅ CORRECT: Use .get() to access data and trigger loading if needed
    const entityData = entity$.get();
    
    if (process.env.NODE_ENV === 'development') {
      log.info('📊 TableStore: Entity observable data retrieved', {
        entityTableName,
        dataType: typeof entityData,
        isNull: entityData === null,
        isUndefined: entityData === undefined,
        isArray: Array.isArray(entityData),
        isObject: typeof entityData === 'object',
        hasKeys: entityData ? Object.keys(entityData).length : 0
      });
    }
    
    // Check if data is actually loaded (not undefined or empty on first load)
    if (!entityData) {
      // Data not yet loaded - this is normal during initial sync
      log.info('📊 TableStore: Data not yet loaded for', entityTableName);
      return { entities: {}, relationships: {}, pagination: null };
    }
    
    entities = Array.isArray(entityData) ? entityData : Object.values(entityData || {});
  } catch (error) {
    log.warn('📊 TableStore: Could not access entity data, using empty array:', error.message);
    entities = [];
  }
  const totalCount = entities.length;
  const columnCount = columns?.length || 10;
  const totalCells = totalCount * columnCount;
  
  // Determine if pagination is needed
  const needsPagination = totalCount > MEMORY_LIMITS.MAX_ROWS || totalCells > MEMORY_LIMITS.MAX_CELLS;
  
  let paginatedEntities: any[];
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
    paginatedEntities = entities.slice(currentPage * pageSize, (currentPage * pageSize) + pageSize);
    
    paginationInfo = {
      enabled: true,
      currentPage,
      pageSize,
      totalRows: totalCount,
      totalPages
    };
    
    if (process.env.NODE_ENV === 'development') {
      log.info('📊 TableStore: Pagination enabled', paginationInfo);
    }
  } else {
    // Load all data
    paginatedEntities = entities;
  }
  
  // Get relationship tables and junction tables we need to load
  const relationshipTables = columns ? getUniqueRelationshipTables(columns) : [];
  const junctionTables = columns ? getUniqueJunctionTables(columns) : [];
  const relationshipConfigs = columns ? discoverRelationships(columns) : [];
  
  // Load relationships and junctions in parallel using Legend State
  const [relationshipDataArrays, junctionDataArrays] = await Promise.all([
    Promise.all(relationshipTables.map(async (tableName) => {
      const relationshipEntity$ = getEntity$(tableName);
      if (!relationshipEntity$) return [];
      try {
        const data = relationshipEntity$.peek?.() || relationshipEntity$;
        return Array.isArray(data) ? data : Object.values(data || {});
      } catch (error) {
        log.warn(`📊 TableStore: Could not load relationship data for ${tableName}:`, error.message);
        return [];
      }
    })),
    Promise.all(junctionTables.map(async (tableName) => {
      const junctionEntity$ = getEntity$(tableName);
      if (!junctionEntity$) return [];
      try {
        const data = junctionEntity$.peek?.() || junctionEntity$;
        return Array.isArray(data) ? data : Object.values(data || {});
      } catch (error) {
        log.warn(`📊 TableStore: Could not load junction data for ${tableName}:`, error.message);
        return [];
      }
    }))
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
      log.info('📊 TableStore: Loaded tags into relationships', {
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
      log.info('📊 TableStore: Processing junction table', {
        tableName,
        junctionDataCount: junctionData.length,
        sampleJunction: junctionData[0]
      });
    }
    
    // Find which relationship config uses this junction table
    const config = relationshipConfigs.find(c => c.junctionTable === tableName);
    if (config) {
      if (process.env.NODE_ENV === 'development') {
        log.info('📊 TableStore: Found config for junction table', {
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
      log.warn('📊 TableStore: No config found for junction table', tableName);
    }
  });
  
  if (process.env.NODE_ENV === 'development') {
    const entitiesWithJunctions = Object.keys(junctionsByEntity).length;
    log.info('📊 TableStore: Junction data processed', {
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
    log.info('📊 TableStore: Initial data loaded', {
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
      log.info('📊 TableStore: Found entities with tags', {
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
  const entityTableName = entityType; // Legend State uses singular names
  
  log.info('📊 TableStore: Loading page', {
    entityType,
    page,
    pageSize
  });
  
  // ✅ CORRECT: Use getUniverseEntity$() for org-prefixed entities, getEntity$() for regular entities
  const entity$ = getEntity$(entityTableName);
  
  if (!entity$) {
    throw new Error(`Entity ${entityTableName} not found or not ready`);
  }
  
  let allEntities: any[] = [];
  try {
    const entityData = entity$.peek?.() || entity$;
    allEntities = Array.isArray(entityData) ? entityData : Object.values(entityData || {});
  } catch (error) {
    log.warn('📊 TableStore: Could not access entity data for pagination:', error.message);
    allEntities = [];
  }
  
  // Apply pagination manually since Legend State doesn't have offset/limit
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  const entities = allEntities.slice(startIndex, endIndex);
  
  // Get relationship tables and junction tables we need to load
  const relationshipTables = columns ? getUniqueRelationshipTables(columns) : [];
  const junctionTables = columns ? getUniqueJunctionTables(columns) : [];
  const relationshipConfigs = columns ? discoverRelationships(columns) : [];
  
  // Load relationships and junctions in parallel using Legend State
  const [relationshipDataArrays, junctionDataArrays] = await Promise.all([
    Promise.all(relationshipTables.map(async (tableName) => {
      const relationshipEntity$ = getEntity$(tableName);
      if (!relationshipEntity$) return [];
      try {
        const data = relationshipEntity$.peek?.() || relationshipEntity$;
        return Array.isArray(data) ? data : Object.values(data || {});
      } catch (error) {
        log.warn(`📊 TableStore: Could not load relationship data for ${tableName}:`, error.message);
        return [];
      }
    })),
    Promise.all(junctionTables.map(async (tableName) => {
      const junctionEntity$ = getEntity$(tableName);
      if (!junctionEntity$) return [];
      try {
        const data = junctionEntity$.peek?.() || junctionEntity$;
        return Array.isArray(data) ? data : Object.values(data || {});
      } catch (error) {
        log.warn(`📊 TableStore: Could not load junction data for ${tableName}:`, error.message);
        return [];
      }
    }))
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
      log.info('📊 TableStore: Loaded tags into relationships', {
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
      log.info('📊 TableStore: Processing junction table', {
        tableName,
        junctionDataCount: junctionData.length,
        sampleJunction: junctionData[0]
      });
    }
    
    // Find which relationship config uses this junction table
    const config = relationshipConfigs.find(c => c.junctionTable === tableName);
    if (config) {
      if (process.env.NODE_ENV === 'development') {
        log.info('📊 TableStore: Found config for junction table', {
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
      log.warn('📊 TableStore: No config found for junction table', tableName);
    }
  });
  
  if (process.env.NODE_ENV === 'development') {
    const entitiesWithJunctions = Object.keys(junctionsByEntity).length;
    log.info('📊 TableStore: Junction data processed', {
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
  // DEPRECATED: Granular subscriptions pattern removed in favor of Legend State integration
  // Legend State handles all data synchronization automatically through XState
  
  log.info('📊 TableStore: Granular subscriptions deprecated - using Legend State integration', {
    entityType,
    columnCount: columns?.length || 0
  });
  
  // Return empty cleanup function since no subscriptions are created
  return () => {
    log.info('📊 TableStore: No subscriptions to cleanup (Legend State handles sync)');
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
      log.info('📊 TableStore: Saved display state', { entityType, displayState });
    }
  } catch (error) {
    log.error('Failed to save display state:', error);
  }
}

export function loadDisplayState(entityType: string): any | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${entityType}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (process.env.NODE_ENV === 'development') {
        log.info('📊 TableStore: Loaded display state', { entityType, parsed });
      }
      return parsed;
    }
  } catch (error) {
    log.error('Failed to load display state:', error);
  }
  return null;
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createTableStoreActor(entityType: string, columns?: any[]) {
  if (process.env.NODE_ENV === 'development') {
    log.info('📊 TableStore: Creating atomic store logic for', entityType, {
      columnCount: columns?.length || 0
    });
  }
  
  return createTableStoreLogic(entityType, columns);
}