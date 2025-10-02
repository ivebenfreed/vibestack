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

      // ✅ Start differential sync in BACKGROUND (don't await!)
      this.performDifferentialSyncOnly(Object.keys(entitySchemas)).catch(error => {
        fileLog.error('Background differential sync failed:', error)
      })

      fileLog.info(`✅ Using existing cache, differential sync running in background`)

      return
    }

    fileLog.info(`📝 Schema changed, rebuilding Dexie DB`, {
      oldHash: storedHash?.substring(0, 12),
      newHash: currentSchemaHash.substring(0, 12),
      entityCount: Object.keys(entitySchemas).length
    })

    // Schema changed - rebuild and do full sync
    await this.rebuildDexieSchema(userId, entitySchemas, currentSchemaHash)
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

    // Dexie DB will be recreated by initializeDexieDB() call in app-initialization-stages
    // Just store the new schema hash
    localStorage.setItem(`dexie_schema_hash_${userId}`, schemaHash)

    // Perform full initial sync
    const entityTypes = Object.keys(entitySchemas)
    await this.performInitialSync(entityTypes)
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
   */
  private async performDifferentialSyncOnly(entityTypes: string[]): Promise<void> {
    fileLog.info(`🔄 Differential sync only (schema unchanged): ${entityTypes.length} entities`)

    // Sync all entities in parallel, fetching only changes
    const results = await Promise.allSettled(
      entityTypes.map(type => this.syncEntityFromServer(type))
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length

    fileLog.info(`✅ Differential sync complete: ${succeeded}/${entityTypes.length} succeeded`)
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

      // Parse entity type to get org and table name
      const { orgId, tableName } = this.parseEntityType(entityType)

      // ✅ Special handling for User entity (uses /members endpoint)
      const baseUrl = tableName === 'User'
        ? `/api/dataforge/orgs/${orgId}/members`
        : `/api/dataforge/orgs/${orgId}/data/${tableName}`

      const diffUrl = lastSync > 0
        ? `${baseUrl}?updated_at[gte]=${lastSync}`
        : baseUrl

      const syncType = lastSync > 0 ? 'differential' : 'full'

      fileLog.info(`🔄 [DEXIE-SYNC] ${entityType}: ${syncType} sync from ${new Date(lastSync).toISOString()}`)

      // Fetch from server
      const response = await fetch(diffUrl, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })

      if (!response.ok) {
        // Don't throw - just log and continue
        fileLog.warn(`⚠️  [DEXIE-SYNC] ${entityType}: API error ${response.status}`)
        return
      }

      const result = await response.json()
      const serverData = result.data || []

      fileLog.info(`✅ [DEXIE-SYNC] ${entityType}: Received ${serverData.length} ${syncType === 'differential' ? 'changes' : 'records'}`)

      // Update Dexie cache
      await dexie.updateFromServer(tableName, serverData)

      // Update sync metadata
      await dexie.updateSyncMetadata(entityType, {
        lastSync: Date.now(),
        recordCount: serverData.length,
        version: (meta?.version || 0) + 1
      })

      fileLog.info(`💾 [DEXIE-SYNC] ${entityType}: Sync complete`)

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
      const { tableName } = this.parseEntityType(entityType)

      try {
        const table = dexie.table(tableName)

        if (!table) {
          fileLog.warn(`Cannot setup liveQuery for ${entityType}: table ${tableName} not found`)
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
