import React from 'react'
import { useMachine } from '@xstate/react'
import { gridMachine, type GridMachineActor } from '../machines/gridMachine'
import type { 
  GridMachineAPI, 
  SaveHandler, 
  SortColumn, 
  FilterState, 
  GridSelection,
  VirtualizedRange,
  GridError
} from '../types/gridTypes'

export interface UseGridMachineOptions {
  entityName: string
  persistenceKey?: string
  initialPageSize?: number
}

/**
 * Hook to create and manage a simplified grid state machine
 * 
 * Pure Display Override Approach:
 * - Grid Machine: Handles grid-level state (sorting, filtering, selection, pagination)
 * - Cell Display Overrides: Simple temporary values during editing (no complex state)
 * - Component Subscription: Atom subscription with shallowEqual handles all updates naturally
 * - Performance: Minimal state tracking, automatic cleanup, no reconciliation needed
 * 
 * Flow: Edit → Display Override → Save → Remove Override → Component Updates via Atom Subscription
 */
export function useGridMachine(options: UseGridMachineOptions): GridMachineAPI {
  const { entityName, persistenceKey = `grid-${entityName}`, initialPageSize = 50 } = options
  
  const [state, send] = useMachine(gridMachine.provide({
    context: {
      // Cell State Management (no actors - direct state tracking)
      cellStates: new Map(),
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
      pageSize: initialPageSize,
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
        pageSize: initialPageSize,
        pinnedColumns: { left: [], right: [] }
      },
      persistenceKey,
      
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
  }))
  
  // Fire-and-forget Cell Management - non-blocking
  const startCellEdit = React.useCallback((
    cellId: string, 
    columnKey: string, 
    value: any, 
    onUpdate?: SaveHandler
  ) => {
    // Direct dispatch - no setTimeout to avoid violations
    send({ 
      type: 'CELL_EDIT_START', 
      cellId, 
      columnKey, 
      value, 
      onUpdate 
    })
  }, [send])
  
  const endCellEdit = React.useCallback((cellId: string, columnKey: string) => {
    // Direct dispatch - no setTimeout
    send({ type: 'CELL_EDIT_END', cellId, columnKey })
  }, [send])
  
  const getCellState = React.useCallback((cellId: string, columnKey: string) => {
    const cellKey = `${cellId}:${columnKey}`
    const cellState = state.context.cellStates.get(cellKey)
    
    if (cellState) {
      return {
        displayValue: cellState.displayValue, // Temporary override value
        isEditing: cellState.isEditing,
        hasError: cellState.hasError,
        error: cellState.error,
        actions: {
          startEdit: (value: any) => {
            send({ 
              type: 'CELL_EDIT_START', 
              cellId, 
              columnKey, 
              value 
            })
          },
          changeValue: (value: any) => {
            send({ 
              type: 'CELL_CHANGE_VALUE', 
              cellId, 
              columnKey, 
              value 
            })
          },
          commitEdit: (value: any) => {
            send({ 
              type: 'CELL_COMMIT_EDIT', 
              cellId, 
              columnKey, 
              value 
            })
          },
          cancelEdit: () => {
            send({ 
              type: 'CELL_EDIT_END', 
              cellId, 
              columnKey 
            })
          },
          saveSuccess: () => {
            send({ 
              type: 'CELL_SAVE_SUCCESS', 
              cellId, 
              columnKey 
            })
          },
          saveError: (error: string) => {
            send({ 
              type: 'CELL_SAVE_ERROR', 
              cellId, 
              columnKey, 
              error 
            })
          }
        }
      }
    }
    
    // No cell state = no override, component will use atom value naturally
    return null
  }, [state.context.cellStates, send])
  
  // Legacy API for compatibility
  const registerCell = startCellEdit
  const unregisterCell = endCellEdit
  
  // Event-based preference saving with debouncing
  const debouncedSaveRef = React.useRef<NodeJS.Timeout | null>(null)
  
  const debouncedSavePreferences = React.useCallback(() => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
    }
    
    debouncedSaveRef.current = setTimeout(() => {
      const preferences = {
        sortColumns: state.context.sortColumns,
        filterState: state.context.filterState,
        pageSize: state.context.pageSize
      }
      
      try {
        localStorage.setItem(persistenceKey, JSON.stringify(preferences))
        console.log('[useGridMachine] 💾 Grid preferences saved:', preferences)
      } catch (error) {
        console.warn('[useGridMachine] ⚠️ Failed to save preferences:', error)
      }
    }, 1000) // 1 second debounce
  }, [persistenceKey, state.context.sortColumns, state.context.filterState, state.context.pageSize])
  
  // Load preferences on mount and cleanup on unmount
  React.useEffect(() => {
    // Load preferences directly here to avoid circular dependency
    try {
      const saved = localStorage.getItem(persistenceKey)
      if (saved) {
        const preferences = JSON.parse(saved)
        console.log('[useGridMachine] 📂 Loading preferences on mount:', preferences)
        
        if (preferences.sortColumns) {
          send({ type: 'SORT_CHANGE', sortColumns: preferences.sortColumns })
        }
        if (preferences.filterState) {
          send({ type: 'FILTER_CHANGE', filterState: preferences.filterState })
        }
        if (preferences.pageSize) {
          send({ type: 'SET_PAGE_SIZE', pageSize: preferences.pageSize })
        }
      }
    } catch (error) {
      console.warn('[useGridMachine] ⚠️ Failed to load preferences on mount:', error)
    }
    
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
      }
    }
  }, [persistenceKey, send])
  
  // Grid State Management
  const setSortColumns = React.useCallback((columns: SortColumn[]) => {
    // Direct dispatch
    send({ type: 'SORT_CHANGE', sortColumns: columns })
    
    // Save preferences after sort change
    debouncedSavePreferences()
  }, [send, debouncedSavePreferences])
  
  const setFilterState = React.useCallback((filterState: FilterState) => {
    // Direct dispatch
    send({ type: 'FILTER_CHANGE', filterState })
    
    // DISABLED: Debounced save for performance testing
    // console.log('[useGridMachine] 🚫 DISABLED: Filter persistence disabled')
  }, [send])
  
  // Selection Management - fire-and-forget
  const selectCell = React.useCallback((cellId: string, extend?: boolean) => {
    send({ type: 'SELECT_CELL', cellId, extend })
  }, [send])
  
  const selectRow = React.useCallback((rowId: string, extend?: boolean) => {
    send({ type: 'SELECT_ROW', rowId, extend })
  }, [send])
  
  const selectColumn = React.useCallback((columnKey: string, extend?: boolean) => {
    send({ type: 'SELECT_COLUMN', columnKey, extend })
  }, [send])
  
  const clearSelection = React.useCallback(() => {
    send({ type: 'CLEAR_SELECTION' })
  }, [send])
  
  // Pagination
  const setPage = React.useCallback((page: number) => {
    send({ type: 'SET_PAGE', page })
  }, [send])
  
  const setPageSize = React.useCallback((size: number) => {
    send({ type: 'SET_PAGE_SIZE', pageSize: size })
  }, [send])
  
  // Persistence management
  const savePreferences = React.useCallback(() => {
    debouncedSavePreferences()
  }, [debouncedSavePreferences])
  
  const loadPreferences = React.useCallback(() => {
    try {
      const saved = localStorage.getItem(persistenceKey)
      if (saved) {
        const preferences = JSON.parse(saved)
        console.log('[useGridMachine] 📂 Loading preferences:', preferences)
        
        if (preferences.sortColumns) {
          send({ type: 'SORT_CHANGE', sortColumns: preferences.sortColumns })
        }
        if (preferences.filterState) {
          send({ type: 'FILTER_CHANGE', filterState: preferences.filterState })
        }
        if (preferences.pageSize) {
          send({ type: 'SET_PAGE_SIZE', pageSize: preferences.pageSize })
        }
      }
    } catch (error) {
      console.warn('[useGridMachine] ⚠️ Failed to load preferences:', error)
    }
  }, [persistenceKey, send])
  
  const resetPreferences = React.useCallback(() => {
    try {
      localStorage.removeItem(persistenceKey)
      console.log('[useGridMachine] 🗑️ Preferences reset')
    } catch (error) {
      console.warn('[useGridMachine] ⚠️ Failed to reset preferences:', error)
    }
  }, [persistenceKey])
  
  // Performance
  const setVirtualizedRange = React.useCallback((range: VirtualizedRange) => {
    send({ type: 'SET_VIRTUALIZED_RANGE', range })
  }, [send])
  
  // No atom update handler needed - component subscription handles everything
  
  // DISABLED: Memory leak prevention - cleanup idle cell states periodically
  // React.useEffect(() => {
  //   const cellStateCount = state.context.cellStates.size
  //   if (cellStateCount > 50) { // Higher threshold to reduce frequency
  //     const cleanupInterval = setInterval(() => {
  //       console.log(`[useGridMachine] 🧹 Memory cleanup: ${cellStateCount} cell states`)
  //       send({ type: 'CLEANUP_IDLE_STATES' })
  //     }, 60000) // Cleanup every 60 seconds to reduce overhead
  //     
  //     return () => clearInterval(cleanupInterval)
  //   }
  // }, [send, state.context.cellStates.size])
  
  // DISABLED: Cleanup all cell states on unmount
  // React.useEffect(() => {
  //   return () => {
  //     console.log('[useGridMachine] 🧹 Component unmounting - cleaning up all cell states')
  //     send({ type: 'CLEANUP_ALL_STATES' })
  //   }
  // }, [send])
  
  return {
    // Cell Management
    registerCell,
    unregisterCell,
    getCellState,
    startCellEdit,
    endCellEdit,
    
    // Grid State
    sortColumns: state.context.sortColumns,
    setSortColumns,
    filterState: state.context.filterState,
    setFilterState,
    
    // Selection
    selection: state.context.selection,
    selectCell,
    selectRow,
    selectColumn,
    clearSelection,
    
    // Pagination
    currentPage: state.context.currentPage,
    pageSize: state.context.pageSize,
    totalCount: state.context.totalCount,
    setPage,
    setPageSize,
    
    // Persistence
    savePreferences,
    loadPreferences,
    resetPreferences,
    
    // Performance
    virtualizedRange: state.context.virtualizedRange,
    setVirtualizedRange,
    
    // State Information
    isEditing: state.matches('editing'),
    isLoading: state.matches('loading'),
    pendingSavesCount: state.context.pendingSaves.size,
    errors: Array.from(state.context.errors.values()),
    
    // Cell State Information
    activeCellStates: state.context.cellStates,
    activeCellCount: state.context.cellStates.size,
    editingCellCount: Array.from(state.context.cellStates.values()).filter(cs => cs.isEditing).length,
    
    // No atom handling needed
    
    // Internal state machine send function for debugging
    __send: send
  }
}

/**
 * DEPRECATED: No longer needed with simplified display override approach
 * 
 * Component Flow (No Manual Atom Handling):
 * 1. User edits cell → grid machine stores temporary displayValue override
 * 2. User commits → updateWithUI called → database updated  
 * 3. live.changes detects change → atom automatically updates
 * 4. Component re-renders via atom subscription (shallowEqual)
 * 5. Grid machine removes display override → shows atom value naturally
 * 
 * Everything happens automatically via React subscriptions!
 */
export function useGridAtomUpdates(gridAPI: GridMachineAPI) {
  return React.useCallback((cellId: string, columnKey: string, value: any) => {
    // No longer needed - component subscription handles everything
    console.log('[useGridAtomUpdates] 🚨 DEPRECATED: Component subscription handles atom updates automatically')
  }, [gridAPI])
}