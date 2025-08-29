/**
 * Live Changes Service
 * 
 * Event-driven service for handling PGLite live changes.
 * Follows the same patterns as WebSocketService, IncomingChangeService, etc.
 * Uses callback-based communication to avoid circular dependencies.
 */

import type { 
  EntityConfig, 
  ChangeEvent, 
  LiveChangesError as LiveChangesErrorType
} from '@/types/live-changes'
import { LiveChangesError } from '@/types/live-changes'

export interface LiveChangesServiceCallbacks {
  onChangeReceived?: (entityType: string, changeType: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  onError?: (error: Error, context?: string) => void;
  onStatusChange?: (status: 'initializing' | 'active' | 'paused' | 'stopped' | 'error') => void;
}

export class LiveChangesService {
  private subscriptions = new Map<string, any>()
  private status: 'initializing' | 'active' | 'paused' | 'stopped' | 'error' = 'stopped'
  private callbacks: LiveChangesServiceCallbacks = {}
  private recentChanges = new Map<string, number>() // Track recent changes to prevent duplicates
  private isPaused = false
  private dataSource: any = null
  private instanceId: string

  constructor() {
    this.instanceId = `LCS_${Math.random().toString(36).substr(2, 9)}`
    console.log(`[LiveChangesService] Created instance ${this.instanceId}`)
  }

  /**
   * Initialize the service with entity configurations and callbacks
   */
  async initialize(
    entityConfigs: EntityConfig[], 
    dataSource: any,
    callbacks: LiveChangesServiceCallbacks
  ): Promise<void> {
    try {
      console.log(`[LiveChangesService:${this.instanceId}] Initializing with ${entityConfigs.length} entities...`)
      
      if (this.status === 'active') {
        console.log(`[LiveChangesService:${this.instanceId}] Already initialized, skipping`)
        return
      }

      this.status = 'initializing'
      this.callbacks = callbacks
      this.dataSource = dataSource
      this.notifyStatusChange('initializing')

      // Set up all entity subscriptions
      const setupPromises = entityConfigs.map(config => 
        this.setupEntityLiveChanges(config).catch(error => {
          console.error(`[LiveChangesService:${this.instanceId}] Failed to setup ${config.entity.name}:`, error)
          this.notifyError(error, `setup_${config.entity.name}`)
        })
      )

      await Promise.all(setupPromises)

      this.status = 'active'
      this.notifyStatusChange('active')
      console.log(`[LiveChangesService:${this.instanceId}] ✅ All ${entityConfigs.length} entities initialized successfully`)

    } catch (error) {
      this.status = 'error'
      this.notifyStatusChange('error')
      this.notifyError(error as Error, 'initialization')
      throw error
    }
  }

  /**
   * Set up live changes for a single entity using PGLite live changes API
   */
  private async setupEntityLiveChanges(config: EntityConfig): Promise<void> {
    const entityName = config.entity.name
    const tableName = config.tableName || config.entity.name.toLowerCase() + 's'
    const primaryKey = config.primaryKey || 'id'

    // Check if already subscribed
    if (this.subscriptions.has(entityName)) {
      console.log(`[LiveChangesService:${this.instanceId}] ${entityName}: Already subscribed, skipping`)
      return
    }

    try {
      console.log(`[LiveChangesService:${this.instanceId}] ${entityName}: Setting up live changes for table "${tableName}"...`)

      // Create a basic SELECT query for the entity
      const sql = `SELECT * FROM "${tableName}" ORDER BY "${primaryKey}" ASC`
      const params: any[] = []

      // Get PGlite database instance
      const { getDatabase } = await import('@/db/db')
      const db = await getDatabase()

      // Verify PGlite live changes API is available
      if (!db.live || !db.live.changes) {
        throw new Error('PGlite live changes API not available - ensure live extension is loaded')
      }

      // Set up PGlite live changes with proper callback handling
      const result = await db.live.changes(
        sql,
        params,
        primaryKey,
        (changes: ChangeEvent[]) => {
          // Skip changes if paused
          if (this.isPaused) {
            console.log(`[LiveChangesService:${this.instanceId}] ${entityName}: 🚫 Skipping ${changes.length} changes - service is paused`)
            return
          }
          
          console.log(`[LiveChangesService:${this.instanceId}] ${entityName}: Received ${changes.length} changes`)
          this.processChanges(config, changes, primaryKey)
        }
      )

      // Handle initial changes - skip them as route loaders handle bulk loading
      if (result.initialChanges && result.initialChanges.length > 0) {
        console.log(`[LiveChangesService:${this.instanceId}] ${entityName}: 🚫 Skipping ${result.initialChanges.length} initial changes - route loaders handle bulk loading`)
      }

      // Store subscription for cleanup
      this.subscriptions.set(entityName, {
        entityName,
        tableName,
        unsubscribe: result.unsubscribe || (() => Promise.resolve()),
        config
      })

      console.log(`[LiveChangesService:${this.instanceId}] ✅ ${entityName}: Live changes subscription active`)

    } catch (error) {
      console.error(`[LiveChangesService:${this.instanceId}] ❌ Failed to setup live changes for ${entityName}:`, error)
      this.notifyError(error as Error, `setup_${entityName}`)
      throw error
    }
  }

  /**
   * Process incoming change events for an entity
   */
  private processChanges(
    config: EntityConfig, 
    changes: ChangeEvent[], 
    primaryKey: string
  ): void {
    const entityName = config.entity.name
    const now = Date.now()

    for (const change of changes) {
      try {
        const itemId = change[primaryKey]
        if (!itemId) {
          console.warn(`[LiveChangesService:${this.instanceId}] ${entityName}: Change missing primary key ${primaryKey}:`, change)
          continue
        }

        // ✅ DUPLICATE DETECTION: Prevent processing the same change multiple times
        const changeKey = `${entityName}:${change.__op__}:${itemId}`
        const lastProcessed = this.recentChanges.get(changeKey)
        const timeSinceLastChange = lastProcessed ? now - lastProcessed : Infinity
        
        // Skip if we processed this exact change within the last 100ms
        if (timeSinceLastChange < 100) {
          console.log(`[LiveChangesService:${this.instanceId}] ${entityName}: ⚠️ Skipping duplicate ${change.__op__} for ${itemId} (${timeSinceLastChange}ms ago)`)
          continue
        }
        
        // Track this change
        this.recentChanges.set(changeKey, now)
        
        console.log(`[LiveChangesService:${this.instanceId}] ${entityName}: Processing ${change.__op__} for ${itemId}`)

        // Notify via callback instead of handling directly
        this.notifyChangeReceived(entityName, change.__op__ as 'INSERT' | 'UPDATE' | 'DELETE', {
          id: itemId,
          change,
          config
        })

      } catch (error) {
        console.error(`[LiveChangesService:${this.instanceId}] ${entityName}: Failed to process change:`, change, error)
        this.notifyError(error as Error, `process_change_${entityName}`)
      }
    }
    
    // ✅ CLEANUP: Remove old entries from recentChanges to prevent memory leak
    if (this.recentChanges.size > 1000) {
      const cutoff = now - 5000 // Keep last 5 seconds
      for (const [key, timestamp] of this.recentChanges.entries()) {
        if (timestamp < cutoff) {
          this.recentChanges.delete(key)
        }
      }
    }
  }

  /**
   * Pause live changes processing
   */
  pause(): void {
    this.isPaused = true
    this.notifyStatusChange('paused')
    console.log(`[LiveChangesService:${this.instanceId}] ⏸️ Live changes processing paused`)
  }

  /**
   * Resume live changes processing
   */
  resume(): void {
    this.isPaused = false
    this.notifyStatusChange('active')
    console.log(`[LiveChangesService:${this.instanceId}] ▶️ Live changes processing resumed`)
  }

  /**
   * Stop all live changes subscriptions and clean up
   */
  async destroy(): Promise<void> {
    console.log(`[LiveChangesService:${this.instanceId}] Stopping all subscriptions...`)
    
    const stopPromises = Array.from(this.subscriptions.values()).map(subscription =>
      subscription.unsubscribe().catch((error: any) => 
        console.error(`[LiveChangesService:${this.instanceId}] Failed to unsubscribe from ${subscription.entityName}:`, error)
      )
    )
    
    await Promise.all(stopPromises)
    this.subscriptions.clear()
    this.recentChanges.clear()
    this.status = 'stopped'
    this.notifyStatusChange('stopped')
    
    console.log(`[LiveChangesService:${this.instanceId}] ✅ All subscriptions stopped and cleaned up`)
  }

  /**
   * Get current status and statistics
   */
  getStats() {
    return {
      status: this.status,
      subscriptions: this.subscriptions.size,
      recentChanges: this.recentChanges.size,
      instanceId: this.instanceId,
      isPaused: this.isPaused
    }
  }

  // ============================================================================
  // Callback Notification Methods
  // ============================================================================

  private notifyChangeReceived(entityType: string, changeType: 'INSERT' | 'UPDATE' | 'DELETE', data: any): void {
    if (this.callbacks.onChangeReceived) {
      try {
        this.callbacks.onChangeReceived(entityType, changeType, data)
      } catch (error) {
        console.error(`[LiveChangesService:${this.instanceId}] Error in onChangeReceived callback:`, error)
      }
    }
  }

  private notifyError(error: Error, context?: string): void {
    if (this.callbacks.onError) {
      try {
        this.callbacks.onError(error, context)
      } catch (callbackError) {
        console.error(`[LiveChangesService:${this.instanceId}] Error in onError callback:`, callbackError)
      }
    }
  }

  private notifyStatusChange(status: 'initializing' | 'active' | 'paused' | 'stopped' | 'error'): void {
    if (this.callbacks.onStatusChange) {
      try {
        this.callbacks.onStatusChange(status)
      } catch (error) {
        console.error(`[LiveChangesService:${this.instanceId}] Error in onStatusChange callback:`, error)
      }
    }
  }
} 