import type { GridPreferences, SortColumn, FilterState } from '../types/gridTypes'

/**
 * Grid Persistence Service
 * Handles local storage, session storage, and IndexedDB for grid state persistence
 */
export class GridPersistenceService {
  private entityName: string
  private storagePrefix: string
  
  constructor(entityName: string) {
    this.entityName = entityName
    this.storagePrefix = `vibeGrid-${entityName}`
  }
  
  // Local Storage Keys
  private getKey(suffix: string): string {
    return `${this.storagePrefix}-${suffix}`
  }
  
  /**
   * Save grid preferences to local storage
   */
  async savePreferences(preferences: GridPreferences): Promise<void> {
    try {
      // Convert Maps and Sets to JSON-serializable objects
      const serializable = {
        columnWidths: Object.fromEntries(preferences.columnWidths),
        columnOrder: preferences.columnOrder,
        hiddenColumns: Array.from(preferences.hiddenColumns),
        sortColumns: preferences.sortColumns,
        filterState: {
          activeFilters: Object.fromEntries(preferences.filterState.activeFilters),
          globalSearch: preferences.filterState.globalSearch,
          quickFilters: Array.from(preferences.filterState.quickFilters)
        },
        pageSize: preferences.pageSize,
        pinnedColumns: preferences.pinnedColumns,
        timestamp: Date.now()
      }
      
      localStorage.setItem(this.getKey('preferences'), JSON.stringify(serializable))
      console.log('[GridPersistenceService] 💾 Saved preferences for:', this.entityName)
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to save preferences:', error)
      throw error
    }
  }
  
  /**
   * Load grid preferences from local storage
   */
  async loadPreferences(): Promise<GridPreferences | null> {
    try {
      const stored = localStorage.getItem(this.getKey('preferences'))
      if (!stored) {
        console.log('[GridPersistenceService] 📭 No stored preferences found for:', this.entityName)
        return null
      }
      
      const serialized = JSON.parse(stored)
      
      // Convert back to Maps and Sets
      const preferences: GridPreferences = {
        columnWidths: new Map(Object.entries(serialized.columnWidths || {})),
        columnOrder: serialized.columnOrder || [],
        hiddenColumns: new Set(serialized.hiddenColumns || []),
        sortColumns: serialized.sortColumns || [],
        filterState: {
          activeFilters: new Map(Object.entries(serialized.filterState?.activeFilters || {})),
          globalSearch: serialized.filterState?.globalSearch || '',
          quickFilters: new Set(serialized.filterState?.quickFilters || [])
        },
        pageSize: serialized.pageSize || 50,
        pinnedColumns: serialized.pinnedColumns || { left: [], right: [] }
      }
      
      console.log('[GridPersistenceService] 📥 Loaded preferences for:', this.entityName)
      return preferences
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to load preferences:', error)
      return null
    }
  }
  
  /**
   * Save column configuration separately for faster access
   */
  async saveColumnConfig(columnWidths: Map<string, number>, columnOrder: string[]): Promise<void> {
    try {
      const config = {
        columnWidths: Object.fromEntries(columnWidths),
        columnOrder,
        timestamp: Date.now()
      }
      
      localStorage.setItem(this.getKey('columns'), JSON.stringify(config))
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to save column config:', error)
    }
  }
  
  /**
   * Load column configuration
   */
  async loadColumnConfig(): Promise<{ columnWidths: Map<string, number>; columnOrder: string[] } | null> {
    try {
      const stored = localStorage.getItem(this.getKey('columns'))
      if (!stored) return null
      
      const serialized = JSON.parse(stored)
      
      return {
        columnWidths: new Map(Object.entries(serialized.columnWidths || {})),
        columnOrder: serialized.columnOrder || []
      }
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to load column config:', error)
      return null
    }
  }
  
  /**
   * Save sort state
   */
  async saveSortState(sortColumns: SortColumn[]): Promise<void> {
    try {
      localStorage.setItem(this.getKey('sort'), JSON.stringify(sortColumns))
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to save sort state:', error)
    }
  }
  
  /**
   * Load sort state
   */
  async loadSortState(): Promise<SortColumn[]> {
    try {
      const stored = localStorage.getItem(this.getKey('sort'))
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to load sort state:', error)
      return []
    }
  }
  
  /**
   * Save filter state
   */
  async saveFilterState(filterState: FilterState): Promise<void> {
    try {
      const serializable = {
        activeFilters: Object.fromEntries(filterState.activeFilters),
        globalSearch: filterState.globalSearch,
        quickFilters: Array.from(filterState.quickFilters)
      }
      
      localStorage.setItem(this.getKey('filter'), JSON.stringify(serializable))
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to save filter state:', error)
    }
  }
  
  /**
   * Load filter state
   */
  async loadFilterState(): Promise<FilterState> {
    try {
      const stored = localStorage.getItem(this.getKey('filter'))
      if (!stored) {
        return {
          activeFilters: new Map(),
          globalSearch: '',
          quickFilters: new Set()
        }
      }
      
      const serialized = JSON.parse(stored)
      return {
        activeFilters: new Map(Object.entries(serialized.activeFilters || {})),
        globalSearch: serialized.globalSearch || '',
        quickFilters: new Set(serialized.quickFilters || [])
      }
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to load filter state:', error)
      return {
        activeFilters: new Map(),
        globalSearch: '',
        quickFilters: new Set()
      }
    }
  }
  
  /**
   * Save current selection to session storage (temporary)
   */
  async saveSelection(cellIds: Set<string>, rowIds: Set<string>): Promise<void> {
    try {
      const selection = {
        cells: Array.from(cellIds),
        rows: Array.from(rowIds),
        timestamp: Date.now()
      }
      
      sessionStorage.setItem(this.getKey('selection'), JSON.stringify(selection))
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to save selection:', error)
    }
  }
  
  /**
   * Load selection from session storage
   */
  async loadSelection(): Promise<{ cells: Set<string>; rows: Set<string> } | null> {
    try {
      const stored = sessionStorage.getItem(this.getKey('selection'))
      if (!stored) return null
      
      const serialized = JSON.parse(stored)
      
      // Check if selection is too old (more than 1 hour)
      if (Date.now() - serialized.timestamp > 3600000) {
        sessionStorage.removeItem(this.getKey('selection'))
        return null
      }
      
      return {
        cells: new Set(serialized.cells || []),
        rows: new Set(serialized.rows || [])
      }
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to load selection:', error)
      return null
    }
  }
  
  /**
   * Clear all stored preferences
   */
  async clearAllPreferences(): Promise<void> {
    try {
      const keys = [
        'preferences',
        'columns', 
        'sort',
        'filter'
      ]
      
      keys.forEach(key => {
        localStorage.removeItem(this.getKey(key))
      })
      
      sessionStorage.removeItem(this.getKey('selection'))
      
      console.log('[GridPersistenceService] 🧹 Cleared all preferences for:', this.entityName)
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to clear preferences:', error)
    }
  }
  
  /**
   * Get storage usage information
   */
  getStorageInfo(): { localStorage: number; sessionStorage: number } {
    const getStorageSize = (storage: Storage, prefix: string): number => {
      let size = 0
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key?.startsWith(prefix)) {
          const value = storage.getItem(key)
          size += key.length + (value?.length || 0)
        }
      }
      return size
    }
    
    return {
      localStorage: getStorageSize(localStorage, this.storagePrefix),
      sessionStorage: getStorageSize(sessionStorage, this.storagePrefix)
    }
  }
  
  /**
   * Export all preferences as JSON for backup
   */
  async exportPreferences(): Promise<string> {
    try {
      const preferences = await this.loadPreferences()
      const columnConfig = await this.loadColumnConfig()
      const sortState = await this.loadSortState()
      const filterState = await this.loadFilterState()
      
      const exportData = {
        entityName: this.entityName,
        preferences,
        columnConfig,
        sortState,
        filterState,
        exportedAt: new Date().toISOString()
      }
      
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to export preferences:', error)
      throw error
    }
  }
  
  /**
   * Import preferences from JSON backup
   */
  async importPreferences(jsonData: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData)
      
      if (importData.entityName !== this.entityName) {
        throw new Error(`Entity name mismatch: expected ${this.entityName}, got ${importData.entityName}`)
      }
      
      if (importData.preferences) {
        await this.savePreferences(importData.preferences)
      }
      
      if (importData.sortState) {
        await this.saveSortState(importData.sortState)
      }
      
      if (importData.filterState) {
        await this.saveFilterState(importData.filterState)
      }
      
      console.log('[GridPersistenceService] 📥 Imported preferences for:', this.entityName)
    } catch (error) {
      console.error('[GridPersistenceService] ❌ Failed to import preferences:', error)
      throw error
    }
  }
}

/**
 * Factory function to create persistence service instances
 */
export function createGridPersistenceService(entityName: string): GridPersistenceService {
  return new GridPersistenceService(entityName)
}

/**
 * Hook for using grid persistence service
 */
import React from 'react'

export function useGridPersistence(entityName: string) {
  const service = React.useMemo(() => createGridPersistenceService(entityName), [entityName])
  
  return service
}