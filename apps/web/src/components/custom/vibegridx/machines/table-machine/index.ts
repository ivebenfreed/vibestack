// ====================================
// TABLE MACHINE - MAIN COMPOSITION
// ====================================

import { setup, assign, spawnChild, sendTo, fromPromise, emit } from 'xstate';
import type { TableContext, TableEvents, TableConfig } from '../../types';

// Import slices
import { createInitialDimensionsState, dimensionActions } from './slices/dimensions-slice';
import { createInitialSelectionState, selectionActions } from './slices/selection-slice';
import { createInitialViewState, viewActions } from './slices/view-slice';
import { createInitialEditState, editActions } from './slices/edit-slice';
import { createInitialDragState, dragActions } from './slices/drag-slice';
import { createInitialOverlayState, overlayActions } from './slices/overlay-slice';
import { atomActions, atomHandlers } from './slices/atom-slice';

// Import event handlers
import { selectionHandlers } from './event-handlers/selection-handlers';
import { viewHandlers } from './event-handlers/view-handlers';
import { keyboardHandlers } from './event-handlers/keyboard-handlers';
import { editHandlers } from './event-handlers/edit-handlers';
import { dragHandlers } from './event-handlers/drag-handlers';
import { fillHandlers } from './event-handlers/fill-handlers';

// Import helpers
import { createViewportFromScroll, calculateVisualPositions } from './helpers/visual-position-helpers';

// Import actors
import { viewActor, createViewActorInput } from '../view-actor';
import { rendererActor } from '../../actors/renderer-actor';
import { canvasActor } from '../../actors/canvas-actor';
import { editActor } from '../../actors/edit-actor';
import { dragActor } from '../../actors/drag-actor';
// No overlay actor needed - canvas subscribes directly to table machine context

// ====================================
// CONTEXT CREATION
// ====================================

const createDefaultContext = (input: TableConfig): TableContext => {
  // Check if we have pre-processed initial data from route loader
  const hasInitialData = !!input.initialData;
  const initialRowCount = hasInitialData ? input.initialData.processedRows?.length || 0 : 0;
  const rowHeight = input.settings?.rowHeight || 40;
  const initialRowIds = hasInitialData ? input.initialData.processedRows?.map(row => row.id) || [] : [];
  
  // Load persisted data if available (sync machine pattern)
  const persistedData = input.persistedData;
  
  // Create view state with persisted view settings FIRST (needed for column order)
  const viewState = createInitialViewState(
    input.entityType,
    input.columns || [],
    input.settings?.initialViewport,
    persistedData // Pass all persisted data for view state initialization
  );
  
  // Create dimension state with persisted column widths
  const dimensionState = createInitialDimensionsState(
    input.columns || [],
    initialRowCount,
    rowHeight,
    input.enableSelectionColumn || false,
    persistedData?.columnWidths, // Pass persisted column widths
    viewState.columnOrder // Pass column order for coordinate mapping
  );
  
  // Create selection state
  const selectionState = createInitialSelectionState();
  
  // Create edit state
  const editState = createInitialEditState();
  
  // Create drag state
  const dragState = createInitialDragState();
  
  // Create overlay state
  const overlayState = createInitialOverlayState(input.settings?.initialViewport);
  
  // Store atoms from input
  const atomState = {
    primaryAtom: input.primaryAtom,
    relationshipAtoms: input.relationshipAtoms,
    atomUnsubscribers: undefined
  };
  
  return {
    id: input.id,
    entityType: input.entityType,
    columns: input.columns || [],
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
    
    // Spread dimension state
    ...dimensionState,
    
    // Spread selection state
    ...selectionState,
    
    // Spread view state
    ...viewState,
    
    // Spread edit state
    ...editState,
    
    // Spread drag state
    ...dragState,
    
    // Spread overlay state
    ...overlayState,
    
    // Spread atom state
    ...atomState,
    
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
    
    actors: {
      rendererActor: null,
      canvasActor: null,
      viewActor: null,
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
    canvasContainer: null
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
    viewActor,
    editActor,
    dragActor,
  },
  
  actions: {
    // Dimension actions
    ...dimensionActions,
    
    // Selection actions  
    ...selectionActions,
    
    // View actions
    ...viewActions,
    
    // Edit actions
    ...editActions,
    
    // Drag actions
    ...dragActions,
    
    // Overlay actions
    ...overlayActions,
    
    // Atom actions
    ...atomActions,
    
    // Additional actions
    logError: ({ event, context }) => {
      console.error('🔴 TableMachine ERROR detected:', {
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
      console.log('TableMachine: forwardToCanvas action', {
        hasCanvasActor: !!context.actors.canvasActor,
        eventType: event.type,
        innerEventType: (event as any).event?.type
      });
      
      if (context.actors.canvasActor) {
        context.actors.canvasActor.send((event as any).event);
      } else {
        console.error('TableMachine: No canvas actor available for forwarding');
      }
    },
    
    forwardToRenderer: ({ context, event }) => {
      console.log('TableMachine: forwardToRenderer action', {
        hasRendererActor: !!context.actors.rendererActor,
        eventType: event.type,
        innerEventType: (event as any).event?.type
      });
      
      if (context.actors.rendererActor) {
        context.actors.rendererActor.send((event as any).event);
      } else {
        console.error('TableMachine: No renderer actor available for forwarding');
      }
    },
    
    // Persistence action
    persistSnapshot: ({ context, self }) => {
      if (typeof window === 'undefined') return;
      
      const key = `vibegridx-${context.id}-state`;
      try {
        // Don't use getPersistedSnapshot - just save what we need
        const currentState = self.getSnapshot();
        
        const stateToPersist = {
          value: currentState.value,
          context: {
            // Only persist the UI state fields we care about
            columnWidths: context.columnWidths,
            columnOffsets: context.columnOffsets,
            rowHeight: context.rowHeight,
            sortBy: context.sortBy,
            filters: context.filters,
            groupBy: context.groupBy,
            columnVisibility: context.columnVisibility,
            columnOrder: context.columnOrder,
            hiddenColumnCount: context.hiddenColumnCount,
            settings: context.settings,
            viewport: context.viewport
          }
        };
        
        const serialized = JSON.stringify(stateToPersist);
        localStorage.setItem(key, serialized);
        
        // Enhanced logging to show what's being saved
        console.log('🔵 TableMachine: SAVING state to localStorage', {
          key,
          tableId: context.id,
          entityType: context.entityType,
          snapshotSize: serialized.length,
          persistedFields: stateToPersist.context,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('🔴 TableMachine: FAILED to persist snapshot:', error);
        console.error('Error details:', error.message);
      }
    }
  }
}).createMachine({
  id: 'tableBaseMachine',
  context: ({ input }) => {
    try {
      return createDefaultContext(input);
    } catch (error) {
      console.error('TableMachine: Error creating context:', error);
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
        enableSelectionColumn: input.enableSelectionColumn || false,
        entities: [],
        relationshipResolvers: {},
        actors: {},
        coordinateManager: null,
        coordinateMapping: null,
        // Add other required fields with defaults
        columnWidths: {},
        columnOffsets: {},
        rowHeight: 40,
        totalWidth: 0,
        totalRows: 0,
        totalHeight: 0,
        selectedCells: new Set(),
        anchorCell: null,
        sortBy: [],
        filters: [],
        groupBy: [],
        columnVisibility: {},
        columnOrder: [],
        hiddenColumnCount: 0,
        viewport: null
      };
    }
  },
  
  initial: 'initializing',
  
  states: {
    initializing: {
      entry: [
        // Set up atom subscriptions in XState (moved from React)
        'setupAtomSubscriptions',
        
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
          actions: ({ context, event }) => {
            console.log('TableMachine: INITIALIZE_RENDERER event received', {
              hasRendererActor: !!context.actors.rendererActor,
              optionsKeys: Object.keys(event.options || {})
            });
            
            if (context.actors.rendererActor) {
              context.actors.rendererActor.send({
                type: 'INITIALIZE',
                options: event.options
              });
            }
          }
        },
        
// SET_VISIBLE_ENTITIES removed - we always use pre-loaded data from route loader
        
        RENDERER_READY: {
          // Single path: Always use pre-processed data from route loader
          target: 'active.idle',
          actions: [
            // Update context with pre-processed data
            assign({
              rows: ({ context }) => context.initialData?.processedRows || [],
              visibleRowIds: ({ context }) => context.initialData?.processedRows?.map((r: any) => r.id) || [],
              coordinateMapping: ({ context }) => context.initialData?.coordinateMapping || null,
              version: ({ context }) => context.version + 1
            }),
            // Send initial data directly to renderer
            sendTo(
              ({ context }) => context.actors.rendererActor!,
              ({ context }) => ({
                type: 'RENDER',
                state: {
                  rows: context.initialData?.processedRows || [],
                  columns: context.initialData?.visibleColumns || context.columns,
                  selectedCells: context.selectedCells,
                  editingCell: null,
                  groupedData: [],
                  optimisticOperations: new Map(),
                  version: context.version + 1,
                  sortBy: context.sortBy,
                  columnVisibility: context.columnVisibility,
                  columnOrder: context.columnOrder,
                  // Include dimensions from table machine context
                  columnWidths: context.columnWidths,
                  columnOffsets: context.columnOffsets,
                  totalWidth: context.totalWidth,
                  totalHeight: context.totalHeight,
                  viewport: context.viewport,
                  // CRITICAL: Include coordinate mapping for passive renderer
                  coordinateMapping: context.coordinateMapping
                }
              })
            ),
            // Spawn canvas actor post-render for selection handling
            assign({
              actors: ({ context, spawn }) => {
                console.log('TableMachine: Spawning canvas actor post-render');
                return {
                  ...context.actors,
                  canvasActor: spawn('canvasActor', { id: 'canvas' })
                };
              }
            })
          ]
        },
        
        // CANVAS_CONTAINER_READY: Deferred to post-render in active state
      },
      
      // Remove child states - causing error "No initial state specified"
    },
    
    active: {
      entry: [],
      
      initial: 'idle',
      
      
      states: {
        idle: {
          entry: [],
          
          on: {
            // Handle view updates (sorting, column reorder, etc)
            INVOKE_VIEW_ACTOR: {
              target: 'processingViewData'
            },
            
            // Include all common event handlers in idle state
            ...selectionHandlers,
            ...viewHandlers,
            ...keyboardHandlers,
            ...editHandlers,
            ...dragHandlers,
            ...fillHandlers
          }
        },
        
        processingViewData: {
          
          // Allow handling events while processing
          on: {
            
            // Selection events should be queued or handled
            ...selectionHandlers,
            ...keyboardHandlers,
            ...editHandlers,
            ...dragHandlers,
            ...fillHandlers
          },
          
          invoke: {
            src: 'viewActor',
            input: ({ context }) => {
              const entities = context.entities || [];
              
              return createViewActorInput({
                entities,
                columns: context.columns,
                viewState: {
                  sortBy: context.sortBy,
                  filters: context.filters,
                  groupBy: context.groupBy,
                  columnVisibility: context.columnVisibility,
                  columnOrder: context.columnOrder
                },
                columnWidths: context.columnWidths,
                viewport: context.viewport,
                rowHeight: context.rowHeight,
                enableSelectionColumn: context.enableSelectionColumn,
                relationshipResolvers: context.relationshipResolvers
              });
            },
            onDone: {
              target: 'idle',
              actions: [
                // Update processed rows
                assign({
                  rows: ({ event }) => event.output.processedRows,
                  visibleRowIds: ({ event }) => event.output.processedRows.map((r: any) => r.id),
                  version: ({ context }) => context.version + 1
                }),
                
                // Update coordinate mapping
                assign({
                  coordinateMapping: ({ event }) => event.output.coordinateMapping
                }),
                
                // Send coordinate update to canvas
                sendTo(
                  ({ context }) => context.actors.canvasActor!,
                  ({ event }) => ({
                    type: 'UPDATE_COORDINATES',
                    mapping: event.output.coordinateMapping
                  })
                ),
                
                // Send processed data to renderer
                sendTo(
                  ({ context }) => context.actors.rendererActor!,
                  ({ event, context }) => ({
                    type: 'RENDER',
                    state: {
                      rows: event.output.processedRows,
                      columns: event.output.visibleColumns, // Use ordered columns from view actor
                      selectedCells: context.selectedCells,
                      editingCell: null,
                      groupedData: [],
                      optimisticOperations: new Map(),
                      version: context.version + 1,
                      sortBy: context.sortBy,
                      columnVisibility: context.columnVisibility,
                      columnOrder: context.columnOrder,
                      // Include dimensions from table machine context
                      columnWidths: context.columnWidths,
                      columnOffsets: context.columnOffsets,
                      totalWidth: context.totalWidth,
                      totalHeight: context.totalHeight,
                      // CRITICAL: Include coordinate mapping for passive renderer
                      coordinateMapping: event.output.coordinateMapping
                    }
                  })
                ),
                
                // PERFORMANCE: Spawn canvas post-render
                assign({
                  actors: ({ context, spawn }) => {
                    // Spawn canvas actor post-render to avoid blocking critical path
                    return {
                      ...context.actors,
                      canvasActor: context.actors.canvasActor || spawn('canvasActor', { id: 'canvas' })
                    };
                  }
                })
              ]
            }
          }
        }
      },
      
      // Handle these events at the active state level
      on: {
      // PERFORMANCE: Initialize canvas actor for selection (post-render spawning)
      SPAWN_CANVAS_ACTOR_FOR_SELECTION: {
        actions: [
          assign({
            actors: ({ context, spawn }) => {
              // Spawn canvas actor if it doesn't exist yet (post-render spawning)
              if (!context.actors.canvasActor) {
                console.log('TableMachine: Spawning canvas actor for selection');
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
              console.log('TableMachine: Ensuring canvas actor is initialized for selection');
              
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
                  borderWidth: 2,
                  dimensionManager: context.dimensionManager
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
            console.log('TableMachine: SPAWN_CANVAS_ACTOR called but canvas is pre-created', {
              hasCanvasActor: !!context.actors.canvasActor
            });
          }
        ]
      },
      
      // Canvas actor is now pre-created, these actions are no longer needed
      SPAWN_CANVAS_AFTER_RENDER: {
        actions: [
          ({ context }) => {
            console.log('TableMachine: SPAWN_CANVAS_AFTER_RENDER called but canvas is pre-created', {
              hasCanvasActor: !!context.actors.canvasActor
            });
          }
        ]
      },
      
      // Canvas initialization (post-render)
      CANVAS_CONTAINER_READY: {
        actions: [
          ({ context, event }) => {
            console.log('TableMachine: Canvas container ready post-render', {
              container: event.container,
              version: context.version,
              hasCanvasActor: !!context.actors.canvasActor,
              hasCoordinateMapping: !!context.coordinateMapping,
              hasCanvasContainer: !!context.canvasContainer
            });
            
            // Check if canvas was already initialized
            if (context.canvasContainer) {
              console.log('TableMachine: Canvas already initialized, skipping duplicate initialization');
              return;
            }
            
            // Store container for canvas initialization
            context.canvasContainer = event.container;
            
            // Initialize canvas actor if it exists (spawned post-render)
            if (context.actors.canvasActor && event.container) {
              console.log('TableMachine: Scheduling canvas initialization to not block UI');
              
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
                    borderWidth: 2,
                    dimensionManager: context.dimensionManager
                  }
                });
                
                // Send coordinate mapping after initialization
                if (context.coordinateMapping) {
                  console.log('TableMachine: Sending coordinate mapping to canvas');
                  context.actors.canvasActor.send({
                    type: 'UPDATE_COORDINATES',
                    mapping: context.coordinateMapping
                  });
                }
              });
            }
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
      
      // Atom events
      ...atomHandlers,
      
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
          
          // Update dimension manager
          dimensionActions.resetColumnDimensions,
          
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
            entities: ({ event }) => event.entities
          }),
          
          // Trigger view processing to update rows
          ({ self }) => {
            console.log('TableMachine: SET_ENTITIES - triggering view actor');
            self.send({ type: 'INVOKE_VIEW_ACTOR' });
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
            console.log('TableMachine: UPDATE_RELATIONSHIP_DATA - triggering view refresh');
            self.send({ type: 'INVOKE_VIEW_ACTOR' });
          }
        ]
      },
      
      // Individual entity update (atomic update after initial load)
      'UPDATE_ENTITY': {
        actions: [
          // Update the specific entity in our entities array
          assign({
            entities: ({ context, event }) => {
              const index = context.entities.findIndex(e => e.id === event.entityId);
              if (index !== -1) {
                const newEntities = [...context.entities];
                newEntities[index] = event.entity;
                return newEntities;
              }
              return context.entities;
            }
          }),
          
          // Update the specific row in our processed rows
          assign({
            rows: ({ context, event }) => {
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
          
          // Send targeted update to renderer for just this row
          sendTo(
            ({ context }) => context.actors.rendererActor!,
            ({ event, context }) => ({
              type: 'UPDATE_ROW',
              rowId: event.entityId,
              entity: event.entity,
              // Don't send columns - let renderer use its last render state columns
              relationshipResolvers: context.relationshipResolvers
            })
          ),
          
          ({ event }) => {
            console.log('TableMachine: UPDATE_ENTITY - updating single row', {
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
            console.log('TableMachine: ADD_ENTITY - triggering view refresh');
            self.send({ type: 'INVOKE_VIEW_ACTOR' });
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
  },
  
  // Add global exit handler for cleanup
  exit: 'cleanupAtomSubscriptions'
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