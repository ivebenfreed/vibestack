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
import { createVibeGridXCoordinateManager } from '../coordinates/VibeGridXCoordinateManager';
import { createVibeGridXSelectionManager } from '../selection/VibeGridXSelectionManager';

// ====================================
// ACTOR IMPORTS (will implement these next)
// ====================================

// SelectionCoordinator removed - using SelectionManager instead
import { editCoordinatorMachine } from './edit-coordinator';
import { viewCoordinatorMachine } from './view-coordinator';
import { dragCoordinatorMachine } from './drag-coordinator';
import { rowActorMachine } from './row-actor';
import { overlayMachine } from './overlay-machine';
// Coordinate coordinator removed - coordinate management handled directly in context

// ====================================
// HELPER FUNCTIONS
// ====================================

// Coordinate manager is now managed by coordinate-coordinator actor

const createDefaultContext = (input: TableConfig): TableContext => {
  const initialRowCount = input.initialData?.length || 0;
  const rowHeight = input.settings?.rowHeight || 40;
  const initialRowIds = input.initialData?.map(row => row.id) || [];
  
  return {
    id: input.id,
    entityType: input.entityType,
    columns: input.columns || [],
    rows: [], // Processed rows ready for rendering
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
    enableSelectionColumn: input.enableSelectionColumn || false,
    
    // Create dimension managers
    dimensionManager: (() => {
      const manager = createColumnDimensionManager(input.columns || []);
      if (input.enableSelectionColumn) {
        manager.setSelectionColumnEnabled(true);
      }
      return manager;
    })(),
    rowDimensionManager: createRowDimensionManager(initialRowCount, rowHeight),
    
    // Coordinate manager for centralized positioning
    coordinateManager: (() => {
      const manager = createVibeGridXCoordinateManager();
      // Initialize with columns - always include selection column
      if (input.columns && input.columns.length > 0) {
        const columns = [{ id: '__selection', name: 'Select', field: '__selection', width: 48 }, ...input.columns];
        manager.updateColumns(columns);
      }
      return manager;
    })(),
    
    // Selection manager for direct selection handling
    selectionManager: createVibeGridXSelectionManager(),
    
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
        
        // Initialize selection manager with dependencies
        if (context.selectionManager) {
          context.selectionManager.setCoordinateManager(context.coordinateManager!);
          context.selectionManager.updateColumns(context.columns);
          context.selectionManager.updateVisibleRows(context.visibleRowIds);
          context.selectionManager.updateAllRows(context.allRowIds);
        }
        
        return {
          ...context.actors,
          // SelectionCoordinator removed - using SelectionManager instead
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
      dimensionManager: ({ event, context }) => {
        if (event.type === 'SET_ENTITY_TYPE') {
          const manager = createColumnDimensionManager(event.columns);
          if (context.enableSelectionColumn) {
            manager.setSelectionColumnEnabled(true);
          }
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
          
          // NOTE: Coordinate manager row update removed - renderer will update with sorted data
          // This ensures coordinate manager always matches what's actually rendered
          
          // Update selection manager with all rows
          if (context.selectionManager) {
            context.selectionManager.updateAllRows(event.entityIds);
            // Also update visible rows initially (will be refined by viewport updates)
            context.selectionManager.updateVisibleRows(event.entityIds);
          }
          
          // All rows are now managed by SelectionManager
          
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
      return context.actors.editCoordinator !== null;
    }
  }
  
}).createMachine({
  id: 'vibeGridXTable',
  
  initial: 'initializing',
  
  context: ({ input }) => createDefaultContext(input),
  
  states: {
    initializing: {
      entry: [
        'spawnCoordinators',
        ({ context }) => {
          console.log('TableMachine: Initializing state completed', {
            hasSelectionCoordinator: !!context.actors.selectionCoordinator,
            hasViewCoordinator: !!context.actors.viewCoordinator,
            hasCoordinateManager: !!context.coordinateManager,
            coordinateManagerColumns: context.coordinateManager?.getColumnCount() || 0
          });
        }
      ],
      
      always: 'ready'
    },
    
    ready: {
      type: 'parallel',
      
      entry: [
        ({ context }) => {
          console.log('TableMachine: Entered ready state', {
            stateValue: 'ready',
            hasAllCoordinators: !!(context.actors.selectionCoordinator && 
                                  context.actors.viewCoordinator),
            viewCoordinatorState: context.actors.viewCoordinator?.getSnapshot?.()?.value || 'unknown',
            viewCoordinatorChildren: context.actors.viewCoordinator?.getSnapshot?.()?.children || {}
          });
        }
      ],
      
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
                    // Update selection manager with new columns
                    ({ context, event }) => {
                      if (context.selectionManager && event.type === 'SET_ENTITY_TYPE') {
                        context.selectionManager.updateColumns(event.columns);
                      }
                    },
                    // Update edit coordinator with columns
                    sendTo(({ context }) => context.actors.editCoordinator!, 
                      ({ event }) => ({ type: 'COLUMNS_CHANGED', columns: event.columns }))
                  ]
                },
                
                SET_VISIBLE_ENTITIES: {
                  target: 'updatingRowActors',
                  actions: 'setVisibleEntities'
                },
                
                // ROWS_SORTED event removed - coordinate manager is updated directly by renderer
                // This ensures coordinate manager always matches what's actually displayed
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
                
                // No-op event (used when view coordinator has no initial state)
                'noop': {},
                
                
                // View state change from view coordinator
                'view.state.changed': {
                  actions: [
                    // Store filtered visible columns in context for renderer
                    assign({
                      visibleColumns: ({ event, context }) => {
                        // Filter columns to only visible ones
                        const visibleColumns = context.columns.filter(col => 
                          event.viewState?.columnVisibility ? event.viewState.columnVisibility[col.id] !== false : true
                        );
                        
                        // Separate selection column from data columns
                        const selectionColumn = visibleColumns.find(col => col.id === '__selection');
                        const dataColumns = visibleColumns.filter(col => col.id !== '__selection');
                        
                        // Apply column order to data columns only
                        let orderedDataColumns = dataColumns;
                        if (event.viewState?.columnOrder && event.viewState.columnOrder.length > 0) {
                          orderedDataColumns = event.viewState.columnOrder
                            .filter(colId => colId !== '__selection')
                            .map(colId => dataColumns.find(col => col.id === colId))
                            .filter(Boolean);
                        }
                        
                        // Selection column always goes first if it exists
                        const orderedVisibleColumns = selectionColumn 
                          ? [selectionColumn, ...orderedDataColumns]
                          : orderedDataColumns;
                        
                        console.log('TableMachine: Storing visible columns in context:', {
                          totalColumns: context.columns.length,
                          columnVisibility: event.viewState?.columnVisibility,
                          visibleAfterFilter: orderedVisibleColumns.length,
                          columnIds: context.columns.map(c => c.id),
                          visibleIds: orderedVisibleColumns.map(c => c.id)
                        });
                        
                        return orderedVisibleColumns;
                      }
                    }),
                    // Don't increment version yet - wait for data
                    ({ event, context }) => {
                      console.log('TableMachine: View state loaded (not rendering yet)', event.viewState);
                    },
                    // Update selection manager with visible columns for arrow navigation
                    ({ context }) => {
                      if (context.selectionManager && context.visibleColumns) {
                        context.selectionManager.updateColumns(context.visibleColumns);
                      }
                    },
                    // Update coordinate manager in context with visible columns
                    ({ event, context }) => {
                      // Filter data columns to only visible ones (selection column is always visible)
                      const visibleDataColumns = context.columns.filter(col => 
                        event.viewState?.columnVisibility ? event.viewState.columnVisibility[col.id] !== false : true
                      );
                      
                      // Apply column order to data columns only
                      let orderedDataColumns = visibleDataColumns;
                      if (event.viewState?.columnOrder && event.viewState.columnOrder.length > 0) {
                        orderedDataColumns = event.viewState.columnOrder
                          .map(colId => visibleDataColumns.find(col => col.id === colId))
                          .filter(Boolean);
                      }
                      
                      // Selection column always goes first
                      const selectionColumn = { id: '__selection', name: 'Select', field: '__selection', width: 48 };
                      const orderedVisibleColumns = [selectionColumn, ...orderedDataColumns];
                      
                      // Update coordinate manager with correct visible columns
                      if (context.coordinateManager) {
                        console.log('TableMachine: Updating coordinate manager with visible columns', {
                          columnCount: orderedVisibleColumns.length,
                          columnIds: orderedVisibleColumns.map(c => c.id)
                        });
                        context.coordinateManager.updateColumns(orderedVisibleColumns);
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
                  actions: [
                    ({ context, event }) => {
                      console.log('TableMachine: Received selection event', {
                        eventType: event.type,
                        hasSelectionManager: !!context.selectionManager,
                        eventDetails: event
                      });
                      
                      // Handle selection events directly through manager
                      if (context.selectionManager) {
                        switch (event.type) {
                          case 'selection.cell.select':
                            context.selectionManager.selectCell(
                              event.rowId, 
                              event.columnId, 
                              event.ctrlKey || false, 
                              event.shiftKey || false
                            );
                            break;
                          case 'selection.range.select':
                            context.selectionManager.selectRange(event.start, event.end);
                            break;
                          case 'selection.clear':
                            context.selectionManager.clearSelection();
                            break;
                          case 'selection.checkbox.toggle':
                            context.selectionManager.toggleRowSelection(event.rowId);
                            break;
                          case 'selection.checkbox.all':
                            context.selectionManager.selectAllRows();
                            break;
                          case 'selection.checkbox.none':
                            context.selectionManager.clearRowSelection();
                            break;
                          case 'selection.checkbox.range':
                            context.selectionManager.selectRowRange(event.startRowId, event.endRowId);
                            break;
                          case 'selection.drag.start':
                            context.selectionManager.startDragSelection(event.startCell.rowId, event.startCell.columnId);
                            break;
                          case 'selection.drag.move':
                            context.selectionManager.updateDragSelection(event.currentCell.rowId, event.currentCell.columnId);
                            break;
                          case 'selection.drag.end':
                            context.selectionManager.endDragSelection();
                            break;
                        }
                      }
                    }
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
                        
                        // Update selection manager with visible rows
                        if (context.selectionManager) {
                          context.selectionManager.updateVisibleRows(visibleIds);
                        }
                        
                        // Visible rows are now managed by SelectionManager
                        
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
                
                // Column visibility events
                'view.columns.toggle': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.show.all': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.hide.all': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.visibility.set': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                // Column drag events
                'view.columns.drag.start': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.drag.move': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.drag.end': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.drag.cancel': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.order.set': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.order.reset': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.column.resized': {
                  actions: [
                    ({ context, event }) => {
                      console.log('TableMachine: Received view.column.resized', { 
                        columnId: event.columnId, 
                        width: event.width,
                        hasDimensionManager: !!context.dimensionManager
                      });
                      
                      // Update dimension manager with new column width
                      if (event.type === 'view.column.resized' && context.dimensionManager) {
                        context.dimensionManager.setColumnWidth(event.columnId, event.width);
                        
                        // Persist column width to localStorage
                        if (typeof window !== 'undefined') {
                          const entityType = context.entityType || 'default';
                          const widthsKey = `vibegridx-column-widths-${entityType}`;
                          const widths = JSON.parse(localStorage.getItem(widthsKey) || '{}');
                          widths[event.columnId] = event.width;
                          localStorage.setItem(widthsKey, JSON.stringify(widths));
                        }
                      }
                    },
                    // Increment version to trigger re-render
                    assign({
                      version: ({ context }) => context.version + 1
                    })
                  ]
                },
                
                'view.filter.set': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                // Column resize events
                'view.columns.resize.start': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.resize.move': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.resize.end': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.viewCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.resize.cancel': {
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
                
                
                // Note: Selection state changes are now handled directly by SelectionManager
                // which updates the canvas overlay without going through events
                
                // Keyboard events
                'keyboard.arrow': {
                  actions: ({ context, event }) => {
                    // Handle arrow navigation through selection manager
                    if (context.selectionManager && event.type === 'keyboard.arrow') {
                      context.selectionManager.moveSelection(event.direction, event.shiftKey || false);
                    }
                  }
                },
                
                'keyboard.copy': {
                  actions: [
                    // Send to overlay actor for visual feedback
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ context }) => ({ 
                        type: 'COPY',
                        cells: context.selectionManager?.getSelectedCells() || new Set()
                      }))
                  ]
                },
                
                'keyboard.cut': {
                  actions: [
                    // Send to overlay actor for visual feedback
                    sendTo(({ context }) => context.actors.overlayActor!, 
                      ({ context }) => ({ 
                        type: 'CUT',
                        cells: context.selectionManager?.getSelectedCells() || new Set()
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
                    // Clear selection through manager
                    ({ context }) => {
                      if (context.selectionManager) {
                        context.selectionManager.clearSelection();
                      }
                    }
                  ]
                },
                
                // Resize events from view coordinator
                'view.resize.started': {
                  actions: [
                    ({ event }) => {
                      console.log('TableMachine: Received view.resize.started', event);
                    },
                    emit(({ event }) => event) // Emit event for listeners
                  ]
                },
                
                'view.resize.updated': {
                  actions: [
                    ({ event }) => {
                      console.log('TableMachine: Received view.resize.updated', event);
                    },
                    emit(({ event }) => event) // Emit event for listeners
                  ]
                },
                
                'view.resize.ended': {
                  actions: [
                    ({ event }) => {
                      console.log('TableMachine: Received view.resize.ended', event);
                    },
                    emit(({ event }) => event) // Emit event for listeners
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