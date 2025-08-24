/**
 * VibegriddEx Legend State Integration
 * 
 * Simple observables that XState table machine can observe with fromObservable.
 * Direct integration - no adapters or hooks needed.
 */

import { observable, computed } from '@legendapp/state'
import { getEntity$, entityOperations, batchOperations } from '@/legend-state'
import type { Column, TableRow } from '../types'

// ====================================
// OBSERVABLE CONVERSION FOR XSTATE
// ====================================

/**
 * Make Legend State observable compatible with XState fromObservable
 */
function makeXStateCompatible<T>(legendObservable: any) {
  return {
    subscribe(observer: any) {
      // Get initial value immediately
      const initialValue = legendObservable.get()
      observer.next(initialValue)
      
      // Subscribe to changes using Legend State's onChange
      const unsubscribe = legendObservable.onChange(() => {
        const value = legendObservable.get()
        observer.next(value)
      })
      
      // Return unsubscribe function
      return { unsubscribe }
    }
  }
}

// ====================================
// TABLE VIEW STATE
// ====================================

/**
 * Create table view state observable for XState integration
 */
export function createTableViewObservable(tableId: string, columns: Column[]) {
  const persistenceKey = `vibegridx-${tableId}-view`
  
  // Load persisted view state
  const loadPersisted = () => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(persistenceKey)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }
  
  const persisted = loadPersisted()
  
  return observable({
    sortBy: persisted.sortBy || [],
    filters: persisted.filters || [],
    columnVisibility: persisted.columnVisibility || Object.fromEntries(columns.map(col => [col.id, true])),
    columnOrder: persisted.columnOrder || columns.map(col => col.id),
    columnWidths: persisted.columnWidths || {},
    version: 0
  })
}

// ====================================
// PROCESSED ROWS OBSERVABLE
// ====================================

/**
 * Create processed rows observable that combines entity data with view state
 */
export function createProcessedRowsObservable(
  entityType: string,
  tableViewState$: any
) {
  return computed(() => {
    // Get entity data from Legend State
    const entityObservable = getEntity$(entityType)
    if (!entityObservable) {
      console.log('🚨 VibegriddEx: Entity observable not found for:', entityType)
      return []
    }
    
    // Use peek() instead of get() to avoid batcher issues
    let entitiesMap: any
    let entities: any[]
    
    try {
      // Try to get the data using peek() which is synchronous and safe
      if (typeof entityObservable.peek === 'function') {
        entitiesMap = entityObservable.peek()
      } else if (typeof entityObservable.get === 'function') {
        entitiesMap = entityObservable.get()
      } else {
        // Maybe it's already the data
        entitiesMap = entityObservable
      }
      
      entities = entitiesMap && typeof entitiesMap === 'object' 
        ? Object.values(entitiesMap) 
        : Array.isArray(entitiesMap) 
          ? entitiesMap 
          : []
          
      console.log('🔍 VibegriddEx: Raw entity data', {
        entityType,
        entitiesMap,
        entityCount: entities.length,
        sampleEntity: entities[0]
      })
      
      if (entities.length === 0) return []
      
    } catch (error) {
      console.error('🚨 VibegriddEx: Error processing entity data:', error)
      return []
    }
    
    // Get view state
    const viewState = tableViewState$.get()
    
    // Apply filters and sorting (simplified)
    let filtered = entities
    if (viewState.filters?.length > 0) {
      filtered = entities.filter(entity => {
        return viewState.filters.every(filter => {
          const value = entity[filter.field]
          // Simple contains filter for now
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
        })
      })
    }
    
    // Apply sorting
    if (viewState.sortBy?.length > 0) {
      const sort = viewState.sortBy[0] // Use first sort for simplicity
      filtered = filtered.slice().sort((a, b) => {
        const aVal = a[sort.field]
        const bVal = b[sort.field]
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sort.direction === 'desc' ? -comparison : comparison
      })
    }
    
    // Convert to TableRow format
    const rows: TableRow[] = filtered.map(entity => ({
      id: entity.id,
      data: entity,
      metadata: {
        isSelected: false,
        isDirty: false,
        isGroup: false,
        level: 0
      }
    }))
    
    console.log('🔍 VibegriddEx: Processed rows computed via Legend State', {
      entityType,
      totalEntities: entities.length,
      filteredRows: rows.length,
      sortBy: viewState.sortBy
    })
    
    return rows
  })
}

// ====================================
// INTEGRATION FACTORY
// ====================================

/**
 * Create all observables needed for VibegriddEx table machine integration
 */
export function createVibegriddExObservables(
  tableId: string,
  entityType: string,
  columns: Column[]
) {
  console.log('📊 VibegriddEx: Creating Legend State integration', { tableId, entityType })
  
  // Create view state observable
  const tableViewState$ = createTableViewObservable(tableId, columns)
  
  // Create processed rows observable
  const processedRows$ = createProcessedRowsObservable(entityType, tableViewState$)
  
  // Visible columns computed observable
  const visibleColumns$ = computed(() => {
    const viewState = tableViewState$.get()
    return columns.filter(col => 
      col.id !== '__selection' && viewState.columnVisibility[col.id] !== false
    )
  })
  
  // Actions for table machine
  const actions = {
    // View state actions
    setSortBy: (sortBy: any[]) => {
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
    
    setFilters: (filters: any[]) => {
      tableViewState$.filters.set(filters)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    toggleColumnVisibility: (columnId: string) => {
      const current = tableViewState$.columnVisibility[columnId].peek()
      tableViewState$.columnVisibility[columnId].set(!current)
      tableViewState$.version.set(prev => prev + 1)
    },
    
    // Entity mutation actions using Legend State
    async saveEntity(entityType: string, rowId: string, updates: Record<string, any>) {
      try {
        console.log('🔄 VibegriddEx: Saving entity via Legend State', { rowId, updates })
        await entityOperations.updateEntity(entityType, rowId, updates)
        console.log('✅ VibegriddEx: Entity saved successfully', { rowId })
      } catch (error) {
        console.error('❌ VibegriddEx: Failed to save entity', error)
        throw error
      }
    },
    
    async createEntity(entityType: string, data: any, insertAfter?: string) {
      try {
        console.log('🔄 VibegriddEx: Creating entity via Legend State', { entityType, data })
        const result = await entityOperations.createEntity(entityType, data)
        console.log('✅ VibegriddEx: Entity created successfully', { result })
        return result
      } catch (error) {
        console.error('❌ VibegriddEx: Failed to create entity', error)
        throw error
      }
    },
    
    async deleteEntity(entityType: string, rowId: string) {
      try {
        console.log('🔄 VibegriddEx: Deleting entity via Legend State', { rowId })
        await entityOperations.deleteEntity(entityType, rowId)
        console.log('✅ VibegriddEx: Entity deleted successfully', { rowId })
      } catch (error) {
        console.error('❌ VibegriddEx: Failed to delete entity', error)
        throw error
      }
    },
    
    // Batch operations for multi-copy, drag, etc.
    async batchUpdateEntities(entityType: string, updates: Array<{ id: string; updates: Record<string, any> }>) {
      try {
        console.log('🔄 VibegriddEx: Batch updating entities via Legend State', { 
          entityType, 
          count: updates.length 
        })
        
        const results = await Promise.allSettled(
          updates.map(({ id, updates: entityUpdates }) => 
            entityOperations.updateEntity(entityType, id, entityUpdates)
          )
        )
        
        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length
        
        console.log('✅ VibegriddEx: Batch update completed', { 
          successful, 
          failed, 
          total: updates.length 
        })
        
        if (failed > 0) {
          const failures = results
            .map((result, index) => ({ result, update: updates[index] }))
            .filter(({ result }) => result.status === 'rejected')
            .map(({ result, update }) => ({ 
              id: update.id, 
              error: (result as PromiseRejectedResult).reason 
            }))
          
          console.warn('⚠️ VibegriddEx: Some batch updates failed', failures)
        }
        
        return { successful, failed, total: updates.length }
      } catch (error) {
        console.error('❌ VibegriddEx: Batch update failed', error)
        throw error
      }
    },
    
    async batchCreateEntities(entityType: string, entities: any[]) {
      try {
        console.log('🔄 VibegriddEx: Batch creating entities via Legend State', { 
          entityType, 
          count: entities.length 
        })
        
        const results = await Promise.allSettled(
          entities.map(entity => entityOperations.createEntity(entityType, entity))
        )
        
        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length
        
        console.log('✅ VibegriddEx: Batch creation completed', { 
          successful, 
          failed, 
          total: entities.length 
        })
        
        return { 
          successful, 
          failed, 
          total: entities.length,
          created: results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map(r => r.value)
        }
      } catch (error) {
        console.error('❌ VibegriddEx: Batch creation failed', error)
        throw error
      }
    },
    
    async copyRows(entityType: string, sourceRowIds: string[], targetAfter?: string) {
      try {
        console.log('🔄 VibegriddEx: Copying rows via Legend State', { 
          entityType, 
          sourceCount: sourceRowIds.length 
        })
        
        // Get source entities
        const entityObservable = getEntity$(entityType)
        if (!entityObservable) {
          throw new Error(`Entity type ${entityType} not found`)
        }
        
        const entitiesMap = entityObservable.peek()
        const sourceEntities = sourceRowIds
          .map(id => entitiesMap[id])
          .filter(Boolean)
        
        if (sourceEntities.length === 0) {
          throw new Error('No source entities found')
        }
        
        // Create copies without IDs (new entities)
        const copiesToCreate = sourceEntities.map(entity => {
          const { id, createdAt, updatedAt, ...entityData } = entity
          return {
            ...entityData,
            // Add copy suffix to distinguishable fields
            title: entity.title ? `${entity.title} (Copy)` : undefined
          }
        })
        
        // Batch create the copies
        return await actions.batchCreateEntities(entityType, copiesToCreate)
      } catch (error) {
        console.error('❌ VibegriddEx: Copy rows failed', error)
        throw error
      }
    },
    
    async moveRows(entityType: string, rowIds: string[], targetPosition: { afterId?: string, beforeId?: string }) {
      try {
        console.log('🔄 VibegriddEx: Moving rows via Legend State', { 
          entityType, 
          rowCount: rowIds.length,
          targetPosition 
        })
        
        // For basic move operation, we'll update a position/order field if it exists
        // This is a simplified implementation - full drag/drop would need more complex logic
        const updates = rowIds.map((id, index) => ({
          id,
          updates: {
            // Assume there's an 'order' or 'position' field
            // This would need to be customized based on the entity schema
            updatedAt: new Date().toISOString()
          }
        }))
        
        return await actions.batchUpdateEntities(entityType, updates)
      } catch (error) {
        console.error('❌ VibegriddEx: Move rows failed', error)
        throw error
      }
    }
  }
  
  // Auto-persist view state
  tableViewState$.onChange(() => {
    const state = tableViewState$.peek()
    const persistable = {
      sortBy: state.sortBy,
      filters: state.filters,
      columnVisibility: state.columnVisibility,
      columnOrder: state.columnOrder,
      columnWidths: state.columnWidths
    }
    
    try {
      localStorage.setItem(`vibegridx-${tableId}-view`, JSON.stringify(persistable))
    } catch (error) {
      console.warn('Failed to persist view state', error)
    }
  })
  
  return {
    // Primary observables for fromObservable (XState compatible)
    processedRows$: makeXStateCompatible(processedRows$),
    tableViewState$: makeXStateCompatible(tableViewState$),
    visibleColumns$: makeXStateCompatible(visibleColumns$),
    
    // Raw observables (for direct access)
    _raw: {
      processedRows$,
      tableViewState$,
      visibleColumns$
    },
    
    // Actions for table machine events
    actions,
    
    // Cleanup (Legend State handles most cleanup automatically)
    cleanup: () => {
      console.log('🧹 VibegriddEx: Legend State observables cleaned up', { tableId })
    }
  }
}