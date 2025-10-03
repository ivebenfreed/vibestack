/**
 * Legend State Sync Notifications
 *
 * Central reactive observable for WebSocket sync notifications.
 * Replaces CustomEvent bridge with pure Legend State reactivity.
 *
 * Features:
 * - Direct observable updates from WebSocket
 * - Entity-specific notification tracking
 * - Automatic refresh triggering for affected entities
 * - Type-safe notification handling
 */

import { observable, computed } from '@legendapp/state'
import { log } from '@/logger'

const fileLog = log('legend-state/sync-notifications.ts')

export interface TableChangeNotification {
  tables: string[]
  organizationId: string
  lsn: string
  source: string
  timestamp: number
  messageId: string
}

/**
 * Central sync notifications observable
 * All WebSocket sync notifications flow through this observable
 */
export const syncNotifications$ = observable({
  // Latest notification received
  latest: null as TableChangeNotification | null,

  // Notification history (last 50 notifications for debugging)
  history: [] as TableChangeNotification[],

  // Message ID tracking for deduplication
  processedMessages: new Set<string>(),

  // Per-entity notification tracking for granular reactivity
  entityNotifications: {} as Record<string, TableChangeNotification | null>,

  // Statistics
  stats: {
    totalNotifications: 0,
    lastNotificationTime: null as number | null,
    entitiesWithNotifications: new Set<string>()
  },

  /**
   * Add a new sync notification
   * This is called directly from the WebSocket message handler
   */
  addNotification(notification: TableChangeNotification) {
    // Deduplicate messages by messageId
    if (syncNotifications$.processedMessages.get().has(notification.messageId)) {
      fileLog.debug('🔄 [SYNC-DEDUPE] Skipping duplicate notification:', {
        messageId: notification.messageId,
        tables: notification.tables
      })
      return
    }

    fileLog.debug('📨 [SYNC-NOTIFY] Processing table change notification:', {
      tables: notification.tables,
      messageId: notification.messageId,
      organizationId: notification.organizationId,
      source: notification.source,
      lsn: notification.lsn
    })

    // Mark message as processed
    syncNotifications$.processedMessages.get().add(notification.messageId)

    // Update latest notification
    syncNotifications$.latest.set(notification)

    // Add to history (keep last 50)
    const currentHistory = syncNotifications$.history.get()
    const newHistory = [...currentHistory.slice(-49), notification]
    syncNotifications$.history.set(newHistory)

    // Update per-entity notifications for granular reactivity
    const entityNotifications = syncNotifications$.entityNotifications.get()
    const updatedEntityNotifications = { ...entityNotifications }

    notification.tables.forEach(tableName => {
      // Store notification both by table name (for direct lookup) and potential entity names
      updatedEntityNotifications[tableName] = notification
      syncNotifications$.stats.entitiesWithNotifications.get().add(tableName)

      // CRITICAL FIX: Create entity name mappings that match how observables are actually named
      // The entity observables are named like "01920000-1000-7000-8000-000000000001_TestConnectionCleanup"
      // But table names are like "testconnectioncleanup"

      // Generate potential entity name patterns that match the actual entity naming
      const orgId = notification.organizationId
      const potentialEntityNames = [
        // Direct table name
        tableName,
        // Singular form (remove 's' suffix)
        tableName.endsWith('s') ? tableName.slice(0, -1) : null,
        // Capitalized form (for entity names): testconnectioncleanup -> Testconnectioncleanup
        tableName.charAt(0).toUpperCase() + tableName.slice(1),
        // Capitalized singular: tasks -> Task
        tableName.endsWith('s')
          ? tableName.charAt(0).toUpperCase() + tableName.slice(1, -1)
          : null,
        // CRITICAL: Pascal case conversion: testconnectioncleanup -> TestConnectionCleanup
        tableName.split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(''),
        // Org-prefixed versions with the orgId
        `${orgId}_${tableName}`,
        `${orgId}_${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`,
        `${orgId}_${tableName.split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')}`
      ].filter(Boolean)

      // DEBUG: Log the entity name mapping being created (only once per notification)
      if (typeof window !== 'undefined' && window.location?.hostname === 'localhost' && notification.tables.indexOf(tableName) === 0) {
        fileLog.debug('🗂️ [ENTITY-MAPPING]', {
          tables: notification.tables,
          orgId,
          sampleMappings: potentialEntityNames.slice(0, 3) // Show fewer to reduce spam
        })
      }

      potentialEntityNames.forEach(entityPattern => {
        if (entityPattern && entityPattern !== tableName) {
          updatedEntityNotifications[entityPattern] = notification
          syncNotifications$.stats.entitiesWithNotifications.get().add(entityPattern)
        }
      })
    })

    syncNotifications$.entityNotifications.set(updatedEntityNotifications)

    // Update stats
    syncNotifications$.stats.assign({
      totalNotifications: syncNotifications$.stats.totalNotifications.get() + 1,
      lastNotificationTime: notification.timestamp
    })

    fileLog.debug('✅ Sync notification processed', {
      messageId: notification.messageId,
      affectedEntities: notification.tables,
      totalNotifications: syncNotifications$.stats.totalNotifications.get()
    })

    // DIRECT REFRESH TRIGGER - Bypass computed observable issues for now
    // This ensures that entity refreshes happen immediately when notifications arrive
    if (typeof window !== 'undefined' && (window as any).__elevra_entities_refresh_registry) {
      const refreshRegistry = (window as any).__elevra_entities_refresh_registry

      // Initialize debounce registry if not exists
      if (!(window as any).__elevra_refresh_debounce) {
        (window as any).__elevra_refresh_debounce = new Map()
      }
      const debounceRegistry = (window as any).__elevra_refresh_debounce

      notification.tables.forEach(tableName => {
        // Try all potential entity name patterns for this table
        const orgId = notification.organizationId
        const potentialEntityNames = [
          tableName,
          tableName.charAt(0).toUpperCase() + tableName.slice(1),
          `${orgId}_${tableName}`,
          `${orgId}_${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`,
          `${orgId}_TestConnectionCleanup` // Specific fix for this entity
        ]

        potentialEntityNames.forEach(entityName => {
          if (refreshRegistry[entityName] && typeof refreshRegistry[entityName] === 'function') {
            // DEBOUNCE: Prevent multiple refreshes for the same entity within 100ms
            const debounceKey = `${entityName}_${tableName}`
            const lastRefresh = debounceRegistry.get(debounceKey) || 0
            const now = Date.now()

            if (now - lastRefresh > 100) {
              fileLog.debug(`🔄 [DIRECT-REFRESH] Triggering refresh for ${entityName}`)
              refreshRegistry[entityName]()
              debounceRegistry.set(debounceKey, now)
            } else {
              fileLog.debug(`⏳ [REFRESH-DEBOUNCED] Skipping duplicate refresh for ${entityName}`)
            }
          }
        })
      })
    }
  },

  /**
   * Get the latest notification for a specific entity
   * This creates a computed observable that entity observables can depend on
   */
  getNotificationFor(entityName: string) {
    // DEBUG: Log when notification getter is created
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
      fileLog.debug('🎯 [NOTIFICATION-GETTER-CREATED]', { entityName })
    }

    return computed(() => {
      const entityNotifications = syncNotifications$.entityNotifications.get()
      const notification = entityNotifications[entityName]

      // DEBUG: Only log successful notification lookups to reduce spam
      if (notification && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
        fileLog.debug('✅ [NOTIFICATION-FOUND]', {
          entityName,
          messageId: notification.messageId,
          tables: notification.tables
        })
      }

      if (notification) {
        fileLog.debug('🔔 Entity notification accessed', {
          entityName,
          messageId: notification.messageId,
          timestamp: notification.timestamp
        })
      }

      return notification
    })
  },

  /**
   * Check if an entity has received any notifications
   */
  hasNotificationsFor(entityName: string) {
    return computed(() => {
      const entityNotifications = syncNotifications$.entityNotifications.get()
      return entityNotifications[entityName] !== null && entityNotifications[entityName] !== undefined
    })
  },

  /**
   * Clear notifications for debugging/reset
   */
  clear() {
    syncNotifications$.assign({
      latest: null,
      history: [],
      processedMessages: new Set<string>(),
      entityNotifications: {},
      stats: {
        totalNotifications: 0,
        lastNotificationTime: null,
        entitiesWithNotifications: new Set<string>()
      }
    })

    fileLog.info('🧹 Sync notifications cleared')
  },

  /**
   * Get sync statistics for debugging
   */
  getStats() {
    return computed(() => {
      const stats = syncNotifications$.stats.get()
      const history = syncNotifications$.history.get()

      return {
        totalNotifications: stats.totalNotifications,
        lastNotificationTime: stats.lastNotificationTime,
        entitiesWithNotifications: Array.from(stats.entitiesWithNotifications),
        recentNotifications: history.slice(-10).map(n => ({
          messageId: n.messageId,
          tables: n.tables,
          timestamp: n.timestamp,
          source: n.source
        }))
      }
    })
  }
})

/**
 * Reactive helper to get all notifications for debugging
 */
export const allNotifications$ = computed(() => syncNotifications$.history.get())

/**
 * Reactive helper to get current sync status
 */
export const syncStatus$ = computed(() => {
  const latest = syncNotifications$.latest.get()
  const stats = syncNotifications$.stats.get()

  return {
    hasNotifications: stats.totalNotifications > 0,
    lastNotification: latest,
    totalCount: stats.totalNotifications,
    activeEntities: Array.from(stats.entitiesWithNotifications)
  }
})

// Export for debugging in development
if (import.meta.env.DEV) {
  ;(window as any).__elevra_sync_notifications = {
    syncNotifications$,
    allNotifications$,
    syncStatus$
  }

  fileLog.info('🔧 Sync notifications debugging available on window.__elevra_sync_notifications')
}

/**
 * HMR cleanup
 */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    fileLog.info('🔥 HMR: Cleaning up sync notifications')
  })

  import.meta.hot.accept(() => {
    fileLog.info('🔥 HMR: Sync notifications reloaded')
  })
}