import { setup, assign, spawnChild, sendTo, fromPromise, emit } from 'xstate';
import type { 
  TableContext, 
  TableEvents, 
  TableConfig, 
  ViewportInfo,
  OptimisticOperation,
  RenderState
} from '../types';
import type { VisualCellPosition } from '../overlays/OverlayTypes';
import { createColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import { createRowDimensionManager } from '../dimensions/RowDimensionManager';
import { createVibeGridXCoordinateManager } from '../coordinates/VibeGridXCoordinateManager';
// SelectionManager removed - selection state now managed directly in TableMachine

// ====================================
// ACTOR IMPORTS (will implement these next)
// ====================================

// SelectionCoordinator removed - using SelectionManager instead
import { editCoordinatorMachine } from './edit-coordinator';
import { viewActor, createViewActorInput, extractCoordinateEvents } from './view-actor'; // Strategic Hybrid Approach: replaces viewCoordinator + coordinateActor
import { dragCoordinatorMachine } from './drag-coordinator';
import { rowActorMachine } from './row-actor';
import { overlayMachine } from './overlay-machine';
import { rendererActor } from '../actors/renderer-actor';
import { canvasActor } from '../actors/canvas-actor';
// coordinateActor removed - coordinate management integrated into viewActor

// ====================================
// HELPER FUNCTIONS
// ====================================

// LocalStorage persistence helpers
const getStorageKey = (entityType: string, key: string) => `vibegridx-${entityType}-${key}`;

// Visual position calculation helper
const calculateVisualPositions = (
  selectedCells: Set<string>,
  coordinateMapping: any,
  viewport: ViewportInfo | null,
  rowHeight: number
): VisualCellPosition[] => {
  if (!viewport || !coordinateMapping) return [];
  
  const visualPositions: VisualCellPosition[] = [];
  
  for (const cellKey of selectedCells) {
    const [rowId, columnId] = cellKey.split(':');
    
    // Find row in coordinate mapping
    const rowData = coordinateMapping.rows.find((r: any) => r.rowId === rowId);
    if (!rowData) continue;
    
    const absoluteRowIndex = rowData.sortedIndex;
    
    // Check if row is in viewport
    if (absoluteRowIndex < viewport.start || absoluteRowIndex > viewport.end) continue;
    
    // Calculate visual row position
    const visualRow = absoluteRowIndex - viewport.start;
    
    // Find column data
    const colData = coordinateMapping.columns.find((c: any) => c.columnId === columnId);
    if (!colData) continue;
    
    // Calculate visual position
    visualPositions.push({
      cellKey,
      x: colData.offset,
      y: visualRow * rowHeight,
      width: colData.width,
      height: rowHeight
    });
  }
  
  return visualPositions;
};

const loadFromStorage = <T>(entityType: string, key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const stored = localStorage.getItem(getStorageKey(entityType, key));
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const saveToStorage = (entityType: string, key: string, value: any): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(getStorageKey(entityType, key), JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};

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
    
    // Selection manager removed - selection state now managed directly in TableMachine
    
    // Coordinate mapping from coordinate actor (single source of truth)
    coordinateMapping: null,
    
    // Entities from parent component (via EntityIntegration/domain atoms)
    entities: [],
    
    // View state management (moved from viewCoordinator for Strategic Hybrid Approach)
    // Load from localStorage if available
    sortBy: loadFromStorage(input.entityType, 'sortBy', []),
    filters: loadFromStorage(input.entityType, 'filters', []),
    groupBy: loadFromStorage(input.entityType, 'groupBy', []),
    columnVisibility: loadFromStorage(
      input.entityType, 
      'columnVisibility', 
      Object.fromEntries((input.columns || []).map(col => [col.id, true]))
    ),
    columnOrder: loadFromStorage(
      input.entityType,
      'columnOrder',
      (input.columns || []).map(col => col.id)
    ),
    hiddenColumnCount: Object.values(
      loadFromStorage(
        input.entityType, 
        'columnVisibility', 
        Object.fromEntries((input.columns || []).map(col => [col.id, true]))
      )
    ).filter(visible => !visible).length,
    
    // Current viewport
    viewport: null,
    
    // Selection state
    selectedCells: new Set<string>(),
    
    actors: {
      rendererActor: null,
      canvasActor: null,
      viewActor: null, // Strategic Hybrid Approach: replaces coordinateActor + viewCoordinator
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
    rendererActor,
    canvasActor,
    viewActor, // Strategic Hybrid Approach: replaces viewCoordinator + coordinateActor
    editCoordinator: editCoordinatorMachine,
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
        console.log('TableMachine: Spawning actors with context:', {
          entityType: context.entityType,
          visibleRowIdsCount: context.visibleRowIds.length,
          columnsCount: context.columns.length,
          columnIds: context.columns.map(c => c.id)
        });
        
        // Selection manager removed - selection state now managed directly in TableMachine
        
        return {
          ...context.actors,
          rendererActor: spawn('rendererActor', {
            systemId: 'renderer-actor'
          }),
          canvasActor: spawn('canvasActor', {
            systemId: 'canvas-actor'
          }),
          // viewActor is stateless fromPromise - no spawning needed
          // SelectionCoordinator removed - using SelectionManager instead
          editCoordinator: spawn('editCoordinator', {
          input: { columns: context.columns },
          systemId: 'edit-coordinator'
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
          
          // Selection manager removed - selection state now managed directly in TableMachine
          
          // NOTE: Entity data processing and coordinate calculation now handled by viewActor
          // ViewActor provides atomic processing: entities + config → processed data + coordinates
          // This eliminates synchronization issues between data processing and coordinate calculation.
          
          return event.entityIds;
        }
        return context.allRowIds;
      },
      // Store entities from parent component
      entities: ({ context, event }) => {
        if (event.type === 'SET_VISIBLE_ENTITIES' && event.entities) {
          return event.entities;
        }
        return context.entities || [];
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
    }),
    
    // ====================================
    // VIEW STATE MANAGEMENT ACTIONS (moved from viewCoordinator)
    // ====================================
    
    // Sort management
    setSortBy: assign({
      sortBy: ({ context, event }) => {
        if (event.type === 'view.sort.set') {
          console.log('TableMachine: Setting sortBy:', event.sortBy);
          saveToStorage(context.entityType, 'sortBy', event.sortBy);
          return event.sortBy;
        }
        return context.sortBy;
      },
      version: ({ context }) => context.version + 1
    }),
    
    // Filter management  
    setFilters: assign({
      filters: ({ context, event }) => {
        if (event.type === 'view.filter.set') {
          console.log('TableMachine: Setting filters:', event.filters);
          saveToStorage(context.entityType, 'filters', event.filters);
          return event.filters;
        }
        return context.filters;
      },
      version: ({ context }) => context.version + 1
    }),
    
    // Group management
    setGroupBy: assign({
      groupBy: ({ context, event }) => {
        if (event.type === 'view.group.set') {
          console.log('TableMachine: Setting groupBy:', event.groupBy);
          saveToStorage(context.entityType, 'groupBy', event.groupBy);
          return event.groupBy;
        }
        return context.groupBy;
      },
      version: ({ context }) => context.version + 1
    }),
    
    // Column visibility management
    toggleColumnVisibility: assign({
      columnVisibility: ({ context, event }) => {
        if (event.type === 'view.columns.toggle') {
          const newVisibility = { ...context.columnVisibility };
          newVisibility[event.columnId] = !newVisibility[event.columnId];
          console.log('TableMachine: Toggled column visibility:', event.columnId, newVisibility[event.columnId]);
          saveToStorage(context.entityType, 'columnVisibility', newVisibility);
          return newVisibility;
        }
        return context.columnVisibility;
      },
      hiddenColumnCount: ({ context, event }) => {
        if (event.type === 'view.columns.toggle') {
          const newVisibility = { ...context.columnVisibility };
          newVisibility[event.columnId] = !newVisibility[event.columnId];
          return Object.values(newVisibility).filter(visible => !visible).length;
        }
        return context.hiddenColumnCount;
      },
      version: ({ context }) => context.version + 1
    }),
    
    setColumnVisibility: assign({
      columnVisibility: ({ context, event }) => {
        if (event.type === 'view.columns.visibility.set') {
          console.log('TableMachine: Setting column visibility:', event.visibility);
          saveToStorage(context.entityType, 'columnVisibility', event.visibility);
          return event.visibility;
        }
        return context.columnVisibility;
      },
      hiddenColumnCount: ({ event }) => {
        if (event.type === 'view.columns.visibility.set') {
          return Object.values(event.visibility).filter(visible => !visible).length;
        }
        return 0;
      },
      version: ({ context }) => context.version + 1
    }),
    
    // Column order management
    setColumnOrder: assign({
      columnOrder: ({ context, event }) => {
        if (event.type === 'view.columns.order.set') {
          console.log('TableMachine: Setting column order:', event.order);
          saveToStorage(context.entityType, 'columnOrder', event.order);
          return event.order;
        }
        return context.columnOrder;
      },
      version: ({ context }) => context.version + 1
    }),
    
    resetColumnOrder: assign({
      columnOrder: ({ context }) => {
        const defaultOrder = context.columns.map(col => col.id);
        console.log('TableMachine: Resetting column order to default:', defaultOrder);
        return defaultOrder;
      },
      version: ({ context }) => context.version + 1
    }),
    
    // ViewActor reprocessing trigger
    REPROCESS_VIEW_DATA: ({ context, self }) => {
      console.log('TableMachine: REPROCESS_VIEW_DATA triggered, invoking ViewActor');
      
      // Create input for ViewActor with current view state
      const viewActorInput = createViewActorInput({
        entities: context.entities,
        columns: context.columns,
        viewState: {
          sortBy: context.sortBy,
          filters: context.filters,
          groupBy: context.groupBy,
          columnVisibility: context.columnVisibility,
          columnOrder: context.columnOrder
        },
        enableSelectionColumn: context.enableSelectionColumn
      });
      
      // Invoke ViewActor with current state
      self.send({
        type: 'INVOKE_VIEW_ACTOR',
        input: viewActorInput
      });
    }
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
            hasViewActor: !!context.actors.viewActor,
            hasSelectionCoordinator: !!context.actors.selectionCoordinator,
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
            hasAllActors: !!(context.actors.selectionCoordinator && 
                                  context.actors.overlayActor),
            hasCanvasActor: !!context.actors.canvasActor,
            hasViewActor: true // viewActor is stateless, always available
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
                    // Selection manager removed - columns are managed directly in context
                    // Update edit coordinator with columns
                    sendTo(({ context }) => context.actors.editCoordinator!, 
                      ({ event }) => ({ type: 'COLUMNS_CHANGED', columns: event.columns }))
                  ]
                },
                
                SET_VISIBLE_ENTITIES: {
                  target: 'processingViewData',
                  actions: 'setVisibleEntities'
                },
                
                INVOKE_VIEW_ACTOR: {
                  target: 'processingViewData'
                },
                
                // ROWS_SORTED event removed - coordinate manager is updated directly by renderer
                // This ensures coordinate manager always matches what's actually displayed
              }
            },
            
            processingViewData: {
              invoke: {
                src: 'viewActor',
                input: ({ context }) => {
                  // Get entities from context - provided by parent component via EntityIntegration
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
                    rowHeight: context.settings.rowHeight,
                    enableSelectionColumn: context.enableSelectionColumn
                  });
                },
                onDone: {
                  target: 'updatingRowActors',
                  actions: [
                    // Update coordinate mapping and processed rows from viewActor output
                    assign({
                      coordinateMapping: ({ event }) => event.output.coordinateMapping,
                      rows: ({ event }) => event.output.processedRows, // Store processed rows for renderer
                      version: ({ context }) => context.version + 1
                    }),
                    // Send coordinate update to canvas actor
                    ({ context, event }) => {
                      if (context.actors.canvasActor) {
                        const coordinateEvent = extractCoordinateEvents(event.output);
                        context.actors.canvasActor.send({
                          type: 'UPDATE_COORDINATES',
                          mapping: coordinateEvent.mapping
                        });
                        console.log('TableMachine: Sent UPDATE_COORDINATES to canvas actor from viewActor');
                      }
                    },
                    // Note: Using direct renderer via VibeGridX subscription instead of renderer actor
                    ({ context, event }) => {
                      console.log('TableMachine: ViewActor processing complete, data stored in context for direct renderer', {
                        rowCount: event.output.processedRows.length,
                        version: event.output.coordinateMapping.version
                      });
                    }
                  ]
                },
                onError: {
                  target: 'idle',
                  actions: ({ event }) => {
                    console.error('TableMachine: ViewActor processing failed:', event.error);
                  }
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
                
                // Log all events for debugging
                '*': {
                  actions: ({ event }) => {
                    if (event.type !== 'noop' && !event.type.startsWith('xstate.')) {
                      console.log('TableMachine: Received event:', event.type, event);
                    }
                  }
                },
                
                // No-op event (used when view coordinator has no initial state)
                'noop': {},
                
                
                // view.rows.processed removed - integrated into viewActor processing
                
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
                    // Selection manager removed - visible columns are managed directly in context
                    // Send column data to coordinate actor for processing
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
                      
                      // Send columns to coordinate actor instead of updating directly
                      if (context.actors.coordinateActor) {
                        console.log('TableMachine: Sending UPDATE_COLUMNS to coordinate actor', {
                          columnCount: orderedVisibleColumns.length,
                          columnIds: orderedVisibleColumns.map(c => c.id)
                        });
                        context.actors.coordinateActor.send({
                          type: 'UPDATE_COLUMNS',
                          columns: orderedVisibleColumns
                        });
                      }
                      
                      // Also update the old coordinate manager for backward compatibility (for now)
                      if (context.coordinateManager) {
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
                
                // Selection events - Manage selection state in TableMachine
                'selection.cell.select': {
                  actions: [
                    // Update selection state
                    assign({
                      selectedCells: ({ context, event }) => {
                        const cellKey = `${event.rowId}:${event.columnId}`;
                        const newSelection = new Set<string>();
                        
                        if (event.ctrlKey) {
                          // Toggle selection
                          context.selectedCells.forEach(cell => newSelection.add(cell));
                          if (newSelection.has(cellKey)) {
                            newSelection.delete(cellKey);
                          } else {
                            newSelection.add(cellKey);
                          }
                        } else if (event.shiftKey) {
                          // Range selection - handled separately
                          newSelection.add(cellKey);
                        } else {
                          // Single selection
                          newSelection.add(cellKey);
                        }
                        
                        return newSelection;
                      }
                    }),
                    // Send visual positions to canvas
                    ({ context, event }) => {
                      console.log('TableMachine: Processing selection.cell.select', {
                        eventType: event.type,
                        rowId: event.rowId,
                        columnId: event.columnId,
                        hasCanvasActor: !!context.actors.canvasActor,
                        selectedCells: context.selectedCells.size
                      });
                      
                      if (context.actors.canvasActor && context.coordinateMapping && context.viewport) {
                        // Calculate visual positions for all selected cells
                        const visualPositions = calculateVisualPositions(
                          context.selectedCells,
                          context.coordinateMapping,
                          context.viewport,
                          context.settings.rowHeight || 40
                        );
                        
                        // Send visual positions to canvas actor
                        context.actors.canvasActor.send({
                          type: 'UPDATE_SELECTION_VISUAL',
                          visualCells: visualPositions
                        });
                        
                        console.log('TableMachine: Sent visual positions to canvas actor', {
                          selectedCount: context.selectedCells.size,
                          visualCount: visualPositions.length,
                          viewport: { start: context.viewport.start, end: context.viewport.end }
                        });
                      } else {
                        console.warn('TableMachine: Missing canvasActor, coordinateMapping or viewport for selection', {
                          hasCanvasActor: !!context.actors.canvasActor,
                          hasCoordinateMapping: !!context.coordinateMapping,
                          hasViewport: !!context.viewport
                        });
                      }
                    }
                  ]
                },
                
                // Other selection events
                'selection.clear': {
                  actions: [
                    // Clear selection state
                    assign({
                      selectedCells: () => new Set<string>()
                    }),
                    // Send empty visual positions to canvas
                    ({ context }) => {
                      if (context.actors.canvasActor) {
                        context.actors.canvasActor.send({
                          type: 'UPDATE_SELECTION_VISUAL',
                          visualCells: []
                        });
                      }
                    }
                  ]
                },
                
                // Checkbox selection events
                'selection.checkbox.toggle': {
                  actions: [
                    assign({
                      selectedCells: ({ context, event }) => {
                        const newSelection = new Set<string>(context.selectedCells);
                        // For checkbox, we select all columns for the row
                        const rowCells = context.columns.map(col => `${event.rowId}:${col.id}`);
                        
                        // Check if row is already selected
                        const isSelected = rowCells.some(cell => newSelection.has(cell));
                        
                        if (isSelected) {
                          // Remove all cells for this row
                          rowCells.forEach(cell => newSelection.delete(cell));
                        } else {
                          // Add all cells for this row
                          rowCells.forEach(cell => newSelection.add(cell));
                        }
                        
                        return newSelection;
                      }
                    }),
                    // Update canvas with visual positions
                    ({ context }) => {
                      if (context.actors.canvasActor && context.coordinateMapping && context.viewport) {
                        const visualPositions = calculateVisualPositions(
                          context.selectedCells,
                          context.coordinateMapping,
                          context.viewport,
                          context.settings.rowHeight || 40
                        );
                        context.actors.canvasActor.send({
                          type: 'UPDATE_SELECTION_VISUAL',
                          visualCells: visualPositions
                        });
                      }
                    }
                  ]
                },
                
                'selection.checkbox.all': {
                  actions: [
                    assign({
                      selectedCells: ({ context }) => {
                        const newSelection = new Set<string>();
                        // Select all cells for all rows
                        context.allRowIds.forEach(rowId => {
                          context.columns.forEach(col => {
                            newSelection.add(`${rowId}:${col.id}`);
                          });
                        });
                        return newSelection;
                      }
                    }),
                    // Update canvas with visual positions
                    ({ context }) => {
                      if (context.actors.canvasActor && context.coordinateMapping && context.viewport) {
                        const visualPositions = calculateVisualPositions(
                          context.selectedCells,
                          context.coordinateMapping,
                          context.viewport,
                          context.settings.rowHeight || 40
                        );
                        context.actors.canvasActor.send({
                          type: 'UPDATE_SELECTION_VISUAL',
                          visualCells: visualPositions
                        });
                      }
                    }
                  ]
                },
                
                'selection.checkbox.none': {
                  actions: [
                    assign({
                      selectedCells: () => new Set<string>()
                    }),
                    // Clear canvas selection
                    ({ context }) => {
                      if (context.actors.canvasActor) {
                        context.actors.canvasActor.send({
                          type: 'UPDATE_SELECTION_VISUAL',
                          visualCells: []
                        });
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
                    // Update visible row IDs and viewport based on viewport
                    assign({
                      visibleRowIds: ({ context, event }) => {
                        // Get visible row IDs from allRowIds based on viewport indices
                        const visibleIds = context.allRowIds.slice(event.viewport.start, event.viewport.end);
                        return visibleIds;
                      },
                      viewport: ({ event }) => event.viewport
                    }),
                    // Recalculate visual positions when viewport changes
                    ({ context }) => {
                      if (context.actors.canvasActor && context.coordinateMapping && context.viewport && context.selectedCells.size > 0) {
                        // Calculate visual positions for selected cells in new viewport
                        const visualPositions = calculateVisualPositions(
                          context.selectedCells,
                          context.coordinateMapping,
                          context.viewport,
                          context.settings.rowHeight || 40
                        );
                        
                        // Send updated visual positions to canvas
                        context.actors.canvasActor.send({
                          type: 'UPDATE_SELECTION_VISUAL',
                          visualCells: visualPositions
                        });
                        
                        console.log('TableMachine: Updated visual positions after viewport change', {
                          selectedCount: context.selectedCells.size,
                          visualCount: visualPositions.length,
                          viewport: { start: context.viewport.start, end: context.viewport.end }
                        });
                      }
                    }
                  ]
                },
                
                'view.group.set': {
                  guard: 'canPerformOperation',
                  actions: [
                    'setGroupBy',
                    // Trigger ViewActor re-processing with new group state
                    { type: 'REPROCESS_VIEW_DATA' }
                  ]
                },
                
                'view.sort.set': {
                  guard: 'canPerformOperation',
                  actions: [
                    'setSortBy',
                    // Trigger ViewActor re-processing with new sort state
                    { type: 'REPROCESS_VIEW_DATA' }
                  ]
                },
                
                'view.column.click': {
                  guard: 'canPerformOperation',
                  actions: [
                    // Handle column click for sorting
                    assign({
                      sortBy: ({ context, event }) => {
                        if (event.type !== 'view.column.click') return context.sortBy;
                        
                        const existingSort = context.sortBy.find(s => s.field === event.field);
                        let newSortBy: SortConfig[];
                        
                        if (event.shiftKey) {
                          // Multi-column sort with Shift+click
                          if (existingSort) {
                            // Toggle direction or remove
                            if (existingSort.direction === 'asc') {
                              newSortBy = context.sortBy.map(s => 
                                s.field === event.field ? { ...s, direction: 'desc' as const } : s
                              );
                            } else {
                              newSortBy = context.sortBy.filter(s => s.field !== event.field);
                            }
                          } else {
                            // Add new sort
                            newSortBy = [...context.sortBy, { field: event.field, direction: 'asc' as const }];
                          }
                        } else {
                          // Single column sort
                          if (existingSort && context.sortBy.length === 1) {
                            // Toggle direction
                            newSortBy = existingSort.direction === 'asc' 
                              ? [{ field: event.field, direction: 'desc' as const }]
                              : [];
                          } else {
                            // New single sort
                            newSortBy = [{ field: event.field, direction: 'asc' as const }];
                          }
                        }
                        
                        console.log('TableMachine: Column click sort update:', {
                          field: event.field,
                          shiftKey: event.shiftKey,
                          newSortBy
                        });
                        
                        saveToStorage(context.entityType, 'sortBy', newSortBy);
                        return newSortBy;
                      },
                      version: ({ context }) => context.version + 1
                    }),
                    // Trigger ViewActor re-processing with new sort state
                    { type: 'REPROCESS_VIEW_DATA' }
                  ]
                },
                
                // Column visibility events
                'view.columns.toggle': {
                  guard: 'canPerformOperation',
                  actions: 'toggleColumnVisibility'
                },
                
                'view.columns.show.all': {
                  guard: 'canPerformOperation',
                  actions: assign({
                    columnVisibility: ({ context }) => {
                      const allVisible = Object.fromEntries(
                        Object.keys(context.columnVisibility).map(id => [id, true])
                      );
                      console.log('TableMachine: Showing all columns');
                      saveToStorage(context.entityType, 'columnVisibility', allVisible);
                      return allVisible;
                    },
                    hiddenColumnCount: () => 0,
                    version: ({ context }) => context.version + 1
                  })
                },
                
                'view.columns.hide.all': {
                  guard: 'canPerformOperation',
                  actions: assign({
                    columnVisibility: ({ context }) => {
                      const allHidden = Object.fromEntries(
                        Object.keys(context.columnVisibility).map(id => [id, false])
                      );
                      console.log('TableMachine: Hiding all columns');
                      saveToStorage(context.entityType, 'columnVisibility', allHidden);
                      return allHidden;
                    },
                    hiddenColumnCount: ({ context }) => Object.keys(context.columnVisibility).length,
                    version: ({ context }) => context.version + 1
                  })
                },
                
                'view.columns.visibility.set': {
                  guard: 'canPerformOperation',
                  actions: 'setColumnVisibility'
                },
                
                // Column drag events (handled by drag coordinator)
                'view.columns.drag.start': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.dragCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.drag.move': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.dragCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.drag.end': {
                  guard: 'canPerformOperation',
                  actions: [
                    sendTo(({ context }) => context.actors.dragCoordinator!, 
                      ({ event }) => event),
                    // Update column order when drag ends
                    ({ context, event }) => {
                      if (event.type === 'view.columns.drag.end' && event.targetIndex !== undefined) {
                        // Logic to reorder columns based on drag result
                        console.log('TableMachine: Column drag ended, updating order');
                      }
                    }
                  ]
                },
                
                'view.columns.drag.cancel': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.dragCoordinator!, 
                    ({ event }) => event)
                },
                
                'view.columns.order.set': {
                  guard: 'canPerformOperation',
                  actions: 'setColumnOrder'
                },
                
                'view.columns.order.reset': {
                  guard: 'canPerformOperation',
                  actions: 'resetColumnOrder'
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
                  actions: [
                    'setFilters',
                    // Trigger ViewActor re-processing with new filter state
                    { type: 'REPROCESS_VIEW_DATA' }
                  ]
                },
                
                // Column resize events (handled by dimension managers)
                'view.columns.resize.start': {
                  guard: 'canPerformOperation',
                  actions: ({ context, event }) => {
                    console.log('TableMachine: Column resize started:', event);
                    // Column resize is handled by dimension managers
                  }
                },
                
                'view.columns.resize.move': {
                  guard: 'canPerformOperation',
                  actions: ({ context, event }) => {
                    console.log('TableMachine: Column resize moving:', event);
                    // Column resize is handled by dimension managers
                  }
                },
                
                'view.columns.resize.end': {
                  guard: 'canPerformOperation',
                  actions: ({ context, event }) => {
                    console.log('TableMachine: Column resize ended:', event);
                    // Column resize is handled by dimension managers
                  }
                },
                
                'view.columns.resize.cancel': {
                  guard: 'canPerformOperation',
                  actions: ({ context, event }) => {
                    console.log('TableMachine: Column resize cancelled:', event);
                    // Column resize is handled by dimension managers
                  }
                },
                
                // Drag events
                'drag.*': {
                  guard: 'canPerformOperation',
                  actions: sendTo(({ context }) => context.actors.dragCoordinator!, 
                    ({ event }) => event)
                },
                
                
                // COORDINATES_UPDATED removed - integrated into viewActor processing
                
                // Note: Selection state changes are now handled directly by SelectionManager
                // which updates the canvas overlay without going through events
                
                // Keyboard events
                'keyboard.arrow': {
                  actions: [
                    assign({
                      selectedCells: ({ context, event }) => {
                        if (context.selectedCells.size === 0) return context.selectedCells;
                        
                        // Get first selected cell
                        const firstCell = Array.from(context.selectedCells)[0];
                        const [rowId, columnId] = firstCell.split(':');
                        
                        // Find current position
                        const rowIndex = context.allRowIds.indexOf(rowId);
                        const colIndex = context.columns.findIndex(col => col.id === columnId);
                        
                        if (rowIndex === -1 || colIndex === -1) return context.selectedCells;
                        
                        // Calculate new position based on direction
                        let newRowIndex = rowIndex;
                        let newColIndex = colIndex;
                        
                        switch (event.direction) {
                          case 'up':
                            newRowIndex = Math.max(0, rowIndex - 1);
                            break;
                          case 'down':
                            newRowIndex = Math.min(context.allRowIds.length - 1, rowIndex + 1);
                            break;
                          case 'left':
                            newColIndex = Math.max(0, colIndex - 1);
                            break;
                          case 'right':
                            newColIndex = Math.min(context.columns.length - 1, colIndex + 1);
                            break;
                        }
                        
                        const newRowId = context.allRowIds[newRowIndex];
                        const newColumnId = context.columns[newColIndex].id;
                        const newCellKey = `${newRowId}:${newColumnId}`;
                        
                        if (event.shiftKey) {
                          // Extend selection
                          const newSelection = new Set(context.selectedCells);
                          newSelection.add(newCellKey);
                          return newSelection;
                        } else {
                          // Move selection
                          return new Set([newCellKey]);
                        }
                      }
                    }),
                    // Update canvas with visual positions
                    ({ context }) => {
                      if (context.actors.canvasActor && context.coordinateMapping && context.viewport) {
                        const visualPositions = calculateVisualPositions(
                          context.selectedCells,
                          context.coordinateMapping,
                          context.viewport,
                          context.settings.rowHeight || 40
                        );
                        context.actors.canvasActor.send({
                          type: 'UPDATE_SELECTION_VISUAL',
                          visualCells: visualPositions
                        });
                      }
                    }
                  ]
                },
                
                'keyboard.copy': {
                  actions: [
                    // Copy operation would go here
                    ({ context }) => {
                      console.log('TableMachine: Copy operation for cells:', context.selectedCells);
                    }
                  ]
                },
                
                'keyboard.cut': {
                  actions: [
                    // Cut operation would go here
                    ({ context }) => {
                      console.log('TableMachine: Cut operation for cells:', context.selectedCells);
                    }
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
                    // Clear selection
                    assign({
                      selectedCells: () => new Set<string>()
                    })
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