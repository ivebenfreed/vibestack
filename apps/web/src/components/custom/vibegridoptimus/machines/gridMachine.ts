import { setup, assign, ActorRefFrom } from 'xstate'
import { logGrid, logPerformance } from '../utils/logger'
import type { 
  GridContext, 
  GridEvent, 
  SortColumn, 
  FilterState, 
  GridSelection, 
  GridPreferences,
  VirtualizedRange,
  GridError
} from '../types/gridTypes'

const initialContext: GridContext = {
  // Cell Display Overrides - simple temporary values during editing
  cellStates: new Map<string, {
    cellId: string
    columnKey: string
    displayValue: any  // Only value that matters - temporary override during editing
    isEditing: boolean
    hasError: boolean
    error: string | null
  }>(),
  activeCell: null,
  pendingSaves: new Set(),
  
  // Grid State
  sortColumns: [],
  filterState: {
    activeFilters: new Map(),
    globalSearch: '',
    quickFilters: new Set()
  },
  selection: {
    cells: new Set(),
    rows: new Set(),
    columns: new Set(),
    ranges: []
  },
  
  // Pagination
  currentPage: 0,
  pageSize: 50,
  totalCount: 0,
  
  // Local Persistence
  preferences: {
    columnWidths: new Map(),
    columnOrder: [],
    hiddenColumns: new Set(),
    sortColumns: [],
    filterState: {
      activeFilters: new Map(),
      globalSearch: '',
      quickFilters: new Set()
    },
    pageSize: 50,
    pinnedColumns: { left: [], right: [] }
  },
  persistenceKey: '',
  
  // Performance
  virtualizedRange: {
    start: 0,
    end: 50,
    overscan: 5
  },
  lastAtomUpdate: 0,
  
  // Error Handling
  errors: new Map(),
  retryCount: 0
}

export const gridMachine = setup({
  types: {
    context: {} as GridContext,
    events: {} as GridEvent
  },
  // No actors needed - using direct cell state management
  actions: {
    startCellEdit: assign(({ context, event }) => {
      if (event.type !== 'CELL_EDIT_START') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      
      logGrid('debug', 'Starting cell edit with display override', { cellKey, value: event.value })
      
      const newCellStates = new Map(context.cellStates)
      newCellStates.set(cellKey, {
        cellId: event.cellId,
        columnKey: event.columnKey,
        displayValue: event.value, // Temporary override - component will use this instead of atom
        isEditing: true,
        hasError: false,
        error: null
      })
      
      return { cellStates: newCellStates }
    }),
    
    endCellEdit: assign(({ context, event }) => {
      if (event.type !== 'CELL_EDIT_END') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      
      logGrid('debug', 'Ending cell edit - removing display override', { cellKey })
      
      // Remove the display override - component will fall back to atom value naturally
      const newCellStates = new Map(context.cellStates)
      newCellStates.delete(cellKey)
      
      return { cellStates: newCellStates }
    }),
    
    setSortColumns: assign(({ event }) => {
      if (event.type !== 'SORT_CHANGE') return {}
      return { sortColumns: event.sortColumns }
    }),
    
    setFilterState: assign(({ event }) => {
      if (event.type !== 'FILTER_CHANGE') return {}
      return { filterState: event.filterState }
    }),
    
    setActiveCell: assign(({ event }) => {
      if (event.type !== 'CELL_EDIT_START') return {}
      return { activeCell: `${event.cellId}:${event.columnKey}` }
    }),
    
    clearActiveCell: assign({
      activeCell: null
    }),
    
    selectCell: assign(({ context, event }) => {
      if (event.type !== 'SELECT_CELL') return {}
      const newSelection = new Set(context.selection.cells)
      if (event.extend) {
        newSelection.add(event.cellId)
      } else {
        newSelection.clear()
        newSelection.add(event.cellId)
      }
      return { selection: { ...context.selection, cells: newSelection } }
    }),
    
    selectRow: assign(({ context, event }) => {
      if (event.type !== 'SELECT_ROW') return {}
      const newSelection = new Set(context.selection.rows)
      if (event.extend) {
        newSelection.add(event.rowId)
      } else {
        newSelection.clear()
        newSelection.add(event.rowId)
      }
      return { selection: { ...context.selection, rows: newSelection } }
    }),
    
    selectColumn: assign(({ context, event }) => {
      if (event.type !== 'SELECT_COLUMN') return {}
      const newSelection = new Set(context.selection.columns)
      if (event.extend) {
        newSelection.add(event.columnKey)
      } else {
        newSelection.clear()
        newSelection.add(event.columnKey)
      }
      return { selection: { ...context.selection, columns: newSelection } }
    }),
    
    clearSelection: assign({
      selection: {
        cells: new Set(),
        rows: new Set(),
        columns: new Set(),
        ranges: []
      }
    }),
    
    setPage: assign(({ event }) => {
      if (event.type !== 'SET_PAGE') return {}
      return { currentPage: event.page }
    }),
    
    setPageSize: assign(({ event }) => {
      if (event.type !== 'SET_PAGE_SIZE') return {}
      return { pageSize: event.pageSize }
    }),
    
    setVirtualizedRange: assign(({ event }) => {
      if (event.type !== 'SET_VIRTUALIZED_RANGE') return {}
      return { virtualizedRange: event.range }
    }),
    
    trackPendingSave: assign(({ context, event }) => {
      if (event.type !== 'CELL_SAVE_START') return {}
      const newPendingSaves = new Set(context.pendingSaves)
      newPendingSaves.add(`${event.cellId}:${event.columnKey}`)
      return { pendingSaves: newPendingSaves }
    }),
    
    removePendingSave: assign(({ context, event }) => {
      if (event.type !== 'CELL_SAVE_COMPLETE' && event.type !== 'CELL_SAVE_FAILED') return {}
      const newPendingSaves = new Set(context.pendingSaves)
      newPendingSaves.delete(`${event.cellId}:${event.columnKey}`)
      return { pendingSaves: newPendingSaves }
    }),
    
    stopPreviousEdit: assign(({ context }) => {
      if (context.activeCell) {
        const cellState = context.cellStates.get(context.activeCell)
        if (cellState && cellState.state === 'editing') {
          const newCellStates = new Map(context.cellStates)
          newCellStates.set(context.activeCell, {
            ...cellState,
            state: 'idle',
            isEditing: false,
            displayValue: cellState.atomValue // Revert to atom value
          })
          return { cellStates: newCellStates }
        }
      }
      return {}
    }),
    
    forwardAtomUpdate: assign(({ context, event }) => {
      if (event.type !== 'ATOM_UPDATE') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      const cellState = context.cellStates.get(cellKey)
      
      if (cellState) {
        logGrid('debug', 'Atom auto-updated via live.changes - reconciling local state', { 
          cellKey, 
          atomValue: event.value, 
          localValue: cellState.displayValue,
          state: cellState.state 
        })
        
        const newCellStates = new Map(context.cellStates)
        
        if (cellState.state === 'persisting') {
          // Atom updated while we were persisting - reconcile automatically
          logGrid('debug', 'Auto-reconciliation: atom updated, transitioning to idle', { cellKey })
          newCellStates.set(cellKey, {
            ...cellState,
            state: 'idle',
            atomValue: event.value,
            displayValue: event.value, // Now show the atom value
            isPersisting: false,
            hasError: false,
            error: null,
            retryCount: 0,
            lastAtomUpdate: Date.now()
          })
        } else if (cellState.state === 'idle') {
          // Cell is idle, just update the underlying atom value
          newCellStates.set(cellKey, {
            ...cellState,
            atomValue: event.value,
            displayValue: event.value, // Show updated atom value when idle
            lastAtomUpdate: Date.now()
          })
        } else {
          // Cell is being edited - keep local value, just update atom reference
          newCellStates.set(cellKey, {
            ...cellState,
            atomValue: event.value,
            // Keep displayValue as local state during editing
            lastAtomUpdate: Date.now()
          })
        }
        
        return { cellStates: newCellStates }
      }
      return {}
    }),
    
    forwardBulkUpdate: assign(({ context, event }) => {
      if (event.type !== 'BULK_UPDATE') return {}
      
      const newCellStates = new Map(context.cellStates)
      let hasChanges = false
      
      event.updates.forEach(update => {
        const cellKey = `${update.cellId}:${update.columnKey}`
        const cellState = newCellStates.get(cellKey)
        
        if (cellState) {
          newCellStates.set(cellKey, {
            ...cellState,
            atomValue: update.value,
            displayValue: cellState.state === 'idle' ? update.value : cellState.displayValue,
            lastAtomUpdate: Date.now()
          })
          hasChanges = true
        }
      })
      
      return hasChanges ? { cellStates: newCellStates } : {}
    }),
    
    recordError: assign(({ context, event }) => {
      if (event.type !== 'ERROR_OCCURRED') return {}
      const newErrors = new Map(context.errors)
      newErrors.set(event.errorId, event.error)
      return { errors: newErrors }
    }),
    
    recordCellError: assign(({ context, event }) => {
      if (event.type !== 'CELL_SAVE_FAILED') return {}
      const newErrors = new Map(context.errors)
      const errorId = `${event.cellId}:${event.columnKey}`
      newErrors.set(errorId, event.error)
      return { errors: newErrors }
    }),
    
    // Cell State Transition Actions
    updateDisplayValue: assign(({ context, event }) => {
      if (event.type !== 'CELL_CHANGE_VALUE') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      const cellState = context.cellStates.get(cellKey)
      
      if (cellState && cellState.isEditing) {
        logGrid('debug', 'Updating display override', { cellKey, value: event.value })
        
        const newCellStates = new Map(context.cellStates)
        newCellStates.set(cellKey, {
          ...cellState,
          displayValue: event.value // Just update the temporary display override
        })
        return { cellStates: newCellStates }
      }
      return {}
    }),
    
    commitEdit: assign(({ context, event }) => {
      if (event.type !== 'CELL_COMMIT_EDIT') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      const cellState = context.cellStates.get(cellKey)
      
      if (cellState) {
        logGrid('debug', 'Committing edit - keeping display override until atom updates', { cellKey, value: event.value })
        
        const newCellStates = new Map(context.cellStates)
        newCellStates.set(cellKey, {
          ...cellState,
          displayValue: event.value, // Keep showing this value until atom subscription updates component
          isEditing: false // But mark as not editing anymore
        })
        return { cellStates: newCellStates }
      }
      return {}
    }),
    
    handleSaveSuccess: assign(({ context, event }) => {
      if (event.type !== 'CELL_SAVE_SUCCESS') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      
      logGrid('debug', 'Save success - removing display override, let atom subscription take over', { cellKey })
      
      // Remove display override - atom subscription will handle the update naturally
      const newCellStates = new Map(context.cellStates)
      newCellStates.delete(cellKey)
      
      return { cellStates: newCellStates }
    }),
    
    handleSaveError: assign(({ context, event }) => {
      if (event.type !== 'CELL_SAVE_ERROR') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      
      logGrid('debug', 'Save error - showing error state', { cellKey, error: event.error })
      
      // Show error state temporarily, then remove override to fall back to atom
      const newCellStates = new Map(context.cellStates)
      newCellStates.set(cellKey, {
        cellId: event.cellId,
        columnKey: event.columnKey,
        displayValue: null, // Will show error in renderer
        isEditing: false,
        hasError: true,
        error: event.error
      })
      
      // DISABLED: Auto-clear error after a delay
      // setTimeout(() => {
      //   const currentStates = new Map(newCellStates)
      //   currentStates.delete(cellKey)
      //   // Note: This would need to be sent as an event in real implementation
      // }, 1000) // Shorter timeout
      console.log('[gridMachine] 🚫 DISABLED: Auto-clear error timeout disabled for performance testing')
      
      return { cellStates: newCellStates }
    }),
    
    cellReconcileComplete: assign(({ context, event }) => {
      if (event.type !== 'CELL_RECONCILE_COMPLETE') return {}
      
      const cellKey = `${event.cellId}:${event.columnKey}`
      const cellState = context.cellStates.get(cellKey)
      
      if (cellState) {
        logGrid('debug', 'Reconciliation complete - pure local state flow finished', { cellKey })
        
        const newCellStates = new Map(context.cellStates)
        newCellStates.set(cellKey, {
          ...cellState,
          state: 'idle',
          isPersisting: false,
          hasError: false,
          error: null,
          retryCount: 0
          // displayValue should already be set to atom value by forwardAtomUpdate
        })
        return { cellStates: newCellStates }
      }
      return {}
    }),
    
    // Grid operations with performance logging
    applySorting: () => {
      const stopTimer = logPerformance('Grid sorting operation')
      logGrid('debug', 'Applying sorting')
      stopTimer()
    },
    applyFiltering: () => {
      const stopTimer = logPerformance('Grid filtering operation')
      logGrid('debug', 'Applying filtering')
      stopTimer()
    },
    processSelection: () => {
      logGrid('debug', 'Processing selection')
    },
    persistToStorage: ({ context }) => {
      const stopTimer = logPerformance('Persist to storage')
      try {
        logGrid('debug', 'Persisting to storage', { cellStates: context.cellStates.size })
        // Batch persistence operations for efficiency
      } finally {
        stopTimer()
      }
    },
    savePreferences: ({ context }) => {
      const stopTimer = logPerformance('Save grid preferences')
      try {
        // Only save if there are actual preferences to save
        if (context.sortColumns.length > 0 || context.filterState.globalSearch || context.selection.cells.size > 0) {
          logGrid('debug', 'Saving grid preferences', {
            sortColumns: context.sortColumns.length,
            hasGlobalSearch: !!context.filterState.globalSearch,
            selectedCells: context.selection.cells.size
          })
          // Actual persistence would go here
        } else {
          logGrid('debug', 'Skipping preference save - no meaningful changes')
        }
      } finally {
        stopTimer()
      }
    },
    loadPreferences: () => {
      logGrid('info', 'Loading grid preferences')
    },
    resetPreferences: assign({ preferences: initialContext.preferences }),
    refreshData: () => console.log('[GridMachine] 🔄 Refreshing data...'),
    
    // Memory leak prevention actions for cell states
    cleanupAllCellStates: assign(({ context }) => {
      logGrid('info', 'Cleaning up all cell states', { count: context.cellStates.size })
      return { cellStates: new Map() }
    }),
    
    cleanupIdleCellStates: assign(({ context }) => {
      logGrid('info', 'Cleaning up idle cell states', { totalStates: context.cellStates.size })
      const activeCellStates = new Map()
      let cleanedCount = 0
      
      context.cellStates.forEach((cellState, key) => {
        // Keep cell states that are actively editing or have pending operations
        if (cellState.state === 'editing' || cellState.state === 'committing' || cellState.state === 'persisting') {
          activeCellStates.set(key, cellState)
        } else {
          logGrid('debug', 'Cleaning up idle cell state', { key })
          cleanedCount++
        }
      })
      
      logGrid('info', 'Idle cell state cleanup completed', { cleanedCount, remainingStates: activeCellStates.size })
      return { cellStates: activeCellStates }
    }),
    
    cleanupErroredCellStates: assign(({ context }) => {
      logGrid('info', 'Cleaning up errored cell states', { totalStates: context.cellStates.size })
      const validCellStates = new Map()
      let cleanedCount = 0
      
      context.cellStates.forEach((cellState, key) => {
        if (cellState.hasError && cellState.retryCount > 3) {
          logGrid('debug', 'Cleaning up errored cell state', { key })
          cleanedCount++
        } else {
          validCellStates.set(key, cellState)
        }
      })
      
      logGrid('info', 'Errored cell state cleanup completed', { cleanedCount, remainingStates: validCellStates.size })
      return { cellStates: validCellStates }
    })
  },
  
  guards: {
    noMorePendingSaves: ({ context }) => context.pendingSaves.size === 0,
    hasTooManyCellStates: ({ context }) => {
      // Trigger cleanup if we have more than 50 cell states
      return context.cellStates.size > 50
    },
    hasIdleCellStates: ({ context }) => {
      // Check if we have cell states in idle state that can be cleaned up
      let idleCount = 0
      context.cellStates.forEach((cellState) => {
        if (cellState.state === 'idle') {
          idleCount++
        }
      })
      return idleCount > 10 // Trigger cleanup if more than 10 idle states
    }
  }
}).createMachine({
  id: 'grid',
  initial: 'idle',
  context: initialContext,
  states: {
      idle: {
        on: {
          CELL_EDIT_START: {
            target: 'editing',
            actions: ['initializeCellState', 'setActiveCell']
          },
          SORT_CHANGE: {
            target: 'sorting',
            actions: 'setSortColumns'
          },
          FILTER_CHANGE: {
            target: 'filtering',
            actions: 'setFilterState'
          },
          SELECT_CELL: {
            target: 'selecting',
            actions: 'selectCell'
          },
          SELECT_ROW: {
            target: 'selecting',
            actions: 'selectRow'
          },
          SELECT_COLUMN: {
            target: 'selecting',
            actions: 'selectColumn'
          },
          CLEAR_SELECTION: {
            actions: 'clearSelection'
          },
          SET_PAGE: {
            actions: 'setPage'
          },
          SET_PAGE_SIZE: {
            actions: 'setPageSize'
          },
          SAVE_PREFERENCES: {
            target: 'persisting',
            actions: 'savePreferences'
          },
          LOAD_PREFERENCES: {
            actions: 'loadPreferences'
          },
          RESET_PREFERENCES: {
            actions: 'resetPreferences'
          },
          // No atom update handling needed
          CELL_ATOM_UPDATE: {
            actions: 'forwardAtomUpdate'
          },
          BULK_UPDATE: {
            actions: 'forwardBulkUpdate'
          },
          SET_VIRTUALIZED_RANGE: {
            actions: 'setVirtualizedRange'
          },
          ERROR_OCCURRED: {
            actions: 'recordError'
          },
          CLEANUP_IDLE_STATES: {
            target: 'cleaning',
            guard: 'hasIdleCellStates'
          },
          CLEANUP_ALL_STATES: {
            target: 'cleaning'
          },
          MEMORY_PRESSURE: {
            target: 'cleaning',
            guard: 'hasTooManyCellStates'
          }
        }
      },
      
      editing: {
        on: {
          CELL_EDIT_START: {
            actions: ['stopPreviousEdit', 'initializeCellState', 'setActiveCell']
          },
          CELL_EDIT_END: {
            actions: ['transitionCellToIdle', 'clearActiveCell'],
            target: 'idle'
          },
          CELL_CHANGE_VALUE: {
            actions: 'cellChangeValue'
          },
          CELL_COMMIT_EDIT: {
            actions: 'cellCommitEdit'
          },
          CELL_SAVE_SUCCESS: {
            actions: 'cellSaveSuccess'
          },
          CELL_SAVE_ERROR: {
            actions: 'cellSaveError'
          },
          CELL_SAVE_START: {
            actions: 'trackPendingSave'
          },
          CELL_SAVE_COMPLETE: {
            actions: 'removePendingSave',
            target: 'idle',
            guard: 'noMorePendingSaves'
          },
          CELL_SAVE_FAILED: {
            actions: ['removePendingSave', 'recordCellError'],
            target: 'idle',
            guard: 'noMorePendingSaves'
          },
          // No atom update handling needed
          // No reconciliation needed
          CLEAR_SELECTION: {
            actions: 'clearSelection'
          }
        }
      },
      
      sorting: {
        entry: 'applySorting',
        on: {
          SORT_CHANGE: {
            actions: 'setSortColumns'
          }
        },
        after: {
          100: 'idle'
        }
      },
      
      filtering: {
        entry: 'applyFiltering',
        on: {
          FILTER_CHANGE: {
            actions: 'setFilterState'
          }
        },
        after: {
          200: 'idle'
        }
      },
      
      selecting: {
        entry: 'processSelection',
        after: {
          50: 'idle'
        },
        on: {
          SELECT_CELL: {
            actions: 'selectCell'
          },
          SELECT_ROW: {
            actions: 'selectRow'
          },
          SELECT_COLUMN: {
            actions: 'selectColumn'
          },
          CLEAR_SELECTION: {
            actions: 'clearSelection'
          }
        }
      },
      
      persisting: {
        entry: 'persistToStorage',
        on: {
          SAVE_PREFERENCES: {
            actions: 'savePreferences'
          }
        },
        after: {
          500: 'idle'
        }
      },
      
      loading: {
        on: {
          REFRESH_DATA: {
            actions: 'refreshData'
          },
          LOAD_PREFERENCES: {
            actions: 'loadPreferences'
          }
        },
        after: {
          1000: 'idle'
        }
      },
      
      cleaning: {
        description: 'Cleaning up memory and idle cell states',
        entry: 'cleanupIdleCellStates',
        on: {
          CLEANUP_ALL: {
            actions: 'cleanupAllCellStates'
          },
          CLEANUP_ERRORS: {
            actions: 'cleanupErroredCellStates'
          }
        },
        after: {
          100: 'idle'
        }
      }
    }
  })

export type GridMachineActor = ActorRefFrom<typeof gridMachine>