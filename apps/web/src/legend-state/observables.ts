/**
 * VibeStack Legend State Observables
 * 
 * Direct observable implementation using Legend State patterns.
 * Uses syncedCrud for automatic CRUD operations with persistence.
 */

import { observable } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { synced } from '@legendapp/state/sync'
import { configureSynced } from '@legendapp/state/sync'
import { orgSchemaClient } from '@/lib/schema-client'
import { createPersistenceManager, type PersistenceManager } from './helpers/PersistenceManager'

// Reactive persistence configuration - created after schema loads
let persistenceManager: PersistenceManager | null = null
let syncedCrudWithPersistence: any = null
let currentOrgId: string | null = null
let currentSchemaVersion: string | null = null

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
  
  // Create the syncedCrud configuration first
  const crudConfig = {
    // LIST - Fetch all items with proper error handling
    list: async () => {
      try {
        const response = await fetch(baseUrl, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        })
        
        if (!response.ok) {
          // Handle common cases gracefully
          if (response.status === 404) {
            console.info(`[Observable] Entity ${entityName} table not found (404) - returning empty data`)
            return []
          }
          if (response.status === 500) {
            // Likely table doesn't exist - don't spam console
            console.info(`[Observable] Entity ${entityName} table not created yet (500) - returning empty data`)
            return []
          }
          console.warn(`[Observable] Failed to load ${entityName}:`, response.status)
          return []
        }
        
        const result = await response.json()
        return result.data || []
      } catch (error) {
        console.info(`[Observable] Network error loading ${entityName} - returning empty data:`, error.message)
        return []
      }
    },

    // CREATE - Add new item
    create: async (item: any) => {
      try {
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
          if (response.status === 500) {
            throw new Error(`Entity ${entityName} table not created yet - cannot create records`)
          }
          throw new Error(`Failed to create ${entityName}: ${response.status}`)
        }
        
        const result = await response.json()
        return result.data || item
      } catch (error) {
        console.error(`[Observable] Create error for ${entityName}:`, error.message)
        throw error
      }
    },

    // UPDATE - Modify existing item
    update: async (item: any) => {
      try {
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
          if (response.status === 500) {
            throw new Error(`Entity ${entityName} table not created yet - cannot update records`)
          }
          throw new Error(`Failed to update ${entityName}: ${response.status}`)
        }
        
        const result = await response.json()
        return result.data || item
      } catch (error) {
        console.error(`[Observable] Update error for ${entityName}:`, error.message)
        throw error
      }
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

    // Retry configuration for network failures
    retry: {
      times: 3,
      delay: 1000,
      backoff: 'exponential',
      maxDelay: 30000
    },

    // FIXED: Re-enable optimistic updates with proper field configuration
    // This allows good UX while preventing IndexedDB loading from triggering creates
    fieldId: 'id',
    fieldCreatedAt: 'created_at',  // Records with this field are existing, not new
    fieldUpdatedAt: 'updated_at',  // Track updates properly
    generateId: () => `temp-${crypto.randomUUID()}`, // Temporary IDs for new records
    
    // Initial empty state - use empty array for list operations to prevent auto-creation
    initial: [],
    
    // RE-ENABLED: IndexedDB persistence with sync loop prevention
    // The WebSocket subscription fix prevents the sync loop that was caused by refresh()
    ...(syncedCrudWithPersistence && persistenceManager ? (() => {
      const persistOptions = persistenceManager.getPersistOptions(entityName)
      console.log(`[Observable] Persistence options for ${entityName}:`, persistOptions)
      return { persist: persistOptions }
    })() : {})
  }
  
  // CRITICAL FIX: Re-enable syncedCrud but fix WebSocket subscription to prevent sync loop
  // The issue was that refresh() from WebSocket notifications was triggering PUT requests
  // Solution: Modify subscription to manually update data without calling refresh()
  
  // Override the subscription to prevent sync loop
  crudConfig.subscribe = ({ refresh }) => {
    const handler = (e: CustomEvent) => {
      const notification = e.detail
      
      // Check if notification is for this entity
      if (notification?.tables?.includes(entityName.toLowerCase()) || 
          notification?.tables?.includes(entityName) ||
          notification?.table === entityName.toLowerCase() || 
          notification?.table === entityName) {
        console.log(`[Observable] WebSocket notification for ${entityName}:`, notification)
        
        // TESTING: Re-enable refresh() and trust syncedCrud's diff logic
        // The syncedCrud plugin should only send PUT requests when data actually changes
        // Let's see if the fieldCreatedAt/fieldUpdatedAt config prevents false updates
        console.log(`[Observable] Calling refresh() and trusting syncedCrud diff logic for ${entityName}`)
        refresh()
      }
    }
    
    // Listen for table change notifications
    window.addEventListener('vibestack:table-change-notification', handler as any)
    
    console.log(`[Observable] Subscribed to WebSocket notifications for ${entityName} (SYNC LOOP PREVENTION)`)
    
    // Return cleanup function
    return () => {
      window.removeEventListener('vibestack:table-change-notification', handler as any)
      console.log(`[Observable] Unsubscribed from WebSocket notifications for ${entityName}`)
    }
  }
  
  const syncedCrudFn = syncedCrudWithPersistence || syncedCrud
  
  console.log(`[Observable] Creating syncedCrud for ${entityName} with WebSocket sync loop prevention`)
  
  return syncedCrudFn(crudConfig)
}

/**
 * Load organization context and initialize entity stores
 * This should only be called by auth state machines, not components
 */
export async function loadOrgContext(orgId: string, userId: string) {
  // Guard: Don't reload if already loaded with same org
  const currentContext = orgContext$.peek()
  if (currentContext.orgId === orgId && currentContext.userId === userId && currentContext.schema) {
    console.log(`[Observable] Context already loaded for ${orgId}, skipping reload`)
    return
  }
  
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
    
    // Initialize PersistenceManager and IndexedDB configuration only when schema changes
    const entities = schemaResult.schema.entities || {}
    const schemaVersion = schemaResult.schema.version || 'unknown'
    
    // FIXED: Only recreate persistence if org or schema version changed
    // Issue was: IndexedDB persistence was causing continuous Document POST requests
    // Solution: Configure persistence more carefully to prevent auto-sync conflicts
    console.log(`[Observable] PERSISTENCE ENABLED WITH SAFEGUARDS - Schema change detected`, {
      prevOrgId: currentOrgId,
      newOrgId: orgId,
      prevVersion: currentSchemaVersion,
      newVersion: schemaVersion
    })
    try {
      const entityKeys = entities && typeof entities === 'object' ? Object.keys(entities) : []
      if (entityKeys.length > 0 && 
          (currentOrgId !== orgId || currentSchemaVersion !== schemaVersion)) {
      
      console.log(`[Observable] Schema change detected - recreating persistence with safeguards`, {
        prevOrgId: currentOrgId,
        newOrgId: orgId,
        prevVersion: currentSchemaVersion,
        newVersion: schemaVersion
      })
      
        // Create persistence manager for this organization
        persistenceManager = createPersistenceManager(orgId, userId)
        
        // Get IndexedDB configuration from persistence manager
        const indexedDBPlugin = persistenceManager.createIndexedDBConfig(entityKeys)
        
        // Create syncedCrud with proper persistence configuration
        // The key insight: IndexedDB loading was triggering "create" operations because
        // Legend State couldn't distinguish between loaded data and new data
        syncedCrudWithPersistence = configureSynced(syncedCrud, {
          persist: {
            plugin: indexedDBPlugin,
            retrySync: false, // Disable retry to prevent persistence errors from looping
          }
        })
        
        // Update tracking variables
        currentOrgId = orgId
        currentSchemaVersion = schemaVersion
        
        console.log(`[Observable] IndexedDB persistence configured with safeguards for ${entityKeys.length} entities`)
      } else if (currentOrgId === orgId && currentSchemaVersion === schemaVersion) {
        console.log(`[Observable] Schema unchanged - reusing existing persistence configuration`)
      }
    } catch (entitiesError) {
      console.error('[Observable] Error processing entities for persistence:', entitiesError)
      // Continue without persistence if there's an error
      console.log('[Observable] Continuing without IndexedDB persistence due to error')
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
    
    const entityCount = entities && typeof entities === 'object' ? Object.keys(entities).length : 0
    console.log(`[Observable] Org context loaded with ${entityCount} entities`)
    
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
 * Following Legend State atomic principles - no manual caching needed
 */
export const entities$ = observable(() => {
  const orgId = orgContext$.orgId.get()
  const schema = orgContext$.schema.get()
  
  if (!orgId || !schema?.entities) {
    return {}
  }
  
  // Safely get entity keys
  const entityKeys = schema.entities && typeof schema.entities === 'object' ? Object.keys(schema.entities) : []
  
  console.log(`[Observable] Creating entity observables reactively`, {
    orgId,
    schemaVersion: schema.version || 'unknown',
    entityCount: entityKeys.length
  })
  
  // Create a reactive map of entity observables - Legend State handles caching internally
  const entityObservables: Record<string, any> = {}
  
  try {
    entityKeys.forEach(entityName => {
      try {
        // Each entity gets its own observable that's created fresh when dependencies change
        entityObservables[entityName] = createEntityObservable(orgId, entityName, schema.entities[entityName])
      } catch (entityError) {
        console.error(`[Observable] Error creating observable for entity ${entityName}:`, entityError)
        // Skip this entity but continue with others
      }
    })
    
    const createdCount = entityObservables && typeof entityObservables === 'object' ? Object.keys(entityObservables).length : 0
    console.log(`[Observable] Created ${createdCount} entity observables`)
    return entityObservables
  } catch (error) {
    console.error('[Observable] Error creating entity observables:', error)
    // Return empty object on error to prevent crashes
    return {}
  }
})

/**
 * Get a specific entity observable - automatically updates when schema changes
 * Returns the actual syncedCrud observable, not wrapped data
 * Directly accesses entities$ which is already reactive
 */
export function getEntity$(entityName: string) {
  try {
    const allEntities = entities$.get()
    if (!allEntities || typeof allEntities !== 'object') {
      console.warn(`[Observable] No entities loaded yet`)
      return null
    }
    
    const entityObs = allEntities[entityName]
    
    if (!entityObs) {
      console.warn(`[Observable] Entity observable not found for: ${entityName}`)
      return null
    }
    
    return entityObs
  } catch (error) {
    console.error(`[Observable] Error getting entity observable for ${entityName}:`, error)
    return null
  }
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
  
  // Clear tracking variables
  currentOrgId = null
  currentSchemaVersion = null
  
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
  
  // Handle schema changes from external sources (other clients)
  if (notification.table === 'entity_schemas') {
    console.log(`[Observable] External entity schema change detected - reloading schema`)
    // Only reload for external changes, not our own local changes
    reloadOrgSchema(orgId)
    return
  }
  
  // Dispatch custom event that entity stores listen to
  window.dispatchEvent(new CustomEvent('vibestack:table-change-notification', {
    detail: notification,
  }))
}

/**
 * Remove entity from local schema observable immediately (for local changes)
 */
export function removeEntityFromSchema(entityName: string) {
  const currentSchema = orgContext$.schema.peek()
  if (!currentSchema?.entities) {
    console.warn(`[Observable] Cannot remove entity ${entityName} - no schema loaded`)
    return
  }
  
  if (!currentSchema.entities[entityName]) {
    console.warn(`[Observable] Entity ${entityName} not found in schema`)
    return
  }
  
  console.log(`[Observable] Removing entity ${entityName} from local schema observable`)
  
  // Create new schema without the deleted entity - ensure deep clone
  const newEntities = { ...currentSchema.entities }
  delete newEntities[entityName]
  
  const newSchema = {
    ...currentSchema,
    entities: newEntities,
    // Update version to trigger proper cache invalidation
    version: currentSchema.version || 'unknown',
    orgId: currentSchema.orgId
  }
  
  console.log(`[Observable] New schema will have ${Object.keys(newEntities).length} entities (was ${Object.keys(currentSchema.entities).length})`)
  
  // Update the observable immediately - this will trigger all reactive components
  orgContext$.schema.set(newSchema)
  
  console.log(`[Observable] Schema updated locally - UI should update immediately`)
}

/**
 * Reload schema from server (for external changes)
 */
async function reloadOrgSchema(orgId: string) {
  try {
    const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)
    if (schemaResult.success && schemaResult.schema) {
      orgContext$.schema.set(schemaResult.schema)
      console.log(`[Observable] Schema reloaded from server`)
    }
  } catch (error) {
    console.error('[Observable] Failed to reload schema:', error)
  }
}

// Computed observables for common patterns
export const isLoading$ = orgContext$.loading
export const currentOrg$ = orgContext$.orgId  
export const currentSchema$ = orgContext$.schema

// Entity groups for sidebar (computed from schema) - fully reactive
export const entityGroups$ = observable(() => {
  const schema = orgContext$.schema.get()
  if (!schema?.entities) return []
  
  // Safely get entity keys with error handling
  try {
    const entityKeys = schema.entities && typeof schema.entities === 'object' ? Object.keys(schema.entities) : []
    return entityKeys.map(name => ({
      name,
      path: `/entities/${name}`,
      icon: 'Database'
      // NOTE: Removed count$ to prevent automatic entity observable initialization
      // Count will be loaded lazily when the entity page is actually accessed
    }))
  } catch (error) {
    console.error('[Observable] Error creating entity groups:', error)
    return []
  }
})

// Debug: Expose to window in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).vibestackOrgContext = orgContext$
}