/**
 * Dexie Sync Layer
 *
 * Handles background synchronization between Dexie cache and DataForge server
 * Implements differential sync and live query subscriptions
 */

import { liveQuery } from 'dexie'
import { getDexieDB, computeSchemaHash, type EntitySchemas } from './DexieEntityDB'
import { syncNotifications$ } from '../sync-notifications'
import { log } from '@/logger'

const fileLog = log('legend-state/persistence/DexieSyncLayer')

export class DexieSyncLayer {
  private syncInProgress = new Set<string>()
  private liveQuerySubscriptions = new Map<string, any>()
  private isInitialSyncComplete = false
  private isRebuilding = false
  private pendingReads = new Map<string, Promise<any>>()

  /**
   * Initialize with schema change detection
   */
  async initializeWithSchemaCheck(
    userId: string,
    entitySchemas: EntitySchemas
  ): Promise<void> {
    const currentSchemaHash = computeSchemaHash(entitySchemas)
    const storedHash = localStorage.getItem(`dexie_schema_hash_${userId}`)

    // Check if schema changed
    if (currentSchemaHash === storedHash) {
      fileLog.info(`✅ Schema unchanged (${currentSchemaHash.substring(0, 12)}), reusing Dexie DB`)

      // Just open existing DB (already created)
      const dexie = getDexieDB()
      if (!dexie) {
        throw new Error('Dexie DB not initialized')
      }

      // ✅ Mark as ready immediately (tables already exist)
      this.isInitialSyncComplete = true

      // Defer differential sync until browser is idle to avoid blocking UI
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {
          this.performDifferentialSyncOnly(Object.keys(entitySchemas)).catch(error => {
            fileLog.error('❌ Background differential sync failed:', error)
          })
        })
      } else {
        setTimeout(() => {
          this.performDifferentialSyncOnly(Object.keys(entitySchemas)).catch(error => {
            fileLog.error('❌ Background differential sync failed:', error)
          })
        }, 100)
      }

      fileLog.info('✅ Using existing cache, sync deferred')

      return
    }

    fileLog.info(`📝 Schema changed - triggering background rebuild`, {
      oldHash: storedHash?.substring(0, 12),
      newHash: currentSchemaHash.substring(0, 12),
      entityCount: Object.keys(entitySchemas).length
    })

    // ✅ Schema changed - rebuild in BACKGROUND (non-blocking)
    this.rebuildInBackground(userId, entitySchemas, currentSchemaHash).catch(error => {
      fileLog.error('❌ Background rebuild failed:', error)
    })

    // ✅ Mark as complete so app can continue (reads will fall back to API during rebuild)
    this.isInitialSyncComplete = true
    fileLog.info(`✅ Background rebuild started, app continues with API fallback`)
  }

  /**
   * Rebuild Dexie in background (non-blocking, transparent to user)
   */
  private async rebuildInBackground(
    userId: string,
    entitySchemas: EntitySchemas,
    schemaHash: string
  ): Promise<void> {
    this.isRebuilding = true
    fileLog.info(`🔄 Starting background DB rebuild...`)

    try {
      await this.rebuildDexieSchema(userId, entitySchemas, schemaHash)

      fileLog.info(`✅ Background rebuild complete - cache restored`)

      // Trigger UI refresh to switch from API to cache
      window.dispatchEvent(new CustomEvent('elevra:dexie-rebuild-complete'))

    } finally {
      this.isRebuilding = false
      this.pendingReads.clear()
    }
  }

  /**
   * Rebuild Dexie schema (when entities added/removed)
   */
  private async rebuildDexieSchema(
    userId: string,
    entitySchemas: EntitySchemas,
    schemaHash: string
  ): Promise<void> {
    const dbName = `elevra_universe_${userId.replace(/-/g, '_')}`

    // Close existing DB
    const oldDB = getDexieDB()
    if (oldDB) {
      oldDB.close()
    }

    // Delete old DB (clean slate)
    try {
      await Dexie.delete(dbName)
      fileLog.info(`🗑️  Deleted old Dexie DB: ${dbName}`)
    } catch (error) {
      fileLog.warn(`Could not delete old DB (may not exist):`, error)
    }

    // Store new schema hash and schema data in localStorage
    localStorage.setItem(`dexie_schema_hash_${userId}`, schemaHash)

    // Import DB management functions
    const { storeSchemaInLocalStorage, initializeDexieDB } = await import('./DexieEntityDB')
    storeSchemaInLocalStorage(userId, entitySchemas)

    // Recreate Dexie DB with new schema (force recreate to replace singleton)
    const newDB = initializeDexieDB(userId, entitySchemas, true)
    await newDB.open()

    fileLog.info(`✅ Recreated Dexie DB with ${newDB.tables.length} tables`)

    // Perform full initial sync to populate new tables
    const entityTypes = Object.keys(entitySchemas)
    await this.performInitialSync(entityTypes)
  }

  /**
   * Check if currently rebuilding
   */
  isCurrentlyRebuilding(): boolean {
    return this.isRebuilding
  }

  /**
   * Perform initial full sync for all entities
   */
  async performInitialSync(entityTypes: string[]): Promise<void> {
    fileLog.info(`🔄 Initial sync: loading ${entityTypes.length} entities (liveQuery DISABLED)`)

    // Fetch all entities in parallel (liveQuery not active yet)
    const results = await Promise.allSettled(
      entityTypes.map(type => this.syncEntityFromServer(type))
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    this.isInitialSyncComplete = true

    fileLog.info(`✅ Initial sync complete: ${succeeded}/${entityTypes.length} succeeded`, {
      failed,
      totalEntities: entityTypes.length
    })
  }

  /**
   * Perform differential sync only (schema unchanged)
   * Throttled to avoid saturating browser event loop/network
   */
  private async performDifferentialSyncOnly(entityTypes: string[]): Promise<void> {
    fileLog.debug(`🔄 Differential sync: ${entityTypes.length} entities`)

    // Throttle to 5 concurrent syncs to avoid blocking UI
    const BATCH_SIZE = 5;
    const results: PromiseSettledResult<void>[] = [];

    for (let i = 0; i < entityTypes.length; i += BATCH_SIZE) {
      const batch = entityTypes.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(type => this.syncEntityFromServer(type))
      );
      results.push(...batchResults);

      // Yield to browser between batches to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    fileLog.info(`✅ Differential sync complete: ${succeeded}/${entityTypes.length}`)
  }

  /**
   * Sync specific entity from server (differential)
   */
  async syncEntityFromServer(entityType: string): Promise<void> {
    // Prevent concurrent syncs for same entity
    if (this.syncInProgress.has(entityType)) {
      fileLog.debug(`⏳ ${entityType}: Sync already in progress`)
      return
    }

    this.syncInProgress.add(entityType)

    try {
      const dexie = getDexieDB()
      if (!dexie) {
        fileLog.warn(`Dexie not initialized, skipping sync for ${entityType}`)
        return
      }

      // Get sync metadata for differential sync
      const meta = await dexie.getSyncMetadata(entityType)
      const lastSync = meta?.lastSync || 0

      // Parse entity type to get org and base entity name
      const { orgId, tableName } = this.parseEntityType(entityType)

      // ✅ Special handling for User entity (uses /members endpoint)
      const baseUrl = tableName === 'User'
        ? `/api/dataforge/orgs/${orgId}/members`
        : `/api/dataforge/orgs/${orgId}/data/${tableName}`

      // FIXED: Use full entityType (with org prefix) as Dexie table name
      const dexieTableName = entityType

      const diffUrl = lastSync > 0
        ? `${baseUrl}?updated_at[gte]=${lastSync}`
        : baseUrl

      const syncType = lastSync > 0 ? 'differential' : 'full'

      // Fetch from server
      const response = await fetch(diffUrl, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })

      if (!response.ok) {
        fileLog.warn(`⚠️ ${entityType}: API error ${response.status}`)
        return
      }

      const result = await response.json()
      const serverData = result.data || []

      if (serverData.length > 0) {
        fileLog.debug(`📦 [DEXIE-READ] ${entityType}: ${serverData.length} records (${syncType})`)
      }

      // Update Dexie cache (use full entity name with org prefix)
      await dexie.updateFromServer(dexieTableName, serverData)

      // Update sync metadata
      await dexie.updateSyncMetadata(entityType, {
        lastSync: Date.now(),
        recordCount: serverData.length,
        version: (meta?.version || 0) + 1
      })

    } catch (error) {
      fileLog.error(`❌ [DEXIE-SYNC] ${entityType}: Sync failed`, error)
    } finally {
      this.syncInProgress.delete(entityType)
    }
  }

  /**
   * Setup liveQuery subscriptions (AFTER initial sync)
   */
  setupLiveQueries(entityTypes: string[]): void {
    if (!this.isInitialSyncComplete) {
      throw new Error('Cannot setup liveQueries before initial sync completes')
    }

    const dexie = getDexieDB()
    if (!dexie) {
      fileLog.warn('Dexie not initialized, cannot setup liveQueries')
      return
    }

    entityTypes.forEach(entityType => {
      // FIXED: Use full entityType (with org prefix) as Dexie table name
      const dexieTableName = entityType

      try {
        const table = dexie.table(dexieTableName)

        if (!table) {
          fileLog.warn(`Cannot setup liveQuery for ${entityType}: table ${dexieTableName} not found`)
          return
        }

        // Setup liveQuery to watch for Dexie changes
        const subscription = liveQuery(() => table.toArray()).subscribe({
        next: () => {
          // Fire custom event when Dexie data changes
          fileLog.debug(`🔔 [DEXIE-CHANGE] ${entityType}: Data changed in Dexie`)

          window.dispatchEvent(new CustomEvent('elevra:dexie-updated', {
            detail: { entityType }
          }))
        },
          error: (error) => {
            fileLog.error(`❌ [DEXIE-WATCH] ${entityType}: liveQuery error`, error)
          }
        })

        this.liveQuerySubscriptions.set(entityType, subscription)
      } catch (error) {
        fileLog.error(`❌ [DEXIE-WATCH] ${entityType}: Failed to setup liveQuery`, error)
      }
    })

    fileLog.info(`✅ Live queries active for ${entityTypes.length} entities`)
  }

  /**
   * Initialize sync listeners for WebSocket notifications
   */
  initializeSyncListeners(entityTypes: string[]): void {
    entityTypes.forEach(entityType => {
      // Get notification observable for this entity
      const notificationObs$ = syncNotifications$.getNotificationFor(entityType)

      // When server notifies of changes, sync from server
      const unsubscribe = notificationObs$.onChange(async (notification) => {
        if (!notification) return

        // Check if this notification is relevant
        const { tableName } = this.parseEntityType(entityType)
        const relevantTables = notification.tables || []

        if (relevantTables.some((t: string) => t.includes(tableName.toLowerCase()))) {
          fileLog.debug(`🔔 [SERVER-NOTIFY] ${entityType}: Syncing from server`)
          await this.syncEntityFromServer(entityType)
        }
      })

      // Store cleanup function
      this.liveQuerySubscriptions.set(`${entityType}_notification`, unsubscribe)
    })

    fileLog.info(`🔔 Listening for server notifications on ${entityTypes.length} entities`)
  }

  /**
   * Parse entity type to extract org ID and table name
   * "01920000-1000-7000-8000-000000000001_BuildProject" → { orgId, tableName }
   */
  private parseEntityType(entityType: string): { orgId: string; tableName: string } {
    const parts = entityType.split('_')

    if (parts.length >= 2) {
      return {
        orgId: parts[0],
        tableName: parts.slice(1).join('_')
      }
    }

    return { orgId: 'unknown', tableName: entityType }
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    fileLog.info('🧹 Cleaning up Dexie sync layer subscriptions')

    this.liveQuerySubscriptions.forEach((sub, key) => {
      if (typeof sub === 'function') {
        sub()  // Unsubscribe function
      } else if (sub?.unsubscribe) {
        sub.unsubscribe()  // RxJS-style subscription
      }
    })

    this.liveQuerySubscriptions.clear()
  }
}

// Singleton
let syncLayer: DexieSyncLayer | null = null

/**
 * Initialize Dexie sync layer
 */
export function initializeSyncLayer(): DexieSyncLayer {
  if (!syncLayer) {
    syncLayer = new DexieSyncLayer()
  }
  return syncLayer
}

/**
 * Get current sync layer instance
 */
export function getSyncLayer(): DexieSyncLayer | null {
  return syncLayer
}

/**
 * Reset sync layer (for logout)
 */
export function resetSyncLayer(): void {
  if (syncLayer) {
    syncLayer.cleanup()
    syncLayer = null
  }
}
