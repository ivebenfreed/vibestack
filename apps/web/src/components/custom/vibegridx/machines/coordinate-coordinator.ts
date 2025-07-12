import { setup, assign, sendParent, fromPromise } from 'xstate';
import { createVibeGridXCoordinateManager, type VibeGridXCoordinateManager } from '../coordinates/VibeGridXCoordinateManager';
import type { Column } from '../types';

// ====================================
// TYPES
// ====================================

interface CoordinateContext {
  coordinateManager: VibeGridXCoordinateManager | null;
  rowCount: number;
  columnCount: number;
  version: number;
  lastUpdateTime: number;
}

type CoordinateEvents = 
  | { type: 'coordinate.initialize' }
  | { 
      type: 'coordinate.rows.update'; 
      rows: Array<{ rowId: string; index: number }>;
      sortBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    }
  | { 
      type: 'coordinate.columns.update'; 
      columns: Array<{ 
        columnId: string; 
        index: number; 
        offset: number; 
        width: number;
      }>;
    }
  | { 
      type: 'coordinate.position.get'; 
      rowId: string; 
      columnId: string;
    }
  | { 
      type: 'coordinate.range.calculate'; 
      startRow: number; 
      endRow: number; 
      startColumn: number; 
      endColumn: number;
    }
  | { type: 'coordinate.clear' }
  | { type: 'coordinate.debug' };

// ====================================
// ASYNC ACTORS
// ====================================

const initializeCoordinateManager = fromPromise(async () => {
  console.log('CoordinateCoordinator: Initializing coordinate manager');
  const manager = createVibeGridXCoordinateManager();
  return { manager };
});

const processRowUpdate = fromPromise(async ({ 
  input 
}: { 
  input: { 
    manager: VibeGridXCoordinateManager; 
    rows: Array<{ rowId: string; index: number }>;
    sortBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  } 
}) => {
  const { manager, rows, sortBy } = input;
  
  // Sort rows array by index to ensure correct order
  const sortedRows = [...rows].sort((a, b) => a.index - b.index);
  
  // Extract row objects with IDs for coordinate manager
  const rowData = sortedRows.map(r => ({ id: r.rowId }));
  
  // Update coordinate manager
  manager.updateRows(rowData, sortBy || []);
  
  return { rowCount: rows.length };
});

const processColumnUpdate = fromPromise(async ({ 
  input 
}: { 
  input: { 
    manager: VibeGridXCoordinateManager;
    columns: Array<{ 
      columnId: string; 
      index: number; 
      offset: number; 
      width: number;
    }>;
  } 
}) => {
  const { manager, columns } = input;
  
  // Sort columns by index
  const sortedColumns = [...columns].sort((a, b) => a.index - b.index);
  
  // Create Column objects for coordinate manager
  const columnData: Column[] = sortedColumns.map(col => ({
    id: col.columnId,
    name: col.columnId, // Will be updated by renderer
    field: col.columnId,
    width: col.width
  }));
  
  // Update coordinate manager
  manager.updateColumns(columnData);
  
  return { columnCount: columns.length };
});

// ====================================
// COORDINATE COORDINATOR MACHINE
// ====================================

export const coordinateCoordinatorMachine = setup({
  types: {
    context: {} as CoordinateContext,
    events: {} as CoordinateEvents
  },
  
  actors: {
    initializeCoordinateManager,
    processRowUpdate,
    processColumnUpdate
  },
  
  actions: {
    // Store coordinate manager
    storeCoordinateManager: assign({
      coordinateManager: ({ event }) => {
        if (event.type === 'done.invoke.coordinateCoordinator.initializing:invocation[0]') {
          return event.output.manager;
        }
        return null;
      }
    }),
    
    // Update row count
    updateRowCount: assign({
      rowCount: ({ event }) => {
        if (event.type === 'done.invoke.coordinateCoordinator.updatingRows:invocation[0]') {
          return event.output.rowCount;
        }
        return 0;
      },
      version: ({ context }) => context.version + 1,
      lastUpdateTime: () => Date.now()
    }),
    
    // Update column count  
    updateColumnCount: assign({
      columnCount: ({ event }) => {
        if (event.type === 'done.invoke.coordinateCoordinator.updatingColumns:invocation[0]') {
          return event.output.columnCount;
        }
        return 0;
      },
      version: ({ context }) => context.version + 1,
      lastUpdateTime: () => Date.now()
    }),
    
    // Clear mappings
    clearMappings: ({ context }) => {
      if (context.coordinateManager) {
        context.coordinateManager.clear();
      }
    },
    
    // Debug output
    debugOutput: ({ context }) => {
      console.log('CoordinateCoordinator Debug:', {
        hasManager: !!context.coordinateManager,
        rowCount: context.rowCount,
        columnCount: context.columnCount,
        version: context.version,
        lastUpdateTime: new Date(context.lastUpdateTime).toISOString()
      });
      
      if (context.coordinateManager) {
        console.log('Coordinate Manager State:', {
          rowIds: context.coordinateManager.getSortedRowIds().slice(0, 5),
          columnIds: context.coordinateManager.getColumnIds()
        });
      }
    },
    
    // Notify parent that coordinate manager is ready
    notifyManagerReady: sendParent(({ context }) => {
      console.log('CoordinateCoordinator: Notifying parent that manager is ready', {
        hasManager: !!context.coordinateManager,
        managerColumnCount: context.coordinateManager?.getColumnCount() || 0
      });
      return {
        type: 'coordinate.manager.ready',
        coordinateManager: context.coordinateManager
      };
    }),
    
    // Notify parent of mapping changes
    notifyMappingChanged: sendParent(() => ({
      type: 'coordinate.mapping.changed'
    }))
  },
  
  guards: {
    hasCoordinateManager: ({ context }) => context.coordinateManager !== null,
    
    isHighFrequencyUpdate: ({ context }) => {
      const now = Date.now();
      const timeSinceLastUpdate = now - context.lastUpdateTime;
      // Warn if updates are happening more than 60 times per second
      return timeSinceLastUpdate < 16;
    }
  }
  
}).createMachine({
  id: 'coordinateCoordinator',
  
  initial: 'uninitialized',
  
  context: {
    coordinateManager: null,
    rowCount: 0,
    columnCount: 0,
    version: 0,
    lastUpdateTime: 0
  },
  
  states: {
    uninitialized: {
      on: {
        'coordinate.initialize': {
          target: 'initializing'
        },
        // Log any events received while uninitialized
        '*': {
          actions: ({ event }) => {
            console.warn('CoordinateCoordinator: Received event while uninitialized', event);
          }
        }
      }
    },
    
    initializing: {
      invoke: {
        src: 'initializeCoordinateManager',
        onDone: {
          target: 'ready',
          actions: [
            'storeCoordinateManager',
            'notifyManagerReady',
            ({ event }) => {
              console.log('CoordinateCoordinator: Initialized successfully');
            }
          ]
        },
        onError: {
          target: '#coordinateCoordinator.error',
          actions: ({ event }) => {
            console.error('CoordinateCoordinator: Failed to initialize', event.error);
          }
        }
      }
    },
    
    ready: {
      entry: () => {
        console.log('CoordinateCoordinator: Entered ready state');
      },
      on: {
        'coordinate.rows.update': {
          target: 'updatingRows',
          guard: 'hasCoordinateManager',
          actions: ({ event }) => {
            console.log('CoordinateCoordinator: Received coordinate.rows.update in ready state', {
              rowCount: event.rows.length
            });
          }
        },
        
        'coordinate.columns.update': {
          target: 'updatingColumns',
          guard: 'hasCoordinateManager',
          actions: ({ event }) => {
            console.log('CoordinateCoordinator: Received coordinate.columns.update in ready state', {
              columnCount: event.columns.length
            });
          }
        },
        
        'coordinate.position.get': {
          actions: ({ context, event }) => {
            if (context.coordinateManager) {
              const position = context.coordinateManager.getCellPosition(
                event.rowId,
                event.columnId
              );
              console.log('CoordinateCoordinator: Position query', {
                rowId: event.rowId,
                columnId: event.columnId,
                position
              });
            }
          }
        },
        
        'coordinate.clear': {
          actions: [
            'clearMappings',
            assign({
              rowCount: 0,
              columnCount: 0,
              version: ({ context }) => context.version + 1
            }),
            'notifyMappingChanged'
          ]
        },
        
        'coordinate.debug': {
          actions: 'debugOutput'
        }
      }
    },
    
    updatingRows: {
      entry: ({ context }) => {
        if (context.lastUpdateTime > 0) {
          const timeSinceLastUpdate = Date.now() - context.lastUpdateTime;
          if (timeSinceLastUpdate < 50) {
            console.warn('CoordinateCoordinator: High frequency row updates detected', {
              timeSinceLastUpdate
            });
          }
        }
      },
      
      invoke: {
        src: 'processRowUpdate',
        input: ({ context, event }) => ({
          manager: context.coordinateManager!,
          rows: event.type === 'coordinate.rows.update' ? event.rows : [],
          sortBy: event.type === 'coordinate.rows.update' ? event.sortBy : undefined
        }),
        onDone: {
          target: 'ready',
          actions: [
            'updateRowCount',
            'notifyMappingChanged',
            ({ event }) => {
              console.log('CoordinateCoordinator: Rows updated', {
                rowCount: event.output.rowCount
              });
            }
          ]
        },
        onError: {
          target: '#coordinateCoordinator.error',
          actions: ({ event }) => {
            console.error('CoordinateCoordinator: Failed to update rows', event.error);
          }
        }
      }
    },
    
    updatingColumns: {
      entry: ({ context }) => {
        if (context.lastUpdateTime > 0) {
          const timeSinceLastUpdate = Date.now() - context.lastUpdateTime;
          if (timeSinceLastUpdate < 50) {
            console.warn('CoordinateCoordinator: High frequency column updates detected', {
              timeSinceLastUpdate
            });
          }
        }
      },
      
      invoke: {
        src: 'processColumnUpdate',
        input: ({ context, event }) => ({
          manager: context.coordinateManager!,
          columns: event.type === 'coordinate.columns.update' ? event.columns : []
        }),
        onDone: {
          target: 'ready',
          actions: [
            'updateColumnCount',
            'notifyMappingChanged',
            ({ event }) => {
              console.log('CoordinateCoordinator: Columns updated', {
                columnCount: event.output.columnCount
              });
            }
          ]
        },
        onError: {
          target: 'error',
          actions: ({ event }) => {
            console.error('CoordinateCoordinator: Failed to update columns', event.error);
          }
        }
      }
    },
    
    error: {
      entry: () => {
        console.error('CoordinateCoordinator: Entered error state');
      },
      
      after: {
        5000: 'uninitialized' // Retry after 5 seconds
      }
    }
  }
});