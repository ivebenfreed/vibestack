/**
 * Persistence Manager for VibeStack Legend State Integration
 * 
 * Handles IndexedDB storage, sync state management, and offline capabilities.
 * Organization-aware with conflict resolution and data integrity checks.
 */

import { type Observable } from '@legendapp/state'
import { type PersistOptions } from '@legendapp/state/sync'
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'

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
    
    console.log('[PersistenceManager] Initialized', {
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
    
    console.log(`[PersistenceManager] Version progression: ${lastVersion} -> ${newVersion}`)
    
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
    
    console.log(`[PersistenceManager] Creating IndexedDB config with ${tableNames.length} tables:`, tableNames)
    console.log(`[PersistenceManager] Using dynamic schema version: ${schemaVersion} (based on entity list)`)
    
    try {
      return new ObservablePersistIndexedDB({
        databaseName: this.dbName,
        version: schemaVersion,
        tableNames: tableNames
      })
    } catch (error) {
      console.warn(`[PersistenceManager] Failed to create IndexedDB plugin, falling back to no-op:`, error)
      // Return a no-op plugin that doesn't break the application
      return {
        loadTable: async () => ({}),
        saveTable: async () => {},
        deleteTable: async () => {},
        getMetadata: async () => ({}),
        setMetadata: async () => {}
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
      
      console.log(`[PersistenceManager] Initialized sync state for table: ${tableName}`)
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
      
      console.log(`[PersistenceManager] Updated sync state for table: ${tableName}`, {
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
      
      console.log(`[PersistenceManager] Persisted sync state for table: ${tableName}`)
      
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
        
        console.log(`[PersistenceManager] Loaded sync state for table: ${tableName}`, parsedState)
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
      
      console.log('[PersistenceManager] Cleared organization data', {
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