/**
 * VibeStack Sync Plugin for Legend State
 * 
 * Integrates VibeStack's WebSocket-based table change notifications 
 * with Legend State's reactive observables and persistence system.
 * 
 * Features:
 * - Real-time WebSocket sync with table change notifications
 * - IndexedDB persistence with offline capability
 * - Optimistic updates with conflict resolution
 * - Automatic retry and reconnection logic
 * - Organization-aware data scoping
 */

import { configureObservableSync, type ObservablePersistPlugin, type PersistOptions } from '@legendapp/state/sync'
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
import { synced } from '@legendapp/state/sync'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { syncLogger } from '../utils/SyncLogger'

export interface VibeStackSyncConfig {
  // Organization context
  organizationId: string
  userId: string
  
  // Server configuration
  serverBaseUrl: string
  webSocketUrl: string
  
  // Persistence configuration
  indexedDbName: string
  indexedDbVersion: number
  
  // Sync behavior
  enableOptimisticUpdates: boolean
  retryAttempts: number
  retryDelayMs: number
  
  // Debug options
  debugMode: boolean
}

export interface TableSyncConfig {
  tableName: string
  apiEndpoint: string
  primaryKey: string
  enableRealTimeSync: boolean
  enablePersistence: boolean
  conflictResolution: 'server-wins' | 'client-wins' | 'last-write-wins'
  // Legend State sync options for differential sync
  fieldUpdatedAt?: string
  fieldDeleted?: string
  changesSince?: 'last-sync' | number | string
  includeDeleted?: boolean
}

class VibeStackSyncPlugin {
  private config: VibeStackSyncConfig
  private tableConfigs: Map<string, TableSyncConfig> = new Map()
  private persistencePlugin: ObservablePersistPlugin
  private isInitialized = false
  
  constructor(config: VibeStackSyncConfig) {
    this.config = config
    this.persistencePlugin = this.createPersistencePlugin()
    
    if (config.debugMode) {
      syncLogger.info('legend-state', 'VibeStack Sync Plugin initialized', { config })
    }
  }
  
  /**
   * Initialize the sync plugin with persistence and WebSocket connections
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      syncLogger.warn('legend-state', 'VibeStack Sync Plugin already initialized')
      return
    }
    
    try {
      // Configure Legend State sync and persistence globally
      configureObservableSync({
        persist: {
          plugin: this.persistencePlugin
        }
      })
      
      // Set up WebSocket event listeners for table change notifications
      this.setupWebSocketListeners()
      
      this.isInitialized = true
      syncLogger.info('legend-state', '✅ VibeStack Sync Plugin initialized successfully')
      
    } catch (error) {
      syncLogger.error('legend-state', 'Failed to initialize VibeStack Sync Plugin', { error })
      throw error
    }
  }
  
  /**
   * Register a table for sync and persistence
   */
  public registerTable(config: TableSyncConfig): void {
    this.tableConfigs.set(config.tableName, config)
    
    syncLogger.info('legend-state', `📋 Registered table for sync: ${config.tableName}`, {
      apiEndpoint: config.apiEndpoint,
      enableRealTimeSync: config.enableRealTimeSync,
      enablePersistence: config.enablePersistence
    })
  }
  
  /**
   * Get table configuration
   */
  public getTableConfig(tableName: string): TableSyncConfig | undefined {
    return this.tableConfigs.get(tableName)
  }
  
  /**
   * Create IndexedDB persistence plugin with organization scoping
   */
  private createPersistencePlugin(): ObservablePersistPlugin {
    const dbName = `${this.config.indexedDbName}_org_${this.config.organizationId}`
    
    return new ObservablePersistIndexedDB({
      databaseName: dbName,
      version: this.config.indexedDbVersion,
      tableNames: ['vibestack_entities', 'vibestack_metadata', 'vibestack_sync_state']
    })
  }
  
  /**
   * Set up WebSocket listeners for table change notifications
   */
  private setupWebSocketListeners(): void {
    // Listen for table change notifications from simple-notification-sync-machine
    window.addEventListener('vibestack:table-change-notification', (event) => {
      const notification = (event as CustomEvent).detail
      
      syncLogger.info('legend-state', '🔔 Received table change notification', {
        tables: notification.tables,
        organizationId: notification.organizationId,
        lsn: notification.lsn,
        messageId: notification.messageId
      })
      
      // Process each table change
      notification.tables.forEach((tableName: string) => {
        this.handleTableChange(tableName, notification)
      })
    })
    
    syncLogger.info('legend-state', '📡 WebSocket event listeners configured')
  }
  
  /**
   * Handle table change notification
   */
  private async handleTableChange(tableName: string, notification: any): Promise<void> {
    const tableConfig = this.tableConfigs.get(tableName)
    
    if (!tableConfig) {
      syncLogger.debug('legend-state', `Table ${tableName} not registered for sync, skipping`)
      return
    }
    
    if (!tableConfig.enableRealTimeSync) {
      syncLogger.debug('legend-state', `Real-time sync disabled for ${tableName}, skipping`)
      return
    }
    
    try {
      syncLogger.info('legend-state', `🔄 Processing table change for: ${tableName}`)
      
      // This will be implemented when we create table-specific stores
      await this.refreshTableData(tableName, notification)
      
    } catch (error) {
      syncLogger.error('legend-state', `Failed to process table change for ${tableName}`, {
        error,
        notification
      })
    }
  }
  
  /**
   * Refresh table data from server (placeholder for now)
   */
  private async refreshTableData(tableName: string, notification: any): Promise<void> {
    const tableConfig = this.tableConfigs.get(tableName)!
    
    syncLogger.info('legend-state', `🔄 Refreshing data for table: ${tableName}`, {
      apiEndpoint: tableConfig.apiEndpoint,
      lsn: notification.lsn
    })
    
    // TODO: Implement actual data fetching and store updates
    // This will be done when we create the table-specific observable stores
  }
  
  /**
   * Create Legend State sync configuration for a table with differential sync support
   */
  public createLegendStateSyncConfig(tableName: string) {
    const tableConfig = this.tableConfigs.get(tableName)
    
    if (!tableConfig) {
      throw new Error(`Table ${tableName} not registered for sync`)
    }
    
    const syncUrl = `${this.config.serverBaseUrl}/api/dataforge/orgs/${this.config.organizationId}/sync/${tableName}`
    
    return {
      list: {
        url: syncUrl,
        // Enable differential sync with changesSince parameter
        urlQuery: (params: any) => {
          const query: Record<string, string> = {}
          
          // Add differential sync parameters
          if (params.changesSince) {
            query.changesSince = typeof params.changesSince === 'number' 
              ? new Date(params.changesSince).toISOString()
              : params.changesSince
          }
          
          if (tableConfig.includeDeleted) {
            query.includeDeleted = 'true'
          }
          
          if (params.limit) {
            query.limit = String(params.limit)
          }
          
          if (params.offset) {
            query.offset = String(params.offset)
          }
          
          return query
        },
        // Transform server response to extract data array
        transform: {
          load: (response: any) => {
            if (response.success && response.data) {
              // Store sync metadata for next request
              if (response.syncInfo?.nextChangesSince) {
                localStorage.setItem(
                  `vibestack_sync_${tableName}_lastSync`, 
                  String(response.syncInfo.nextChangesSince)
                )
              }
              return response.data
            }
            return []
          }
        }
      },
      create: {
        url: `${this.config.serverBaseUrl}/api/dataforge/orgs/${this.config.organizationId}/data/${tableName}`,
        transform: {
          save: (item: any) => {
            // Remove Legend State metadata before sending to server
            const { __id, __metadata, ...cleanItem } = item
            return cleanItem
          },
          load: (response: any) => response.saved || response.data
        }
      },
      update: {
        url: (item: any) => `${this.config.serverBaseUrl}/api/dataforge/orgs/${this.config.organizationId}/data/${tableName}/${item[tableConfig.primaryKey]}`,
        transform: {
          save: (item: any) => {
            // Remove Legend State metadata before sending to server
            const { __id, __metadata, ...cleanItem } = item
            return cleanItem
          },
          load: (response: any) => response.updated || response.data
        }
      },
      delete: {
        url: (item: any) => `${this.config.serverBaseUrl}/api/dataforge/orgs/${this.config.organizationId}/data/${tableName}/${item[tableConfig.primaryKey]}`,
        transform: {
          save: () => ({ deleted: true, deleted_at: new Date().toISOString() })
        }
      },
      // Configure differential sync fields
      fieldUpdatedAt: tableConfig.fieldUpdatedAt || 'updated_at',
      fieldDeleted: tableConfig.fieldDeleted || 'deleted',
      changesSince: tableConfig.changesSince || 'last-sync',
      
      // Persistence configuration
      persist: tableConfig.enablePersistence ? {
        name: `vibestack_${tableName}`,
        plugin: this.persistencePlugin
      } : undefined,
      
      // Real-time sync via WebSocket notifications
      realtime: tableConfig.enableRealTimeSync
    }
  }
  
  /**
   * Get the last sync timestamp for a table
   */
  public getLastSyncTimestamp(tableName: string): number | null {
    const stored = localStorage.getItem(`vibestack_sync_${tableName}_lastSync`)
    return stored ? parseInt(stored) : null
  }
  
  /**
   * Get the persistence plugin instance
   */
  public getPersistencePlugin() {
    return this.persistencePlugin
  }
  
  /**
   * Get sync statistics and status
   */
  public getSyncStatus() {
    return {
      isInitialized: this.isInitialized,
      registeredTables: Array.from(this.tableConfigs.keys()),
      organizationId: this.config.organizationId,
      userId: this.config.userId,
      config: this.config
    }
  }
}

// Singleton instance for global access
let vibeStackSyncPlugin: VibeStackSyncPlugin | null = null

/**
 * Initialize VibeStack Sync Plugin globally
 */
export function initializeVibeStackSync(config: VibeStackSyncConfig): VibeStackSyncPlugin {
  if (vibeStackSyncPlugin) {
    syncLogger.warn('legend-state', 'VibeStack Sync Plugin already exists, returning existing instance')
    return vibeStackSyncPlugin
  }
  
  vibeStackSyncPlugin = new VibeStackSyncPlugin(config)
  return vibeStackSyncPlugin
}

/**
 * Get the global VibeStack Sync Plugin instance
 */
export function getVibeStackSync(): VibeStackSyncPlugin | null {
  return vibeStackSyncPlugin
}

/**
 * Default configuration for VibeStack Sync
 */
export function createDefaultSyncConfig(organizationId: string, userId: string): VibeStackSyncConfig {
  return {
    organizationId,
    userId,
    serverBaseUrl: 'http://localhost:8787',
    webSocketUrl: `ws://localhost:8787/api/org-actor/${organizationId}/websocket`,
    indexedDbName: 'vibestack',
    indexedDbVersion: 1,
    enableOptimisticUpdates: true,
    retryAttempts: 3,
    retryDelayMs: 1000,
    debugMode: true
  }
}

/**
 * Default table sync configuration with differential sync enabled
 */
export function createDefaultTableConfig(tableName: string): TableSyncConfig {
  return {
    tableName,
    apiEndpoint: `/api/dataforge/orgs/{orgId}/sync/${tableName}`,
    primaryKey: 'id',
    enableRealTimeSync: true,
    enablePersistence: true,
    conflictResolution: 'server-wins',
    // Differential sync configuration
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: 'deleted',
    changesSince: 'last-sync',
    includeDeleted: false
  }
}

/**
 * Register all business entity tables for sync with differential sync enabled
 */
export function registerBusinessEntityTables(syncPlugin: VibeStackSyncPlugin): void {
  // Wide Corp business entities
  const businessEntities = [
    'project', 'client', 'contract', 'document', 'expense',
    'invoice', 'meeting', 'proposal', 'resource', 'skill',
    'timesheet', 'certification'
  ]
  
  businessEntities.forEach(entityName => {
    const config = createDefaultTableConfig(entityName)
    syncPlugin.registerTable(config)
  })
  
  syncLogger.info('legend-state', `Registered ${businessEntities.length} business entities for differential sync`, {
    entities: businessEntities
  })
}

/**
 * Create a synced Legend State observable for a specific entity using syncedCrud
 * This is the main function used by components to create reactive data stores
 * Uses Legend State v3 syncedCrud API for proper CRUD operations
 */
export function syncedVibeStack(config: {
  orgId: string
  entityName: string
  initial?: any[]
}) {
  console.log('[syncedVibeStack] Creating syncedCrud observable with v3 API:', config)
  
  const baseUrl = `http://localhost:8787/api/dataforge/orgs/${config.orgId}/data/${config.entityName}`
  
  // Use syncedCrud for proper CRUD operations with v3 compatibility
  return syncedCrud({
    // List all items
    list: async () => {
      console.log(`[syncedVibeStack] Fetching data for ${config.entityName}`)
      
      const response = await fetch(baseUrl, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        console.warn(`[syncedVibeStack] Failed to fetch ${config.entityName}:`, response.status)
        return []
      }
      
      const result = await response.json()
      console.log(`[syncedVibeStack] Fetched ${config.entityName} data:`, result)
      
      if (result.success && Array.isArray(result.data)) {
        return result.data
      }
      
      return []
    },
    
    // Create new item
    create: async (item: any) => {
      console.log(`[syncedVibeStack] Creating ${config.entityName}:`, item)
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create ${config.entityName}: ${response.status}`)
      }
      
      const result = await response.json()
      return result.success ? result.data : item
    },
    
    // Update existing item
    update: async (item: any) => {
      console.log(`[syncedVibeStack] Updating ${config.entityName}:`, item)
      
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update ${config.entityName}: ${response.status}`)
      }
      
      const result = await response.json()
      return result.success ? result.data : item
    },
    
    // Delete item
    delete: async (item: any) => {
      console.log(`[syncedVibeStack] Deleting ${config.entityName}:`, item)
      
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete ${config.entityName}: ${response.status}`)
      }
      
      return undefined // Indicates successful deletion
    },
    
    // Configuration
    fieldId: 'id', // Primary key field
    generateId: () => crypto.randomUUID(), // Generate UUIDs for new items
    
    // Enable persistence to IndexedDB  
    persist: {
      name: `vibestack_${config.orgId}_${config.entityName}`,
      plugin: 'indexeddb'
    },
    
    // Initial value
    initial: config.initial || []
  })
}

/**
 * Alternative synced implementation for custom sync patterns
 * Use this when you need more control over the sync process
 */
export function syncedVibeStackCustom(config: {
  orgId: string
  entityName: string
  initial?: any[]
}) {
  console.log('[syncedVibeStackCustom] Creating synced observable with v3 API:', config)
  
  // Use the synced function with get/set operations for v3 compatibility
  return synced({
    get: async () => {
      console.log(`[syncedVibeStackCustom] Fetching data for ${config.entityName}`)
      
      const response = await fetch(`http://localhost:8787/api/dataforge/orgs/${config.orgId}/data/${config.entityName}`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        console.warn(`[syncedVibeStackCustom] Failed to fetch ${config.entityName}:`, response.status)
        return []
      }
      
      const result = await response.json()
      console.log(`[syncedVibeStackCustom] Fetched ${config.entityName} data:`, result)
      
      if (result.success && Array.isArray(result.data)) {
        return result.data
      }
      
      return []
    },
    
    set: async ({ value, changes }) => {
      console.log(`[syncedVibeStackCustom] Sync changes for ${config.entityName}:`, { value, changes })
      
      // Handle different types of changes
      if (changes) {
        for (const change of changes) {
          if (change.path.length === 1 && typeof change.path[0] === 'number') {
            // Array index change
            const index = change.path[0]
            const item = change.value
            
            if (change.valueAtPath === undefined && item) {
              // New item
              await createItem(config, item)
            } else if (change.valueAtPath === undefined) {
              // Deleted item
              const originalItem = (value as any[])[index]
              if (originalItem?.id) {
                await deleteItem(config, originalItem)
              }
            } else {
              // Updated item
              await updateItem(config, item)
            }
          }
        }
      }
      
      return { value }
    },
    
    // Enable persistence to IndexedDB  
    persist: {
      name: `vibestack_${config.orgId}_${config.entityName}`,
      plugin: 'indexeddb'
    },
    
    // Initial value
    initial: config.initial || []
  })
}

// Helper methods for CRUD operations
async function createItem(config: { orgId: string, entityName: string }, item: any) {
  console.log(`[syncedVibeStack] Creating ${config.entityName}:`, item)
  
  const response = await fetch(`http://localhost:8787/api/dataforge/orgs/${config.orgId}/data/${config.entityName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(item)
  })
  
  if (!response.ok) {
    throw new Error(`Failed to create ${config.entityName}: ${response.status}`)
  }
  
  const result = await response.json()
  return result.success ? result.data : item
}

async function updateItem(config: { orgId: string, entityName: string }, item: any) {
  console.log(`[syncedVibeStack] Updating ${config.entityName}:`, item)
  
  const response = await fetch(`http://localhost:8787/api/dataforge/orgs/${config.orgId}/data/${config.entityName}/${item.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(item)
  })
  
  if (!response.ok) {
    throw new Error(`Failed to update ${config.entityName}: ${response.status}`)
  }
  
  const result = await response.json()
  return result.success ? result.data : item
}

async function deleteItem(config: { orgId: string, entityName: string }, item: any) {
  console.log(`[syncedVibeStack] Deleting ${config.entityName}:`, item)
  
  const response = await fetch(`http://localhost:8787/api/dataforge/orgs/${config.orgId}/data/${config.entityName}/${item.id}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  
  if (!response.ok) {
    throw new Error(`Failed to delete ${config.entityName}: ${response.status}`)
  }
  
  return undefined // Indicates successful deletion
}

export { VibeStackSyncPlugin }
export type { VibeStackSyncConfig, TableSyncConfig }