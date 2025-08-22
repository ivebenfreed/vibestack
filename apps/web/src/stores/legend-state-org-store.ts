/**
 * Legend State Organization Store
 * 
 * Proper Legend State implementation that replaces the manual orgData$ container.
 * Uses Legend State's built-in sync, persistence, and reactivity features.
 * 
 * Based on Legend State v3 patterns:
 * - Observables for reactive state
 * - syncedCrud for CRUD operations  
 * - IndexedDB persistence
 * - Computed observables for derived state
 * - WebSocket integration for real-time updates
 */

import { observable, computed, observe, when } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { synced } from '@legendapp/state/sync'
import { configureSynced } from '@legendapp/state/sync'
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
import { enableLegendStateReact } from '@legendapp/state/react'
import { orgSchemaClient } from '@/lib/schema-client'

// Enable React integration
enableLegendStateReact()

// Configure synced defaults for all entities
configureSynced({
  persist: {
    plugin: ObservablePersistIndexedDB,
    retrySync: true,
  },
  retry: {
    times: 3,
    delay: 1000,
  },
  debounce: {
    wait: 500,
  },
})

/**
 * Organization Schema Observable
 * The schema drives everything - entity types, fields, sidebar, etc.
 */
export const orgSchema$ = observable<{
  orgId: string | null
  entities: Record<string, any>
  loading: boolean
  error: string | null
}>({
  orgId: null,
  entities: {},
  loading: false,
  error: null,
})

/**
 * Computed observable for sidebar entity groups
 * Automatically derives from schema - no manual updates needed
 */
export const entityGroups$ = computed(() => {
  const schema = orgSchema$.entities.get()
  if (!schema || Object.keys(schema).length === 0) return []
  
  return Object.keys(schema).map(entityName => ({
    name: entityName,
    path: `/entities/${entityName}`,
    icon: 'Database',
  }))
})

/**
 * Dynamic entity stores
 * Each entity gets its own synced observable with CRUD operations
 */
const entityStores: Record<string, any> = {}

/**
 * Get or create a synced entity store
 * Uses Legend State's syncedCrud for automatic CRUD operations
 */
export function getEntityStore$(entityName: string) {
  if (!entityStores[entityName]) {
    const orgId = orgSchema$.orgId.get()
    if (!orgId) {
      throw new Error('Organization ID not set')
    }
    
    // Create a synced observable for this entity with CRUD operations
    entityStores[entityName] = observable(
      syncedCrud({
        list: () => fetch(`/api/archetype/orgs/${orgId}/data/${entityName}`, {
          credentials: 'include',
        }).then(r => r.json()).then(r => r.data || []),
        
        create: (item: any) => fetch(`/api/archetype/orgs/${orgId}/data/${entityName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item),
        }).then(r => r.json()),
        
        update: (item: any) => fetch(`/api/archetype/orgs/${orgId}/data/${entityName}/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item),
        }).then(r => r.json()),
        
        delete: (item: any) => fetch(`/api/archetype/orgs/${orgId}/data/${entityName}/${item.id}`, {
          method: 'DELETE',
          credentials: 'include',
        }).then(r => r.json()),
        
        // Persistence configuration
        persist: {
          name: `vibestack_${orgId}_${entityName}`,
          plugin: ObservablePersistIndexedDB,
        },
        
        // Optimistic updates
        updateLocal: true,
        
        // Retry configuration
        retry: {
          times: 3,
        },
      })
    )
  }
  
  return entityStores[entityName]
}

/**
 * Load organization schema
 * This is the only manual load needed - everything else is automatic
 */
export async function loadOrgSchema(orgId: string) {
  // Check if already loaded
  if (orgSchema$.orgId.get() === orgId && Object.keys(orgSchema$.entities.get()).length > 0) {
    return
  }
  
  orgSchema$.loading.set(true)
  orgSchema$.error.set(null)
  
  try {
    const result = await orgSchemaClient.loadOrgSchema(orgId)
    if (!result.success || !result.schema) {
      throw new Error('Failed to load schema')
    }
    
    // Set the schema in the observable
    orgSchema$.merge({
      orgId,
      entities: result.schema.entities,
      loading: false,
      error: null,
    })
    
    console.log('[Legend State Store] Schema loaded:', Object.keys(result.schema.entities))
  } catch (error) {
    orgSchema$.merge({
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to load schema',
    })
    throw error
  }
}

/**
 * Handle WebSocket notifications
 * Legend State observables automatically update all subscribers
 */
export function handleWebSocketNotification(notification: any) {
  if (notification.table && entityStores[notification.table]) {
    const store$ = entityStores[notification.table]
    
    // Based on operation, update the store
    switch (notification.operation) {
      case 'INSERT':
        // Fetch the new record and add it
        const orgId = orgSchema$.orgId.get()
        fetch(`/api/archetype/orgs/${orgId}/data/${notification.table}/${notification.id}`, {
          credentials: 'include',
        })
          .then(r => r.json())
          .then(record => {
            // Legend State will handle reactivity automatically
            store$.push(record)
          })
        break
        
      case 'UPDATE':
        // Update the existing record
        const index = store$.get().findIndex((r: any) => r.id === notification.id)
        if (index !== -1) {
          // Fetch updated record
          const orgId = orgSchema$.orgId.get()
          fetch(`/api/archetype/orgs/${orgId}/data/${notification.table}/${notification.id}`, {
            credentials: 'include',
          })
            .then(r => r.json())
            .then(record => {
              store$[index].set(record)
            })
        }
        break
        
      case 'DELETE':
        // Remove the record
        const items = store$.get()
        const filteredItems = items.filter((r: any) => r.id !== notification.id)
        store$.set(filteredItems)
        break
    }
  }
}

/**
 * Clear all stores (for logout/org switch)
 */
export function clearAllStores() {
  // Clear schema
  orgSchema$.set({
    orgId: null,
    entities: {},
    loading: false,
    error: null,
  })
  
  // Clear all entity stores
  Object.keys(entityStores).forEach(key => {
    delete entityStores[key]
  })
}

/**
 * Get entity count (reactive)
 */
export function getEntityCount$(entityName: string) {
  return computed(() => {
    const store$ = entityStores[entityName]
    if (!store$) return 0
    return store$.get()?.length || 0
  })
}

/**
 * Preload entity data for dashboard
 * Returns immediately, loads in background
 */
export function preloadEntityData(entityNames: string[]) {
  entityNames.forEach(entityName => {
    // Just accessing the store will trigger the initial load
    const store$ = getEntityStore$(entityName)
    // Legend State handles the rest automatically
  })
}

// Debug: Expose to window in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).orgSchema$ = orgSchema$
  (window as any).entityGroups$ = entityGroups$
  (window as any).getEntityStore$ = getEntityStore$
}