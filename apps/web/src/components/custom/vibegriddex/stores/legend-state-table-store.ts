/**
 * VibegriddEx Legend State Integration
 * 
 * Simple observables that the table machine can observe directly with fromObservable.
 * No hooks or adapters needed - pure Legend State observables.
 */

import { observable, computed } from '@legendapp/state'
import { getEntity$ } from '@/legend-state'
import type { Column, TableRow, SortConfig, FilterConfig } from '../types'

// ====================================
// TABLE VIEW STATE OBSERVABLE
// ====================================

export interface TableViewState {
  // Table identity
  tableId: string
  entityType: string
  
  // View configuration  
  sortBy: SortConfig[]
  filters: FilterConfig[]
  groupBy: string[]
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  columnWidths: Record<string, number>
  
  // UI state
  selectedCells: Set<string>
  editingCell: { rowId: string; columnId: string } | null
  
  // Performance tracking
  version: number
  lastProcessedAt: number
}

/**
 * Create table view state observable for a specific table instance
 */
export function createTableViewState$(tableId: string, entityType: string, columns: Column[]): any {
  const persistenceKey = `vibegridx-${tableId}-view-state`
  
  // Load persisted state
  const loadPersistedState = (): Partial<TableViewState> => {
    if (typeof window === 'undefined') return {}
    
    try {
      const stored = localStorage.getItem(persistenceKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        console.log('🟢 VibegriddEx: Loading persisted view state', { tableId, parsed })
        return parsed
      }
    } catch (error) {
      console.warn('🔴 VibegriddEx: Failed to load persisted view state', error)
    }
    
    return {}
  }
  
  const persistedState = loadPersistedState()
  
  // Create reactive view state observable
  const tableViewState$ = observable<TableViewState>({
    tableId,
    entityType,
    sortBy: persistedState.sortBy || [],
    filters: persistedState.filters || [],
    groupBy: persistedState.groupBy || [],
    columnVisibility: persistedState.columnVisibility || Object.fromEntries(columns.map(col => [col.id, true])),
    columnOrder: persistedState.columnOrder || columns.map(col => col.id),
    columnWidths: persistedState.columnWidths || {},
    selectedCells: new Set<string>(),
    editingCell: null,
    version: 0,
    lastProcessedAt: Date.now()
  })
  
  // Auto-persist view state changes
  tableViewState$.onChange(() => {
    const state = tableViewState$.peek()
    const persistable = {
      sortBy: state.sortBy,
      filters: state.filters,
      groupBy: state.groupBy,
      columnVisibility: state.columnVisibility,
      columnOrder: state.columnOrder,
      columnWidths: state.columnWidths
    }
    
    try {
      localStorage.setItem(persistenceKey, JSON.stringify(persistable))
    } catch (error) {
      console.warn('Failed to persist view state', error)
    }
  })
  
  return tableViewState$
}

// ====================================
// DATA PROCESSING UTILITIES
// ====================================

/**
 * Apply sorting to entities using Legend State data
 */
function applySorting(entities: any[], sortBy: SortConfig[]): any[] {
  if (sortBy.length === 0) return entities
  
  return entities.slice().sort((a, b) => {
    for (const sort of sortBy) {
      const aValue = a[sort.field]
      const bValue = b[sort.field]
      
      // Handle null/undefined
      if (aValue == null && bValue == null) continue
      if (aValue == null) return sort.direction === 'asc' ? 1 : -1
      if (bValue == null) return sort.direction === 'asc' ? -1 : 1
      
      // Compare values
      let comparison = 0
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime()
      } else {
        const aStr = String(aValue).toLowerCase()
        const bStr = String(bValue).toLowerCase()
        comparison = aStr < bStr ? -1 : aStr > bStr ? 1 : 0
      }
      
      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison
      }
    }
    return 0
  })
}

/**
 * Apply filters to entities
 */
function applyFilters(entities: any[], filters: FilterConfig[]): any[] {
  if (filters.length === 0) return entities
  
  return entities.filter(entity => {
    return filters.every(filter => {
      const value = entity[filter.field]
      let matches = false
      
      switch (filter.operator) {
        case 'equals':
          matches = value === filter.value
          break
        case 'not_equals':
          matches = value !== filter.value
          break
        case 'contains':
          matches = String(value).toLowerCase().includes(String(filter.value).toLowerCase())
          break
        case 'not_contains':
          matches = !String(value).toLowerCase().includes(String(filter.value).toLowerCase())
          break
        case 'starts_with':
          matches = String(value).toLowerCase().startsWith(String(filter.value).toLowerCase())
          break
        case 'ends_with':
          matches = String(value).toLowerCase().endsWith(String(filter.value).toLowerCase())
          break
        case 'greater_than':
          matches = Number(value) > Number(filter.value)
          break
        case 'less_than':
          matches = Number(value) < Number(filter.value)
          break
        case 'is_empty':
          matches = value == null || value === ''
          break
        case 'is_not_empty':
          matches = value != null && value !== ''
          break
        case 'in':
          matches = Array.isArray(filter.value) && filter.value.includes(value)
          break
        case 'not_in':
          matches = Array.isArray(filter.value) && !filter.value.includes(value)
          break
        case 'regex':
          try {
            const regex = new RegExp(filter.value, filter.caseSensitive ? 'g' : 'gi')
            matches = regex.test(String(value))
          } catch {
            matches = false
          }
          break
        default:
          matches = true
      }
      
      return filter.negate ? !matches : matches
    })
  })
}

/**
 * Convert entities to table rows
 */
function entitiesToTableRows(entities: any[]): TableRow[] {
  return entities.map(entity => ({
    id: entity.id,
    data: entity,
    metadata: {
      isSelected: false,
      isDirty: false,
      isGroup: false,
      level: 0
    }
  }))
}

// ====================================
// COMPUTED PROCESSED ROWS
// ====================================

/**
 * Create processed rows computed observable
 * This replaces the atomic store's data processing logic
 */
export function createProcessedRows$(
  entityType: string, 
  tableViewState$: any,
  columns: Column[]
) {
  return computed(() => {
    // Get entity data from Legend State
    const entityObservable = getEntity$(entityType)
    if (!entityObservable) {
      console.log('🔍 VibegriddEx: No entity observable for', entityType)
      return []
    }
    
    // Get entities as array (Legend State returns object map)
    const entitiesMap = entityObservable.get()
    const entities = Object.values(entitiesMap || {})
    
    if (entities.length === 0) {
      return []
    }
    
    // Get view state
    const viewState = tableViewState$.get()
    
    // Apply filtering
    const filteredEntities = applyFilters(entities, viewState.filters)
    
    // Apply sorting  
    const sortedEntities = applySorting(filteredEntities, viewState.sortBy)
    
    // Convert to table rows
    const processedRows = entitiesToTableRows(sortedEntities)
    
    console.log('🔍 VibegriddEx: Processed rows computed', {
      entityType,
      totalEntities: entities.length,
      filteredCount: filteredEntities.length,
      finalRowCount: processedRows.length,
      sortBy: viewState.sortBy,
      filters: viewState.filters
    })
    
    return processedRows
  })
}

// ====================================
// TABLE STORE FACTORY
// ====================================

/**
 * Create complete table store using Legend State observables
 * Replaces the atomic store actor pattern
 */
export function createLegendStateTableStore(
  tableId: string,
  entityType: string, 
  columns: Column[]
) {
  console.log('📊 VibegriddEx: Creating Legend State table store', { tableId, entityType })
  
  // Create view state observable
  const tableViewState$ = createTableViewState$(tableId, entityType, columns)
  
  // Create processed rows computed observable  
  const processedRows$ = createProcessedRows$(entityType, tableViewState$, columns)
  
  // Create visible columns computed observable
  const visibleColumns$ = computed(() => {
    const viewState = tableViewState$.get()
    return columns.filter(col => 
      col.id !== '__selection' && viewState.columnVisibility[col.id] !== false
    )
  })
  
  // API for updating view state
  const api = {
    // Sorting
    setSortBy: (sortBy: SortConfig[]) => {
      tableViewState$.sortBy.set(sortBy)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    toggleSort: (field: string) => {
      const current = tableViewState$.sortBy.peek()
      const existing = current.find(s => s.field === field)
      
      if (!existing) {
        tableViewState$.sortBy.set([{ field, direction: 'asc' }])
      } else if (existing.direction === 'asc') {
        tableViewState$.sortBy.set([{ field, direction: 'desc' }])
      } else {
        tableViewState$.sortBy.set([])
      }
      
      tableViewState$.version.set(prev => prev + 1)
    },
    
    // Filtering
    setFilters: (filters: FilterConfig[]) => {
      tableViewState$.filters.set(filters)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    // Column visibility
    toggleColumnVisibility: (columnId: string) => {
      const current = tableViewState$.columnVisibility[columnId].peek()
      tableViewState$.columnVisibility[columnId].set(!current)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    setColumnVisibility: (visibility: Record<string, boolean>) => {
      tableViewState$.columnVisibility.set(visibility)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    showAllColumns: () => {
      const visibility = Object.fromEntries(columns.map(col => [col.id, true]))
      tableViewState$.columnVisibility.set(visibility)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    hideAllColumns: () => {
      const visibility = Object.fromEntries(columns.map(col => [col.id, false]))
      tableViewState$.columnVisibility.set(visibility)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    // Column order
    setColumnOrder: (order: string[]) => {
      tableViewState$.columnOrder.set(order)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    // Selection
    setSelectedCells: (cells: Set<string>) => {
      tableViewState$.selectedCells.set(cells)
    },
    
    // Editing
    setEditingCell: (cell: { rowId: string; columnId: string } | null) => {
      tableViewState$.editingCell.set(cell)
    }
  }
  
  return {
    // Observables
    tableViewState$,
    processedRows$,
    visibleColumns$,
    
    // API
    ...api,
    
    // Cleanup
    cleanup: () => {
      // Legend State handles cleanup automatically
      console.log('📊 VibegriddEx: Legend State table store cleaned up', { tableId })
    }
  }
}

// ====================================
// SIMPLE OBSERVABLE FACTORY
// ====================================

/**
 * Create table observables that XState can observe with fromObservable
 * Much simpler than the hook pattern - pure observables
 */
export function createTableObservables(
  tableId: string,
  entityType: string,
  columns: Column[]
) {
  console.log('📊 VibegriddEx: Creating Legend State observables for table machine', { tableId, entityType })
  
  const store = createLegendStateTableStore(tableId, entityType, columns)
  
  // Return observables that table machine can observe directly
  return {
    // Primary data observable - table machine listens to this
    processedRows$: store.processedRows$,
    
    // View state observables
    viewState$: store.tableViewState$,
    visibleColumns$: store.visibleColumns$,
    
    // Actions for table machine to call
    actions: store,
    
    // Cleanup
    cleanup: store.cleanup
  }
}