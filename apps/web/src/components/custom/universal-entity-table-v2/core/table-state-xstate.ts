import { createStore } from '@xstate/store'
import { useSelector } from '@xstate/store/react'
import {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  ColumnSizingState,
} from '@tanstack/react-table'

// ==========================================
// XState Store Context Types
// ==========================================

export interface TableStateContext {
  // Persistent UI state (survives page reloads)
  sorting: SortingState
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  pagination: PaginationState
  columnSizing: ColumnSizingState
  
  // Runtime state (reset on page load)
  rowSelection: Record<string, boolean>
  isLoading: boolean
  error: string | null
  
  // Cell editing state (atomic)
  editingCell: {
    rowId: string
    columnId: string
    value: any
    originalValue: any
    isValid: boolean
    error?: string
  } | null
  
  // Performance tracking
  lastUpdateTime: number
  renderCount: number
}

// ==========================================
// XState Store Events
// ==========================================

export type TableStateEvents = {
  // Sorting
  'sorting.set': { sorting: SortingState }
  'sorting.clear': {}
  
  // Column Filters
  'columnFilters.set': { filters: ColumnFiltersState }
  'columnFilters.add': { filter: { id: string; value: any } }
  'columnFilters.remove': { columnId: string }
  'columnFilters.clear': {}
  
  // Column Visibility
  'columnVisibility.set': { visibility: VisibilityState }
  'columnVisibility.toggle': { columnId: string }
  'columnVisibility.show': { columnId: string }
  'columnVisibility.hide': { columnId: string }
  
  // Column Sizing
  'columnSizing.set': { sizing: ColumnSizingState }
  'columnSizing.setColumnSize': { columnId: string; size: number }
  'columnSizing.resetColumn': { columnId: string }
  'columnSizing.reset': {}
  
  // Pagination
  'pagination.set': { pagination: PaginationState }
  'pagination.setPageIndex': { pageIndex: number }
  'pagination.setPageSize': { pageSize: number }
  'pagination.nextPage': {}
  'pagination.previousPage': {}
  'pagination.reset': {}
  
  // Row Selection
  'rowSelection.set': { selection: Record<string, boolean> }
  'rowSelection.toggle': { rowId: string }
  'rowSelection.selectAll': {}
  'rowSelection.clearAll': {}
  
  // Cell Editing (Atomic)
  'cell.startEdit': { rowId: string; columnId: string; originalValue: any }
  'cell.updateValue': { value: any; isValid?: boolean; error?: string }
  'cell.endEdit': {}
  'cell.cancelEdit': {}
  
  // Loading & Error States
  'loading.set': { isLoading: boolean }
  'error.set': { error: string | null }
  'error.clear': {}
  
  // Table Management
  'table.reset': {}
  'table.incrementRender': {}
}

// ==========================================
// Default State
// ==========================================

const createDefaultTableState = (): TableStateContext => ({
  sorting: [],
  columnFilters: [],
  columnVisibility: {},
  pagination: { pageIndex: 0, pageSize: 10 },
  columnSizing: {},
  rowSelection: {},
  isLoading: false,
  error: null,
  editingCell: null,
  lastUpdateTime: Date.now(),
  renderCount: 0,
})

// ==========================================
// XState Store Factory
// ==========================================

export const createTableStore = (tableId: string, initialState?: Partial<TableStateContext>) => {
  return createStore({
    context: {
      ...createDefaultTableState(),
      ...initialState,
    } as TableStateContext,
    
    on: {
      // ============================================================================
      // Sorting Events
      // ============================================================================
      'sorting.set': (context, event) => ({
        ...context,
        sorting: event.sorting,
        lastUpdateTime: Date.now(),
      }),
      
      'sorting.clear': (context) => ({
        ...context,
        sorting: [],
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Column Filter Events  
      // ============================================================================
      'columnFilters.set': (context, event) => ({
        ...context,
        columnFilters: event.filters,
        lastUpdateTime: Date.now(),
      }),
      
      'columnFilters.add': (context, event) => {
        const existingIndex = context.columnFilters.findIndex(f => f.id === event.filter.id)
        const newFilters = [...context.columnFilters]
        
        if (existingIndex >= 0) {
          newFilters[existingIndex] = event.filter
        } else {
          newFilters.push(event.filter)
        }
        
        return {
          ...context,
          columnFilters: newFilters,
          lastUpdateTime: Date.now(),
        }
      },
      
      'columnFilters.remove': (context, event) => ({
        ...context,
        columnFilters: context.columnFilters.filter(f => f.id !== event.columnId),
        lastUpdateTime: Date.now(),
      }),
      
      'columnFilters.clear': (context) => ({
        ...context,
        columnFilters: [],
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Column Visibility Events
      // ============================================================================
      'columnVisibility.set': (context, event) => ({
        ...context,
        columnVisibility: event.visibility,
        lastUpdateTime: Date.now(),
      }),
      
      'columnVisibility.toggle': (context, event) => ({
        ...context,
        columnVisibility: {
          ...context.columnVisibility,
          [event.columnId]: !context.columnVisibility[event.columnId]
        },
        lastUpdateTime: Date.now(),
      }),
      
      'columnVisibility.show': (context, event) => ({
        ...context,
        columnVisibility: {
          ...context.columnVisibility,
          [event.columnId]: true
        },
        lastUpdateTime: Date.now(),
      }),
      
      'columnVisibility.hide': (context, event) => ({
        ...context,
        columnVisibility: {
          ...context.columnVisibility,
          [event.columnId]: false
        },
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Column Sizing Events
      // ============================================================================
      'columnSizing.set': (context, event) => ({
        ...context,
        columnSizing: event.sizing,
        lastUpdateTime: Date.now(),
      }),
      
      'columnSizing.setColumnSize': (context, event) => ({
        ...context,
        columnSizing: {
          ...context.columnSizing,
          [event.columnId]: event.size
        },
        lastUpdateTime: Date.now(),
      }),
      
      'columnSizing.resetColumn': (context, event) => ({
        ...context,
        columnSizing: {
          ...context.columnSizing,
          [event.columnId]: undefined
        },
        lastUpdateTime: Date.now(),
      }),
      
      'columnSizing.reset': (context) => ({
        ...context,
        columnSizing: {},
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Pagination Events
      // ============================================================================
      'pagination.set': (context, event) => ({
        ...context,
        pagination: event.pagination,
        lastUpdateTime: Date.now(),
      }),
      
      'pagination.setPageIndex': (context, event) => ({
        ...context,
        pagination: {
          ...context.pagination,
          pageIndex: event.pageIndex
        },
        lastUpdateTime: Date.now(),
      }),
      
      'pagination.setPageSize': (context, event) => ({
        ...context,
        pagination: {
          ...context.pagination,
          pageSize: event.pageSize,
          pageIndex: 0 // Reset to first page when changing page size
        },
        lastUpdateTime: Date.now(),
      }),
      
      'pagination.nextPage': (context) => ({
        ...context,
        pagination: {
          ...context.pagination,
          pageIndex: context.pagination.pageIndex + 1
        },
        lastUpdateTime: Date.now(),
      }),
      
      'pagination.previousPage': (context) => ({
        ...context,
        pagination: {
          ...context.pagination,
          pageIndex: Math.max(0, context.pagination.pageIndex - 1)
        },
        lastUpdateTime: Date.now(),
      }),
      
      'pagination.reset': (context) => ({
        ...context,
        pagination: { pageIndex: 0, pageSize: 10 },
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Row Selection Events
      // ============================================================================
      'rowSelection.set': (context, event) => ({
        ...context,
        rowSelection: event.selection,
        lastUpdateTime: Date.now(),
      }),
      
      'rowSelection.toggle': (context, event) => ({
        ...context,
        rowSelection: {
          ...context.rowSelection,
          [event.rowId]: !context.rowSelection[event.rowId]
        },
        lastUpdateTime: Date.now(),
      }),
      
      'rowSelection.selectAll': (context) => ({
        ...context,
        rowSelection: {}, // This will be computed by TanStack Table
        lastUpdateTime: Date.now(),
      }),
      
      'rowSelection.clearAll': (context) => ({
        ...context,
        rowSelection: {},
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Cell Editing Events (Atomic)
      // ============================================================================
      'cell.startEdit': (context, event) => ({
        ...context,
        editingCell: {
          rowId: event.rowId,
          columnId: event.columnId,
          value: event.originalValue,
          originalValue: event.originalValue,
          isValid: true,
          error: undefined,
        },
        lastUpdateTime: Date.now(),
      }),
      
      'cell.updateValue': (context, event) => {
        if (!context.editingCell) return context
        
        return {
          ...context,
          editingCell: {
            ...context.editingCell,
            value: event.value,
            isValid: event.isValid ?? true,
            error: event.error,
          },
          lastUpdateTime: Date.now(),
        }
      },
      
      'cell.endEdit': (context) => ({
        ...context,
        editingCell: null,
        lastUpdateTime: Date.now(),
      }),
      
      'cell.cancelEdit': (context) => ({
        ...context,
        editingCell: null,
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Loading & Error Events
      // ============================================================================
      'loading.set': (context, event) => ({
        ...context,
        isLoading: event.isLoading,
        lastUpdateTime: Date.now(),
      }),
      
      'error.set': (context, event) => ({
        ...context,
        error: event.error,
        lastUpdateTime: Date.now(),
      }),
      
      'error.clear': (context) => ({
        ...context,
        error: null,
        lastUpdateTime: Date.now(),
      }),
      
      // ============================================================================
      // Table Management Events
      // ============================================================================
      'table.reset': () => createDefaultTableState(),
      
      'table.incrementRender': (context) => ({
        ...context,
        renderCount: context.renderCount + 1,
      }),
    }
  })
}

// ==========================================
// Store Instance Management
// ==========================================

const tableStores = new Map<string, ReturnType<typeof createTableStore>>()

export const getTableStore = (tableId: string, initialState?: Partial<TableStateContext>) => {
  if (!tableStores.has(tableId)) {
    tableStores.set(tableId, createTableStore(tableId, initialState))
  }
  return tableStores.get(tableId)!
}

export const clearTableStore = (tableId: string) => {
  tableStores.delete(tableId)
}

// ==========================================
// React Hooks
// ==========================================

export const useTableStore = (tableId: string, initialState?: Partial<TableStateContext>) => {
  const store = getTableStore(tableId, initialState)
  
  return {
    // State selectors
    state: useSelector(store, (state) => state.context),
    sorting: useSelector(store, (state) => state.context.sorting),
    columnFilters: useSelector(store, (state) => state.context.columnFilters),
    columnVisibility: useSelector(store, (state) => state.context.columnVisibility),
    pagination: useSelector(store, (state) => state.context.pagination),
    columnSizing: useSelector(store, (state) => state.context.columnSizing),
    rowSelection: useSelector(store, (state) => state.context.rowSelection),
    editingCell: useSelector(store, (state) => state.context.editingCell),
    isLoading: useSelector(store, (state) => state.context.isLoading),
    error: useSelector(store, (state) => state.context.error),
    
    // Actions
    send: store.send,
    
    // Convenience action creators
    actions: {
      setSorting: (sorting: SortingState) => store.send({ type: 'sorting.set', sorting }),
      setColumnFilters: (filters: ColumnFiltersState) => store.send({ type: 'columnFilters.set', filters }),
      setColumnVisibility: (visibility: VisibilityState) => store.send({ type: 'columnVisibility.set', visibility }),
      setPagination: (pagination: PaginationState) => store.send({ type: 'pagination.set', pagination }),
      setColumnSizing: (sizing: ColumnSizingState) => store.send({ type: 'columnSizing.set', sizing }),
      setRowSelection: (selection: Record<string, boolean>) => store.send({ type: 'rowSelection.set', selection }),
      
      startCellEdit: (rowId: string, columnId: string, originalValue: any) => 
        store.send({ type: 'cell.startEdit', rowId, columnId, originalValue }),
      updateCellValue: (value: any, isValid?: boolean, error?: string) => 
        store.send({ type: 'cell.updateValue', value, isValid, error }),
      endCellEdit: () => store.send({ type: 'cell.endEdit' }),
      cancelCellEdit: () => store.send({ type: 'cell.cancelEdit' }),
      
      setLoading: (isLoading: boolean) => store.send({ type: 'loading.set', isLoading }),
      setError: (error: string | null) => store.send({ type: 'error.set', error }),
      resetTable: () => store.send({ type: 'table.reset' }),
    }
  }
}

// ==========================================
// Performance Utilities
// ==========================================

export const useTablePerformance = (tableId: string) => {
  const store = getTableStore(tableId)
  
  return {
    renderCount: useSelector(store, (state) => state.context.renderCount),
    lastUpdateTime: useSelector(store, (state) => state.context.lastUpdateTime),
    
    incrementRender: () => store.send({ type: 'table.incrementRender' }),
    
    getPerformanceMetrics: () => {
      const state = store.getSnapshot().context
      return {
        renderCount: state.renderCount,
        lastUpdateTime: state.lastUpdateTime,
        timeSinceLastUpdate: Date.now() - state.lastUpdateTime,
      }
    }
  }
} 