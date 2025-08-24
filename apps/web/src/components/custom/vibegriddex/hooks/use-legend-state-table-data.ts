/**
 * Hook for VibegriddEx Legend State Integration
 * 
 * Uses the universal entity access pattern with proper loading states.
 * Follows Legend State official patterns for reactive data handling.
 */

import { useMemo, useCallback } from 'react'
import { useObservable, use$ } from '@legendapp/state/react'
import { useEntity$, entityOperations } from '@/legend-state'
import type { Column, TableRow } from '../types'

export interface LegendStateTableData {
  // Data
  processedRows: TableRow[]
  visibleColumns: Column[]
  loading: boolean
  error: string | null
  
  // View state
  sortBy: any[]
  filters: any[]
  columnVisibility: Record<string, boolean>
  selectedCells: Set<string>
  editingCell: { rowId: string; columnId: string } | null
  
  // Actions
  setSortBy: (sortBy: any[]) => void
  toggleSort: (field: string) => void
  setFilters: (filters: any[]) => void
  toggleColumnVisibility: (columnId: string) => void
  showAllColumns: () => void
  hideAllColumns: () => void
  setSelectedCells: (cells: Set<string>) => void
  setEditingCell: (cell: { rowId: string; columnId: string } | null) => void
  
  // Entity operations
  updateEntity: (rowId: string, updates: Record<string, any>) => Promise<void>
  batchUpdateEntities: (updates: Array<{ id: string; updates: Record<string, any> }>) => Promise<void>
  createEntity: (data: any, insertAfter?: string) => Promise<void>
  deleteEntity: (rowId: string) => Promise<void>
}

/**
 * Use Legend State observables for VibegriddEx data
 * Uses the universal useEntity$ hook for proper async handling
 */
export function useLegendStateTableData(
  tableId: string,
  entityType: string,
  columns: Column[]
): LegendStateTableData {
  
  // Use the universal entity hook for proper loading states
  const { data: entities, loading, error, observable: entityObservable, isEmpty } = useEntity$(entityType)
  
  console.log('🔍 VibegriddEx Hook: Entity data from Legend State', {
    entityType,
    entityCount: entities.length,
    loading,
    error,
    isEmpty,
    hasObservable: !!entityObservable,
    sampleEntity: entities[0]
  })
  
  // Create reactive view state using Legend State local observables
  const viewState$ = useObservable({
    sortBy: [],
    filters: [],
    columnVisibility: Object.fromEntries(columns.map(col => [col.id, true])),
    selectedCells: new Set<string>(),
    editingCell: null as { rowId: string; columnId: string } | null
  })
  
  const viewState = use$(viewState$)
  const visibleColumns = columns.filter(col => viewState.columnVisibility[col.id] !== false)
  
  // Entity operation handlers
  const updateEntity = useCallback(async (rowId: string, updates: Record<string, any>) => {
    try {
      await entityOperations.updateEntity(entityType, rowId, updates)
      console.log('✅ VibegriddEx: Entity updated via Legend State', { rowId, entityType })
    } catch (error) {
      console.error('❌ VibegriddEx: Failed to update entity', error)
      throw error
    }
  }, [entityType])
  
  const batchUpdateEntities = useCallback(async (updates: Array<{ id: string; updates: Record<string, any> }>) => {
    try {
      // Use Legend State batch operations
      const updateData = updates.map(({ id, updates }) => ({ id, data: updates }))
      await entityOperations.batchUpdate?.(entityType, updateData)
      console.log('✅ VibegriddEx: Batch update completed via Legend State', { count: updates.length, entityType })
    } catch (error) {
      console.error('❌ VibegriddEx: Failed to batch update entities', error)
      throw error
    }
  }, [entityType])
  
  const createEntity = useCallback(async (data: any, insertAfter?: string) => {
    try {
      await entityOperations.createEntity(entityType, data)
      console.log('✅ VibegriddEx: Entity created via Legend State', { entityType })
    } catch (error) {
      console.error('❌ VibegriddEx: Failed to create entity', error)
      throw error
    }
  }, [entityType])
  
  const deleteEntity = useCallback(async (rowId: string) => {
    try {
      await entityOperations.deleteEntity(entityType, rowId)
      console.log('✅ VibegriddEx: Entity deleted via Legend State', { rowId, entityType })
    } catch (error) {
      console.error('❌ VibegriddEx: Failed to delete entity', error)
      throw error
    }
  }, [entityType])
  
  // Convert entities to table rows format
  const tableRows = entities.map(entity => ({
    id: entity.id,
    data: entity,
    metadata: {
      isSelected: false,
      isDirty: false,
      isGroup: false,
      level: 0
    }
  }))
  
  console.log('🔍 VibegriddEx Hook: Final processed rows', {
    processedRowsCount: tableRows.length,
    sampleRow: tableRows[0],
    entityCount: entities.length
  })

  // Reactive view action handlers
  const setSortBy = useCallback((sortBy: any[]) => {
    viewState$.sortBy.set(sortBy)
  }, [viewState$])
  
  const toggleSort = useCallback((field: string) => {
    const currentSort = viewState$.sortBy.peek()
    const existingIndex = currentSort.findIndex((s: any) => s.field === field)
    
    if (existingIndex >= 0) {
      const existing = currentSort[existingIndex]
      const newSort = [...currentSort]
      newSort[existingIndex] = { ...existing, direction: existing.direction === 'asc' ? 'desc' : 'asc' }
      viewState$.sortBy.set(newSort)
    } else {
      viewState$.sortBy.set([...currentSort, { field, direction: 'asc' }])
    }
  }, [viewState$])
  
  const setFilters = useCallback((filters: any[]) => {
    viewState$.filters.set(filters)
  }, [viewState$])
  
  const toggleColumnVisibility = useCallback((columnId: string) => {
    const current = viewState$.columnVisibility[columnId].peek()
    viewState$.columnVisibility[columnId].set(!current)
  }, [viewState$])
  
  const showAllColumns = useCallback(() => {
    const visibility = Object.fromEntries(columns.map(col => [col.id, true]))
    viewState$.columnVisibility.set(visibility)
  }, [viewState$, columns])
  
  const hideAllColumns = useCallback(() => {
    const visibility = Object.fromEntries(columns.map(col => [col.id, false]))
    viewState$.columnVisibility.set(visibility)
  }, [viewState$, columns])
  
  const setSelectedCells = useCallback((cells: Set<string>) => {
    viewState$.selectedCells.set(cells)
  }, [viewState$])
  
  const setEditingCell = useCallback((cell: { rowId: string; columnId: string } | null) => {
    viewState$.editingCell.set(cell)
  }, [viewState$])

  return {
    // Data
    processedRows: tableRows,
    visibleColumns,
    loading,
    error, // Use error from useEntity$
    
    // View state
    sortBy: viewState.sortBy,
    filters: viewState.filters,
    columnVisibility: viewState.columnVisibility,
    selectedCells: viewState.selectedCells,
    editingCell: viewState.editingCell,
    
    // Reactive view actions
    setSortBy,
    toggleSort,
    setFilters,
    toggleColumnVisibility,
    showAllColumns,
    hideAllColumns,
    setSelectedCells,
    setEditingCell,
    
    // Entity operations
    updateEntity,
    batchUpdateEntities,
    createEntity,
    deleteEntity
  }
}

/**
 * Hook that provides a simplified interface compatible with existing VibegriddEx patterns
 */
export function useTableStoreForVibegriddEx(
  tableId: string,
  entityType: string,
  columns: Column[]
) {
  const legendState = useLegendStateTableData(tableId, entityType, columns)
  
  // Return data in format expected by table machine
  return {
    // Data for XState machine context
    rows: legendState.processedRows,
    visibleColumns: legendState.visibleColumns,
    sortBy: legendState.sortBy,
    filters: legendState.filters,
    columnVisibility: legendState.columnVisibility,
    version: legendState.processedRows.length, // Use row count as version
    
    // Actions that can be called from table machine events
    actions: {
      setSortBy: legendState.setSortBy,
      toggleSort: legendState.toggleSort,
      setFilters: legendState.setFilters,
      toggleColumnVisibility: legendState.toggleColumnVisibility,
      showAllColumns: legendState.showAllColumns,
      hideAllColumns: legendState.hideAllColumns,
    },
    
    // Entity operations for update handlers
    entityOperations: {
      update: legendState.updateEntity,
      batchUpdate: legendState.batchUpdateEntities,
      create: legendState.createEntity,
      delete: legendState.deleteEntity
    },
    
    // Cleanup function
    cleanup: () => {
      // Legend State handles cleanup automatically
      console.log('🧹 VibegriddEx: Legend State store cleaned up for', tableId)
    }
  }
}