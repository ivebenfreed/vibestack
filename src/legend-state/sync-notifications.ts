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
    fileLog.info('📨 [SYNC-NOTIFY] Processing table change notification:', {
      tables: notification.tables,
      messageId: notification.messageId,
      organizationId: notification.organizationId,
      source: notification.source,
      lsn: notification.lsn
    })

    // Update latest notification
    syncNotifications$.latest.set(notification)

    // Add to history (keep last 50)
    const currentHistory = syncNotifications$.history.get()
    const newHistory = [...currentHistory.slice(-49), notification]
    syncNotifications$.history.set(newHistory)

    // Update per-entity notifications for granular reactivity
    const entityNotifications = syncNotifications$.entityNotifications.get()
    const updatedEntityNotifications = { ...entityNotifications }

    notification.tables.forEach(entityName => {
      updatedEntityNotifications[entityName] = notification
      syncNotifications$.stats.entitiesWithNotifications.get().add(entityName)
    })

    syncNotifications$.entityNotifications.set(updatedEntityNotifications)

    // Update stats
    syncNotifications$.stats.assign({
      totalNotifications: syncNotifications$.stats.totalNotifications.get() + 1,
      lastNotificationTime: notification.timestamp
    })

    fileLog.info('✅ Sync notification processed', {
      messageId: notification.messageId,
      affectedEntities: notification.tables,
      totalNotifications: syncNotifications$.stats.totalNotifications.get()
    })
  },

  /**
   * Get the latest notification for a specific entity
   * This creates a computed observable that entity observables can depend on
   */
  getNotificationFor(entityName: string) {
    return computed(() => {
      const entityNotifications = syncNotifications$.entityNotifications.get()
      const notification = entityNotifications[entityName]

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