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

// Custom error classes for better error handling
export class ValidationError extends Error {
  constructor(message: string, public errors: any[] = []) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends Error {
  constructor(message: string, public conflictData?: any) {
    super(message)
    this.name = 'ConflictError'
  }
}

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
 * Validate item against server-side validation rules
 */
async function validateItem(orgId: string, entityName: string, item: any, operation: 'create' | 'update'): Promise<boolean> {
  try {
    const baseUrl = `/api/dataforge/orgs/${orgId}/data/${entityName}`
    const response = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Entity-Name': entityName,
        'X-Org-Context': orgId,
        'X-Validation-Operation': operation,
      },
      credentials: 'include',
      body: JSON.stringify({ item, operation })
    })

    if (!response.ok) {
      if (response.status === 404) {
        // Validation endpoint doesn't exist - skip validation
        console.info(`[Observable] Validation endpoint not available for ${entityName} - skipping`)
        return true
      }
      
      const validation = await response.json().catch(() => ({}))
      const errors = validation.errors || [validation.message || `Validation failed: ${response.status}`]
      throw new ValidationError(
        `Validation failed for ${entityName} ${operation}: ${errors.join(', ')}`,
        errors
      )
    }

    const result = await response.json()
    if (!result.valid) {
      const errors = result.errors || ['Unknown validation error']
      throw new ValidationError(
        `Validation failed for ${entityName} ${operation}: ${errors.join(', ')}`,
        errors
      )
    }

    return true
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }
    // Network errors or other issues - don't block the operation
    console.warn(`[Observable] Validation check failed for ${entityName} ${operation}:`, error.message)
    return true
  }
}

/**
 * Create a synced entity observable using Legend State patterns
 */
function createEntityObservable(orgId: string, entityName: string, schema?: any) {
  const baseUrl = `/api/dataforge/orgs/${orgId}/data/${entityName}`
  const syncUrl = `/api/dataforge/orgs/${orgId}/sync/${entityName}`
  
  // Create the syncedCrud configuration with proper differential sync
  const crudConfig = {
    // CRITICAL: Enable Legend State's built-in differential sync
    changesSince: 'last-sync',
    
    // CRITICAL: Field mappings for differential sync tracking
    fieldId: 'id',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: 'deleted',
    
    // LIST - Use differential sync endpoint when changesSince is provided
    list: async ({ changesSince }: { changesSince?: string } = {}) => {
      try {
        // Use sync endpoint for differential sync, fallback to regular endpoint
        const url = changesSince ? 
          `${syncUrl}?changesSince=${encodeURIComponent(changesSince)}&limit=1000` : 
          baseUrl;
        
        console.log(`[Observable] ${changesSince ? 'Differential' : 'Full'} sync for ${entityName}:`, url);
        
        const response = await fetch(url, {
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
        const data = result.data || []
        
        // Log sync results for debugging
        if (changesSince) {
          console.log(`[Observable] Differential sync ${entityName}: ${data.length} changed records since ${changesSince}`)
        } else {
          console.log(`[Observable] Full sync ${entityName}: ${data.length} total records`)
        }
        
        return data
      } catch (error) {
        console.info(`[Observable] Network error loading ${entityName} - returning empty data:`, error.message)
        return []
      }
    },

    // CREATE - Add new item with enhanced error context
    create: async (item: any) => {
      try {
        // Optional: Validate before creating
        if (schema?.validation !== false) {
          try {
            await validateItem(orgId, entityName, item, 'create')
          } catch (validationError) {
            console.warn(`[Observable] Validation failed for ${entityName}:`, validationError.message)
            throw validationError
          }
        }

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Entity-Name': entityName, // Help server debugging
            'X-Org-Context': orgId,      // Audit trail
            'X-User-Context': orgContext$.userId.peek() || 'unknown', // User context
          },
          credentials: 'include',
          body: JSON.stringify(item)
        })
        
        if (!response.ok) {
          // Enhanced error context
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`
          
          if (response.status === 500) {
            throw new Error(`Entity ${entityName} table not created yet - cannot create records`)
          }
          if (response.status === 400) {
            throw new Error(`Invalid ${entityName} data: ${errorMessage}`)
          }
          if (response.status === 403) {
            throw new Error(`Permission denied: Cannot create ${entityName}`)
          }
          if (response.status === 409) {
            throw new Error(`Conflict: ${entityName} already exists or violates constraints`)
          }
          
          throw new Error(`Create ${entityName} failed: ${errorMessage}`)
        }
        
        const result = await response.json()
        console.log(`[Observable] Successfully created ${entityName}:`, result.data?.id || 'unknown-id')
        return result.data || item
      } catch (error) {
        // Add context to help debugging
        console.error(`[Observable] Create error for ${entityName}:`, {
          error: error.message,
          item: item ? { id: item.id, ...Object.keys(item).slice(0, 3) } : 'null', // Avoid logging sensitive data
          orgId,
          entityName
        })
        throw error
      }
    },

    // UPDATE - Modify existing item with enhanced error context
    update: async (item: any) => {
      try {
        // Optional: Validate before updating
        if (schema?.validation !== false) {
          try {
            await validateItem(orgId, entityName, item, 'update')
          } catch (validationError) {
            console.warn(`[Observable] Validation failed for ${entityName} update:`, validationError.message)
            throw validationError
          }
        }

        const response = await fetch(`${baseUrl}/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Entity-Name': entityName,
            'X-Org-Context': orgId,
            'X-User-Context': orgContext$.userId.peek() || 'unknown',
            'X-Record-Id': item.id, // Help with server-side debugging
          },
          credentials: 'include',
          body: JSON.stringify(item)
        })
        
        if (!response.ok) {
          // Enhanced error context
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`
          
          if (response.status === 404) {
            throw new Error(`${entityName} not found: Record may have been deleted`)
          }
          if (response.status === 409) {
            throw new Error(`Conflict updating ${entityName}: ${errorMessage}`)
          }
          if (response.status === 400) {
            throw new Error(`Invalid ${entityName} update data: ${errorMessage}`)
          }
          if (response.status === 403) {
            throw new Error(`Permission denied: Cannot update ${entityName}`)
          }
          if (response.status === 500) {
            throw new Error(`Entity ${entityName} table not created yet - cannot update records`)
          }
          
          throw new Error(`Update ${entityName} failed: ${errorMessage}`)
        }
        
        const result = await response.json()
        console.log(`[Observable] Successfully updated ${entityName}:`, item.id)
        return result.data || item
      } catch (error) {
        console.error(`[Observable] Update error for ${entityName}:`, {
          error: error.message,
          itemId: item?.id || 'unknown',
          orgId,
          entityName
        })
        throw error
      }
    },

    // DELETE - Remove item with enhanced error context
    delete: async (item: any) => {
      try {
        const response = await fetch(`${baseUrl}/${item.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 
            'Accept': 'application/json',
            'X-Entity-Name': entityName,
            'X-Org-Context': orgId,
            'X-User-Context': orgContext$.userId.peek() || 'unknown',
            'X-Record-Id': item.id,
          }
        })
        
        if (!response.ok) {
          // Enhanced error context
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`
          
          if (response.status === 404) {
            console.warn(`[Observable] ${entityName} already deleted:`, item.id)
            return undefined // Treat as successful deletion
          }
          if (response.status === 403) {
            throw new Error(`Permission denied: Cannot delete ${entityName}`)
          }
          if (response.status === 409) {
            throw new Error(`Cannot delete ${entityName}: ${errorMessage}`)
          }
          
          throw new Error(`Delete ${entityName} failed: ${errorMessage}`)
        }
        
        console.log(`[Observable] Successfully deleted ${entityName}:`, item.id)
        return undefined // Successful deletion
      } catch (error) {
        console.error(`[Observable] Delete error for ${entityName}:`, {
          error: error.message,
          itemId: item?.id || 'unknown',
          orgId,
          entityName
        })
        throw error
      }
    },

    // BATCH UPDATE - Modify multiple items efficiently
    batchUpdate: async (items: any[]) => {
      try {
        if (!items || items.length === 0) {
          return []
        }

        console.log(`[Observable] Batch updating ${items.length} ${entityName} records`)

        const response = await fetch(`${baseUrl}/batch`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Entity-Name': entityName,
            'X-Org-Context': orgId,
            'X-User-Context': orgContext$.userId.peek() || 'unknown',
            'X-Batch-Size': items.length.toString(),
          },
          credentials: 'include',
          body: JSON.stringify({ operations: items })
        })

        if (!response.ok) {
          // Enhanced error context for batch operations
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`
          
          if (response.status === 400) {
            throw new Error(`Invalid batch ${entityName} data: ${errorMessage}`)
          }
          if (response.status === 403) {
            throw new Error(`Permission denied: Cannot batch update ${entityName}`)
          }
          if (response.status === 413) {
            throw new Error(`Batch too large: Reduce number of ${entityName} items`)
          }
          
          throw new Error(`Batch update ${entityName} failed: ${errorMessage}`)
        }

        const result = await response.json()
        console.log(`[Observable] Successfully batch updated ${items.length} ${entityName} records`)
        return result.data || items
      } catch (error) {
        console.error(`[Observable] Batch update error for ${entityName}:`, {
          error: error.message,
          itemCount: items?.length || 0,
          orgId,
          entityName
        })
        throw error
      }
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

    // Generate temporary IDs for optimistic updates
    generateId: () => `temp-${crypto.randomUUID()}`,
    
    // Initial empty state - use empty array for list operations to prevent auto-creation
    initial: [],
    
    // PERSISTENCE: Enable IndexedDB persistence with differential sync support
    // This is CRITICAL for changesSince to work - Legend State stores sync timestamps here
    ...(syncedCrudWithPersistence && persistenceManager ? (() => {
      const persistOptions = persistenceManager.getPersistOptions(entityName)
      console.log(`[Observable] Persistence enabled for ${entityName} with differential sync:`, persistOptions)
      return { 
        persist: {
          ...persistOptions,
          // Ensure retrySync is enabled for differential sync
          retrySync: true
        }
      }
    })() : {
      // Fallback: Basic persistence for differential sync even without IndexedDB
      persist: {
        name: `entity-${entityName}`,
        retrySync: true
      }
    })
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

/**
 * Batch operation utilities for components
 */
export const batchOperations = {
  /**
   * Update multiple items of the same entity type
   */
  async batchUpdate(entityName: string, updates: Array<{ id: string, data: any }>) {
    const entity$ = getEntity$(entityName)
    if (!entity$ || !entity$.batchUpdate) {
      throw new Error(`Entity ${entityName} not found or doesn't support batch operations`)
    }
    
    return entity$.batchUpdate(updates)
  },

  /**
   * Delete multiple items efficiently
   */
  async batchDelete(entityName: string, ids: string[]) {
    const entity$ = getEntity$(entityName)
    if (!entity$) {
      throw new Error(`Entity ${entityName} not found`)
    }

    // Use batch deletion if available, otherwise fall back to individual deletes
    const items = ids.map(id => ({ id }))
    const results = await Promise.allSettled(
      items.map(item => entity$.delete(item))
    )
    
    const failures = results
      .map((result, index) => ({ result, id: ids[index] }))
      .filter(({ result }) => result.status === 'rejected')
    
    if (failures.length > 0) {
      console.warn(`[BatchOperations] ${failures.length}/${ids.length} deletions failed:`, failures)
    }
    
    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: failures.length,
      failures: failures.map(f => ({ id: f.id, error: f.result.reason }))
    }
  },

  /**
   * Create multiple items efficiently
   */
  async batchCreate(entityName: string, items: any[]) {
    const entity$ = getEntity$(entityName)
    if (!entity$) {
      throw new Error(`Entity ${entityName} not found`)
    }

    // Create items individually with proper error handling
    const results = await Promise.allSettled(
      items.map(item => entity$.create(item))
    )
    
    const failures = results
      .map((result, index) => ({ result, item: items[index] }))
      .filter(({ result }) => result.status === 'rejected')
    
    if (failures.length > 0) {
      console.warn(`[BatchOperations] ${failures.length}/${items.length} creations failed:`, failures)
    }
    
    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: failures.length,
      failures: failures.map(f => ({ item: f.item, error: f.result.reason })),
      created: results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value)
    }
  }
}

/**
 * Enhanced entity operations with better error handling
 */
export const entityOperations = {
  /**
   * Safe entity creation with validation
   */
  async createEntity(entityName: string, data: any, options: { validate?: boolean } = {}) {
    try {
      const entity$ = getEntity$(entityName)
      if (!entity$) {
        throw new Error(`Entity ${entityName} not found`)
      }

      // Pre-validate if requested
      if (options.validate !== false) {
        const orgId = orgContext$.orgId.peek()
        if (orgId) {
          await validateItem(orgId, entityName, data, 'create')
        }
      }

      const result = await entity$.create(data)
      
      // Emit success event for UI feedback
      window.dispatchEvent(new CustomEvent('vibestack:entity-created', {
        detail: { entityName, data: result }
      }))
      
      return result
    } catch (error) {
      // Emit error event for UI feedback
      window.dispatchEvent(new CustomEvent('vibestack:entity-error', {
        detail: { entityName, operation: 'create', error: error.message }
      }))
      throw error
    }
  },

  /**
   * Safe entity update with optimistic updates
   */
  async updateEntity(entityName: string, id: string, data: any, options: { validate?: boolean } = {}) {
    try {
      const entity$ = getEntity$(entityName)
      if (!entity$) {
        throw new Error(`Entity ${entityName} not found`)
      }

      const fullData = { ...data, id }

      // Pre-validate if requested
      if (options.validate !== false) {
        const orgId = orgContext$.orgId.peek()
        if (orgId) {
          await validateItem(orgId, entityName, fullData, 'update')
        }
      }

      const result = await entity$.update(fullData)
      
      // Emit success event for UI feedback
      window.dispatchEvent(new CustomEvent('vibestack:entity-updated', {
        detail: { entityName, id, data: result }
      }))
      
      return result
    } catch (error) {
      // Emit error event for UI feedback
      window.dispatchEvent(new CustomEvent('vibestack:entity-error', {
        detail: { entityName, operation: 'update', id, error: error.message }
      }))
      throw error
    }
  },

  /**
   * Safe entity deletion
   */
  async deleteEntity(entityName: string, id: string) {
    try {
      const entity$ = getEntity$(entityName)
      if (!entity$) {
        throw new Error(`Entity ${entityName} not found`)
      }

      const result = await entity$.delete({ id })
      
      // Emit success event for UI feedback
      window.dispatchEvent(new CustomEvent('vibestack:entity-deleted', {
        detail: { entityName, id }
      }))
      
      return result
    } catch (error) {
      // Emit error event for UI feedback
      window.dispatchEvent(new CustomEvent('vibestack:entity-error', {
        detail: { entityName, operation: 'delete', id, error: error.message }
      }))
      throw error
    }
  }
}

// Debug: Expose to window in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).vibestackOrgContext = orgContext$
  ;(window as any).vibestackBatchOps = batchOperations
  ;(window as any).vibestackEntityOps = entityOperations
}