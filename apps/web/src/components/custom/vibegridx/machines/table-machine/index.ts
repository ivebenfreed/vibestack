// ====================================
// TABLE MACHINE - MAIN COMPOSITION
// ====================================

import { setup, assign, spawnChild, sendTo, fromPromise, emit } from 'xstate';
import type { TableContext, TableEvents, TableConfig } from '../../types';

// Import slices
import { createInitialDimensionsState, dimensionActions } from './slices/dimensions-slice';
import { createInitialSelectionState, selectionActions } from './slices/selection-slice';
import { createInitialViewState, viewActions } from './slices/view-slice';

// Import event handlers
import { selectionHandlers } from './event-handlers/selection-handlers';
import { viewHandlers } from './event-handlers/view-handlers';
import { keyboardHandlers } from './event-handlers/keyboard-handlers';

// Import helpers
import { createViewportFromScroll } from './helpers/visual-position-helpers';

// Import actors
import { editCoordinatorMachine } from '../edit-coordinator';
import { viewActor, createViewActorInput } from '../view-actor';
import { dragCoordinatorMachine } from '../drag-coordinator';
import { rowActorMachine } from '../row-actor';
import { overlayMachine } from '../overlay-machine';
import { rendererActor } from '../../actors/renderer-actor';
import { canvasActor } from '../../actors/canvas-actor';

// Import managers (for backward compatibility)
import { createVibeGridXCoordinateManager } from '../../coordinates/VibeGridXCoordinateManager';

// ====================================
// CONTEXT CREATION
// ====================================

const createDefaultContext = (input: TableConfig): TableContext => {
  const initialRowCount = input.initialData?.length || 0;
  const rowHeight = input.settings?.rowHeight || 40;
  const initialRowIds = input.initialData?.map(row => row.id) || [];
  
  // Create dimension state
  const dimensionState = createInitialDimensionsState(
    input.columns || [],
    initialRowCount,
    rowHeight,
    input.enableSelectionColumn || false
  );
  
  // Create selection state
  const selectionState = createInitialSelectionState();
  
  // Create view state
  const viewState = createInitialViewState(
    input.entityType,
    input.columns || [],
    input.settings?.initialViewport
  );
  
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
    
    // Coordinate manager for backward compatibility
    coordinateManager: (() => {
      const manager = createVibeGridXCoordinateManager();
      // Initialize with columns - always include selection column
      if (input.columns && input.columns.length > 0) {
        const columns = [{ id: '__selection', name: 'Select', field: '__selection', width: 48 }, ...input.columns];
        manager.updateColumns(columns);
      }
      return manager;
    })(),
    
    // Coordinate mapping from coordinate actor
    coordinateMapping: null,
    
    // Entities from parent component
    entities: [],
    
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
    }
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
      | { type: 'vibegridx.fill.complete'; originalCells: Set<string>; fillCells: Set<string> }
      | { type: 'vibegridx.perf.render'; duration: number; cellCount: number }
      | { type: 'vibegridx.error'; error: Error; context: string }
  },
  
  actors: {
    rendererActor,
    canvasActor,
    viewActor,
    editCoordinator: editCoordinatorMachine,
    dragCoordinator: dragCoordinatorMachine,
    overlayActor: overlayMachine,
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
    
    // Additional actions
    logError: ({ event }) => {
      console.error('TableMachine Error:', event);
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
    }
  }
}).createMachine({
  id: 'tableBaseMachine',
  context: ({ input }) => createDefaultContext(input),
  
  initial: 'initializing',
  
  states: {
    initializing: {
      entry: [
        // Spawn core actors
        assign({
          actors: ({ context, spawn }) => ({
            ...context.actors,
            rendererActor: spawn('rendererActor', {
              id: 'renderer',
              input: { 
                containerId: context.id,
                enableSelectionColumn: context.enableSelectionColumn
              }
            }),
            canvasActor: spawn('canvasActor', { id: 'canvas' }),
            overlayActor: spawn('overlayActor', { 
              id: 'overlay',
              input: {
                cellHeight: context.settings.rowHeight,
                rowDimensionManager: context.rowDimensionManager,
                dimensionManager: context.dimensionManager,
                coordinateManager: context.coordinateManager
              }
            }),
            editCoordinator: spawn('editCoordinator', { 
              id: 'editCoordinator',
              input: {
                columns: context.columns
              }
            }),
            dragCoordinator: spawn('dragCoordinator', { id: 'dragCoordinator' })
            // viewActor is invoked as needed, not spawned
          })
        })
      ],
      
      always: {
        target: 'active'
      }
    },
    
    active: {
      initial: 'idle',
      
      states: {
        idle: {
          on: {
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
            ...keyboardHandlers
          }
        },
        
        processingViewData: {
          // Allow handling events while processing
          on: {
            // Selection events should be queued or handled
            ...selectionHandlers,
            ...keyboardHandlers
          },
          
          invoke: {
            src: 'viewActor',
            input: ({ context }) => {
              const entities = context.entities || [];
              
              console.log('TableMachine: Creating ViewActor input from parent-provided entities:', {
                entityCount: entities.length,
                hasEntities: entities.length > 0
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
                viewport: context.viewport,
                rowHeight: context.rowHeight,
                enableSelectionColumn: context.enableSelectionColumn
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
                      columns: context.columns,
                      selectedCells: context.selectedCells,
                      editingCell: null,
                      groupedData: [],
                      optimisticOperations: new Map(),
                      version: context.version + 1,
                      sortBy: context.sortBy,
                      columnVisibility: context.columnVisibility,
                      columnOrder: context.columnOrder
                    },
                    coordinateMapping: event.output.coordinateMapping
                  })
                )
              ]
            }
          }
        }
      },
      
      // Handle these events at the active state level
      on: {
      // Selection events
      ...selectionHandlers,
      
      // View events
      ...viewHandlers,
      
      // Keyboard events
      ...keyboardHandlers,
      
      // Edit events
      'edit.*': {
        actions: sendTo(
          ({ context }) => context.actors.editCoordinator!,
          ({ event }) => event
        )
      },
      
      // Drag events
      'drag.*': {
        actions: sendTo(
          ({ context }) => context.actors.dragCoordinator!,
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
          
          // Send to edit coordinator
          sendTo(
            ({ context }) => context.actors.editCoordinator!,
            ({ event }) => ({ type: 'COLUMNS_CHANGED', columns: event.columns })
          ),
          
          // Send entity type to edit coordinator
          sendTo(
            ({ context }) => context.actors.editCoordinator!,
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