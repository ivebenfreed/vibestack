/**
 * VibeStack Legend State Observables
 * 
 * Direct observable implementation using Legend State patterns.
 * Uses syncedCrud for automatic CRUD operations with persistence.
 */

import { observable } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { configureSynced } from '@legendapp/state/sync'
import { orgSchemaClient } from '@/lib/schema-client'
import { createPersistenceManager, type PersistenceManager } from './helpers/PersistenceManager'

// Reactive persistence configuration - created after schema loads
let persistenceManager: PersistenceManager | null = null
let syncedCrudWithPersistence: any = null

/**
 * Organization context observable
 */
export const orgContext$ = observable({
  orgId: null as string | null,
  userId: null as string | null,
  schema: null as any | null,
  loading: false,
  error: null as string | null,
})

/**
 * Create a synced entity observable using Legend State patterns
 */
function createEntityObservable(orgId: string, entityName: string, schema?: any) {
  const baseUrl = `/api/dataforge/orgs/${orgId}/data/${entityName}`
  
  // Use the reactive persistence configuration if available, otherwise use basic syncedCrud
  const syncedCrudFn = syncedCrudWithPersistence || syncedCrud
  
  // Create the syncedCrud configuration first
  const crudConfig = {
    // LIST - Fetch all items
    list: async () => {
      const response = await fetch(baseUrl, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })
      
      if (!response.ok) {
        console.warn(`[Observable] Failed to load ${entityName}:`, response.status)
        return []
      }
      
      const result = await response.json()
      return result.data || []
    },

    // CREATE - Add new item
    create: async (item: any) => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create ${entityName}: ${response.status}`)
      }
      
      const result = await response.json()
      return result.data || item
    },

    // UPDATE - Modify existing item
    update: async (item: any) => {
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!response.ok) {
        throw new Error(`Failed to update ${entityName}: ${response.status}`)
      }
      
      const result = await response.json()
      return result.data || item
    },

    // DELETE - Remove item
    delete: async (item: any) => {
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete ${entityName}: ${response.status}`)
      }
      
      return undefined // Successful deletion
    },

    // Real-time sync via WebSocket notifications
    subscribe: ({ refresh }) => {
      const handler = (e: CustomEvent) => {
        const notification = e.detail
        
        // Check if notification is for this entity
        if (notification?.tables?.includes(entityName.toLowerCase()) || 
            notification?.tables?.includes(entityName) ||
            notification?.table === entityName.toLowerCase() || 
            notification?.table === entityName) {
          console.log(`[Observable] WebSocket notification for ${entityName}:`, notification)
          refresh()
        }
      }
      
      // Listen for table change notifications
      window.addEventListener('vibestack:table-change-notification', handler as any)
      
      console.log(`[Observable] Subscribed to WebSocket notifications for ${entityName}`)
      
      // Return cleanup function
      return () => {
        window.removeEventListener('vibestack:table-change-notification', handler as any)
        console.log(`[Observable] Unsubscribed from WebSocket notifications for ${entityName}`)
      }
    },

    // Retry configuration for offline support
    retry: {
      infinite: true,
      delay: 1000,
      backoff: 'exponential',
      maxDelay: 30000
    },

    // Enable optimistic updates
    fieldId: 'id',
    generateId: () => crypto.randomUUID(),
    
    // Initial empty state - this should be an object for list operations
    initial: {},
    
    // Local persistence with IndexedDB - only if persistence is configured
    ...(syncedCrudWithPersistence && persistenceManager ? {
      persist: persistenceManager.getPersistOptions(entityName)
    } : {})
  }
  
  // Return the observable wrapping syncedCrud with or without persistence
  return observable(syncedCrudFn(crudConfig))
}

/**
 * Load organization context and initialize entity stores
 */
export async function loadOrgContext(orgId: string, userId: string) {
  console.log(`[Observable] Loading org context for ${orgId}`)
  
  // Update loading state
  orgContext$.loading.set(true)
  orgContext$.error.set(null)
  
  try {
    // Load schema from API
    const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)
    if (!schemaResult.success || !schemaResult.schema) {
      throw new Error('Failed to load schema')
    }
    
    // Initialize PersistenceManager and IndexedDB configuration with the loaded schema
    const entities = schemaResult.schema.entities || {}
    if (Object.keys(entities).length > 0) {
      // Create persistence manager for this organization
      persistenceManager = createPersistenceManager(orgId, userId)
      
      // Get IndexedDB configuration from persistence manager
      const indexedDBPlugin = persistenceManager.createIndexedDBConfig(Object.keys(entities))
      
      // Create syncedCrud with proper persistence configuration
      syncedCrudWithPersistence = configureSynced(syncedCrud, {
        persist: {
          plugin: indexedDBPlugin
        }
      })
      
      console.log(`[Observable] IndexedDB persistence configured for ${Object.keys(entities).length} entities`)
    }
    
    // Update context
    orgContext$.assign({
      orgId,
      userId,
      schema: schemaResult.schema,
      loading: false,
      error: null,
    })
    
    // Note: Entity observables are created lazily by getEntity$ function
    // We don't pre-create them here to avoid proxy assignment issues
    
    console.log(`[Observable] Org context loaded with ${Object.keys(entities).length} entities`)
    
  } catch (error) {
    console.error('[Observable] Failed to load org context:', error)
    orgContext$.assign({
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to load organization'
    })
    throw error
  }
}

/**
 * Reactive entity observables - automatically recreates when schema changes
 * This creates entity observables lazily and reactively based on schema
 */
export const entities$ = observable(() => {
  const orgId = orgContext$.orgId.get()
  const schema = orgContext$.schema.get()
  
  if (!orgId || !schema?.entities) {
    return {}
  }
  
  // Create a reactive map of entity observables
  const entityObservables: Record<string, any> = {}
  
  Object.keys(schema.entities).forEach(entityName => {
    // Each entity gets its own observable that's created fresh when schema changes
    entityObservables[entityName] = createEntityObservable(orgId, entityName, schema.entities[entityName])
  })
  
  console.log(`[Observable] Created ${Object.keys(entityObservables).length} entity observables for schema change`)
  return entityObservables
})

/**
 * Get a specific entity observable - automatically updates when schema changes
 * Returns the actual syncedCrud observable, not wrapped data
 */
export function getEntity$(entityName: string) {
  const allEntities = entities$.get()
  const entityObs = allEntities[entityName]
  
  if (!entityObs) {
    console.warn(`[Observable] Entity observable not found for: ${entityName}`)
    return null
  }
  
  return entityObs
}

/**
 * Clear all observables (for logout or org switching)
 */
export function clearContext() {
  console.log('[Observable] Clearing all observables')
  
  // Clear persistence manager data if it exists
  if (persistenceManager) {
    persistenceManager.clearOrganizationData()
    persistenceManager = null
  }
  
  // Reset persistence configuration
  syncedCrudWithPersistence = null
  
  // Clear context - this will automatically clear all entity observables due to reactivity
  orgContext$.set({
    orgId: null,
    userId: null,
    schema: null,
    loading: false,
    error: null,
  })
}

/**
 * Handle WebSocket table change notification
 */
export function handleTableNotification(notification: any) {
  if (!notification?.table) return
  
  const orgId = orgContext$.orgId.get()
  if (!orgId) return
  
  console.log(`[Observable] Table notification for ${notification.table}:`, notification.operation)
  
  // Dispatch custom event that entity stores listen to
  window.dispatchEvent(new CustomEvent('vibestack:table-change-notification', {
    detail: notification,
  }))
}

// Computed observables for common patterns
export const isLoading$ = orgContext$.loading
export const currentOrg$ = orgContext$.orgId  
export const currentSchema$ = orgContext$.schema

// Entity groups for sidebar (computed from schema) - fully reactive
export const entityGroups$ = observable(() => {
  const schema = orgContext$.schema.get()
  if (!schema?.entities) return []
  
  return Object.keys(schema.entities).map(name => ({
    name,
    path: `/entities/${name}`,
    icon: 'Database',
    // Reactive count from the actual entity observable
    count$: observable(() => {
      const allEntities = entities$.get()
      const entityObs = allEntities?.[name]
      
      // Return 0 if entity observable isn't ready yet
      if (!entityObs || typeof entityObs.get !== 'function') {
        return 0
      }
      
      try {
        const data = entityObs.get()
        return data && typeof data === 'object' ? Object.keys(data).length : 0
      } catch (error) {
        console.warn(`[Observable] Error getting count for ${name}:`, error)
        return 0
      }
    })
  }))
})

// Debug: Expose to window in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).vibestackOrgContext = orgContext$
}