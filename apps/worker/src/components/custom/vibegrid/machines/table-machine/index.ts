// ====================================
// TABLE MACHINE - MAIN COMPOSITION
// ====================================

import { setup, assign, spawnChild, sendTo, fromPromise, emit, raise } from 'xstate';
import type { TableContext, TableEvents, TableConfig, RenderState } from '../../types';

// Import slices
import { createInitialDimensionsState, dimensionActions } from './slices/dimensions-slice';
import { createInitialSelectionState, selectionActions } from './slices/selection-slice';
import { createInitialEditState, editActions } from './slices/edit-slice';
import { createInitialDragState, dragActions } from './slices/drag-slice';
import { createInitialOverlayState, overlayActions } from './slices/overlay-slice';

// Import event handlers
import { selectionHandlers } from './event-handlers/selection-handlers';
import { viewHandlers } from './event-handlers/view-handlers';
import { keyboardHandlers } from './event-handlers/keyboard-handlers';
import { editHandlers } from './event-handlers/edit-handlers';
import { dragHandlers } from './event-handlers/drag-handlers';
import { fillHandlers } from './event-handlers/fill-handlers';
import { clipboardHandlers } from './event-handlers/clipboard-handlers';
import { contextMenuHandlers } from './event-handlers/contextmenu-handlers';

// Import helpers
import { createViewportFromScroll, calculateVisualPositions } from './helpers/visual-position-helpers';

// ====================================
// CENTRALIZED COLUMN HELPERS
// ====================================

/**
 * Get visible columns from store data with proper ordering
 * Single source of truth for column visibility logic
 */
const getVisibleColumnsFromStore = (storeActor: any, fallbackColumns: any[] = []) => {
  const storeSnapshot = storeActor?.getSnapshot();
  const storeColumns = storeSnapshot?.context?.columns || fallbackColumns;
  const columnVisibility = storeSnapshot?.context?.columnVisibility || {};
  
  // Filter out selection column and hidden columns
  return storeColumns.filter(col => 
    col.id !== '__selection' && columnVisibility[col.id] !== false
  );
};

/**
 * Add selection column if enabled
 */
const addSelectionColumnIfEnabled = (columns: any[], enableSelectionColumn: boolean) => {
  return enableSelectionColumn
    ? [{ id: '__selection', field: '__selection', name: 'Select', width: 48 }, ...columns]
    : columns;
};

// Import actors
import { rendererActor } from '../../actors/renderer-actor';
import { canvasActor } from '../../actors/canvas-actor';
import { editActor } from '../../actors/edit-actor';
import { dragActor } from '../../actors/drag-actor';
// Data subscription actor removed - using store subscription
// No overlay actor needed - canvas subscribes directly to table machine context

// Import atomic store setup utilities  
import { createTableStoreLogic, loadInitialData, setupGranularSubscriptions } from '../../stores/table-data-store-atomic';
import { createActor } from 'xstate';
import { addRelationshipProvidersToColumns } from '../../providers/relationship-provider-factory';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/machines/table-machine/index.ts');


// ====================================
// CONTEXT CREATION
// ====================================

const createDefaultContext = (input: TableConfig): TableContext => {
  // Check if we have pre-processed initial data from route loader
  const hasInitialData = !!input.initialData;
  const initialRowCount = hasInitialData ? input.initialData.processedRows?.length || 0 : 0;
  const rowHeight = input.settings?.rowHeight || 40;
  const initialRowIds = hasInitialData ? input.initialData.processedRows?.map(row => row.id) || [] : [];
  
  log.info('TableMachine: Creating context', {
    hasInitialData,
    initialRowCount,
    entitiesCount: input.entities?.length || 0,
    hasEntities: !!input.entities
  });
  
  // Load persisted data if available (sync machine pattern)
  const persistedData = input.persistedData;
  
  // View state is now managed by the store - just get column order for coordinate mapping
  const persistedColumnOrder = persistedData?.columnOrder || [];
  const persistedColumnVisibility = persistedData?.columnVisibility || {};
  
  // Create dimension state with persisted column widths
  const dimensionState = createInitialDimensionsState(
    input.columns || [],
    initialRowCount,
    rowHeight,
    persistedColumnOrder, // Pass column order for coordinate mapping
    persistedColumnVisibility, // Pass column visibility
    persistedData?.columnWidths // Pass persisted column widths
  );
  
  // Create selection state
  const selectionState = createInitialSelectionState();
  
  // Create edit state
  const editState = createInitialEditState();
  
  // Create drag state
  const dragState = createInitialDragState();
  
  // Create overlay state
  const overlayState = createInitialOverlayState(input.settings?.initialViewport);
  
  // Add relationship providers to columns - they'll use the store actor from context
  const columnsWithProviders = addRelationshipProvidersToColumns(
    input.columns || [],
    () => {
      // Use window fallback since we don't have context here
      return (window as any).__vibegrid_store_actor;
    }
  );

  return {
    id: input.id,
    entityType: input.entityType,
    columns: columnsWithProviders,
    rows: hasInitialData ? input.initialData.processedRows : [], // Use pre-processed rows if available
    visibleRowIds: initialRowIds,
    allRowIds: initialRowIds,
    settings: {
      enableVirtualScrolling: true,
      enableGrouping: false,
      enableFiltering: false,
      enableFormulas: false,
      pageSize: 50,
      rowHeight: rowHeight,
      bufferSize: 10,
      ...input.settings
    },
    version: 0,
    enableSelectionColumn: true, // Always enabled
    
    // Store initial data for immediate rendering
    initialData: hasInitialData ? input.initialData : null,
    hasInitialData: hasInitialData, // Track whether we have preloaded data
    
    // Spread dimension state
    ...dimensionState,
    
    // Spread selection state
    ...selectionState,
    
    // View state now managed by store - just keep viewport for coordinate calculations
    viewport: input.settings?.initialViewport || null,
    
    // Spread edit state
    ...editState,
    
    // Spread drag state
    ...dragState,
    
    // Spread overlay state
    ...overlayState,
    
    // Context menu state
    contextMenu: {
      isVisible: false,
      position: null,
      context: null
    },
    
    // DEPRECATED: Legacy coordinate manager - disabled in favor of unified coordinateMapping
    coordinateManager: null,
    
    // Coordinate mapping from coordinate actor - use initial data if available
    coordinateMapping: hasInitialData ? input.initialData.coordinateMapping : null,
    
    // Entities from parent component (via useSelector)
    entities: input.entities || [],
    
    // Relationship resolvers
    relationshipResolvers: input.relationshipResolvers || {},
    
    // Entity update handler
    onEntityUpdate: input.onEntityUpdate,
    
    // Batch entity update handler
    onBatchEntityUpdate: input.onBatchEntityUpdate,
    
    // Notification handler
    onNotification: input.onNotification,
    
    actors: {
      rendererActor: null,
      canvasActor: null,
      selectionCoordinator: null,
      dragCoordinator: null,
      rowActors: new Map()
    },
    
    performance: {
      lastRenderTime: 0,
      totalRows: initialRowCount,
      visibleRows: 0,
      activeActors: 0
    },
    
    // Canvas container reference (stored for lazy initialization)
    canvasContainer: null,
    
    // Track if we're using pre-resolved initial data from loader
    // (hasInitialData already set above at line 112)
    
    // Timer for batching view updates during rapid data changes
    pendingViewUpdateTimer: null,
    
    // Atomic store actor (will be created in initializing state)
    storeActor: null,
    
    // Column widths from store (for initial render)
    columnWidths: {}
  };
};


// ====================================
// MAIN TABLE MACHINE
// ====================================

export const tableBaseMachine = setup({
  types: {
    context: {} as TableContext,
    events: {} as TableEvents,
    input: {} as TableConfig,
    emitted: {} as
      | { type: 'vibegridx.cell.click'; rowId: string; columnId: string }
      | { type: 'vibegridx.cell.edit'; rowId: string; columnId: string; value: any }
      | { type: 'vibegridx.selection.change'; selectedCells: Set<string> }
      | { type: 'vibegridx.fill.start'; originalCells: Set<string>; direction: 'vertical' | 'horizontal' }
      | { type: 'vibegridx.fill.complete'; originalCells: Set<string>; fillCells: Set<string> }
      | { type: 'vibegridx.perf.render'; duration: number; cellCount: number }
      | { type: 'vibegridx.error'; error: Error; context: string }
  },
  
  actors: {
    rendererActor,
    canvasActor,
    editActor,
    dragActor,
  },
  
  actions: {
    // Dimension actions
    ...dimensionActions,
    
    // Selection actions  
    ...selectionActions,
    
    // View actions removed - now handled by store
    
    // Edit actions
    ...editActions,
    
    // Drag actions
    ...dragActions,
    
    // Overlay actions
    ...overlayActions,
    
    // Additional actions
    logError: ({ event, context }) => {
      log.error('🔴 TableMachine ERROR detected:', {
        event,
        errorType: event?.type,
        errorMessage: event?.error?.message || event?.error,
        errorStack: event?.error?.stack,
        contextKeys: Object.keys(context || {}),
        contextSize: JSON.stringify(context || {}).length
      });
    },
    
    updateCoordinateMapping: assign({
      coordinateMapping: (_, event: any) => event.mapping
    }),
    
    forwardToCanvas: ({ context, event }) => {
      log.info('TableMachine: forwardToCanvas action', {
        hasCanvasActor: !!context.actors.canvasActor,
        eventType: event.type,
        innerEventType: (event as any).event?.type
      });
      
      if (context.actors.canvasActor) {
        context.actors.canvasActor.send((event as any).event);
      } else {
        log.error('TableMachine: No canvas actor available for forwarding');
      }
    },
    
    forwardToRenderer: ({ context, event }) => {
      log.info('TableMachine: forwardToRenderer action', {
        hasRendererActor: !!context.actors.rendererActor,
        eventType: event.type,
        innerEventType: (event as any).event?.type
      });
      
      if (context.actors.rendererActor) {
        context.actors.rendererActor.send((event as any).event);
      } else {
        log.error('TableMachine: No renderer actor available for forwarding');
      }
    },
    
    // Persistence action - now persists to store
    persistSnapshot: ({ context, self }) => {
      if (typeof window === 'undefined') return;
      
      const key = `vibegridx-${context.id}-state`;
      try {
        // Get view state from store actor
        const storeSnapshot = context.storeActor?.getSnapshot();
        const storeContext = storeSnapshot?.context;
        
        const stateToPersist = {
          value: self.getSnapshot().value,
          context: {
            // Only persist the UI state fields from store
            rowHeight: context.rowHeight,
            sortBy: storeContext?.sortBy || [],
            filters: storeContext?.filters || [],
            groupBy: storeContext?.groupBy || [],
            columnVisibility: storeContext?.columnVisibility || {},
            columnOrder: storeContext?.columnOrder || [],
            hiddenColumnCount: Object.values(storeContext?.columnVisibility || {}).filter(v => !v).length,
            settings: context.settings,
            viewport: context.viewport,
            // Persist column widths from coordinate mapping
            columnWidths: context.coordinateMapping?.columns ? 
              Object.fromEntries(context.coordinateMapping.columns.map(col => [col.columnId, col.width])) : 
              {}
          }
        };
        
        const serialized = JSON.stringify(stateToPersist);
        localStorage.setItem(key, serialized);
        
        // Enhanced logging to show what's being saved
        log.info('🔵 TableMachine: SAVING state to localStorage', {
          key,
          tableId: context.id,
          entityType: context.entityType,
          snapshotSize: serialized.length,
          persistedFields: stateToPersist.context,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        log.error('🔴 TableMachine: FAILED to persist snapshot:', error);
        log.error('Error details:', error.message);
      }
    }
  }
}).createMachine({
  id: 'tableBaseMachine',
  context: ({ input }) => {
    try {
      const context = createDefaultContext(input);
      return context;
    } catch (error) {
      log.error('TableMachine: Error creating context:', error);
      // Return a minimal valid context
      return {
        id: input.id,
        entityType: input.entityType || 'unknown',
        columns: input.columns || [],
        rows: [],
        visibleRowIds: [],
        allRowIds: [],
        settings: input.settings || {},
        version: 0,
        enableSelectionColumn: true, // Selection column is always enabled
        entities: [],
        relationshipResolvers: {},
        actors: {},
        coordinateManager: null,
        coordinateMapping: null,
        // Add other required fields with defaults
        rowHeight: 40,
        totalRows: 0,
        selectedCells: new Set(),
        anchorCell: null,
        viewport: null,
        storeActor: null,
        columnWidths: {}
      };
    }
  },
  
  initial: 'initializing',
  
  // Clean up timer on machine exit
  exit: ({ context }) => {
    if (context.pendingViewUpdateTimer) {
      clearTimeout(context.pendingViewUpdateTimer);
      context.pendingViewUpdateTimer = null;
    }
  },
  
  states: {
    initializing: {
      entry: [
        // Create store actor with atomic mutations and Promise.all loader
        assign({
          storeActor: ({ context, self }) => {
            log.info('TableMachine: Creating atomic store actor for', context.entityType);
            const storeLogic = createTableStoreLogic(context.entityType, context.columns);
            const storeActor = createActor(storeLogic);
            storeActor.start();
            
            // Store in window for relationship providers
            (window as any).__vibegrid_store_actor = storeActor;
            
            // Subscribe to store changes and forward to table machine
            log.info('TableMachine: Setting up store subscription', { 
              hasSubscribe: typeof storeActor.subscribe === 'function',
              storeActorKeys: Object.keys(storeActor)
            });
            
            // Set up persistence subscription for display state changes
            storeActor.subscribe((snapshot) => {
              if (snapshot?.context && !snapshot.context.loading) {
                // Debounce persistence to avoid too many writes
                if ((context as any)._persistenceTimer) {
                  clearTimeout((context as any)._persistenceTimer);
                }
                (context as any)._persistenceTimer = setTimeout(() => {
                  import('../../stores/table-data-store-atomic').then(({ saveDisplayState }) => {
                    saveDisplayState(context.entityType, snapshot.context);
                  });
                }, 500); // 500ms debounce
              }
            });
            
            // Get initial snapshot to verify structure
            const initialSnapshot = storeActor.getSnapshot();
            log.info('🔍 TableMachine: Initial store snapshot', {
              initialSnapshot,
              hasContext: !!initialSnapshot?.context,
              contextKeys: initialSnapshot?.context ? Object.keys(initialSnapshot.context) : [],
              entityCount: initialSnapshot?.context?.entities ? Object.keys(initialSnapshot.context.entities).length : 0
            });
            
            const subscription = storeActor.subscribe((snapshot) => {
              log.info('🔍 TableMachine: Atomic store snapshot received', {
                snapshot,
                hasContext: !!snapshot?.context,
                hasEntities: !!snapshot?.context?.entities,
                entitiesCount: snapshot?.context?.entities ? Object.keys(snapshot.context.entities).length : 0,
                rowCount: snapshot?.context?.processedRows?.length || 0,
                loading: snapshot?.context?.loading,
                currentState: (self as any).getSnapshot?.()?.value
              });
              
              self.send({ 
                type: 'STORE_SNAPSHOT_RECEIVED', 
                snapshot 
              });
            });
            
            log.info('TableMachine: Store subscription created', { hasSubscription: !!subscription });
            
            // Load initial data with Promise.all then setup granular subscriptions
            loadInitialData(context.entityType, context.columns)
              .then(({ entities, relationships, pagination }) => {
                log.info('TableMachine: Promise.all initial load complete', {
                  entityCount: Object.keys(entities).length,
                  relationshipTables: Object.keys(relationships),
                  paginationEnabled: !!pagination
                });
                
                // Set initial data atomically using event
                storeActor.send({ type: 'setInitialData', entities, relationships });
                
                // Set pagination if needed
                if (pagination) {
                  storeActor.send({ type: 'setPagination', pagination });
                }
                
                // SYNCHRONOUS: Send data directly to table machine (bypass subscription timing)
                log.info('🚀 TableMachine: Sending data SYNCHRONOUSLY to avoid timing issues');
                self.send({
                  type: 'STORE_DATA_UPDATED',
                  entities: Object.values(entities),
                  loading: false,
                  source: 'synchronous_initial_load'
                });
                
                // Setup granular subscriptions for live updates
                // Only enable if not in pagination mode (for now)
                if (!pagination) {
                  const cleanup = setupGranularSubscriptions(storeActor, context.entityType, context.columns);
                  
                  // Store cleanup in global registry
                  (window as any).__vibegrid_store_cleanup = () => {
                    if (cleanup && typeof cleanup === 'function') {
                      cleanup();
                    }
                    storeActor.stop();
                    delete (window as any).__vibegrid_store_actor;
                  };
                } else {
                  log.info('📊 TableMachine: Pagination mode - live queries disabled for performance');
                }
              })
              .catch(error => {
                log.error('TableMachine: Initial data load failed', error);
                storeActor.send({ type: 'setError', error: error.message });
              });
            
            return storeActor;
          }
        }),
        
        // Spawn essential actors (canvas deferred to post-render)
        assign({
          actors: ({ context, spawn }) => ({
            ...context.actors,
            rendererActor: spawn('rendererActor', {
              id: 'renderer',
              input: { 
                containerId: context.id,
                enableSelectionColumn: context.enableSelectionColumn
              }
            })
            // canvasActor: deferred to post-render to avoid blocking critical path
            // editActor: spawn as needed for editing
            // dragActor: spawn as needed for drag operations
            // viewActor is invoked as needed, not spawned
          })
        }),
        
        // NOTE: INITIALIZE is now sent by React component when DOM is ready
        // This prevents race condition with DOM elements
      ],
      
      on: {
        INITIALIZE_RENDERER: {
          actions: ({ context, event, self }) => {
            log.info('TableMachine: INITIALIZE_RENDERER event received', {
              hasRendererActor: !!context.actors.rendererActor,
              optionsKeys: Object.keys(event.options || {})
            });
            
            if (context.actors.rendererActor) {
              // Initialize renderer without editing callbacks (editing handled by edit-handlers.ts directly)
              context.actors.rendererActor.send({
                type: 'INITIALIZE',
                options: event.options
              });
            }
          }
        },
        
// SET_VISIBLE_ENTITIES removed - we always use pre-loaded data from route loader
        
        RENDERER_READY: {
          target: 'active',
          actions: [
            // Spawn canvas actor post-render for selection handling
            assign({
              actors: ({ context, spawn }) => {
                log.info('TableMachine: Spawning canvas actor post-render');
                return {
                  ...context.actors,
                  canvasActor: spawn('canvasActor', { id: 'canvas' })
                };
              }
            }),
            // Initialize editing actor with editing container (will be set later)
            ({ context }) => {
              log.info('TableMachine: Editing actor spawned, waiting for editing container');
            }
          ]
        },
        
        // CANVAS_CONTAINER_READY: Deferred to post-render in active state
      },
      
      // Remove child states - causing error "No initial state specified"
    },
    
    active: {
      initial: 'idle',
      
      // Store subscription is now set up in initializing state
      entry: [
        // Check if we have data that needs initial rendering
        ({ context, self }) => {
          log.info('🔍 TableMachine: Entering active state', {
            hasRows: context.rows.length > 0,
            rowCount: context.rows.length,
            hasRenderer: !!context.actors.rendererActor
          });
          
          // If we have rows but haven't rendered yet, trigger initial render
          if (context.rows.length > 0 && context.actors.rendererActor) {
            log.info('🔍 TableMachine: Triggering initial render on active entry');
            
            // Get visible columns using centralized logic
            const visibleColumns = getVisibleColumnsFromStore(context.storeActor, context.columns);
            const columnsWithSelection = addSelectionColumnIfEnabled(visibleColumns, context.enableSelectionColumn);
            
            // Send coordinate calculation request
            context.actors.rendererActor.send({
              type: 'CALCULATE_COORDINATES',
              rows: context.rows,
              columns: columnsWithSelection,
              columnWidths: context.columnWidths || (context.coordinateMapping?.columns
                ? Object.fromEntries(context.coordinateMapping.columns.map(col => [col.columnId, col.width]))
                : undefined)
            });
          }
        }
      ],
      
      states: {
        idle: {
          entry: [],
          
          on: {
            
            
            // Handle data updates from subscription actor (only for entity mode, not manual mode)
            DATA_UPDATE: {
              actions: [
                assign({
                  entities: ({ context, event }) => {
                    log.info('TableMachine: DATA_UPDATE received', {
                      table: event.table,
                      oldEntityCount: context.entities.length,
                      newEntityCount: event.data?.length || 0,
                      timestamp: performance.now(),
                      sampleOldEntity: context.entities[0],
                      sampleNewEntity: event.data?.[0],
                      firstThreeNewIds: event.data?.slice(0, 3).map((item: any) => item.id)
                    });
                    return event.data || [];
                  }
                }),
                // Batch view updates to prevent reflow during rapid sync updates
                ({ self, context }) => {
                  log.info('TableMachine: DATA_UPDATE - batching view actor trigger');
                  
                  // Clear any existing pending update timer
                  if (context.pendingViewUpdateTimer) {
                    clearTimeout(context.pendingViewUpdateTimer);
                  }
                  
                  // Set a new timer to batch multiple updates
                  context.pendingViewUpdateTimer = setTimeout(() => {
                    log.info('TableMachine: DATA_UPDATE - executing batched view update');
                    // Data processing now handled by store subscription
                    context.pendingViewUpdateTimer = null;
                  }, 150); // 150ms batching window
                }
              ]
            },
            
            // Handle targeted data changes for surgical updates
            DATA_CHANGES: {
              actions: [
                // Update specific entities based on changes
                assign({
                  entities: ({ context, event }) => {
                    log.info('TableMachine: DATA_CHANGES received', {
                      table: event.table,
                      changesCount: event.changes.length,
                      changeTypes: event.changes.map(c => `${c.operation}:${c.id}`),
                      firstChangeDetail: event.changes[0] ? {
                        id: event.changes[0].id,
                        operation: event.changes[0].operation,
                        changedFields: event.changes[0].changedFields,
                        hasChangedFields: 'changedFields' in event.changes[0],
                        changedFieldsType: typeof event.changes[0].changedFields
                      } : null
                    });
                    
                    const updatedEntities = [...context.entities];
                    
                    for (const change of event.changes) {
                      const index = updatedEntities.findIndex(e => e.id === change.id);
                      
                      switch (change.operation) {
                        case 'update':
                          if (index !== -1) {
                            updatedEntities[index] = change.data;
                          }
                          break;
                        case 'insert':
                          if (index === -1) {
                            updatedEntities.push(change.data);
                          }
                          break;
                        case 'delete':
                          if (index !== -1) {
                            updatedEntities.splice(index, 1);
                          }
                          break;
                      }
                    }
                    
                    return updatedEntities;
                  }
                }),
                
                // Send surgical updates to renderer
                ({ context, event, self }) => {
                  log.info('TableMachine: DATA_CHANGES - processing updates', {
                    changeCount: event.changes.length,
                    sortedBy: context.sortBy?.map(s => s.field),
                    hasSortConfig: context.sortBy?.length > 0
                  });
                  
                  // Check if any changes affect sorted columns
                  const affectsSortedColumn = event.changes.some(change => {
                    if (change.operation !== 'update') {
                      return false;
                    }
                    
                    log.info('TableMachine: Checking sort impact for change', {
                      changeId: change.id,
                      changedFields: change.changedFields,
                      hasChangedFields: !!change.changedFields,
                      sortedColumns: context.sortBy?.map(s => s.field) || []
                    });
                    
                    // If no changedFields provided, we can't determine impact
                    if (!change.changedFields || change.changedFields.length === 0) {
                      log.warn('TableMachine: No changedFields provided, assuming sort might be affected');
                      return true; // Conservative: assume sort is affected
                    }
                    
                    // Check if any changed field is a sorted column
                    return context.sortBy?.some(sort => 
                      change.changedFields.includes(sort.field)
                    );
                  });
                  
                  // For simple updates that don't affect sort order, use surgical updates
                  if (event.changes.every(c => c.operation === 'update') && !affectsSortedColumn) {
                    log.info('TableMachine: DATA_CHANGES - sending surgical updates (no sort impact)');
                    // Send surgical update event to renderer
                    if (context.actors.rendererActor) {
                      context.actors.rendererActor.send({
                        type: 'SURGICAL_UPDATE',
                        changes: event.changes,
                        relationshipResolvers: context.relationshipResolvers
                      });
                    }
                  } else {
                    // For inserts/deletes or updates affecting sorted columns, trigger full view update
                    log.info('TableMachine: DATA_CHANGES - triggering full view update', {
                      hasInsertDelete: event.changes.some(c => c.operation !== 'update'),
                      affectsSortedColumn
                    });
                    // Data processing now handled by store subscription
                  }
                }
              ]
            },
            
            DATA_SUBSCRIPTION_ERROR: {
              actions: ({ event }) => {
                log.error('TableMachine: Data subscription error:', event);
              }
            },
            
            // Handle relationship data updates from subscription actor
            RELATIONSHIP_DATA_UPDATE: {
              actions: [
                // Update relationship resolvers with new data
                assign({
                  relationshipResolvers: ({ context, event }) => {
                    log.info('TableMachine: RELATIONSHIP_DATA_UPDATE received', {
                      table: event.table,
                      dataCount: event.data?.length || 0
                    });
                    
                    // Find columns that use this relationship table
                    const affectedColumns = context.columns.filter(col => {
                      // Check various relationship table name formats
                      return col.relationshipTable === event.table ||
                             col.relationshipTable === event.table.replace(/s$/, '') ||
                             col.relationshipTable === `${event.table.replace(/s$/, '')}s`;
                    });
                    
                    if (affectedColumns.length === 0) {
                      return context.relationshipResolvers; // No columns use this table
                    }
                    
                    // Convert array to id-keyed object for fast lookup
                    const dataMap = event.data.reduce((acc: any, item: any) => {
                      acc[item.id] = item;
                      return acc;
                    }, {});
                    
                    // Update resolvers for affected columns
                    const newResolvers = { ...context.relationshipResolvers };
                    
                    affectedColumns.forEach(column => {
                      const displayField = column.relationshipDisplayField || 'displayName';
                      
                      newResolvers[column.id] = (id: string | string[]) => {
                        if (Array.isArray(id)) {
                          return id.map(i => {
                            const entity = dataMap[i];
                            if (!entity) return i;
                            return entity[displayField] || entity.displayName || entity.name || entity.title || i;
                          }).join(', ');
                        }
                        
                        const entity = dataMap[id];
                        if (!entity) return id;
                        return entity[displayField] || entity.displayName || entity.name || entity.title || id;
                      };
                    });
                    
                    return newResolvers;
                  }
                }),
                
                // Trigger view refresh to update relationship displays (with batching)
                ({ self, context }) => {
                  // Skip view refresh if we're using pre-resolved initial data
                  // The initial subscription emissions don't need to trigger re-renders
                  if (context.hasInitialData && context.viewVersion <= 10) {
                    log.info('TableMachine: RELATIONSHIP_DATA_UPDATE - skipping view refresh (using pre-resolved initial data)');
                    return;
                  }
                  
                  log.info('TableMachine: RELATIONSHIP_DATA_UPDATE - batching view refresh');
                  
                  // Clear any existing pending update timer
                  if (context.pendingViewUpdateTimer) {
                    clearTimeout(context.pendingViewUpdateTimer);
                  }
                  
                  // Set a new timer to batch multiple updates
                  context.pendingViewUpdateTimer = setTimeout(() => {
                    log.info('TableMachine: RELATIONSHIP_DATA_UPDATE - executing batched view update');
                    // Data processing now handled by store subscription
                    context.pendingViewUpdateTimer = null;
                  }, 150); // 150ms batching window
                }
              ]
            },
            
            
            // Include all common event handlers in idle state
            ...selectionHandlers,
            ...viewHandlers,
            ...keyboardHandlers,
            ...editHandlers,
            ...dragHandlers,
            ...fillHandlers,
            ...clipboardHandlers,
            ...contextMenuHandlers
          }
        }
      },
      
      // Handle these events at the active state level
      on: {
      // Handle store snapshot updates - simplified flow
      STORE_SNAPSHOT_RECEIVED: {
        actions: [
          // Update context with processed data from store
          assign({
            entities: ({ event }) => event.snapshot?.context?.entities ? Object.values(event.snapshot.context.entities) : [],
            rows: ({ event }) => event.snapshot?.context?.processedRows || [],
            visibleRowIds: ({ event }) => event.snapshot?.context?.processedRows?.map((r: any) => r.id) || [],
            sortBy: ({ event }) => event.snapshot?.context?.sortBy || [],
            filters: ({ event }) => event.snapshot?.context?.filters || [],
            columnVisibility: ({ event }) => event.snapshot?.context?.columnVisibility || {},
            columnOrder: ({ event }) => event.snapshot?.context?.columnOrder || [],
            columnWidths: ({ event }) => event.snapshot?.context?.columnWidths || {},
            // CRITICAL: Update columns from store to get the correct order!
            columns: ({ event }) => event.snapshot?.context?.columns || []
          }),
          
          // Recalculate coordinate mapping with the new columns from store
          dimensionActions.recalculateCoordinateMapping,
          
          // Always render when store emits new data - store decides what changed
          ({ context, self, event }) => {
            if (!context.actors.rendererActor) {
              log.info('🔍 TableMachine: No renderer actor available');
              return;
            }
            
            // Enhanced logging to track relationship updates
            const previousRows = (self as any).getSnapshot?.()?.context?.rows || [];
            const relationshipColumns = context.columns.filter(col => 
              col.cellType?.startsWith('relationship') || col.type?.startsWith('relationship')
            );
            
            // Check if any relationship data changed
            const relationshipChanges = [];
            if (previousRows.length === context.rows.length) {
              for (let i = 0; i < context.rows.length; i++) {
                const prevRow = previousRows[i];
                const newRow = context.rows[i];
                if (prevRow && newRow && prevRow.id === newRow.id) {
                  relationshipColumns.forEach(col => {
                    const prevValue = prevRow.data[col.field];
                    const newValue = newRow.data[col.field];
                    const prevResolved = prevRow.data[`__resolved_${col.id}`];
                    const newResolved = newRow.data[`__resolved_${col.id}`];
                    
                    if (JSON.stringify(prevValue) !== JSON.stringify(newValue) || 
                        JSON.stringify(prevResolved) !== JSON.stringify(newResolved)) {
                      relationshipChanges.push({
                        rowId: newRow.id,
                        column: col.name,
                        field: col.field,
                        oldValue: prevValue,
                        newValue: newValue,
                        oldResolved: prevResolved,
                        newResolved: newResolved
                      });
                    }
                  });
                }
              }
            }
            
            log.info('🔍 TableMachine: Store update received, rendering', {
              rowCount: context.rows.length,
              columnCount: context.columns.length,
              relationshipColumns: relationshipColumns.map(c => c.name),
              relationshipChanges: relationshipChanges.length > 0 ? relationshipChanges : 'none',
              lastProcessedAt: event.snapshot?.context?.lastProcessedAt
            });
            
            // Get visible columns using centralized logic
            const visibleColumns = getVisibleColumnsFromStore(context.storeActor, context.columns);
            const columnsWithSelection = addSelectionColumnIfEnabled(visibleColumns, context.enableSelectionColumn);
            
            context.actors.rendererActor.send({
              type: 'CALCULATE_COORDINATES',
              rows: context.rows,
              columns: columnsWithSelection,
              columnWidths: context.columnWidths || (context.coordinateMapping?.columns
                ? Object.fromEntries(context.coordinateMapping.columns.map(col => [col.columnId, col.width]))
                : undefined)
            });
          }
        ]
      },
      
      // Handle coordinate calculation response from renderer
      COORDINATES_CALCULATED: {
        actions: [
          // Update coordinate mapping
          assign({
            coordinateMapping: ({ event }) => event.mapping,
            version: ({ context }) => context.version + 1
          }),
          
          // Send coordinates to canvas if available
          ({ context, event }) => {
            if (context.actors.canvasActor) {
              context.actors.canvasActor.send({
                type: 'UPDATE_COORDINATES',
                mapping: event.mapping
              });
            }
          },
          
          // Send render command to renderer with full state
          ({ context }) => {
            if (context.actors.rendererActor) {
              // Get visible columns using centralized logic
              const visibleColumns = getVisibleColumnsFromStore(context.storeActor, context.columns);
              const columnsWithSelection = addSelectionColumnIfEnabled(visibleColumns, context.enableSelectionColumn);
              
              // Get store state for render data
              const storeSnapshot = context.storeActor?.getSnapshot();
              const columnVisibility = storeSnapshot?.context?.columnVisibility || {};
              
              // Merge column widths from coordinate mapping into columns
              const columnsWithWidths = columnsWithSelection.map(col => {
                if (context.coordinateMapping) {
                  const coordCol = context.coordinateMapping.columns.find(c => c.columnId === col.id);
                  return coordCol ? { ...col, width: coordCol.width } : col;
                }
                return col;
              });
              
              context.actors.rendererActor.send({
                type: 'RENDER',
                state: {
                  rows: context.rows,
                  columns: columnsWithWidths,
                  selectedCells: context.selectedCells,
                  editingCell: null,
                  groupedData: [],
                  optimisticOperations: new Map(),
                  version: context.version,
                  sortBy: storeSnapshot?.context?.sortBy || [],
                  columnVisibility: columnVisibility,
                  coordinateMapping: context.coordinateMapping
                }
              });
            }
          }
        ]
      },
      
      // PERFORMANCE: Initialize canvas actor for selection (post-render spawning)
      SPAWN_CANVAS_ACTOR_FOR_SELECTION: {
        actions: [
          assign({
            actors: ({ context, spawn }) => {
              // Spawn canvas actor if it doesn't exist yet (post-render spawning)
              if (!context.actors.canvasActor) {
                log.info('TableMachine: Spawning canvas actor for selection');
                return {
                  ...context.actors,
                  canvasActor: spawn('canvasActor', { id: 'canvas' })
                };
              }
              return context.actors;
            }
          }),
          ({ context }) => {
            // Ensure canvas actor is initialized with container
            if (context.actors.canvasActor && context.canvasContainer) {
              log.info('TableMachine: Ensuring canvas actor is initialized for selection');
              
              // Initialize if not already done
              context.actors.canvasActor.send({
                type: 'INITIALIZE',
                container: context.canvasContainer,
                config: {
                  cellHeight: context.settings.rowHeight,
                  cellWidth: 120,
                  selectionColor: '#3b82f6',
                  selectionBorderColor: '#1d4ed8',
                  editingColor: '#10b981',
                  editingBorderColor: '#059669',
                  enableAnimations: false,
                  animationDuration: 0,
                  borderWidth: 2
                }
              });
              
              // Send coordinate mapping to the canvas
              if (context.coordinateMapping) {
                context.actors.canvasActor.send({
                  type: 'UPDATE_COORDINATES',
                  mapping: context.coordinateMapping
                });
              }
              
              // Send current selection to canvas after initialization
              setTimeout(() => {
                const visualPositions = calculateVisualPositions(
                  context.selectedCells,
                  context.coordinateMapping,
                  context.viewport,
                  context.settings.rowHeight
                );
                
                if (visualPositions.length > 0) {
                  context.actors.canvasActor!.send({
                    type: 'UPDATE_SELECTION_VISUAL',
                    visualCells: visualPositions
                  });
                }
              }, 10);
            }
          }
        ]
      },
      
      // Canvas actor is now pre-created, these actions are no longer needed
      SPAWN_CANVAS_ACTOR: {
        actions: [
          ({ context }) => {
            log.info('TableMachine: SPAWN_CANVAS_ACTOR called but canvas is pre-created', {
              hasCanvasActor: !!context.actors.canvasActor
            });
          }
        ]
      },
      
      // Canvas actor is now pre-created, these actions are no longer needed
      SPAWN_CANVAS_AFTER_RENDER: {
        actions: [
          ({ context }) => {
            log.info('TableMachine: SPAWN_CANVAS_AFTER_RENDER called but canvas is pre-created', {
              hasCanvasActor: !!context.actors.canvasActor
            });
          }
        ]
      },
      
      // Canvas initialization (post-render)
      CANVAS_CONTAINER_READY: {
        actions: [
          ({ context, event }) => {
            log.info('TableMachine: Canvas container ready post-render', {
              container: event.container,
              version: context.version,
              hasCanvasActor: !!context.actors.canvasActor,
              hasCoordinateMapping: !!context.coordinateMapping,
              hasCanvasContainer: !!context.canvasContainer
            });
            
            // Check if canvas was already initialized
            if (context.canvasContainer) {
              log.info('TableMachine: Canvas already initialized, skipping duplicate initialization');
              return;
            }
            
            // Store container for canvas initialization
            context.canvasContainer = event.container;
            
            // Initialize canvas actor if it exists (spawned post-render)
            if (context.actors.canvasActor && event.container) {
              log.info('TableMachine: Scheduling canvas initialization to not block UI');
              
              // Defer canvas initialization to next tick to not block the table
              requestAnimationFrame(() => {
                // Initialize canvas
                context.actors.canvasActor.send({
                  type: 'INITIALIZE',
                  container: event.container,
                  config: {
                    cellHeight: context.settings.rowHeight,
                    cellWidth: 120,
                    selectionColor: '#3b82f6',
                    selectionBorderColor: '#1d4ed8',
                    editingColor: '#10b981',
                    editingBorderColor: '#059669',
                    enableAnimations: false,
                    animationDuration: 0,
                    borderWidth: 2
                  }
                });
                
                // Send coordinate mapping after initialization
                if (context.coordinateMapping) {
                  log.info('TableMachine: Sending coordinate mapping to canvas');
                  context.actors.canvasActor.send({
                    type: 'UPDATE_COORDINATES',
                    mapping: context.coordinateMapping
                  });
                }
                
                // Send initial viewport to canvas after a small delay to ensure canvas is ready
                if (context.viewport) {
                  setTimeout(() => {
                    log.info('TableMachine: Sending initial viewport to canvas (delayed)', context.viewport);
                    context.actors.canvasActor.send({
                      type: 'UPDATE_VIEWPORT',
                      viewport: context.viewport
                    });
                  }, 50); // Small delay to ensure canvas initialization is complete
                }
              });
            }
            
            // Note: EditingOverlay is now managed directly by edit-handlers.ts
            // No separate actor initialization needed
          }
        ]
      },
      
      // Selection events
      ...selectionHandlers,
      
      // View events
      ...viewHandlers,
      
      // Keyboard events
      ...keyboardHandlers,
      
      // Edit events
      ...editHandlers,
      
      // Drag events
      ...dragHandlers,
      
      // Fill events (from canvas actor)
      ...fillHandlers,
      
      // Clipboard events
      ...clipboardHandlers,
      
      // Context menu events
      ...contextMenuHandlers,
      
      // Legacy edit events (now handled by edit slice)
      'edit.legacy.*': {
        actions: sendTo(
          ({ context }) => context.actors.editActor!,
          ({ event }) => event
        )
      },
      
      // Legacy drag events (now handled by drag slice)
      'drag.legacy.*': {
        actions: sendTo(
          ({ context }) => context.actors.dragActor!,
          ({ event }) => event
        )
      },
      
      // Coordinate updates from view actor
      'COORDINATE_UPDATE': {
        actions: [
          'updateCoordinateMapping',
          sendTo(
            ({ context }) => context.actors.canvasActor!,
            ({ event }) => ({
              type: 'UPDATE_COORDINATES',
              mapping: event.mapping
            })
          )
        ]
      },
      
      // Entity configuration
      'SET_ENTITY_TYPE': {
        actions: [
          assign({
            entityType: ({ event }) => event.entityType,
            columns: ({ event }) => event.columns
          }),
          
          // Trigger coordinate recalculation
          raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
          
          // Send to edit actor
          sendTo(
            ({ context }) => context.actors.editActor!,
            ({ event }) => ({ type: 'COLUMNS_CHANGED', columns: event.columns })
          ),
          
          // Send entity type to edit actor
          sendTo(
            ({ context }) => context.actors.editActor!,
            ({ event }) => ({ type: 'ENTITY_TYPE_CHANGED', entityType: event.entityType })
          )
        ]
      },
      
      // Entity data updates from atom subscriptions
      'SET_ENTITIES': {
        actions: [
          // Update entities in context
          assign({
            entities: ({ event, context }) => {
              // If we have existing entities, maintain their order when possible
              // This prevents re-ordering when Object.values() returns a different order
              if (context.entities.length > 0) {
                const newEntitiesMap = new Map(event.entities.map(e => [e.id, e]));
                const orderedEntities: any[] = [];
                
                // First, add all existing entities in their current order (if they still exist)
                context.entities.forEach(existingEntity => {
                  const updated = newEntitiesMap.get(existingEntity.id);
                  if (updated) {
                    orderedEntities.push(updated);
                    newEntitiesMap.delete(existingEntity.id); // Remove from map so we don't add it twice
                  }
                });
                
                // Then add any new entities that weren't in the existing list
                newEntitiesMap.forEach(newEntity => {
                  orderedEntities.push(newEntity);
                });
                
                return orderedEntities;
              }
              
              // First time - just use the order as given
              return event.entities;
            }
          }),
          
          // Trigger view processing to update rows
          ({ self }) => {
            log.info('TableMachine: SET_ENTITIES - triggering view actor');
            // Data processing now handled by store subscription
          }
        ]
      },
      
      // Relationship data updates
      'UPDATE_RELATIONSHIP_DATA': {
        actions: [
          // Update relationship resolvers
          assign({
            relationshipResolvers: ({ context, event }) => {
              const { relationshipTable, data } = event;
              const columns = context.columns.filter(col => 
                col.relationshipTable === relationshipTable
              );
              
              const newResolvers = { ...context.relationshipResolvers };
              
              columns.forEach(column => {
                const displayField = column.relationshipDisplayField || 'name';
                newResolvers[column.id] = (id: string | string[]) => {
                  if (Array.isArray(id)) {
                    return id.map(i => {
                      const entity = data[i];
                      return entity ? (entity[displayField] || entity.name || i) : i;
                    }).join(', ');
                  }
                  const entity = data[id];
                  return entity ? (entity[displayField] || entity.name || id) : id;
                };
              });
              
              return newResolvers;
            }
          }),
          
          // Trigger view refresh to update relationship displays
          ({ self }) => {
            log.info('TableMachine: UPDATE_RELATIONSHIP_DATA - triggering view refresh');
            // Data processing now handled by store subscription
          }
        ]
      },
      
      // Atomic entity update from AtomicBridge (Legend State changes)
      updateEntityAtomic: {
        actions: [
          ({ context, event, self }) => {
            log.info('🔄 VibeGrid: Processing atomic entity update', {
              entityType: context.entityType,
              entityId: event.entity?.id,
              entityName: event.entity?.name,
              source: event.source,
              timestamp: performance.now()
            });
            
            if (!event.entity) return;
            
            // HYBRID APPROACH: Update store data silently + surgical rendering
            // This maintains data consistency for sorting/filtering while avoiding full re-renders
            log.info('🔄 VibeGrid: Updating store data silently for data consistency');
            if (context.actors.storeActor) {
              context.actors.storeActor.send({
                type: 'atomicEntityUpdate',
                entityId: event.entity.id,
                entity: event.entity,
                silent: true // Prevent store from triggering full re-render
              });
            }
            
            // CRITICAL: Use surgical update for cell-only rendering
            log.info('🔄 VibeGrid: Triggering SURGICAL renderer update for atomic change');
            if (context.actors.rendererActor) {
              context.actors.rendererActor.send({
                type: 'SURGICAL_UPDATE',
                changes: [{
                  operation: 'update',
                  id: event.entity.id,
                  data: event.entity
                }]
              });
            } else {
              log.warn('🔄 VibeGrid: No renderer actor available for atomic update render');
            }
          }
        ]
      },

      // Individual entity update (atomic update after initial load)
      'UPDATE_ENTITY': {
        actions: [
          // Update the specific entity in our entities array with shallow equality check
          assign({
            entities: ({ context, event }) => {
              const index = context.entities.findIndex(e => e.id === event.entityId);
              if (index !== -1) {
                // Shallow equality check to prevent unnecessary updates
                const existingEntity = context.entities[index];
                
                // Check if entity has actually changed
                let hasChanged = false;
                
                // First check if they're the same reference
                if (existingEntity === event.entity) {
                  return context.entities; // No change needed
                }
                
                // Then check if all properties are equal
                const existingKeys = Object.keys(existingEntity);
                const newKeys = Object.keys(event.entity);
                
                if (existingKeys.length !== newKeys.length) {
                  hasChanged = true;
                } else {
                  // Check each property for shallow equality
                  const changedKeys: string[] = [];
                  for (const key of existingKeys) {
                    if (existingEntity[key] !== event.entity[key]) {
                      changedKeys.push(key);
                    }
                  }
                  
                  // Only consider it changed if fields other than updatedAt have changed
                  // This prevents unnecessary re-renders when only timestamps update
                  hasChanged = changedKeys.some(key => key !== 'updatedAt');
                  
                  if (changedKeys.length > 0 && !hasChanged) {
                    log.info('TableMachine: UPDATE_ENTITY - only updatedAt changed, skipping update', {
                      entityId: event.entityId,
                      changedKeys
                    });
                  }
                }
                
                // Only update if there's an actual change
                if (hasChanged) {
                  log.info('TableMachine: UPDATE_ENTITY - entity has changed', {
                    entityId: event.entityId,
                    changedFields: existingKeys.filter(key => existingEntity[key] !== event.entity[key] && key !== 'updatedAt')
                  });
                  const newEntities = [...context.entities];
                  newEntities[index] = event.entity;
                  // Store flag to indicate change happened for next action
                  (event as any)._entityChanged = true;
                  return newEntities;
                } else {
                  log.info('TableMachine: UPDATE_ENTITY - no changes detected, skipping update', {
                    entityId: event.entityId
                  });
                  (event as any)._entityChanged = false;
                  return context.entities;
                }
              }
              return context.entities;
            }
          }),
          
          // Update the specific row in our processed rows only if entity changed
          assign({
            rows: ({ context, event }) => {
              const entityIndex = context.entities.findIndex(e => e.id === event.entityId);
              const existingEntity = entityIndex !== -1 ? context.entities[entityIndex] : null;
              
              // Skip if entity hasn't changed (based on entities array update above)
              if (existingEntity === event.entity) {
                return context.rows;
              }
              
              const index = context.rows.findIndex(r => r.id === event.entityId);
              if (index !== -1) {
                const newRows = [...context.rows];
                // Convert entity to TableRow format
                newRows[index] = {
                  id: event.entity.id,
                  data: event.entity,
                  metadata: {
                    createdAt: event.entity.createdAt,
                    updatedAt: event.entity.updatedAt,
                    version: (newRows[index].metadata?.version || 0) + 1,
                    isNew: false,
                    isDirty: false
                  }
                };
                return newRows;
              }
              return context.rows;
            },
            version: ({ context }) => context.version + 1
          }),
          
          // Trigger view processing to ensure consistent rendering
          // ViewActor will handle sorting, filtering, and relationship resolution
          ({ self, event }) => {
            // Check the flag set by the previous action to see if entity changed
            if ((event as any)._entityChanged) {
              log.info('TableMachine: UPDATE_ENTITY - triggering view processing');
              // Data processing now handled by store subscription
            }
          },
          
          ({ event }) => {
            log.info('TableMachine: UPDATE_ENTITY - processed', {
              entityId: event.entityId,
              timestamp: performance.now()
            });
          }
        ]
      },
      
      // Add entity (for new items)
      'ADD_ENTITY': {
        actions: [
          assign({
            entities: ({ context, event }) => [...context.entities, event.entity],
            rows: ({ context, event }) => {
              // Add new row at the beginning (or according to sort)
              const newRow = {
                id: event.entity.id,
                data: event.entity,
                metadata: {
                  createdAt: event.entity.createdAt,
                  updatedAt: event.entity.updatedAt,
                  version: 1,
                  isNew: true,
                  isDirty: false
                }
              };
              return [newRow, ...context.rows];
            },
            visibleRowIds: ({ context, event }) => [event.entity.id, ...context.visibleRowIds],
            allRowIds: ({ context, event }) => [event.entity.id, ...context.allRowIds],
            version: ({ context }) => context.version + 1
          }),
          
          // For now, trigger full re-render for adds (could optimize later)
          ({ self }) => {
            log.info('TableMachine: ADD_ENTITY - triggering view refresh');
            // Data processing now handled by store subscription
          }
        ]
      },
      
      // Remove entity
      'REMOVE_ENTITY': {
        actions: [
          assign({
            entities: ({ context, event }) => 
              context.entities.filter(e => e.id !== event.entityId),
            rows: ({ context, event }) => 
              context.rows.filter(r => r.id !== event.entityId),
            visibleRowIds: ({ context, event }) => 
              context.visibleRowIds.filter(id => id !== event.entityId),
            allRowIds: ({ context, event }) => 
              context.allRowIds.filter(id => id !== event.entityId),
            version: ({ context }) => context.version + 1
          }),
          
          // Send remove event to renderer
          sendTo(
            ({ context }) => context.actors.rendererActor!,
            ({ event }) => ({
              type: 'REMOVE_ROW',
              rowId: event.entityId
            })
          )
        ]
      }
    }
  }, // End of active state
    
  error: {
    entry: 'logError',
    on: {
      // Allow recovery from error state
      RETRY: {
        target: 'initializing'
      }
    }
  }
}, // End of states
  
on: {
    ERROR: {
      target: '.error',
      actions: emit(({ event }) => ({
        type: 'vibegridx.error',
        error: event.error,
        context: event.context || 'unknown'
      }))
    },
    
    // Handle initial data load from store (can happen in any state)
    STORE_DATA_UPDATED: {
      actions: [
        assign({
          entities: ({ event }) => event.entities || [],
          rows: ({ event }) => {
            const entities = event.entities || [];
            return entities.map((entity: any) => ({
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
          visibleRowIds: ({ event }) => (event.entities || []).map((e: any) => e.id),
          allRowIds: ({ event }) => (event.entities || []).map((e: any) => e.id)
        }),
        ({ context, self, event }) => {
          log.info('TableMachine: STORE_DATA_UPDATED - Initial data loaded', {
            entityCount: context.entities.length,
            rowCount: context.rows.length,
            source: (event as any).source,
            currentState: self.getSnapshot().value
          });
        },
        
        // Send render command to renderer with updated rows
        ({ context }) => {
          if (context.actors.rendererActor) {
            // Get visible columns using centralized logic
            const visibleColumns = getVisibleColumnsFromStore(context.storeActor, context.columns);
            const columnsWithSelection = addSelectionColumnIfEnabled(visibleColumns, context.enableSelectionColumn);
            
            // Get store state for render data
            const storeSnapshot = context.storeActor?.getSnapshot();
            const columnVisibility = storeSnapshot?.context?.columnVisibility || {};
            
            // Merge column widths from coordinate mapping into columns (if available)
            const columnsWithWidths = columnsWithSelection.map(col => {
              if (context.coordinateMapping) {
                const coordCol = context.coordinateMapping.columns.find(c => c.columnId === col.id);
                return coordCol ? { ...col, width: coordCol.width } : col;
              }
              return col;
            });
            
            log.info('TableMachine: Sending RENDER after STORE_DATA_UPDATED', {
              rowCount: context.rows.length,
              hasCoordinateMapping: !!context.coordinateMapping
            });
            
            context.actors.rendererActor.send({
              type: 'RENDER',
              state: {
                rows: context.rows,
                columns: columnsWithWidths,
                selectedCells: context.selectedCells,
                editingCell: null,
                groupedData: [],
                optimisticOperations: new Map(),
                version: context.version,
                sortBy: storeSnapshot?.context?.sortBy || [],
                columnVisibility: columnVisibility,
                coordinateMapping: context.coordinateMapping
              }
            });
          }
        }
      ]
    },
    
    // Forward events to canvas from any state
    FORWARD_TO_CANVAS: {
      actions: 'forwardToCanvas'
    },
    
    // Forward events to renderer from any state
    FORWARD_TO_RENDERER: {
      actions: 'forwardToRenderer'
    }
  }
});

// The machine is already defined and exported above