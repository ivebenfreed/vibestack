/**
 * Live Changes Manager
 * 
 * Centralized manager for real-time database changes across all entities.
 * Uses pure XState atoms for all domains - no more mixed Jotai/XState patterns.
 * This centralized approach eliminates the need for individual domain service live changes.
 */

import type { 
  EntityConfig, 
  ChangeEvent, 
  LiveChangesStatus, 
  LiveChangesSubscription,
  LiveChangesError as LiveChangesErrorType
} from '@/types/live-changes'
import { LiveChangesError } from '@/types/live-changes'

// ============================================================================
// HMR-Resistant Singleton LiveChangesManager
// ============================================================================

// Global singleton key for HMR resistance
const GLOBAL_KEY = '__VIBESTACK_LIVE_CHANGES_MANAGER__'

class LiveChangesManager {
  private subscriptions = new Map<string, LiveChangesSubscription>()
  private status: LiveChangesStatus = 'initializing'
  private dataSource: any = null
  private recentChanges = new Map<string, number>() // Track recent changes to prevent duplicates
  private instanceId: string
  private isPaused = false // Flag to pause processing during bulk operations

  constructor() {
    this.instanceId = `LCM_${Math.random().toString(36).substr(2, 9)}`
    console.log(`[LiveChangesManager] Created instance ${this.instanceId}`)
  }

  /**
   * Initialize live changes for all configured entities
   */
  async initialize(entityConfigs: EntityConfig[], sharedDataSource?: any): Promise<void> {
    try {
      console.log(`[LiveChangesManager:${this.instanceId}] Initializing with ${entityConfigs.length} entities...`)
      
      // Check if already initialized
      if (this.status === 'active') {
        console.log(`[LiveChangesManager:${this.instanceId}] Already initialized, skipping`)
        return
      }

      this.status = 'initializing'
      this.dataSource = sharedDataSource

      // Wait for all entities to be set up
      const initialLoadPromises = new Map<string, Promise<void>>()
      
      const setupPromises = entityConfigs.map(config => {
        let resolveInitialLoad!: () => void
        const initialLoadPromise = new Promise<void>(resolve => {
          resolveInitialLoad = resolve
        })
        initialLoadPromises.set(config.entity.name, initialLoadPromise)
        
        return this.setupEntityLiveChanges(config, resolveInitialLoad).catch(error => {
          console.error(`[LiveChangesManager:${this.instanceId}] Failed to setup ${config.entity.name}:`, error)
          // Resolve the promise even on error so we don't hang
          resolveInitialLoad()
        })
      })

      // Wait for all subscriptions to be set up
      await Promise.all(setupPromises)
      
      // Wait for initial data to be loaded for all entities
      await Promise.all(Array.from(initialLoadPromises.values()))

      this.status = 'active'
      console.log(`[LiveChangesManager:${this.instanceId}] ✅ All ${entityConfigs.length} entities initialized successfully`)

    } catch (error) {
      this.status = 'error'
      console.error(`[LiveChangesManager:${this.instanceId}] ❌ Initialization failed:`, error)
      throw error
    }
  }

  /**
   * Set up live changes for a single entity
   */
  private async setupEntityLiveChanges(
    config: EntityConfig, 
    resolveInitialLoad: () => void
  ): Promise<void> {
    const entityName = config.entity.name
    const tableName = config.tableName || config.entity.name.toLowerCase() + 's'
    const primaryKey = config.primaryKey || 'id'

    // Check if already subscribed (HMR protection)
    if (this.subscriptions.has(entityName)) {
      console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: Already subscribed, skipping`)
      resolveInitialLoad()
      return
    }

    try {
      console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: Setting up live changes for table "${tableName}"...`)

      // Create a basic SELECT query for the entity
      const sql = `SELECT * FROM "${tableName}" ORDER BY "${primaryKey}" ASC`
      const params: any[] = []

      // Get PGlite database instance using the same method as other parts of the system
      const { getDatabase } = await import('@/db/db')
      const db = await getDatabase()

      // Verify PGlite live changes API is available
      if (!db.live || !db.live.changes) {
        throw new Error('PGlite live changes API not available - ensure live extension is loaded')
      }

      // Track if we've seen the initial changes
      let hasReceivedInitialChanges = false
      let isInitialLoad = true

      // Set up PGlite live changes
      const result = await db.live.changes(
        sql,
        params,
        primaryKey, // Key column for change tracking
        (changes: ChangeEvent[]) => {
          // 🚫 Skip changes during initial load phase
          if (isInitialLoad) {
            console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: 🚫 Skipping ${changes.length} changes during initial load phase`)
            return
          }
          
          // 🚫 Skip empty change events (common after sync operations)
          if (!changes || changes.length === 0) {
            console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: 🚫 Skipping empty changes event`)
            return
          }
          
          console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: Received ${changes.length} changes`)
          this.processChanges(config, changes, primaryKey)
        }
      )

      // Process initial changes event to determine when ready
      if (result.initialChanges && result.initialChanges.length > 0) {
        console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: 🚫 Skipping ${result.initialChanges.length} initial changes - route loaders handle bulk loading`)
        hasReceivedInitialChanges = true
      } else {
        console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: No initial changes - entity ready immediately`)
        hasReceivedInitialChanges = true
      }

      // Mark initial load as complete immediately after processing initial changes
      if (hasReceivedInitialChanges) {
        isInitialLoad = false
        console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: ✅ Initial load phase complete - live changes now active for real updates`)
        resolveInitialLoad() // Signal this entity is ready
      }

      // Store subscription for cleanup
      this.subscriptions.set(entityName, {
        entityName,
        tableName,
        unsubscribe: result.unsubscribe || (() => Promise.resolve()),
        config
      })

      console.log(`[LiveChangesManager:${this.instanceId}] ✅ ${entityName}: Live changes subscription active`)

    } catch (error) {
      console.error(`[LiveChangesManager:${this.instanceId}] ❌ Failed to setup live changes for ${entityName}:`, error)
      resolveInitialLoad() // Don't block initialization on individual entity failures
      throw error
    }
  }

  /**
   * Process incoming change events for an entity
   */
  private async processChanges(
    config: EntityConfig, 
    changes: ChangeEvent[], 
    primaryKey: string
  ): Promise<void> {
    // Skip processing if paused (e.g., during bulk operations like integrity resets)
    if (this.isPaused) {
      console.log(`[LiveChangesManager:${this.instanceId}] 🚫 Skipping ${changes.length} changes - processing is paused`)
      return
    }

    const entityName = config.entity.name
    const now = Date.now()

    for (const change of changes) {
      try {
        const itemId = change[primaryKey]
        if (!itemId) {
          console.warn(`[LiveChangesManager:${this.instanceId}] ${entityName}: Change missing primary key ${primaryKey}:`, change)
          continue
        }

        // ✅ DUPLICATE DETECTION: Prevent processing the same change multiple times
        const changeKey = `${entityName}:${change.__op__}:${itemId}`
        const lastProcessed = this.recentChanges.get(changeKey)
        const timeSinceLastChange = lastProcessed ? now - lastProcessed : Infinity
        
        // Skip if we processed this exact change within the last 100ms
        if (timeSinceLastChange < 100) {
          console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: ⚠️ Skipping duplicate ${change.__op__} for ${itemId} (${timeSinceLastChange}ms ago)`)
          continue
        }
        
        // Track this change
        this.recentChanges.set(changeKey, now)
        
        console.log(`[LiveChangesManager:${this.instanceId}] ${entityName}: Processing ${change.__op__} for ${itemId}`)

        switch (change.__op__) {
          case 'INSERT':
          case 'UPDATE':
            await this.handleInsertOrUpdate(config, itemId, entityName)
            break

          case 'DELETE':
            await this.handleDelete(config, itemId, entityName)
            break

          default:
            console.warn(`[LiveChangesManager:${this.instanceId}] ${entityName}: Unknown operation ${change.__op__}`)
        }

      } catch (error) {
        console.error(`[LiveChangesManager:${this.instanceId}] ${entityName}: Failed to process change:`, change, error)
        // Continue processing other changes even if one fails
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
   * Handle INSERT/UPDATE by fetching fresh data and updating XState atoms
   */
  private async handleInsertOrUpdate(
    config: EntityConfig, 
    itemId: string, 
    entityName: string
  ): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 100; // Base delay in ms
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Fetch fresh data from database with retry logic for IndexedDB errors
        const repository = this.dataSource.getRepository(config.entity)
        const freshItem = await repository.findOne({ 
          where: { id: itemId },
          relations: this.getEntityRelations(config.entity) 
        })

        if (freshItem) {
          // Update XState atom with fresh data - centralized update
          config.atomActions.updateItem(itemId, freshItem)
          console.log(`[LiveChangesManager:${this.instanceId}] ✅ ${entityName}: Updated XState atom for ${itemId}`)
        } else {
          console.warn(`[LiveChangesManager:${this.instanceId}] ${entityName}: Item ${itemId} not found after INSERT/UPDATE`)
        }
        
        // Success - break out of retry loop
        return;

      } catch (error: any) {
        // Check if this is an IndexedDB ErrnoError 44 (device busy)
        const isIndexedDBBusy = error?.name === 'ErrnoError' && error?.errno === 44;
        const isRetryableError = isIndexedDBBusy || 
          error?.message?.includes('database is locked') ||
          error?.message?.includes('device or resource busy');
        
        if (isRetryableError && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`[LiveChangesManager:${this.instanceId}] ${entityName}: IndexedDB busy (attempt ${attempt}/${maxRetries}) - retrying in ${delay}ms for ${itemId}:`, error?.message || error);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Either not retryable or max retries exceeded
        if (isRetryableError) {
          console.error(`[LiveChangesManager:${this.instanceId}] ${entityName}: IndexedDB busy error persisted after ${maxRetries} attempts for ${itemId}:`, error?.message || error);
        } else {
          console.error(`[LiveChangesManager:${this.instanceId}] ${entityName}: Failed to fetch fresh data for ${itemId}:`, error);
        }
        
        // Don't throw - continue processing other changes
        return;
      }
    }
  }

  /**
   * Handle DELETE by removing item from XState atoms
   */
  private async handleDelete(
    config: EntityConfig, 
    itemId: string, 
    entityName: string
  ): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 50; // Shorter delay for deletes since they're simpler operations
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        config.atomActions.removeItem(itemId)
        console.log(`[LiveChangesManager:${this.instanceId}] ✅ ${entityName}: Removed ${itemId} from XState atoms`)
        return; // Success - exit retry loop
        
      } catch (error: any) {
        // Check if this is an IndexedDB ErrnoError 44 (device busy) or similar
        const isIndexedDBBusy = error?.name === 'ErrnoError' && error?.errno === 44;
        const isRetryableError = isIndexedDBBusy || 
          error?.message?.includes('database is locked') ||
          error?.message?.includes('device or resource busy');
        
        if (isRetryableError && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`[LiveChangesManager:${this.instanceId}] ${entityName}: IndexedDB busy during delete (attempt ${attempt}/${maxRetries}) - retrying in ${delay}ms for ${itemId}:`, error?.message || error);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Either not retryable or max retries exceeded
        if (isRetryableError) {
          console.error(`[LiveChangesManager:${this.instanceId}] ${entityName}: IndexedDB busy error persisted after ${maxRetries} attempts during delete for ${itemId}:`, error?.message || error);
        } else {
          console.error(`[LiveChangesManager:${this.instanceId}] ${entityName}: Failed to remove ${itemId}:`, error);
        }
        
        // Don't throw - continue processing other changes
        return;
      }
    }
  }

  /**
   * Get relations to include when fetching entity data
   * Uses the same relations as initial loading for consistency
   */
  private getEntityRelations(entity: any): string[] {
    const entityName = entity.name?.toLowerCase()
    
    // Use the same relations as initial loading in ensure-loaded.ts
    // This ensures live changes and initial loading are consistent
    switch (entityName) {
      case 'task':
        return ['project', 'assignee', 'status'] // Matches ensureTasksLoaded
      case 'project':
        return ['owner', 'members'] // Matches ensureProjectsLoaded - FIXED: was missing 'members'
      case 'comment':
        return ['author', 'task', 'project'] // Matches ensureCommentsLoaded
      case 'user':
        return [] // Matches ensureUsersLoaded (no relations)
      default:
        return []
    }
  }

  /**
   * Pause live changes processing (e.g., during bulk operations)
   */
  pause(): void {
    this.isPaused = true
    console.log(`[LiveChangesManager:${this.instanceId}] ⏸️ Live changes processing paused`)
  }

  /**
   * Resume live changes processing
   */
  resume(): void {
    this.isPaused = false
    console.log(`[LiveChangesManager:${this.instanceId}] ▶️ Live changes processing resumed`)
  }

  /**
   * Check if live changes processing is currently paused
   */
  isPausedState(): boolean {
    return this.isPaused
  }

  /**
   * Stop all live changes subscriptions
   */
  async stop(): Promise<void> {
    console.log(`[LiveChangesManager:${this.instanceId}] Stopping all subscriptions...`)
    
    const stopPromises = Array.from(this.subscriptions.values()).map(subscription =>
      subscription.unsubscribe().catch(error => 
        console.error(`[LiveChangesManager:${this.instanceId}] Failed to unsubscribe from ${subscription.entityName}:`, error)
      )
    )
    
    await Promise.all(stopPromises)
    this.subscriptions.clear()
    this.status = 'stopped'
    
    console.log(`[LiveChangesManager:${this.instanceId}] ✅ All subscriptions stopped`)
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
}

// ============================================================================
// HMR-Resistant Singleton Export
// ============================================================================

function createOrGetSingleton(): LiveChangesManager {
  // Use globalThis to store the singleton across HMR reloads
  const globalStore = globalThis as any
  
  if (!globalStore[GLOBAL_KEY]) {
    console.log('[LiveChangesManager] Creating new HMR-resistant singleton')
    globalStore[GLOBAL_KEY] = new LiveChangesManager()
  } else {
    console.log('[LiveChangesManager] Using existing HMR-resistant singleton')
  }
  
  return globalStore[GLOBAL_KEY]
}

// Export the singleton instance
export const liveChangesManager = createOrGetSingleton()

// HMR cleanup: Stop the old instance when this module is replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[LiveChangesManager] HMR: Disposing current instance')
    // Don't stop the singleton - let it persist across HMR
  })
}

// Debug helper
if (typeof window !== 'undefined') {
  (window as any).liveChangesManager = liveChangesManager
  ;(window as any).debugLiveChanges = () => liveChangesManager.getStats()
} 