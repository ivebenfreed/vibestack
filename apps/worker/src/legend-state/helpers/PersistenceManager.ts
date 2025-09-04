/**
 * Persistence Manager for VibeStack Legend State Integration
 * 
 * Handles IndexedDB storage, sync state management, and offline capabilities.
 * Organization-aware with conflict resolution and data integrity checks.
 */

import { type Observable } from '@legendapp/state'
import { type PersistOptions } from '@legendapp/state/sync'
import { ObservablePersistIndexedDB, observablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
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
    const versionKey = `vibestack_db_version_${this.organizationId}`
    const schemaHashKey = `vibestack_db_schema_hash_${this.organizationId}`
    
    // Create a stable hash of the entity names to detect schema changes
    const currentSchemaHash = this.createSchemaHash(entityNames)
    const lastSchemaHash = localStorage.getItem(schemaHashKey) || ''
    const lastVersion = parseInt(localStorage.getItem(versionKey) || '1', 10)
    
    // Only increment version if schema actually changed
    if (currentSchemaHash === lastSchemaHash && lastVersion > 0) {
      log.info(`[PersistenceManager] Schema unchanged, reusing version: ${lastVersion}`)
      return lastVersion
    }
    
    // Schema changed - increment version
    const newVersion = lastVersion + 1
    
    // Store both the new version and schema hash
    localStorage.setItem(versionKey, newVersion.toString())
    localStorage.setItem(schemaHashKey, currentSchemaHash)
    
    log.info(`[PersistenceManager] Schema changed, version progression: ${lastVersion} -> ${newVersion}`, {
      oldHash: lastSchemaHash.substring(0, 8),
      newHash: currentSchemaHash.substring(0, 8),
      entityCount: entityNames.length
    })
    
    return newVersion
  }
  
  /**
   * Create a stable hash of entity names for schema change detection
   */
  private createSchemaHash(entityNames: string[]): string {
    // Sort entity names to ensure consistent hash regardless of order
    const sortedNames = [...entityNames].sort()
    const schemaString = sortedNames.join(',')
    
    // Simple hash function - could be more sophisticated but this works for our needs
    let hash = 0
    for (let i = 0; i < schemaString.length; i++) {
      const char = schemaString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return `schema_${Math.abs(hash).toString(36)}_${sortedNames.length}`
  }
  
  /**
   * Create IndexedDB configuration for all entity tables using Legend State v3 pattern
   */
  public async createIndexedDBConfig(entityNames: string[]) {
    console.log(`[PersistenceManager] Creating IndexedDB config for entities:`, entityNames)
    
    // Create table names for all entities plus metadata tables
    // For multi-org universe system, entityNames are in format: {orgId}_{EntityName}
    // We need to create valid IndexedDB table names by sanitizing them
    const tableNames = [
      ...entityNames.map(name => {
        // Convert composite key to valid table name by replacing invalid chars
        const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
        return `vibestack_${sanitized}`
      }),
      'metadata',
      'sync_state'
    ]
    
    console.log(`[PersistenceManager] Created table names:`, tableNames)
    
    // Generate dynamic version based on schema to trigger IndexedDB upgrades when needed
    const schemaVersion = this.generateSchemaVersion(entityNames)
    
    log.info(`[PersistenceManager] Creating IndexedDB config with ${tableNames.length} tables:`, tableNames)
    log.info(`[PersistenceManager] Using schema version: ${schemaVersion}`)
    
    try {
      console.log(`[PersistenceManager] Schema version: ${schemaVersion}, table names:`, tableNames)
      
      // Check if we need to clear database due to version downgrade
      const needsClear = this.checkForVersionDowngrade(schemaVersion)
      console.log(`[PersistenceManager] Needs clear due to version downgrade:`, needsClear)
      if (needsClear) {
        log.info(`[PersistenceManager] Clearing database due to version downgrade`)
        return await this.createConfigAfterClear(schemaVersion, tableNames, entityNames)
      }
      
      // Use the proper Legend State v3 pattern - configure globally with configureSynced
      const { configureSynced } = await import('@legendapp/state/sync')
      
      const persistOptions = configureSynced({
        persist: {
          plugin: observablePersistIndexedDB({
            databaseName: this.dbName,
            version: schemaVersion,
            tableNames: tableNames
          })
        }
      })
      
      log.info(`[PersistenceManager] Legend State v3 IndexedDB configuration created successfully`)
      
      // Return both the configuration function and entity mapping for table names
      return {
        persistOptions,
        entityTableMap: this.createEntityTableMap(entityNames, tableNames)
      }
      
    } catch (error) {
      console.error(`[PersistenceManager] ERROR - Failed to create IndexedDB plugin:`, error)
      log.warn(`[PersistenceManager] Failed to create IndexedDB plugin:`, error)
      
      // Check if this is a version downgrade error
      if (error.name === 'VersionError' && error.message?.includes('is less than the existing version')) {
        log.info(`[PersistenceManager] Detected version downgrade, clearing database and retrying`)
        return await this.createConfigAfterClear(schemaVersion, tableNames, entityNames)
      }
      
      // For other errors, return null - the calling code will handle fallback
      log.warn(`[PersistenceManager] Using fallback storage due to IndexedDB error`)
      return null
    }
  }
  


  /**
   * Check if the new version would cause a downgrade
   */
  private checkForVersionDowngrade(newVersion: number): boolean {
    // Check if there's a database that might have a higher version
    const oldVersionKey = `vibestack_db_version_${this.organizationId}`
    const storedVersion = localStorage.getItem(oldVersionKey)
    
    if (!storedVersion) {
      return false
    }
    
    const existingVersion = parseInt(storedVersion, 10)
    
    // If the new version is significantly lower, it's likely a downgrade from timestamp to hash-based versioning
    if (existingVersion > 1000000 && newVersion < 1000) {
      log.info(`[PersistenceManager] Detected migration from timestamp (${existingVersion}) to hash-based versioning (${newVersion})`)
      return true
    }
    
    return false
  }
  
  /**
   * Create configuration after clearing database
   */
  private async createConfigAfterClear(schemaVersion: number, tableNames: string[], entityNames: string[]): Promise<any> {
    try {
      // Clear the problematic database
      await this.clearAndRecreateDatabase()
      
      // Wait for the database to be fully cleared
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Use the proper Legend State v3 pattern - configure globally with configureSynced
      const { configureSynced } = await import('@legendapp/state/sync')
      
      const persistOptions = configureSynced({
        persist: {
          plugin: observablePersistIndexedDB({
            databaseName: this.dbName,
            version: schemaVersion,
            tableNames: tableNames
          })
        }
      })
      
      log.info(`[PersistenceManager] Legend State v3 IndexedDB configuration recreated after database clear`)
      
      // Return both the configuration function and entity mapping for table names
      return {
        persistOptions,
        entityTableMap: this.createEntityTableMap(entityNames, tableNames)
      }
      
    } catch (retryError) {
      log.warn(`[PersistenceManager] Failed to create plugin even after clearing database:`, retryError)
      log.info(`[PersistenceManager] Falling back to in-memory storage`)
      return null
    }
  }
  
  /**
   * Create mapping from entity names to sanitized table names
   */
  private createEntityTableMap(entityNames: string[], tableNames: string[]): Record<string, string> {
    const entityTableMap: Record<string, string> = {}
    
    // Map each entity name to its corresponding sanitized table name
    entityNames.forEach((entityName, index) => {
      // Extract the actual entity name from the composite key (remove orgId prefix)
      const entityKey = entityName.split('_').pop() || entityName
      entityTableMap[entityKey] = tableNames[index]
    })
    
    return entityTableMap
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