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
    
    // Validate entity exists in schema
    const entities = orgSchema$.entities.get()
    if (!entities[entityName]) {
      console.warn(`[Legend State] Entity ${entityName} not found in schema, creating placeholder store`)
      // Return a placeholder observable that will be replaced when schema loads
      entityStores[entityName] = observable([])
      return entityStores[entityName]
    }
    
    console.log(`[Legend State] Creating synced store for entity: ${entityName}`)
    
    // Create a synced observable for this entity with CRUD operations
    entityStores[entityName] = observable(
      syncedCrud({
        list: () => fetch(`/api/dataforge/orgs/${orgId}/data/${entityName}`, {
          credentials: 'include',
        }).then(async r => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`)
          }
          const data = await r.json()
          return data.data || []
        }),
        
        create: (item: any) => fetch(`/api/dataforge/orgs/${orgId}/data/${entityName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item),
        }).then(async r => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`)
          }
          return r.json()
        }),
        
        update: (item: any) => fetch(`/api/dataforge/orgs/${orgId}/data/${entityName}/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item),
        }).then(async r => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`)
          }
          return r.json()
        }),
        
        delete: (item: any) => fetch(`/api/dataforge/orgs/${orgId}/data/${entityName}/${item.id}`, {
          method: 'DELETE',
          credentials: 'include',
        }).then(async r => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`)
          }
          return r.json()
        }),
        
        // Persistence configuration with entity validation
        persist: {
          name: `vibestack_${orgId}_${entityName}`,
          plugin: ObservablePersistIndexedDB,
        },
        
        // Optimistic updates
        updateLocal: true,
        
        // Retry configuration with backoff
        retry: {
          times: 3,
          delay: 1000, // Start with 1 second delay
          backoff: 'exponential', // Exponential backoff
          maxDelay: 30000, // Max 30 seconds
        },
        
        // Error handling for various error types
        onError: (error) => {
          console.error(`[Legend State] Error in entity store ${entityName}:`, error)
          
          // Handle different error types
          if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
            console.warn(`[Legend State] Server error for ${entityName}, stopping retries to prevent spam`)
            // Stop retrying on 500 errors to prevent infinite loops
            return { retry: false }
          }
          
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            console.warn(`[Legend State] Entity ${entityName} not found, removing from stores`)
            delete entityStores[entityName]
            return { retry: false }
          }
          
          if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            console.warn(`[Legend State] Rate limited for ${entityName}, using longer delay`)
            return { retry: true, delay: 60000 } // Wait 1 minute on rate limits
          }
          
          // Default: allow retry with exponential backoff
          return { retry: true }
        }
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
  // Handle schema change notifications first
  if (notification.type === 'schema_change') {
    console.log('[Legend State] Schema change detected:', notification)
    handleSchemaChangeNotification(notification)
    return
  }
  
  if (notification.table && entityStores[notification.table]) {
    const store$ = entityStores[notification.table]
    
    // Based on operation, update the store
    switch (notification.operation) {
      case 'INSERT':
        // Fetch the new record and add it
        const orgId = orgSchema$.orgId.get()
        fetch(`/api/dataforge/orgs/${orgId}/data/${notification.table}/${notification.id}`, {
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
          fetch(`/api/dataforge/orgs/${orgId}/data/${notification.table}/${notification.id}`, {
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
 * Handle schema change notifications from entity operations
 */
export function handleSchemaChangeNotification(notification: {
  orgId: string
  entityName: string
  operation: 'create' | 'update' | 'delete'
}) {
  const currentOrgId = orgSchema$.orgId.get()
  
  // Only process if it's for the current organization
  if (notification.orgId !== currentOrgId) {
    return
  }
  
  console.log(`[Legend State] Handling schema change: ${notification.operation} on ${notification.entityName}`)
  
  switch (notification.operation) {
    case 'create':
      // Reload entire schema to pick up new entity
      reloadOrgSchema(currentOrgId).then(() => {
        // Create the new entity store immediately after schema reload
        recreateEntityStore(notification.entityName)
      })
      break
      
    case 'update':
      // Clear entity store cache and reload schema
      if (entityStores[notification.entityName]) {
        console.log(`[Legend State] Clearing store for updated entity: ${notification.entityName}`)
        delete entityStores[notification.entityName]
      }
      reloadOrgSchema(currentOrgId).then(() => {
        // Recreate the entity store with updated schema
        recreateEntityStore(notification.entityName)
      })
      break
      
    case 'delete':
      // Remove entity from stores and schema
      if (entityStores[notification.entityName]) {
        console.log(`[Legend State] Removing store for deleted entity: ${notification.entityName}`)
        delete entityStores[notification.entityName]
      }
      reloadOrgSchema(currentOrgId)
      break
  }
}

/**
 * Recreate entity store after schema change
 */
function recreateEntityStore(entityName: string) {
  // Force recreate the entity store to pick up new schema
  if (entityStores[entityName]) {
    delete entityStores[entityName]
  }
  
  try {
    // This will create a new store with the updated schema
    const newStore = getEntityStore$(entityName)
    console.log(`[Legend State] Recreated entity store for: ${entityName}`)
  } catch (error) {
    console.error(`[Legend State] Failed to recreate store for ${entityName}:`, error)
  }
}

/**
 * Reload organization schema and update all dependent observables
 */
async function reloadOrgSchema(orgId: string) {
  console.log(`[Legend State] Reloading schema for org ${orgId}`)
  
  try {
    // Force reload schema from server
    const result = await orgSchemaClient.loadOrgSchema(orgId)
    if (result.success && result.schema) {
      // Update schema observable
      orgSchema$.merge({
        entities: result.schema.entities,
        error: null,
      })
      
      console.log(`[Legend State] Schema reloaded: ${Object.keys(result.schema.entities).length} entities`)
    }
  } catch (error) {
    console.error('[Legend State] Failed to reload schema:', error)
    orgSchema$.error.set(error instanceof Error ? error.message : 'Failed to reload schema')
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