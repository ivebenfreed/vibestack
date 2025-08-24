/**
 * VibegriddEx Table Machine with Legend State Integration
 * 
 * Clean implementation using fromObservable to observe Legend State directly.
 * Replaces the atomic store pattern with reactive observables.
 */

import { setup, assign, spawnChild, fromObservable, emit } from 'xstate'
import type { TableContext, TableEvents, TableConfig } from '../types'
import { createVibegriddExObservables } from '../stores/legend-state-integration'

// Import slices (reuse existing)
import { createInitialDimensionsState, dimensionActions } from './table-machine/slices/dimensions-slice'
import { createInitialSelectionState, selectionActions } from './table-machine/slices/selection-slice'
import { createInitialEditState, editActions } from './table-machine/slices/edit-slice'

// Import actors (reuse existing)
import { rendererActor } from '../actors/renderer-actor'
import { canvasActor } from '../actors/canvas-actor'

// ====================================
// LEGEND STATE CONTEXT
// ====================================

interface LegendStateTableContext extends Omit<TableContext, 'storeActor'> {
  // Legend State integration
  legendStateObservables: any
  legendStateDataActor: any
}

// ====================================
// TABLE MACHINE WITH LEGEND STATE
// ====================================

export const tableBaseMachineWithLegendState = setup({
  types: {
    context: {} as LegendStateTableContext,
    events: {} as TableEvents,
    input: {} as TableConfig,
    emitted: {} as
      | { type: 'vibegridx.cell.click'; rowId: string; columnId: string }
      | { type: 'vibegridx.cell.edit'; rowId: string; columnId: string; value: any }
      | { type: 'vibegridx.selection.change'; selectedCells: Set<string> }
  },
  
  actors: {
    rendererActor,
    canvasActor,
    // Legend State data observer
    legendStateDataActor: fromObservable(({ input }: { input: any }) => {
      const observables = createVibegriddExObservables(input.tableId, input.entityType, input.columns)
      return observables.processedRows$
    }),
  },
  
  actions: {
    ...dimensionActions,
    ...selectionActions, 
    ...editActions,
    
    // New action to handle Legend State data updates
    updateRowsFromLegendState: assign({
      rows: ({ event }) => {
        console.log('🔍 TableMachine: Received Legend State data update', {
          rowCount: event.data?.length || 0
        })
        return event.data || []
      },
      version: ({ context }) => context.version + 1
    }),
    
    // Action to update view state via Legend State
    updateLegendStateView: ({ context, event }) => {
      const observables = context.legendStateObservables
      if (!observables) return
      
      console.log('🔍 TableMachine: Updating Legend State view', event)
      
      switch (event.type) {
        case 'view.column.click':
          observables.actions.toggleSort(event.field)
          break
        case 'view.columns.toggle':
          observables.actions.toggleColumnVisibility(event.columnId)
          break
        case 'view.filter.set':
          observables.actions.setFilters(event.filters)
          break
        // Add more view actions as needed
      }
    },
    
    // Actions for Legend State mutations
    saveEntity: assign({
      version: ({ context }) => context.version + 1
    }),
    
    handleEntitySave: ({ context, event }) => {
      const observables = context.legendStateObservables
      if (!observables) return
      
      console.log('🔄 TableMachine: Handling entity save via Legend State', event)
      
      // Call Legend State mutation
      observables.actions.saveEntity(context.entityType, event.rowId, event.updates)
        .catch(error => {
          console.error('❌ TableMachine: Entity save failed', error)
          // TODO: Send error event back to machine
        })
    },
    
    handleBatchUpdate: ({ context, event }) => {
      const observables = context.legendStateObservables
      if (!observables) return
      
      console.log('🔄 TableMachine: Handling batch update via Legend State', event)
      
      // Call Legend State batch mutation
      observables.actions.batchUpdateEntities(context.entityType, event.updates)
        .catch(error => {
          console.error('❌ TableMachine: Batch update failed', error)
          // TODO: Send error event back to machine
        })
    },
    
    handleRowCopy: ({ context, event }) => {
      const observables = context.legendStateObservables
      if (!observables) return
      
      console.log('🔄 TableMachine: Handling row copy via Legend State', event)
      
      // Call Legend State copy operation
      observables.actions.copyRows(context.entityType, event.sourceRowIds, event.targetAfter)
        .catch(error => {
          console.error('❌ TableMachine: Row copy failed', error)
          // TODO: Send error event back to machine
        })
    },
    
    handleRowMove: ({ context, event }) => {
      const observables = context.legendStateObservables
      if (!observables) return
      
      console.log('🔄 TableMachine: Handling row move via Legend State', event)
      
      // Call Legend State move operation
      observables.actions.moveRows(context.entityType, event.rowIds, event.targetPosition)
        .catch(error => {
          console.error('❌ TableMachine: Row move failed', error)
          // TODO: Send error event back to machine
        })
    }
  },
}).createMachine({
  id: 'vibegridx-legend-state-table',
  
  context: ({ input }: { input: TableConfig }) => {
    // Create initial context similar to original but simplified
    const dimensionState = createInitialDimensionsState(
      input.columns || [],
      0, // Initial row count - will be updated by Legend State
      input.settings?.rowHeight || 40,
      [], // Column order from Legend State
      {}, // Column visibility from Legend State
      {} // Column widths
    )
    
    const selectionState = createInitialSelectionState()
    const editState = createInitialEditState()
    
    return {
      id: input.id,
      entityType: input.entityType,
      columns: input.columns || [],
      rows: [], // Will be populated by Legend State
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
      
      // Legend State integration
      legendStateObservables: null,
      legendStateDataActor: null,
      
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
    } as LegendStateTableContext
  },
  
  initial: 'initializing',
  
  states: {
    initializing: {
      entry: [
        // Create Legend State observables
        assign({
          legendStateObservables: ({ context }) => {
            console.log('TableMachine: Creating Legend State observables for', context.entityType)
            return createVibegriddExObservables(context.id, context.entityType, context.columns)
          }
        }),
        
        // Spawn Legend State data observer
        assign({
          legendStateDataActor: ({ context, spawn }) => {
            console.log('TableMachine: Spawning Legend State data observer')
            return spawn('legendStateDataActor', {
              input: {
                tableId: context.id,
                entityType: context.entityType,
                columns: context.columns
              }
            })
          }
        }),
        
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
        })
      ],
      
      on: {
        // Legend State data updates come via fromObservable
        'xstate.snapshot': {
          guard: ({ event }) => event.snapshot?.context?.type === 'legendStateDataActor',
          actions: ['updateRowsFromLegendState'],
          target: 'ready'
        }
      }
    },
    
    ready: {
      on: {
        // View actions that update Legend State
        'view.column.click': {
          actions: ['updateLegendStateView']
        },
        
        'view.columns.toggle': {
          actions: ['updateLegendStateView']
        },
        
        'view.filter.set': {
          actions: ['updateLegendStateView']
        },
        
        // Entity mutation events
        'entity.save': {
          actions: ['handleEntitySave', 'saveEntity']
        },
        
        'entity.create': {
          actions: ['handleEntitySave'] // Same handler for create
        },
        
        'entity.delete': {
          actions: ['handleEntitySave'] // Same handler for delete
        },
        
        // Batch operations
        'entity.batch.update': {
          actions: ['handleBatchUpdate']
        },
        
        'entity.batch.create': {
          actions: ['handleBatchUpdate'] // Same handler pattern
        },
        
        // Multi-copy and drag operations  
        'rows.copy': {
          actions: ['handleRowCopy']
        },
        
        'rows.move': {
          actions: ['handleRowMove']
        },
        
        'rows.drag.end': {
          actions: ['handleRowMove'] // Drag end is a type of move
        },
        
        // Handle continued Legend State updates
        'xstate.snapshot': {
          guard: ({ event }) => event.snapshot?.context?.type === 'legendStateDataActor',
          actions: ['updateRowsFromLegendState']
        },
        
        // Renderer events (keep existing)
        'INITIALIZE_RENDERER': {
          actions: [
            assign({
              actors: ({ context, spawn, event }) => {
                console.log('TableMachine: Initializing renderer with Legend State data')
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