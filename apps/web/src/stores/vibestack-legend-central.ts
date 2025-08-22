/**
 * VibeStack Legend State Central Store
 * 
 * This is the PROPER implementation that replaces orgData$.
 * It uses Legend State's built-in features instead of manual implementations.
 * 
 * Key Features:
 * - Automatic CRUD with syncedCrud
 * - IndexedDB persistence
 * - WebSocket real-time sync
 * - Optimistic updates
 * - Computed observables for derived state
 */

import { observable, computed, batch, when, observe } from '@legendapp/state'
import { synced } from '@legendapp/state/sync'
import { orgSchemaClient } from '@/lib/schema-client'
import { syncedVibeStack, syncedVibeStackWithSchema } from './sync/synced-vibestack'

// Note: IndexedDB persistence is now configured in the custom sync adapter
// Each entity store gets its own IndexedDB entry with org-specific keys

/**
 * Core organization context - the source of truth
 */
export const orgContext$ = observable({
  orgId: null as string | null,
  userId: null as string | null,
  schema: null as any | null,
  loading: false,
  error: null as string | null,
})

// We'll persist the org context after it's loaded
// to avoid persisting null values on initial load

/**
 * Entity store registry - one store per entity type
 * Created on-demand and cached
 */
const entityStores = new Map<string, any>()

/**
 * Loading state for each entity
 */
export const entityLoadingStates = new Map<string, any>()

/**
 * Get or create an entity store
 * This is the primary API for accessing entity data
 */
export function entity$(entityName: string) {
  const orgId = orgContext$.orgId.get()
  if (!orgId) {
    console.warn(`[Legend Central] No org context when accessing ${entityName}`)
    return observable({}) // Return empty observable if no org
  }

  const storeKey = `${orgId}_${entityName}`
  
  if (!entityStores.has(storeKey)) {
    console.log(`[Legend Central] Creating entity store for ${entityName}`)
    
    // Create loading state observable
    const loadingState = observable({
      isLoading: true,
      hasLoaded: false,
      error: null as string | null,
    })
    entityLoadingStates.set(storeKey, loadingState)
    
    // Get schema for this entity if available
    const schema = orgContext$.schema.get()
    
    // Use our custom sync adapter with schema-aware configuration
    const syncConfig = syncedVibeStackWithSchema(
      orgId,
      entityName,
      schema,
      {
        changesSince: 'last-sync',  // Enable diff syncing
        softDelete: true,            // Enable soft deletes
        optimisticUpdates: true,     // Enable optimistic updates
        onDataLoaded: (name, data) => {
          // Mark as loaded when data arrives
          if (name === entityName) {
            batch(() => {
              loadingState.isLoading.set(false)
              loadingState.hasLoaded.set(true)
              loadingState.error.set(null)
            })
            console.log(`[Legend Central] Entity ${entityName} marked as loaded with ${data.length} records`)
          }
        }
      }
    )
    
    // Create the store with syncConfig
    const store = observable(syncConfig)
    
    // Don't mark as loaded yet - wait for actual data
    // The loadingState will be updated when data arrives
    
    entityStores.set(storeKey, store)
  }
  
  return entityStores.get(storeKey)!
}

/**
 * Get loading state for an entity
 */
export function entityLoading$(entityName: string) {
  const orgId = orgContext$.orgId.get()
  if (!orgId) return observable({ isLoading: false, hasLoaded: false, error: null })
  
  const storeKey = `${orgId}_${entityName}`
  
  // Ensure entity store exists first
  entity$(entityName)
  
  return entityLoadingStates.get(storeKey) || observable({ isLoading: false, hasLoaded: false, error: null })
}

/**
 * Computed observable for sidebar entity groups
 * Automatically updates when schema changes
 */
export const entityGroups$ = computed(() => {
  const schema = orgContext$.schema.get()
  if (!schema?.entities) return []
  
  return Object.keys(schema.entities).map(name => ({
    name,
    path: `/entities/${name}`,
    icon: 'Database',
    // Return count directly (computed returns the value, not an observable)
    count$: 0, // Will be updated when entity store loads
  }))
})

/**
 * Load organization schema and context
 */
export async function loadOrgContext(orgId: string, userId: string) {
  // Check if already loaded
  if (orgContext$.orgId.get() === orgId && orgContext$.schema.get()) {
    console.log(`[Legend Central] Org context already loaded for ${orgId}`)
    return
  }
  
  console.log(`[Legend Central] Loading org context for ${orgId}`)
  
  batch(() => {
    orgContext$.loading.set(true)
    orgContext$.error.set(null)
  })
  
  try {
    // Load schema
    const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)
    if (!schemaResult.success || !schemaResult.schema) {
      throw new Error('Failed to load schema')
    }
    
    // Update context in a batch
    batch(() => {
      orgContext$.assign({
        orgId,
        userId,
        schema: schemaResult.schema,
        loading: false,
        error: null,
      })
    })
    
    console.log(`[Legend Central] Org context loaded with ${Object.keys(schemaResult.schema.entities).length} entities`)
    
    // Preload entity data for dashboard (non-blocking)
    if (schemaResult.schema.entities) {
      Object.keys(schemaResult.schema.entities).forEach(entityName => {
        // Just accessing the store triggers background load
        entity$(entityName)
      })
    }
  } catch (error) {
    console.error('[Legend Central] Failed to load org context:', error)
    batch(() => {
      orgContext$.loading.set(false)
      orgContext$.error.set(error instanceof Error ? error.message : 'Failed to load organization')
    })
    throw error
  }
}

/**
 * Clear all stores (for logout or org switching)
 */
export function clearAllStores() {
  console.log('[Legend Central] Clearing all stores')
  
  batch(() => {
    // Clear entity stores
    entityStores.forEach(store => {
      if (store?.clear) store.clear()
    })
    entityStores.clear()
    
    // Clear context
    orgContext$.set({
      orgId: null,
      userId: null,
      schema: null,
      loading: false,
      error: null,
    })
  })
}

/**
 * Handle WebSocket table change notification
 */
export function handleTableNotification(notification: any) {
  if (!notification?.table) return
  
  const orgId = orgContext$.orgId.get()
  if (!orgId) return
  
  console.log(`[Legend Central] Table notification for ${notification.table}:`, notification.operation)
  
  // Dispatch custom event that entity stores listen to
  window.dispatchEvent(new CustomEvent('vibestack:table-change-notification', {
    detail: notification,
  }))
}

// Debug: Expose to window in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).legendCentral = {
    orgContext$,
    entity$,
    entityGroups$,
    entityStores,
  }
}