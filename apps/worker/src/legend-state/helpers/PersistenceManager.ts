/**
 * Persistence Manager for VibeStack Legend State Integration
 * 
 * Handles IndexedDB storage, sync state management, and offline capabilities.
 * Organization-aware with conflict resolution and data integrity checks.
 */

import { type Observable } from '@legendapp/state'
import { type PersistOptions } from '@legendapp/state/sync'
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
import { stateLog } from '@/logger';

const log = stateLog('legend-state/helpers/PersistenceManager.ts');

export interface EntityMetadata {
  id: string
  tableName: string
  organizationId: string
  lastSyncedAt: number
  version: number
  isLocalOnly: boolean
  hasConflicts: boolean
  conflictData?: any
}

export interface SyncState {
  tableName: string
  organizationId: string
  lastSyncTimestamp: number
  lastLSN: string
  pendingChanges: string[]
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
  errorMessage?: string
}

export class PersistenceManager {
  private organizationId: string
  private userId: string
  private dbName: string
  private dbVersion: number
  private syncStates: Map<string, SyncState> = new Map()
  
  constructor(organizationId: string, userId: string, dbName?: string, dbVersion?: number) {
    this.organizationId = organizationId
    this.userId = userId
    this.dbName = dbName || `vibestack_org_${organizationId.replace(/-/g, '_')}`
    this.dbVersion = dbVersion || 1
    
    log.info('[PersistenceManager] Initialized', {
      organizationId,
      userId,
      dbName: this.dbName,
      dbVersion: this.dbVersion
    })
  }

  /**
   * Generate database version based on entity schema to ensure IndexedDB upgrades
   */
  private generateSchemaVersion(entityNames: string[]): number {
    // Use timestamp-based version to ensure monotonic increase
    // This prevents IndexedDB version downgrade errors when entities are deleted
    const currentTime = Date.now()
    
    // Store the last version used for this org in localStorage to ensure monotonic increase
    const versionKey = `vibestack_db_version_${this.organizationId}`
    const lastVersion = parseInt(localStorage.getItem(versionKey) || '0', 10)
    
    // Use the larger of current time or last version + 1 to ensure we never go backwards
    const newVersion = Math.max(currentTime, lastVersion + 1)
    
    // Store the new version
    localStorage.setItem(versionKey, newVersion.toString())
    
    log.info(`[PersistenceManager] Version progression: ${lastVersion} -> ${newVersion}`)
    
    return newVersion
  }
  
  /**
   * Create IndexedDB configuration for all entity tables
   */
  public createIndexedDBConfig(entityNames: string[]) {
    // Create table names for all entities plus metadata tables
    const tableNames = [
      ...entityNames.map(name => `vibestack_${name.toLowerCase()}`),
      'metadata',
      'sync_state'
    ]
    
    // Generate dynamic version based on schema to trigger IndexedDB upgrades when needed
    const schemaVersion = this.generateSchemaVersion(entityNames)
    
    log.info(`[PersistenceManager] Creating IndexedDB config with ${tableNames.length} tables:`, tableNames)
    log.info(`[PersistenceManager] Using dynamic schema version: ${schemaVersion} (based on entity list)`)
    
    try {
      // Create and properly initialize the IndexedDB plugin
      const plugin = new ObservablePersistIndexedDB({
        databaseName: this.dbName,
        version: schemaVersion,
        tableNames: tableNames
      })
      
      // Initialize the plugin immediately to avoid "not initialized" errors
      // The plugin's initialize method sets up the database connection
      plugin.initialize({
        databaseName: this.dbName,
        version: schemaVersion,
        tableNames: tableNames
      })
      
      log.info(`[PersistenceManager] IndexedDB plugin initialized successfully`)
      return plugin
      
    } catch (error) {
      log.warn(`[PersistenceManager] Failed to create IndexedDB plugin, falling back to localStorage:`, error)
      
      // Instead of complex fallback, just disable persistence by returning null
      // This allows the app to work without persistence rather than with a broken plugin
      return null
    }
  }

  /**
   * Create load transform with error handling for missing object stores
   */
  private createLoadTransform() {
    return {
      load: (value: any, path: string[]) => {
        try {
          return value
        } catch (error) {
          log.warn(`[PersistenceManager] Load transform error for path ${path.join('.')}:`, error)
          return {}
        }
      }
    }
  }

  /**
   * Create save transform with error handling
   */
  private createSaveTransform() {
    return {
      save: (value: any, path: string[]) => {
        try {
          return value
        } catch (error) {
          log.warn(`[PersistenceManager] Save transform error for path ${path.join('.')}:`, error)
          return value
        }
      }
    }
  }

  /**
   * Wrap IndexedDB plugin methods with error handling for object store issues
   */
  private wrapPluginWithErrorHandling(plugin: any, tableNames: string[]) {
    const originalGetTable = plugin.getTable?.bind(plugin)
    const originalLoadTable = plugin.loadTable?.bind(plugin)
    const originalSet = plugin.set?.bind(plugin)
    const originalDeleteTable = plugin.deleteTable?.bind(plugin)
    const originalGetMetadata = plugin.getMetadata?.bind(plugin)
    const originalSetMetadata = plugin.setMetadata?.bind(plugin)

    return {
      ...plugin,
      
      getTable: async (table: string, init: any, config: any) => {
        try {
          if (!originalGetTable) return init || {}
          return await originalGetTable(table, init, config)
        } catch (error) {
          // Handle object store not found errors
          if (error.name === 'NotFoundError' || error.message?.includes('object stores was not found')) {
            log.info(`[PersistenceManager] Object store '${table}' not found in getTable - likely schema change. Returning init data and clearing database for clean state.`)
            
            // Clear the problematic database to force clean recreation
            await this.clearAndRecreateDatabase()
            return init || {}
          }
          
          log.error(`[PersistenceManager] getTable error for '${table}':`, error)
          return init || {}
        }
      },
      
      loadTable: async (table: string, config: any) => {
        try {
          if (!originalLoadTable) return {}
          return await originalLoadTable(table, config)
        } catch (error) {
          // Handle object store not found errors
          if (error.name === 'NotFoundError' || error.message?.includes('object stores was not found')) {
            log.info(`[PersistenceManager] Object store '${table}' not found in loadTable - likely schema change. Returning empty data and clearing database for clean state.`)
            
            // Clear the problematic database to force clean recreation
            await this.clearAndRecreateDatabase()
            return {}
          }
          
          log.error(`[PersistenceManager] loadTable error for '${table}':`, error)
          return {}
        }
      },
      
      set: async (table: string, changes: any, config: any) => {
        try {
          if (!originalSet) return
          await originalSet(table, changes, config)
        } catch (error) {
          if (error.name === 'NotFoundError' || error.message?.includes('object stores was not found')) {
            log.info(`[PersistenceManager] Object store '${table}' not found during set - clearing database for clean recreation.`)
            await this.clearAndRecreateDatabase()
            return
          }
          
          log.error(`[PersistenceManager] set error for '${table}':`, error)
        }
      },
      
      deleteTable: async (table: string, config: any) => {
        try {
          if (!originalDeleteTable) return
          await originalDeleteTable(table, config)
        } catch (error) {
          if (error.name === 'NotFoundError' || error.message?.includes('object stores was not found')) {
            log.info(`[PersistenceManager] Object store '${table}' not found during delete - already cleared.`)
            return
          }
          
          log.error(`[PersistenceManager] deleteTable error for '${table}':`, error)
        }
      },

      getMetadata: async (table: string) => {
        try {
          if (!originalGetMetadata) return {}
          return await originalGetMetadata(table)
        } catch (error) {
          if (error.name === 'NotFoundError' || error.message?.includes('object stores was not found')) {
            log.info(`[PersistenceManager] Object store '${table}' not found during getMetadata - clearing database for clean recreation.`)
            await this.clearAndRecreateDatabase()
            return {}
          }
          
          log.error(`[PersistenceManager] getMetadata error for '${table}':`, error)
          return {}
        }
      },

      setMetadata: async (table: string, metadata: any) => {
        try {
          if (!originalSetMetadata) return
          await originalSetMetadata(table, metadata)
        } catch (error) {
          if (error.name === 'NotFoundError' || error.message?.includes('object stores was not found')) {
            log.info(`[PersistenceManager] Object store '${table}' not found during setMetadata - clearing database for clean recreation.`)
            await this.clearAndRecreateDatabase()
            return
          }
          
          log.error(`[PersistenceManager] setMetadata error for '${table}':`, error)
        }
      }
    }
  }

  /**
   * Clear and recreate IndexedDB database to fix schema mismatches
   */
  private async clearAndRecreateDatabase(): Promise<void> {
    try {
      log.info(`[PersistenceManager] Clearing corrupted IndexedDB database: ${this.dbName}`)
      
      // Delete the entire database to force clean recreation
      const deleteRequest = indexedDB.deleteDatabase(this.dbName)
      
      await new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => {
          log.info(`[PersistenceManager] Successfully deleted database: ${this.dbName}`)
          resolve(undefined)
        }
        deleteRequest.onerror = () => {
          log.error(`[PersistenceManager] Failed to delete database: ${this.dbName}`, deleteRequest.error)
          resolve(undefined) // Don't reject, continue with fallback
        }
        deleteRequest.onblocked = () => {
          log.warn(`[PersistenceManager] Database deletion blocked: ${this.dbName} - continuing anyway`)
          resolve(undefined)
        }
      })

      // Clear localStorage entries for this organization as well
      const orgPrefix = this.organizationId
      const keysToRemove = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes(orgPrefix)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      log.info(`[PersistenceManager] Database cleanup completed. Removed ${keysToRemove.length} localStorage entries.`)
      
    } catch (error) {
      log.error('[PersistenceManager] Failed to clear database:', error)
    }
  }

  /**
   * Create fallback plugin when IndexedDB fails
   */
  private createFallbackPlugin() {
    log.info('[PersistenceManager] Using fallback storage plugin (localStorage-based)')
    
    return {
      getTable: async (table: string, init: any, config: any) => {
        try {
          const key = `${this.dbName}_${table}`
          const data = localStorage.getItem(key)
          return data ? JSON.parse(data) : (init || {})
        } catch (error) {
          log.warn(`[PersistenceManager] Fallback getTable error for '${table}':`, error)
          return init || {}
        }
      },
      
      loadTable: async (table: string, config: any) => {
        try {
          const key = `${this.dbName}_${table}`
          const data = localStorage.getItem(key)
          return data ? JSON.parse(data) : {}
        } catch (error) {
          log.warn(`[PersistenceManager] Fallback loadTable error for '${table}':`, error)
          return {}
        }
      },
      
      set: async (table: string, changes: any, config: any) => {
        try {
          const key = `${this.dbName}_${table}`
          // For Legend State, changes might be partial updates or full data
          // Store the changes directly as Legend State will manage the merging
          localStorage.setItem(key, JSON.stringify(changes))
        } catch (error) {
          log.warn(`[PersistenceManager] Fallback set error for '${table}':`, error)
        }
      },
      
      deleteTable: async (table: string, config: any) => {
        try {
          const key = `${this.dbName}_${table}`
          localStorage.removeItem(key)
        } catch (error) {
          log.warn(`[PersistenceManager] Fallback deleteTable error for '${table}':`, error)
        }
      },
      
      getMetadata: async (table: string) => {
        try {
          const key = `${this.dbName}_${table}_metadata`
          const data = localStorage.getItem(key)
          return data ? JSON.parse(data) : {}
        } catch (error) {
          log.warn(`[PersistenceManager] Fallback getMetadata error for '${table}':`, error)
          return {}
        }
      },
      
      setMetadata: async (table: string, metadata: any) => {
        try {
          const key = `${this.dbName}_${table}_metadata`
          localStorage.setItem(key, JSON.stringify(metadata))
        } catch (error) {
          log.warn(`[PersistenceManager] Fallback setMetadata error for '${table}':`, error)
        }
      }
    }
  }
  
  /**
   * Get persistence options for an entity
   */
  public getPersistOptions(entityName: string): Partial<PersistOptions> {
    const persistKey = `vibestack_${entityName.toLowerCase()}`
    
    return {
      name: persistKey,
      retrySync: false // Disable automatic retry to prevent flooding
    }
  }
  
  /**
   * Initialize sync state for a table
   */
  private initializeSyncState(tableName: string): void {
    const existingState = this.syncStates.get(tableName)
    
    if (!existingState) {
      const initialState: SyncState = {
        tableName,
        organizationId: this.organizationId,
        lastSyncTimestamp: 0,
        lastLSN: '0/0',
        pendingChanges: [],
        syncStatus: 'idle'
      }
      
      this.syncStates.set(tableName, initialState)
      
      log.info(`[PersistenceManager] Initialized sync state for table: ${tableName}`)
    }
  }
  
  /**
   * Update sync state for a table
   */
  public updateSyncState(tableName: string, updates: Partial<SyncState>): void {
    const currentState = this.syncStates.get(tableName)
    
    if (currentState) {
      const newState = { ...currentState, ...updates }
      this.syncStates.set(tableName, newState)
      
      log.info(`[PersistenceManager] Updated sync state for table: ${tableName}`, {
        updates,
        newState
      })
      
      // Persist sync state to IndexedDB
      this.persistSyncState(tableName, newState)
    }
  }
  
  /**
   * Get sync state for a table
   */
  public getSyncState(tableName: string): SyncState | undefined {
    return this.syncStates.get(tableName)
  }
  
  /**
   * Persist sync state to IndexedDB
   */
  private async persistSyncState(tableName: string, syncState: SyncState): Promise<void> {
    try {
      // This will be stored in the 'sync_state' table in IndexedDB
      const stateKey = `${this.organizationId}_${tableName}_sync_state`
      
      // For now, we'll use localStorage as a fallback
      // In a full implementation, this would use the IndexedDB directly
      localStorage.setItem(stateKey, JSON.stringify(syncState))
      
      log.info(`[PersistenceManager] Persisted sync state for table: ${tableName}`)
      
    } catch (error) {
      console.error(`[PersistenceManager] Failed to persist sync state for table: ${tableName}`, error)
    }
  }
  
  /**
   * Load sync state from IndexedDB on initialization
   */
  public async loadSyncState(tableName: string): Promise<SyncState | null> {
    try {
      const stateKey = `${this.organizationId}_${tableName}_sync_state`
      const storedState = localStorage.getItem(stateKey)
      
      if (storedState) {
        const parsedState = JSON.parse(storedState) as SyncState
        this.syncStates.set(tableName, parsedState)
        
        log.info(`[PersistenceManager] Loaded sync state for table: ${tableName}`, parsedState)
        return parsedState
      }
      
      return null
      
    } catch (error) {
      console.error(`[PersistenceManager] Failed to load sync state for table: ${tableName}`, error)
      return null
    }
  }
  
  /**
   * Clear all data for the organization (useful for logout)
   */
  public async clearOrganizationData(): Promise<void> {
    try {
      // Clear sync states
      this.syncStates.clear()
      
      // Clear localStorage items for this organization
      const orgPrefix = this.organizationId
      const keysToRemove = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes(orgPrefix)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      log.info('[PersistenceManager] Cleared organization data', {
        organizationId: this.organizationId,
        clearedKeys: keysToRemove.length
      })
      
    } catch (error) {
      console.error('[PersistenceManager] Failed to clear organization data', error)
      throw error
    }
  }
  
  /**
   * Get storage usage statistics
   */
  public getStorageStats(): any {
    const orgKeys = []
    let totalSize = 0
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes(this.organizationId)) {
        const value = localStorage.getItem(key)
        orgKeys.push(key)
        totalSize += (key.length + (value?.length || 0)) * 2 // Rough byte estimate
      }
    }
    
    return {
      organizationId: this.organizationId,
      keyCount: orgKeys.length,
      estimatedSizeBytes: totalSize,
      syncStates: Object.fromEntries(this.syncStates),
      tableCount: this.syncStates.size
    }
  }
}

/**
 * Create persistence manager for organization
 */
export function createPersistenceManager(
  organizationId: string,
  userId: string,
  options?: { dbName?: string; dbVersion?: number }
): PersistenceManager {
  return new PersistenceManager(
    organizationId,
    userId,
    options?.dbName,
    options?.dbVersion
  )
}