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
import { createInitialAtomState, atomActions } from './slices/atom-slice';

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
import { rowActorMachine } from '../row-actor';
import { rendererActor } from '../../actors/renderer-actor';
import { canvasActor } from '../../actors/canvas-actor';
import { editActor } from '../../actors/edit-actor';
import { dragActor } from '../../actors/drag-actor';
// No overlay actor needed - canvas subscribes directly to table machine context

// ====================================
// CONTEXT CREATION
// ====================================

const createDefaultContext = (input: TableConfig): TableContext => {
  const initialRowCount = input.initialData?.length || 0;
  const rowHeight = input.settings?.rowHeight || 40;
  const initialRowIds = input.initialData?.map(row => row.id) || [];
  
  // Load persisted data if available (sync machine pattern)
  const persistedData = input.persistedData;
  
  // Create dimension state with persisted column widths
  const dimensionState = createInitialDimensionsState(
    input.columns || [],
    initialRowCount,
    rowHeight,
    input.enableSelectionColumn || false,
    persistedData?.columnWidths // Pass persisted column widths
  );
  
  // Create selection state
  const selectionState = createInitialSelectionState();
  
  // Create view state with persisted view settings
  const viewState = createInitialViewState(
    input.entityType,
    input.columns || [],
    input.settings?.initialViewport,
    persistedData // Pass all persisted data for view state initialization
  );
  
  // Create edit state
  const editState = createInitialEditState();
  
  // Create drag state
  const dragState = createInitialDragState();
  
  // Create overlay state
  const overlayState = createInitialOverlayState(input.settings?.initialViewport);
  
  // Create atom state with config
  const atomState = createInitialAtomState(input.atomConfig);
  
  return {
    id: input.id,
    entityType: input.entityType,
    columns: input.columns || [],
    rows: [], // Processed rows ready for rendering
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
    enableSelectionColumn: input.enableSelectionColumn || false,
    
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
    
    // Coordinate mapping from coordinate actor
    coordinateMapping: null,
    
    // Entities from parent component (via useSelector)
    entities: input.entities || [],
    
    // Relationship resolvers
    relationshipResolvers: input.relationshipResolvers || {},
    
    actors: {
      rendererActor: null,
      canvasActor: null,
      viewActor: null,
      selectionCoordinator: null,
      editCoordinator: null,
      dragCoordinator: null,
      overlayActor: null,
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
// ASYNC ACTORS
// ====================================

const spawnRowActors = fromPromise(async ({ input }: { 
  input: { rowIds: string[]; spawn: any; existingActors: Map<string, any> }
}) => {
  const { rowIds, spawn, existingActors } = input;
  const newActors = new Map(existingActors);
  
  // Spawn actors for visible rows that don't exist yet
  for (const rowId of rowIds) {
    if (!newActors.has(rowId)) {
      const actor = spawnChild('rowActor', {
        input: { id: rowId },
        systemId: `row-${rowId}`
      });
      newActors.set(rowId, actor);
    }
  }
  
  // Cleanup actors for rows no longer visible
  for (const [rowId, actor] of existingActors) {
    if (!rowIds.includes(rowId)) {
      actor.stop?.();
      newActors.delete(rowId);
    }
  }
  
  return { actors: newActors };
});

const updatePerformanceMetrics = fromPromise(async ({ input }: {
  input: { operation: string; startTime: number; context: TableContext }
}) => {
  const { operation, startTime, context } = input;
  const duration = performance.now() - startTime;
  
  // Log performance if slow
  if (duration > 16) {
    console.warn(`Slow ${operation}: ${duration.toFixed(2)}ms`);
  }
  
  return {
    operation,
    duration,
    timestamp: Date.now(),
    totalRows: context.performance.totalRows,
    visibleRows: context.visibleRowIds.length,
    activeActors: context.actors.rowActors.size
  };
});

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
    rowActor: rowActorMachine,
    spawnRowActors,
    updatePerformanceMetrics
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
        // CLEAN API: Skip atom subscriptions - entities come from props via useSelector
        // Entities will be sent via useEffect in React component
        
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
        
        SET_VISIBLE_ENTITIES: {
          actions: [
            ({ event }) => {
              console.log('🟢 STEP 1: SET_VISIBLE_ENTITIES received in initializing state', {
                entityCount: event.entities?.length || 0
              });
            },
            assign({
              entities: ({ event }) => event.entities || [],
              allRowIds: ({ event }) => event.entities?.map((e: any) => e.id) || []
            })
          ]
        },
        
        RENDERER_READY: {
          target: 'active',
          actions: [
            ({ context }) => {
              console.log('🟢 STEP 2: RENDERER_READY received, transitioning to active state', {
                entityCount: context.entities?.length || 0,
                hasEntities: !!(context.entities?.length)
              });
            },
            ({ self }) => {
              console.log('🟢 STEP 2a: RENDERER_READY action completed, transition should execute now');
              
              // Check state after a brief delay to see if transition happened
              setTimeout(() => {
                try {
                  const snapshot = self.getSnapshot();
                  console.log('🟢 STEP 2b: State check after RENDERER_READY', {
                    currentState: snapshot.value,
                    machineStatus: snapshot.status,
                    contextKeys: Object.keys(snapshot.context || {}),
                    hasError: snapshot.status === 'error'
                  });
                  
                  if (snapshot.status === 'error') {
                    console.error('🔴 STEP 2c: Machine is in error state! Checking error details...');
                  }
                } catch (error) {
                  console.error('🔴 STEP 2b: Error getting snapshot:', error);
                }
              }, 1);
            }
          ]
        },
        
        // CANVAS_CONTAINER_READY: Deferred to post-render in active state
      }
    },
    
    active: {
      entry: [
        ({ context }) => {
          const hasEntities = !!(context.entities?.length);
          const targetState = hasEntities ? 'processingViewData' : 'idle';
          console.log('🟢 STEP 3a: Entering active state', {
            entityCount: context.entities?.length || 0,
            hasEntities,
            targetState,
            entitiesIsArray: Array.isArray(context.entities)
          });
        }
      ],
      
      initial: 'checkingEntities',
      
      // Cleanup atom subscriptions when leaving active state
      exit: atomActions.cleanupAtomSubscriptions,
      
      states: {
        checkingEntities: {
          always: [
            {
              guard: ({ context }) => !!(context.entities?.length),
              target: 'processingViewData',
              actions: ({ context }) => {
                console.log('🟢 STEP 3b: Has entities, transitioning to processingViewData', {
                  entityCount: context.entities?.length || 0
                });
              }
            },
            {
              target: 'idle',
              actions: ({ context }) => {
                console.log('🟢 STEP 3b: No entities, transitioning to idle', {
                  entityCount: context.entities?.length || 0
                });
              }
            }
          ]
        },
        
        idle: {
          on: {
            // Handle atom data updates
            ATOM_DATA_UPDATED: {
              target: 'processingViewData',
              actions: atomActions.updateEntitiesFromAtom
            },
            
            // Handle relationship data updates (just trigger reprocessing)
            RELATIONSHIP_DATA_UPDATED: {
              target: 'processingViewData'
            },
            
            // Legacy event for backward compatibility
            SET_VISIBLE_ENTITIES: {
              target: 'processingViewData',
              actions: assign({
                entities: ({ event }) => event.entities || [],
                allRowIds: ({ event }) => event.entities?.map((e: any) => e.id) || []
              })
            },
            
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
          entry: [
            ({ context }) => {
              console.log('🟢 STEP 4: Entered processingViewData state - invoking ViewActor', {
                entityCount: context.entities?.length || 0,
                hasEntities: !!context.entities
              });
            }
          ],
          
          // Allow handling events while processing
          on: {
            // Handle atom updates even while processing
            ATOM_DATA_UPDATED: {
              actions: atomActions.updateEntitiesFromAtom
            },
            
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
              
              console.log('🟢 STEP 4a: Creating ViewActor input', {
                entityCount: entities.length,
                hasEntities: entities.length > 0,
                columnsCount: context.columns?.length || 0
              });
              
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
                ({ event }) => {
                  console.log('🟢 STEP 5: ViewActor completed successfully', {
                    processedRowCount: event.output.processedRows?.length || 0,
                    coordinateVersion: event.output.coordinateMapping?.version
                  });
                },
                
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
                      totalHeight: context.totalHeight
                    },
                    coordinateMapping: event.output.coordinateMapping
                  })
                ),
                
                // PERFORMANCE: Log when first render completes and spawn canvas post-render
                assign({
                  actors: ({ context, spawn }) => {
                    console.log('TableMachine: First render complete, spawning canvas actor post-render', {
                      version: context.version,
                      hasCanvasActor: !!context.actors.canvasActor,
                      hasCanvasContainer: !!context.canvasContainer
                    });
                    
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
          // PERFORMANCE: Store container for canvas initialization
          assign({
            canvasContainer: ({ event }) => event.container
          }),
          ({ context, event }) => {
            console.log('TableMachine: Canvas container ready post-render', {
              container: event.container,
              version: context.version,
              hasCanvasActor: !!context.actors.canvasActor
            });
            
            // Initialize canvas actor if it exists (spawned post-render)
            if (context.actors.canvasActor && event.container) {
              console.log('TableMachine: Initializing canvas actor post-render');
              
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
    
    // Forward events to canvas from any state
    FORWARD_TO_CANVAS: {
      actions: 'forwardToCanvas'
    }
  }
});

// The machine is already defined and exported above