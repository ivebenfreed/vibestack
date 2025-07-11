import { setup, assign, spawnChild, sendTo, fromPromise, emit } from 'xstate';
import type { 
  TableContext, 
  TableEvents, 
  TableConfig, 
  ViewportInfo,
  OptimisticOperation 
} from '../types';
import { createColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import { createRowDimensionManager } from '../dimensions/RowDimensionManager';

// ====================================
// ACTOR IMPORTS (will implement these next)
// ====================================

import { selectionCoordinatorMachine } from './selection-coordinator';
import { editCoordinatorMachine } from './edit-coordinator';
import { viewCoordinatorMachine } from './view-coordinator';
import { dragCoordinatorMachine } from './drag-coordinator';
import { rowActorMachine } from './row-actor';
import { overlayMachine } from './overlay-machine';

// ====================================
// HELPER FUNCTIONS
// ====================================

const createDefaultContext = (input: TableConfig): TableContext => {
  const initialRowCount = input.initialData?.length || 0;
  const rowHeight = input.settings?.rowHeight || 40;
  const initialRowIds = input.initialData?.map(row => row.id) || [];
  
  return {
    id: input.id,
    entityType: input.entityType,
    columns: input.columns || [],
    visibleRowIds: initialRowIds, // Initially all rows are visible
    allRowIds: initialRowIds, // Store all row IDs
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
    
    // Create dimension managers
    dimensionManager: createColumnDimensionManager(input.columns || []),
    rowDimensionManager: createRowDimensionManager(initialRowCount, rowHeight),
    
    actors: {
      selectionCoordinator: null,
      editCoordinator: null,
      viewCoordinator: null,
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

const createViewportFromScroll = (event: any): ViewportInfo => ({
  start: Math.floor(event.scrollTop / event.itemHeight),
  end: Math.floor(event.scrollTop / event.itemHeight) + Math.ceil(event.containerHeight / event.itemHeight) + event.bufferSize,
  height: event.containerHeight,
  scrollTop: event.scrollTop,
  itemHeight: event.itemHeight
});

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
    selectionCoordinator: selectionCoordinatorMachine,
    editCoordinator: editCoordinatorMachine,
    viewCoordinator: viewCoordinatorMachine,
    dragCoordinator: dragCoordinatorMachine,
    overlayActor: overlayMachine,
    rowActor: rowActorMachine,
    spawnRowActors,
    updatePerformanceMetrics
  },
  
  actions: {
    // Initialization actions
    spawnCoordinators: assign({
      actors: ({ spawn, context }) => {
        console.log('TableMachine: Spawning coordinators with context:', {
          entityType: context.entityType,
          visibleRowIdsCount: context.visibleRowIds.length,
          columnsCount: context.columns.length,
          columnIds: context.columns.map(c => c.id)
        });
        
        return {
          ...context.actors,
          selectionCoordinator: spawn('selectionCoordinator', {
            input: { 
              entityType: context.entityType,
              visibleRowIds: context.visibleRowIds,
              columns: context.columns
            },
            systemId: 'selection-coordinator'
          }),
          editCoordinator: spawn('editCoordinator', {
          input: { columns: context.columns },
          systemId: 'edit-coordinator'
        }),
          viewCoordinator: spawn('viewCoordinator', {
            input: { 
              columns: context.columns,
              entityType: context.entityType 
            },
            systemId: 'view-coordinator'
          }),
          dragCoordinator: spawn('dragCoordinator', {
            systemId: 'drag-coordinator'
          }),
          overlayActor: spawn('overlayActor', {
            input: {
              initialViewport: context.settings?.initialViewport || null
            },
            systemId: 'overlay-actor'
          })
        };
      }
    }),
    
    // Entity configuration
    setEntityType: assign({
      entityType: ({ event }) => 
        event.type === 'SET_ENTITY_TYPE' ? event.entityType : '',
      columns: ({ event }) => 
        event.type === 'SET_ENTITY_TYPE' ? event.columns : [],
      dimensionManager: ({ event }) => {
        if (event.type === 'SET_ENTITY_TYPE') {
          const manager = createColumnDimensionManager(event.columns);
          return manager;
        }
        return undefined;
      },
      version: ({ context }) => context.version + 1
    }),
    
    setVisibleEntities: assign({
      allRowIds: ({ context, event }) => {
        if (event.type === 'SET_VISIBLE_ENTITIES') {
          // Update row dimension manager with new row count
          const newRowCount = event.entityIds.length;
          context.rowDimensionManager?.setRowCount(newRowCount);
          
          // Send all rows update to selection coordinator
          if (context.actors?.selectionCoordinator) {
            context.actors.selectionCoordinator.send({
              type: 'ALL_ROWS_CHANGED',
              rowIds: event.entityIds
            });
          }
          
          return event.entityIds;
        }
        return context.allRowIds;
      },
      version: ({ context }) => context.version + 1,
      performance: ({ context, event }) => {
        if (event.type === 'SET_VISIBLE_ENTITIES') {
          return {
            ...context.performance,
            totalRows: event.entityIds.length
          };
        }
        return context.performance;
      }
    }),
    
    // Performance tracking
    updatePerformance: assign({
      performance: ({ context, event }) => {
        if (event.type === 'PERFORMANCE_MARK') {
          return {
            ...context.performance,
            lastRenderTime: event.duration
          };
        }
        return context.performance;
      }
    }),
    
    // Version increment for React re-renders
    incrementVersion: assign({
      version: ({ context }) => context.version + 1
    })
  },
  
  guards: {
    hasVisibleRows: ({ context }) => context.visibleRowIds.length > 0,
    isVirtualScrollingEnabled: ({ context }) => 
      context.settings.enableVirtualScrolling === true,
    canPerformOperation: ({ context, event }) => {
      // Guard against operations when coordinators aren't ready
      return context.actors.selectionCoordinator !== null && 
             context.actors.editCoordinator !== null;
    }
  }
  
}).createMachine({
  id: 'vibeGridXTable',
  
  initial: 'initializing',
  
  context: ({ input }) => createDefaultContext(input),
  
  states: {
    initializing: {
      entry: [
        'spawnCoordinators'
      ],
      
      after: {
        100: 'ready' // Small delay to ensure coordinators are spawned
      }
    },
    
    ready: {
      type: 'parallel',
      
      states: {
        // Entity management
        entityManagement: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                SET_ENTITY_TYPE: {
                  actions: [
                    'setEntityType',
                    // Notify coordinators of entity type change
                    sendTo(({ context }) => context.actors.selectionCoordinator!, 
                      ({ event }) => ({ type: 'ENTITY_TYPE_CHANGED', entityType: event.entityType })),
                    sendTo(({ context }) => context.actors.selectionCoordinator!, 
                      ({ event }) => ({ type: 'COLUMNS_CHANGED', columns: event.columns })),
                    sendTo(({ context }) => context.actors.editCoordinator!, 
                      ({ event }) => ({ type: 'COLUMNS_CHANGED', columns: event.columns }))
                  ]
                },
                
                SET_VISIBLE_ENTITIES: {
                  target: 'updatingRowActors',
                  actions: 'setVisibleEntities'
                }
              }
            },
            
            updatingRowActors: {
              invoke: {
                src: 'spawnRowActors',
                input: ({ context, spawn }) => ({
                  rowIds: context.visibleRowIds,
                  spawn,
                  existingActors: context.actors.rowActors
                }),
                onDone: {
                  target: 'idle',
                  actions: assign({
                    actors: ({ context, event }) => ({
                      ...context.actors,
                      rowActors: event.output.actors
                    }),
                    performance: ({ context, event }) => ({
                      ...context.performance,
                      activeActors: event.output.actors.size,
                      visibleRows: context.visibleRowIds.length
                    })
                  })
                }
              }
            }
          }
        },
        
        // Event routing to coordinators
        coordinatorRouting: {
          initial: 'active',
          states: {
            active: {
              on: {
                // Data events from EntityIntegration
                'data.entities.updated': {
                  actions: [
                    // Update context with new entity data
                    assign({
                      version: ({ context }) => context.version + 1,
                      allRowIds: ({ event }) => Object.keys(event.entities),
                      // Don't update visibleRowIds here - that should only be updated by viewport events
                      // visibleRowIds represents what's currently visible in the viewport, not all data
                    }),
                    // Log the data update
                    ({ event }) => {
                      console.log(`TableMachine: Received ${event.entityType} data update - ${Object.keys(event.entities).length} entities`);
                    },
                    // Forward data to view coordinator for processing (sorting/filtering)
                    ({ context, event }) => {
                      const viewCoordinator = context.actors.viewCoordinator;
                      if (viewCoordinator) {
                        // Convert entities to TableRow format
                        const rows = Object.values(event.entities).map((entity: any) => ({
                          id: entity.id,
                          data: { ...entity },
                          metadata: {
                            createdAt: entity.createdAt || new Date(),
                            updatedAt: entity.updatedAt || new Date(),
                            version: entity.version || 1,
                            isNew: entity.isNew || false,
                            isDirty: entity.isDirty || false
                          }
                        }));
                        
                        viewCoordinator.send({
                          type: 'ROWS_UPDATED',
                          rows
                        });
                      }
                    }
                  ]
                },
                
                // No-op event (used when view coordinator has no initial state)
                'noop': {},
                
                // View state change from view coordinator
                'view.state.changed': {
                  actions: [
                    // Increment version to trigger re-render
                    assign({
                      version: ({ context }) => context.version + 1
                    }),
                    ({ event, context }) => {
                      console.log('TableMachine: View state changed, triggering re-render', event.viewState);
                      
                      // Persist sort state to localStorage
                      if (event.viewState?.sortBy && typeof window !== 'undefined') {
                        const storageKey = `vibegridx-sort-${context.entityType}`;
                        localStorage.setItem(storageKey, JSON.stringify(event.viewState.sortBy));
                        console.log(`TableMachine: Persisted sort state for ${context.entityType}`);
                      }
                    }
                  ]
                },
                
                // Render events from EntityIntegration
                'view.render.update': {
                  actions: [
                    // Increment version to trigger React re-render
                    'incrementVersion',
                    // Log render trigger
                    ({ event }) => {
                      console.log(`TableMachine: Render update triggered - ${event.reason}`);
                    }
                  ]
                },
                
                // Selection events
                'selection.*': {
                  guard: 'canPerformOperation',
                  actions: [
                    ({ context, event }) => {
                      console.log('TableMachine: Received selection event', {
                        eventType: event.type,
                        hasSelectionCoordinator: !!context.actors.selectionCoordinator,
                        eventDetails: event
                      });
                    },
                    sendTo(({ context }) => context.actors.selectionCoordinator!, 
                      ({ event }) => {
                        console.log('TableMachine: Forwarding to selection coordinator', event);
                        return event;
                      }),
                    // Forward to overlay actor for visualization
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ event }) => {
                        // Map selection events to overlay events
                        if (event.type === 'selection.cell.select') {
                          return {
                            type: 'CELL_CLICK',
                            cellKey: `${event.rowId}:${event.columnId}`,
                            ctrlKey: event.ctrlKey || false,
                            shiftKey: event.shiftKey || false,
                            row: 0, // Will be calculated by overlay
                            column: 0 // Will be calculated by overlay
                          };
                        } else if (event.type === 'selection.bulk.set') {
                          return {
                            type: 'SELECTION_UPDATE',
                            cells: event.selectedCells
                          };
                        }
                        return event;
                      })
                  ]
                },
                
                // Edit events
                'edit.*': {
                  guard: 'canPerformOperation',
                  actions: [
                    sendTo(({ context }) => context.actors.editCoordinator!, 
                      ({ event }) => event),
                    // Forward to overlay actor for visualization
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ event }) => {
                        if (event.type === 'edit.cell.start') {
                          return {
                            type: 'EDIT_START',
                            cell: { rowId: event.rowId, columnId: event.columnId }
                          };
                        } else if (event.type === 'edit.cell.end' || event.type === 'edit.cell.cancel') {
                          return { type: 'EDIT_END' };
                        }
                        return event;
                      })
                  ]
                },
                
                // View events (not render updates)
                'view.viewport.update': {
                  guard: 'canPerformOperation',
                  actions: [
                    // Update visible row IDs based on viewport
                    assign({
                      visibleRowIds: ({ context, event }) => {
                        // Get visible row IDs from allRowIds based on viewport indices
                        const visibleIds = context.allRowIds.slice(event.viewport.start, event.viewport.end);
                        
                        // Send updated visible rows to selection coordinator
                        if (context.actors.selectionCoordinator) {
                          context.actors.selectionCoordinator.send({
                            type: 'VISIBLE_ROWS_CHANGED',
                            rowIds: visibleIds
                          });
                        }
                        
                        return visibleIds;
                      }
                    }),
                    sendTo(({ context }) => context.actors.viewCoordinator!, 
                      ({ event }) => event),
                    // Forward viewport updates to overlay actor
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ event }) => ({
                        type: 'VIEWPORT_UPDATE',
                        viewport: event.viewport
                      }))
                  ]
                },
                
                'view.group.set': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.sort.set': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.column.click': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.filter.set': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                // Drag events
                'drag.*': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.dragCoordinator!, 
                    ({ event }) => event)
                },
                
                // Coordinate manager events
                'COORDINATE_MANAGER_SET': {
                  actions: sendTo(({ context }) => context.actors.selectionCoordinator!, 
                    ({ event }) => event)
                },
                
                'COORDINATE_MAPPING_CHANGED': {
                  actions: sendTo(({ context }) => context.actors.selectionCoordinator!, 
                    ({ event }) => event)
                },
                
                // Selection state changes from selection coordinator
                'selection.state.changed': {
                  actions: [
                    ({ context, event }) => {
                      console.log('TableMachine: Received selection.state.changed from selection coordinator', {
                        selectedCellsSize: event.selectedCells?.size || 0,
                        activeCell: event.activeCell,
                        hasOverlayActor: !!context.actors.overlayActor
                      });
                    },
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ event }) => {
                        const overlayEvent = {
                          type: 'SELECTION_UPDATE',
                          cells: event.selectedCells
                        };
                        console.log('TableMachine: Forwarding to overlay actor', overlayEvent);
                        return overlayEvent;
                      })
                  ]
                },
                
                // Keyboard events (route to appropriate coordinator)
                'keyboard.arrow': {
                  actions: sendTo(({ context }) => context.actors.selectionCoordinator!, 
                    ({ event }) => event)
                },
                
                'keyboard.copy': {
                  actions: [
                    sendTo(({ context }) => context.actors.selectionCoordinator!, 
                      ({ event }) => event),
                    // Also send to overlay actor for visual feedback
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ context }) => ({ 
                        type: 'COPY',
                        cells: context.actors.selectionCoordinator?.getSnapshot().context.selectedCells || new Set()
                      }))
                  ]
                },
                
                'keyboard.cut': {
                  actions: [
                    sendTo(({ context }) => context.actors.selectionCoordinator!, 
                      ({ event }) => event),
                    // Also send to overlay actor for visual feedback
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ context }) => ({ 
                        type: 'CUT',
                        cells: context.actors.selectionCoordinator?.getSnapshot().context.selectedCells || new Set()
                      }))
                  ]
                },
                
                'keyboard.paste': {
                  actions: sendTo(({ context }) => context.actors.editCoordinator!, 
                    ({ event }) => event)
                },
                
                'keyboard.delete': {
                  actions: sendTo(({ context }) => context.actors.editCoordinator!, 
                    ({ event }) => event)
                },
                
                'keyboard.enter': {
                  actions: sendTo(({ context }) => context.actors.editCoordinator!, 
                    ({ event }) => event)
                },
                
                'keyboard.escape': {
                  actions: [
                    // Send to overlay actor first to clear any visual states
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      () => ({ type: 'ESCAPE' })),
                    // Then to edit coordinator to cancel any editing
                    sendTo(({ context }) => context.actors.editCoordinator!, 
                      ({ event }) => event),
                    // Finally to selection coordinator to clear selection if needed
                    sendTo(({ context }) => context.actors.selectionCoordinator!, 
                      () => ({ type: 'selection.clear' }))
                  ]
                }
              }
            }
          }
        },
        
        // Performance monitoring
        performanceMonitoring: {
          initial: 'monitoring',
          states: {
            monitoring: {
              on: {
                PERFORMANCE_MARK: {
                  actions: [
                    'updatePerformance',
                    // Log significant performance issues
                    ({ event }) => {
                      if (event.duration > 50) {
                        console.warn(`Performance warning: ${event.operation} took ${event.duration}ms`);
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  }
});

// ====================================
// UTILITY FUNCTIONS
// ====================================

export const createTableEvent = <T extends TableEvents['type']>(
  type: T,
  payload: Omit<Extract<TableEvents, { type: T }>, 'type'>
): Extract<TableEvents, { type: T }> => {
  return { type, ...payload } as Extract<TableEvents, { type: T }>;
};

// Performance measurement helper
export const measurePerformance = <T>(operation: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  // Can be used to send PERFORMANCE_MARK events
  if (duration > 5) {
    console.log(`${operation}: ${duration.toFixed(2)}ms`);
  }
  
  return result;
};