/**
 * VibeStack Legend State Integration
 * 
 * Complete integration system that combines:
 * - VibeStack Sync Plugin
 * - Entity Store Manager
 * - Sync Adapter
 * - Persistence Manager
 * 
 * Provides a single initialization point and unified API for the entire sync system.
 */

import { syncLogger } from '../utils/SyncLogger'
import { 
  initializeVibeStackSync, 
  createDefaultSyncConfig,
  type VibeStackSyncConfig,
  type VibeStackSyncPlugin 
} from './VibeStackSyncPlugin'
import { 
  initializeEntityStores, 
  getEntityStores,
  resetEntityStores,
  type EntityStoreManager 
} from './stores/EntityStores'
import { 
  initializeSyncAdapter, 
  getSyncAdapter,
  resetSyncAdapter,
  type SyncAdapter,
  type SyncAdapterConfig 
} from './adapters/SyncAdapter'

export interface VibeStackIntegrationConfig {
  organizationId: string
  userId: string
  serverBaseUrl?: string
  webSocketUrl?: string
  enableOptimisticUpdates?: boolean
  enablePersistence?: boolean
  debugMode?: boolean
  retryAttempts?: number
  retryDelayMs?: number
}

export interface VibeStackIntegrationStatus {
  isInitialized: boolean
  organizationId: string
  userId: string
  syncPlugin: any
  storeManager: any
  syncAdapter: any
  stats: {
    totalEntities: number
    registeredTables: string[]
    syncStatus: string
  }
}

export class VibeStackLegendStateIntegration {
  private config: VibeStackIntegrationConfig
  private syncPlugin: VibeStackSyncPlugin | null = null
  private storeManager: EntityStoreManager | null = null
  private syncAdapter: SyncAdapter | null = null
  private isInitialized = false
  
  constructor(config: VibeStackIntegrationConfig) {
    this.config = {
      serverBaseUrl: 'http://localhost:8787',
      webSocketUrl: `ws://localhost:8787/api/org-actor/${config.organizationId}/websocket`,
      enableOptimisticUpdates: true,
      enablePersistence: true,
      debugMode: true,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...config
    }
    
    syncLogger.info('integration', 'VibeStack Legend State Integration created', { 
      config: this.config 
    })
  }
  
  /**
   * Initialize the complete integration system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      syncLogger.warn('integration', 'Integration already initialized')
      return
    }
    
    try {
      syncLogger.info('integration', '🚀 Starting VibeStack Legend State Integration...')
      
      // Step 1: Initialize Sync Plugin
      await this.initializeSyncPlugin()
      
      // Step 2: Initialize Entity Store Manager
      await this.initializeStoreManager()
      
      // Step 3: Initialize Sync Adapter
      await this.initializeSyncAdapter()
      
      this.isInitialized = true
      
      const status = this.getStatus()
      syncLogger.info('integration', '✅ VibeStack Legend State Integration initialized successfully', {
        status
      })
      
      // Log summary
      console.log('🎯 [VibeStack Legend State] Integration Complete!', {
        organizationId: this.config.organizationId,
        totalEntities: status.stats.totalEntities,
        registeredTables: status.stats.registeredTables,
        features: {
          realTimeSync: true,
          persistence: this.config.enablePersistence,
          optimisticUpdates: this.config.enableOptimisticUpdates,
          conflictResolution: true
        }
      })
      
    } catch (error) {
      syncLogger.error('integration', 'Failed to initialize VibeStack Legend State Integration', { error })
      await this.cleanup()
      throw error
    }
  }
  
  /**
   * Initialize the sync plugin
   */
  private async initializeSyncPlugin(): Promise<void> {
    syncLogger.info('integration', '1️⃣ Initializing Sync Plugin...')
    
    const syncConfig = createDefaultSyncConfig(
      this.config.organizationId,
      this.config.userId
    )
    
    // Override with custom config
    if (this.config.serverBaseUrl) syncConfig.serverBaseUrl = this.config.serverBaseUrl
    if (this.config.webSocketUrl) syncConfig.webSocketUrl = this.config.webSocketUrl
    if (this.config.debugMode !== undefined) syncConfig.debugMode = this.config.debugMode
    if (this.config.enableOptimisticUpdates !== undefined) {
      syncConfig.enableOptimisticUpdates = this.config.enableOptimisticUpdates
    }
    
    this.syncPlugin = initializeVibeStackSync(syncConfig)
    await this.syncPlugin.initialize()
    
    syncLogger.info('integration', '✅ Sync Plugin initialized')
  }
  
  /**
   * Initialize entity store manager
   */
  private async initializeStoreManager(): Promise<void> {
    syncLogger.info('integration', '2️⃣ Initializing Entity Store Manager...')
    
    this.storeManager = initializeEntityStores(
      this.config.organizationId,
      this.config.userId
    )
    
    await this.storeManager.initialize()
    
    syncLogger.info('integration', '✅ Entity Store Manager initialized')
  }
  
  /**
   * Initialize sync adapter
   */
  private async initializeSyncAdapter(): Promise<void> {
    syncLogger.info('integration', '3️⃣ Initializing Sync Adapter...')
    
    const adapterConfig: SyncAdapterConfig = {
      organizationId: this.config.organizationId,
      userId: this.config.userId,
      serverBaseUrl: this.config.serverBaseUrl!,
      enableOptimisticUpdates: this.config.enableOptimisticUpdates!,
      retryAttempts: this.config.retryAttempts!,
      retryDelayMs: this.config.retryDelayMs!
    }
    
    this.syncAdapter = initializeSyncAdapter(adapterConfig)
    await this.syncAdapter.start()
    
    syncLogger.info('integration', '✅ Sync Adapter initialized')
  }
  
  /**
   * Get entity stores for use in components
   */
  public getEntityStores(): EntityStoreManager | null {
    return this.storeManager
  }
  
  /**
   * Get sync adapter for manual operations
   */
  public getSyncAdapter(): SyncAdapter | null {
    return this.syncAdapter
  }
  
  /**
   * Manually refresh data for a specific table
   */
  public async refreshTable(tableName: string): Promise<void> {
    if (!this.syncAdapter) {
      throw new Error('Sync adapter not initialized')
    }
    
    await this.syncAdapter.refreshTableData(tableName)
  }
  
  /**
   * Manually refresh all tables (BATCHED - reduces server load)
   */
  public async refreshAllTables(): Promise<void> {
    if (!this.storeManager || !this.syncAdapter) {
      throw new Error('Integration not fully initialized')
    }
    
    const stores = this.storeManager.getStores()
    const tableNames = Object.keys(stores)
    
    syncLogger.info('integration', '🔄 Batching refresh for all tables...', { 
      tableCount: tableNames.length,
      tables: tableNames 
    })
    
    // Use batched refresh to prevent server overload
    // All table refreshes will be batched together with 50ms debounce
    const refreshPromises = tableNames.map(tableName => 
      this.syncAdapter!.refreshTableData(tableName)
    )
    
    try {
      await Promise.allSettled(refreshPromises)
      syncLogger.info('integration', '✅ All tables refresh completed')
    } catch (error) {
      syncLogger.error('integration', 'Failed to refresh all tables', { error })
    }
  }
  
  /**
   * Get integration status
   */
  public getStatus(): VibeStackIntegrationStatus {
    const storeStats = this.storeManager?.getStats()
    const syncStatus = this.syncAdapter?.getStatus()
    
    return {
      isInitialized: this.isInitialized,
      organizationId: this.config.organizationId,
      userId: this.config.userId,
      syncPlugin: this.syncPlugin?.getSyncStatus(),
      storeManager: storeStats,
      syncAdapter: syncStatus,
      stats: {
        totalEntities: storeStats?.totalEntities || 0,
        registeredTables: Object.keys(storeStats?.stores || {}),
        syncStatus: syncStatus?.isActive ? 'active' : 'inactive'
      }
    }
  }
  
  /**
   * Cleanup integration (useful for logout or component unmount)
   */
  public async cleanup(): Promise<void> {
    syncLogger.info('integration', '🧹 Cleaning up VibeStack Legend State Integration...')
    
    try {
      if (this.syncAdapter) {
        this.syncAdapter.stop()
      }
      
      resetSyncAdapter()
      resetEntityStores()
      
      this.syncPlugin = null
      this.storeManager = null
      this.syncAdapter = null
      this.isInitialized = false
      
      syncLogger.info('integration', '✅ Integration cleanup completed')
      
    } catch (error) {
      syncLogger.error('integration', 'Error during cleanup', { error })
      throw error
    }
  }
}

// ============ Global Integration Instance ============

let globalIntegration: VibeStackLegendStateIntegration | null = null

/**
 * Initialize global VibeStack Legend State integration
 */
export async function initializeVibeStackLegendState(
  config: VibeStackIntegrationConfig
): Promise<VibeStackLegendStateIntegration> {
  if (globalIntegration) {
    syncLogger.warn('integration', 'Global integration already exists, cleaning up previous instance')
    await globalIntegration.cleanup()
  }
  
  globalIntegration = new VibeStackLegendStateIntegration(config)
  await globalIntegration.initialize()
  
  return globalIntegration
}

/**
 * Get global integration instance
 */
export function getVibeStackLegendState(): VibeStackLegendStateIntegration | null {
  return globalIntegration
}

/**
 * Cleanup global integration
 */
export async function cleanupVibeStackLegendState(): Promise<void> {
  if (globalIntegration) {
    await globalIntegration.cleanup()
    globalIntegration = null
  }
}

// ============ React Hook for Easy Integration ============

/**
 * React hook for using VibeStack Legend State integration
 */
export function useVibeStackLegendState() {
  const integration = getVibeStackLegendState()
  
  if (!integration) {
    throw new Error('VibeStack Legend State integration not initialized. Call initializeVibeStackLegendState first.')
  }
  
  return {
    integration,
    stores: integration.getEntityStores(),
    syncAdapter: integration.getSyncAdapter(),
    status: integration.getStatus(),
    refreshTable: integration.refreshTable.bind(integration),
    refreshAllTables: integration.refreshAllTables.bind(integration)
  }
}

export type { VibeStackIntegrationConfig, VibeStackIntegrationStatus }