/**
 * Sync Adapter for VibeStack Legend State Integration
 * 
 * Bridges WebSocket table change notifications with Legend State observable stores.
 * Handles data fetching, conflict resolution, and optimistic updates.
 */

import { syncLogger } from '../../utils/SyncLogger'
import { getEntityStores, type EntityCollections, type BaseEntity } from '../stores/EntityStores'
import { getVibeStackSync } from '../VibeStackSyncPlugin'

export interface SyncAdapterConfig {
  organizationId: string
  userId: string
  serverBaseUrl: string
  enableOptimisticUpdates: boolean
  retryAttempts: number
  retryDelayMs: number
}

export interface TableChangeNotification {
  tables: string[]
  organizationId: string
  lsn: string
  source: string
  messageId: string
  timestamp: number
}

export class SyncAdapter {
  private config: SyncAdapterConfig
  private isActive = false
  private pendingRequests = new Map<string, Promise<any>>()
  private batchTimeout: NodeJS.Timeout | null = null
  private pendingBatchTables = new Set<string>()
  
  constructor(config: SyncAdapterConfig) {
    this.config = config
    
    syncLogger.info('sync-adapter', 'SyncAdapter created', { config })
  }
  
  /**
   * Start the sync adapter and set up event listeners
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      syncLogger.warn('sync-adapter', 'SyncAdapter already active')
      return
    }
    
    try {
      // Listen for table change notifications
      this.setupTableChangeListener()
      
      this.isActive = true
      syncLogger.info('sync-adapter', '🚀 SyncAdapter started successfully')
      
    } catch (error) {
      syncLogger.error('sync-adapter', 'Failed to start SyncAdapter', { error })
      throw error
    }
  }
  
  /**
   * Stop the sync adapter
   */
  public stop(): void {
    this.isActive = false
    this.pendingRequests.clear()
    this.pendingBatchTables.clear()
    
    // Clear batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    
    // Remove event listeners
    window.removeEventListener('vibestack:table-change-notification', this.handleTableChangeNotification)
    
    syncLogger.info('sync-adapter', '🛑 SyncAdapter stopped')
  }
  
  /**
   * Set up table change notification listener
   */
  private setupTableChangeListener(): void {
    window.addEventListener('vibestack:table-change-notification', this.handleTableChangeNotification.bind(this))
    syncLogger.debug('sync-adapter', 'Table change notification listener set up')
  }
  
  /**
   * Handle table change notification from WebSocket
   */
  private async handleTableChangeNotification(event: CustomEvent): Promise<void> {
    if (!this.isActive) return
    
    const notification: TableChangeNotification = event.detail
    
    syncLogger.info('sync-adapter', '🔔 Processing table change notification', {
      tables: notification.tables,
      organizationId: notification.organizationId,
      lsn: notification.lsn,
      messageId: notification.messageId
    })
    
    // Only process notifications for our organization
    if (notification.organizationId !== this.config.organizationId) {
      syncLogger.debug('sync-adapter', 'Ignoring notification for different organization', {
        notificationOrgId: notification.organizationId,
        currentOrgId: this.config.organizationId
      })
      return
    }
    
    // Process each table change
    for (const tableName of notification.tables) {
      await this.refreshTableData(tableName, notification)
    }
  }
  
  /**
   * Refresh data for a specific table with batching to prevent spam
   */
  public async refreshTableData(tableName: string, notification?: TableChangeNotification): Promise<void> {
    const storeManager = getEntityStores()
    if (!storeManager) {
      syncLogger.error('sync-adapter', 'EntityStoreManager not found')
      return
    }
    
    // Check if we have a pending request for this table
    const requestKey = `refresh_${tableName}`
    if (this.pendingRequests.has(requestKey)) {
      syncLogger.debug('sync-adapter', `Refresh already in progress for table: ${tableName}`)
      return this.pendingRequests.get(requestKey)
    }
    
    // Add to batch instead of immediate execution
    this.pendingBatchTables.add(tableName)
    
    // Debounce batch execution (50ms delay to collect multiple table changes)
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }
    
    this.batchTimeout = setTimeout(() => {
      this.executeBatchRefresh()
    }, 50)
  }
  
  /**
   * Execute batched table refreshes
   */
  private async executeBatchRefresh(): Promise<void> {
    if (this.pendingBatchTables.size === 0) return
    
    const tablesToRefresh = Array.from(this.pendingBatchTables)
    this.pendingBatchTables.clear()
    this.batchTimeout = null
    
    syncLogger.info('sync-adapter', `🔄 Executing batch refresh for tables:`, {
      tables: tablesToRefresh,
      count: tablesToRefresh.length
    })
    
    const storeManager = getEntityStores()
    if (!storeManager) {
      syncLogger.error('sync-adapter', 'EntityStoreManager not found for batch refresh')
      return
    }
    
    // Execute all refreshes in parallel
    const refreshPromises = tablesToRefresh.map(async (tableName) => {
      const requestKey = `refresh_${tableName}`
      
      try {
        const refreshPromise = this.performTableRefresh(tableName, storeManager)
        this.pendingRequests.set(requestKey, refreshPromise)
        
        await refreshPromise
        syncLogger.debug('sync-adapter', `✅ Batch refreshed table: ${tableName}`)
        
      } catch (error) {
        syncLogger.error('sync-adapter', `Failed to batch refresh table: ${tableName}`, { error })
        // Try retry logic
        try {
          await this.retryTableRefresh(tableName, storeManager)
        } catch (retryError) {
          syncLogger.error('sync-adapter', `Retry failed for table: ${tableName}`, { error: retryError })
        }
      } finally {
        this.pendingRequests.delete(requestKey)
      }
    })
    
    await Promise.allSettled(refreshPromises)
    syncLogger.info('sync-adapter', `✅ Batch refresh completed for ${tablesToRefresh.length} tables`)
  }
  
  /**
   * Perform the actual table refresh
   */
  private async performTableRefresh(tableName: string, storeManager: any): Promise<void> {
    // Convert table name to entity name format (capitalize first letter)
    const entityName = tableName.charAt(0).toUpperCase() + tableName.slice(1, -1) // Remove 's' and capitalize
    const apiEndpoint = `${this.config.serverBaseUrl}/api/archetype/orgs/${this.config.organizationId}/data/${entityName}`
    
    syncLogger.debug('sync-adapter', `Fetching data from: ${apiEndpoint}`, {
      tableName,
      entityName
    })
    
    // Make API request with authentication
    const response = await fetch(apiEndpoint, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Update the corresponding store
    await this.updateStore(tableName, data, storeManager)
  }
  
  /**
   * Update store with fresh data from server
   */
  private async updateStore(tableName: string, data: any[], storeManager: any): Promise<void> {
    const stores = storeManager.getStores()
    const store = stores[tableName as keyof EntityCollections]
    
    if (!store) {
      syncLogger.warn('sync-adapter', `Store not found for table: ${tableName}`)
      return
    }
    
    try {
      // Convert array to record keyed by ID
      const dataRecord: Record<string, BaseEntity> = {}
      
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.id) {
            dataRecord[item.id] = item
          }
        }
      }
      
      // Update the store (this will trigger reactivity and persistence)
      store.set(dataRecord)
      
      syncLogger.info('sync-adapter', `Updated store for table: ${tableName}`, {
        recordCount: Object.keys(dataRecord).length
      })
      
    } catch (error) {
      syncLogger.error('sync-adapter', `Failed to update store for table: ${tableName}`, { error })
      throw error
    }
  }
  
  /**
   * Retry table refresh with exponential backoff
   */
  private async retryTableRefresh(tableName: string, storeManager: any): Promise<void> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1)
        
        syncLogger.info('sync-adapter', `Retrying table refresh (${attempt}/${this.config.retryAttempts})`, {
          tableName,
          delay
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
        await this.performTableRefresh(tableName, storeManager)
        
        syncLogger.info('sync-adapter', `✅ Retry successful for table: ${tableName}`)
        return
        
      } catch (error) {
        syncLogger.error('sync-adapter', `Retry ${attempt} failed for table: ${tableName}`, { error })
        
        if (attempt === this.config.retryAttempts) {
          throw new Error(`All retry attempts failed for table: ${tableName}`)
        }
      }
    }
  }
  
  /**
   * Perform optimistic update for an entity
   */
  public async performOptimisticUpdate<T extends BaseEntity>(
    tableName: string,
    operation: 'create' | 'update' | 'delete',
    entityId: string,
    data?: Partial<T>
  ): Promise<void> {
    if (!this.config.enableOptimisticUpdates) {
      syncLogger.debug('sync-adapter', 'Optimistic updates disabled, skipping')
      return
    }
    
    const storeManager = getEntityStores()
    if (!storeManager) {
      syncLogger.error('sync-adapter', 'EntityStoreManager not found for optimistic update')
      return
    }
    
    try {
      syncLogger.info('sync-adapter', '⚡ Performing optimistic update', {
        tableName,
        operation,
        entityId
      })
      
      switch (operation) {
        case 'create':
          if (data) {
            await storeManager.addEntity(tableName as keyof EntityCollections, data)
          }
          break
          
        case 'update':
          if (data) {
            await storeManager.updateEntity(tableName as keyof EntityCollections, entityId, data)
          }
          break
          
        case 'delete':
          await storeManager.deleteEntity(tableName as keyof EntityCollections, entityId)
          break
      }
      
      syncLogger.info('sync-adapter', '✅ Optimistic update completed')
      
    } catch (error) {
      syncLogger.error('sync-adapter', 'Optimistic update failed', {
        tableName,
        operation,
        entityId,
        error
      })
      
      // Revert optimistic update by refreshing table data
      await this.refreshTableData(tableName)
    }
  }
  
  /**
   * Handle conflict resolution when server data differs from local optimistic updates
   */
  private async handleConflict(tableName: string, entityId: string, serverData: any, localData: any): Promise<void> {
    syncLogger.warn('sync-adapter', 'Data conflict detected', {
      tableName,
      entityId,
      serverData,
      localData
    })
    
    const syncPlugin = getVibeStackSync()
    if (!syncPlugin) {
      syncLogger.error('sync-adapter', 'SyncPlugin not available for conflict resolution')
      return
    }
    
    const tableConfig = syncPlugin.getTableConfig(tableName)
    if (!tableConfig) {
      syncLogger.error('sync-adapter', `Table config not found for: ${tableName}`)
      return
    }
    
    // Apply conflict resolution strategy
    switch (tableConfig.conflictResolution) {
      case 'server-wins':
        syncLogger.info('sync-adapter', 'Resolving conflict: server wins', { tableName, entityId })
        // Server data will overwrite local data (default behavior)
        break
        
      case 'client-wins':
        syncLogger.info('sync-adapter', 'Resolving conflict: client wins', { tableName, entityId })
        // TODO: Send local data to server to overwrite
        break
        
      case 'last-write-wins':
        syncLogger.info('sync-adapter', 'Resolving conflict: last write wins', { tableName, entityId })
        // Compare timestamps and keep the most recent
        const serverTimestamp = new Date(serverData.updated_at || 0).getTime()
        const localTimestamp = new Date(localData.updated_at || 0).getTime()
        
        if (localTimestamp > serverTimestamp) {
          // TODO: Send local data to server
          syncLogger.info('sync-adapter', 'Local data is newer, updating server')
        } else {
          syncLogger.info('sync-adapter', 'Server data is newer, keeping server version')
        }
        break
    }
  }
  
  /**
   * Get sync adapter status
   */
  public getStatus() {
    return {
      isActive: this.isActive,
      organizationId: this.config.organizationId,
      userId: this.config.userId,
      pendingRequests: Array.from(this.pendingRequests.keys()),
      config: this.config
    }
  }
}

// ============ Global Sync Adapter ============

let globalSyncAdapter: SyncAdapter | null = null

/**
 * Initialize global sync adapter
 */
export function initializeSyncAdapter(config: SyncAdapterConfig): SyncAdapter {
  if (globalSyncAdapter) {
    syncLogger.warn('sync-adapter', 'SyncAdapter already exists, stopping previous instance')
    globalSyncAdapter.stop()
  }
  
  globalSyncAdapter = new SyncAdapter(config)
  return globalSyncAdapter
}

/**
 * Get global sync adapter
 */
export function getSyncAdapter(): SyncAdapter | null {
  return globalSyncAdapter
}

/**
 * Reset global sync adapter
 */
export function resetSyncAdapter(): void {
  if (globalSyncAdapter) {
    globalSyncAdapter.stop()
  }
  globalSyncAdapter = null
  syncLogger.info('sync-adapter', 'Global sync adapter reset')
}