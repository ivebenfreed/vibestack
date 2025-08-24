/**
 * VibegriddEx Table Machine with Direct Hook Integration
 * 
 * Bypasses fromObservable complexity by using the Legend State hook directly in React
 */

import { setup, assign } from 'xstate'
import type { TableContext, TableEvents, TableConfig } from '../types'

// Import slices (reuse existing)
import { createInitialDimensionsState, dimensionActions } from './table-machine/slices/dimensions-slice'
import { createInitialSelectionState, selectionActions } from './table-machine/slices/selection-slice'
import { createInitialEditState, editActions } from './table-machine/slices/edit-slice'

// Import actors (reuse existing)
import { rendererActor } from '../actors/renderer-actor'
import { canvasActor } from '../actors/canvas-actor'

// ====================================
// SIMPLIFIED LEGEND STATE MACHINE
// ====================================

export const tableBaseMachineWithLegendStateSimple = setup({
  types: {
    context: {} as TableContext,
    events: {} as TableEvents,
    input: {} as TableConfig,
    emitted: {} as
      | { type: 'vibegridx.cell.click'; rowId: string; columnId: string }
      | { type: 'vibegridx.cell.edit'; rowId: string; columnId: string; value: any }
      | { type: 'vibegridx.selection.change'; selectedCells: Set<string> }
  },
  
  actors: {
    rendererActor,
    canvasActor
  },
  
  actions: {
    ...dimensionActions,
    ...selectionActions, 
    ...editActions,
    
    // Action to update rows from external source (Legend State hook)
    updateRowsFromExternal: assign({
      rows: ({ event }) => {
        console.log('🔄 TableMachine: Updating rows from external', { 
          rowCount: event.rows?.length || 0,
          sampleRow: event.rows?.[0] 
        });
        return event.rows || [];
      },
      version: ({ context }) => context.version + 1,
      allRowIds: ({ event }) => (event.rows || []).map((row: any) => row.id),
      visibleRowIds: ({ event }) => (event.rows || []).map((row: any) => row.id)
    }),
    
    // Action to notify renderer of data changes (with delay to ensure initialization)
    notifyRendererOfDataUpdate: ({ context }) => {
      console.log('🔄 TableMachine: Notifying renderer of data update', {
        rowCount: context.rows?.length || 0
      });
      
      // Send update to renderer actor if it exists using the correct event type
      if (context.actors?.rendererActor) {
        // Add a small delay to ensure renderer is initialized
        setTimeout(() => {
          if (context.actors?.rendererActor) {
            console.log('🔄 TableMachine: Sending delayed RENDER_ROWS event');
            context.actors.rendererActor.send({
              type: 'RENDER_ROWS',
              state: {
                rows: context.rows,
                visibleRows: context.rows,
                visibleRowIds: context.visibleRowIds,
                allRowIds: context.allRowIds,
                columns: context.columns,
                viewport: {
                  startRowIndex: 0,
                  endRowIndex: Math.min(context.rows?.length || 0, 100),
                  startColumnIndex: 0,
                  endColumnIndex: context.columns?.length || 0
                },
                version: context.version
              }
            });
          }
        }, 100);
      }
    }
  },
}).createMachine({
  id: 'vibegridx-legend-state-simple',
  
  context: ({ input }: { input: TableConfig }) => {
    // Create initial context using existing patterns
    const dimensionState = createInitialDimensionsState(
      input.columns || [],
      0, // Initial row count
      input.settings?.rowHeight || 40,
      [], // Column order
      {}, // Column visibility
      {} // Column widths
    )
    
    const selectionState = createInitialSelectionState()
    const editState = createInitialEditState()
    
    return {
      id: input.id,
      entityType: input.entityType,
      columns: input.columns || [],
      rows: [], // Will be updated externally
      visibleRowIds: [],
      allRowIds: [],
      settings: {
        enableVirtualScrolling: true,
        enableGrouping: false,
        enableFiltering: false,
        rowHeight: 40,
        bufferSize: 10,
        ...input.settings
      },
      version: 0,
      enableSelectionColumn: input.enableSelectionColumn ?? true,
      
      // Spread other states
      ...dimensionState,
      ...selectionState,
      ...editState,
      
      // Actor refs
      actors: {},
      
      // Other properties
      canvasContainer: null,
      pendingViewUpdateTimer: null,
      columnWidths: {}
    } as TableContext
  },
  
  initial: 'initializing',
  
  states: {
    initializing: {
      entry: [
        // Spawn renderer actor
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
          })
        }),
        
        // Initialize the renderer actor with proper DOM ready check
        ({ context }) => {
          console.log('🚀 TableMachine: Initializing renderer actor');
          
          // Function to check if container is ready and initialize
          const initializeRenderer = () => {
            if (!context.actors?.rendererActor) {
              console.warn('🚀 TableMachine: No renderer actor available for initialization');
              return;
            }
            
            const container = document.getElementById(context.id);
            
            if (!container) {
              console.log('🚀 TableMachine: Container not ready, retrying in 100ms', {
                containerId: context.id,
                containerElement: !!container
              });
              
              // Retry after a longer delay
              setTimeout(initializeRenderer, 100);
              return;
            }
            
            console.log('🚀 TableMachine: Container ready! Sending INITIALIZE event', {
              containerId: context.id,
              container: !!container,
              containerDimensions: {
                width: container.clientWidth,
                height: container.clientHeight
              },
              enableSelectionColumn: context.enableSelectionColumn
            });
            
            context.actors.rendererActor.send({
              type: 'INITIALIZE',
              options: {
                container,
                containerId: context.id,
                enableSelectionColumn: context.enableSelectionColumn,
                columns: context.columns,
                settings: context.settings
              }
            });
          };
          
          // Start the initialization check after a small delay
          setTimeout(initializeRenderer, 50);
        }
      ],
      
      // Immediately go to ready - no need to wait for data
      always: 'ready'
    },
    
    ready: {
      on: {
        // External data updates from Legend State hook
        'external.data.update': {
          actions: ['updateRowsFromExternal', 'notifyRendererOfDataUpdate']
        },
        
        // Entity mutation events (these will be handled by the parent component)
        'entity.save': {
          actions: ['saveEntity']
        },
        
        'entity.create': {
          actions: ['saveEntity']
        },
        
        'entity.delete': {
          actions: ['saveEntity']
        },
        
        // Renderer events (keep existing)
        'INITIALIZE_RENDERER': {
          actions: [
            assign({
              actors: ({ context, spawn, event }) => {
                console.log('TableMachine: Initializing renderer (simple Legend State)')
                return {
                  ...context.actors,
                  rendererActor: spawn('rendererActor', {
                    id: 'renderer',
                    input: {
                      ...event.options,
                      containerId: context.id
                    }
                  })
                }
              }
            })
          ]
        }
      }
    }
  }
})