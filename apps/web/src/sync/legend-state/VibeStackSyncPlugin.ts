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

import { configureObservablePersistence, type ObservablePersistPlugin } from '@legendapp/state/persist'
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
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
      // Configure Legend State persistence globally
      configureObservablePersistence({
        pluginLocal: this.persistencePlugin
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
    
    return ObservablePersistIndexedDB({
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
    webSocketUrl: 'ws://localhost:8787/websocket',
    indexedDbName: 'vibestack',
    indexedDbVersion: 1,
    enableOptimisticUpdates: true,
    retryAttempts: 3,
    retryDelayMs: 1000,
    debugMode: true
  }
}

export { VibeStackSyncPlugin }
export type { VibeStackSyncConfig, TableSyncConfig }