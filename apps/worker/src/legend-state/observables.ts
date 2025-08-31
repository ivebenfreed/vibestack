/**
 * VibeStack Legend State Observables
 * 
 * Direct observable implementation using Legend State patterns.
 * Uses syncedCrud for automatic CRUD operations with persistence.
 * Updated to fix HMR reload issues - Force timestamp update.
 */

import { observable, syncState, when } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { configureSynced } from '@legendapp/state/sync'
import { orgSchemaClient } from '@/lib/schema-client'
import { createPersistenceManager, type PersistenceManager } from './helpers/PersistenceManager'
import { stateLog } from '@/logger';
const log = stateLog('legend-state/observables.ts');

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
        log.info(`[Observable] Validation endpoint not available for ${entityName} - skipping`)
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
    log.warn(`[Observable] Validation check failed for ${entityName} ${operation}:`, error.message)
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
    
    // LIST - Legend State passes lastSync timestamp when changesSince: 'last-sync' is configured
    list: async (params: { lastSync?: number } = {}) => {
      try {
        // DEBUG: Log what Legend State is passing us
        log.info(`[Observable] List called for ${entityName}:`, {
          lastSync: params?.lastSync,
          lastSyncType: typeof params?.lastSync,
          hasLastSync: !!params?.lastSync,
          lastSyncDate: params?.lastSync ? new Date(params.lastSync).toISOString() : null
        });
        
        // Use sync endpoint for differential sync when Legend State provides lastSync timestamp
        const url = params?.lastSync ? 
          `${syncUrl}?changesSince=${encodeURIComponent(new Date(params.lastSync).toISOString())}&limit=1000` : 
          baseUrl;
        
        log.info(`[Observable] ${params?.lastSync ? 'Differential' : 'Full'} sync for ${entityName}:`, url);
        
        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        })
        
        if (!response.ok) {
          // Handle common cases gracefully
          if (response.status === 404) {
            log.info(`[Observable] Entity ${entityName} table not found (404) - returning empty data`)
            return []
          }
          if (response.status === 500) {
            // Likely table doesn't exist - don't spam console
            log.info(`[Observable] Entity ${entityName} table not created yet (500) - returning empty data`)
            return []
          }
          log.warn(`[Observable] Failed to load ${entityName}:`, response.status)
          return []
        }
        
        const result = await response.json()
        const data = result.data || []
        
        // Log sync results for debugging
        if (params?.lastSync) {
          log.info(`[Observable] Differential sync ${entityName}: ${data.length} changed records since ${new Date(params.lastSync).toISOString()}`)
        } else {
          log.info(`[Observable] Full sync ${entityName}: ${data.length} total records`)
        }
        
        return data
      } catch (error) {
        log.info(`[Observable] Network error loading ${entityName} - returning empty data:`, error.message)
        return []
      }
    },

    // CREATE - Add new item with enhanced error context
    create: async (item: any) => {
      try {
        // Optional: Validate before creating - disabled for now since validation endpoint doesn't exist
        if (false && schema?.validation !== false) {
          try {
            await validateItem(orgId, entityName, item, 'create')
          } catch (validationError) {
            log.warn(`[Observable] Validation failed for ${entityName}:`, validationError.message)
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
        log.info(`[Observable] Successfully created ${entityName}:`, result.data?.id || 'unknown-id')
        return result.data || item
      } catch (error) {
        // Add context to help debugging
        log.error(`[Observable] Create error for ${entityName}:`, {
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
        // Optional: Validate before updating - disabled for now since validation endpoint doesn't exist
        if (false && schema?.validation !== false) {
          try {
            await validateItem(orgId, entityName, item, 'update')
          } catch (validationError) {
            log.warn(`[Observable] Validation failed for ${entityName} update:`, validationError.message)
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
        log.info(`[Observable] Successfully updated ${entityName}:`, item.id)
        return result.data || item
      } catch (error) {
        log.error(`[Observable] Update error for ${entityName}:`, {
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
            log.warn(`[Observable] ${entityName} already deleted:`, item.id)
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
        
        log.info(`[Observable] Successfully deleted ${entityName}:`, item.id)
        return undefined // Successful deletion
      } catch (error) {
        log.error(`[Observable] Delete error for ${entityName}:`, {
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

        log.info(`[Observable] Batch updating ${items.length} ${entityName} records`)

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
        log.info(`[Observable] Successfully batch updated ${items.length} ${entityName} records`)
        return result.data || items
      } catch (error) {
        log.error(`[Observable] Batch update error for ${entityName}:`, {
          error: error.message,
          itemCount: items?.length || 0,
          orgId,
          entityName
        })
        throw error
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
    
    // Set initial to empty object to trigger the initial fetch
    // syncedCrud needs this to know it should start loading data
    initial: {},
    
    // Add waitFor to delay sync until persistence is ready
    ...(syncedCrudWithPersistence && persistenceManager ? {
      waitFor: new Promise(resolve => setTimeout(resolve, 100)) // Small delay for persistence
    } : {}),
    
    // PERSISTENCE: Enable IndexedDB persistence with differential sync support
    // This is CRITICAL for changesSince to work - Legend State stores sync timestamps here
    ...(syncedCrudWithPersistence && persistenceManager ? (() => {
      const persistOptions = persistenceManager.getPersistOptions(entityName)
      // Persistence configured for entity (logging reduced for performance)
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
      
      // Only log notifications in development for debugging
      if (import.meta.env.DEV && notification.test) {
        log.info(`[Observable] ${entityName} received test notification:`, notification)
      }
      
      // Check if notification is for this entity
      const isRelevantNotification = notification?.tables?.some((tableName: string) => {
        const expectedTableName = entityName.toLowerCase() + 's'
        return tableName === expectedTableName
      })
      
      if (isRelevantNotification) {
        if (import.meta.env.DEV) {
          log.info(`[Observable] ${entityName} sync triggered by WebSocket`)
        }
        refresh()
      }
    }
    
    // Listen for table change notifications
    window.addEventListener('vibestack:table-change-notification', handler as any)
    
    // WebSocket subscription configured (logging reduced for performance)
    
    // Return cleanup function
    return () => {
      window.removeEventListener('vibestack:table-change-notification', handler as any)
      if (import.meta.env.DEV) {
        log.info(`[Observable] Unsubscribed from WebSocket notifications for ${entityName}`)
      }
    }
  }
  
  const syncedCrudFn = syncedCrudWithPersistence || syncedCrud
  
  if (import.meta.env.DEV) {
    log.info(`[Observable] Creating syncedCrud for ${entityName}`)
  }
  
  // CRITICAL FIX: syncedCrud must be wrapped in observable() to create proper observable with .get()/.set() methods
  // The correct pattern is: observable(syncedCrud(config))
  return observable(syncedCrudFn(crudConfig))
}

/**
 * Load organization context and initialize entity stores
 * This should only be called by auth state machines, not components
 */
export async function loadOrgContext(orgId: string, userId: string) {
  // Guard: Don't reload if already loaded with same org
  const currentContext = orgContext$.peek()
  if (currentContext.orgId === orgId && currentContext.userId === userId && currentContext.schema) {
    log.info(`[Observable] Context already loaded for ${orgId}, skipping reload`)
    return
  }
  
  log.info(`[Observable] Loading org context for ${orgId}`)
  
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
    log.info(`[Observable] PERSISTENCE ENABLED WITH SAFEGUARDS - Schema change detected`, {
      prevOrgId: currentOrgId,
      newOrgId: orgId,
      prevVersion: currentSchemaVersion,
      newVersion: schemaVersion
    })
    try {
      const entityKeys = entities && typeof entities === 'object' ? Object.keys(entities) : []
      if (entityKeys.length > 0 && 
          (currentOrgId !== orgId || currentSchemaVersion !== schemaVersion)) {
      
      log.info(`[Observable] Schema change detected - recreating persistence with safeguards`, {
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
        // CRITICAL: retrySync must be TRUE for changesSince to work properly
        syncedCrudWithPersistence = configureSynced(syncedCrud, {
          persist: {
            plugin: indexedDBPlugin,
            retrySync: true, // REQUIRED for differential sync - stores sync timestamps
          }
        })
        
        // Update tracking variables
        currentOrgId = orgId
        currentSchemaVersion = schemaVersion
        
        log.info(`[Observable] IndexedDB persistence configured with safeguards for ${entityKeys.length} entities`)
      } else if (currentOrgId === orgId && currentSchemaVersion === schemaVersion) {
        log.info(`[Observable] Schema unchanged - reusing existing persistence configuration`)
      }
    } catch (entitiesError) {
      log.error('[Observable] Error processing entities for persistence:', entitiesError)
      // Continue without persistence if there's an error
      log.info('[Observable] Continuing without IndexedDB persistence due to error')
    }
    
    // Update context
    orgContext$.assign({
      orgId,
      userId,
      schema: schemaResult.schema,
      loading: false,
      error: null,
    })
    
    // Pre-initialize commonly used entities to avoid race conditions with table components
    // This triggers the lazy getters in a controlled way after schema is loaded
    const entityCount = entities && typeof entities === 'object' ? Object.keys(entities).length : 0
    log.info(`[Observable] Org context loaded with ${entityCount} entities`)
    
    // Pre-initialize common entities by accessing them (triggers lazy creation)
    if (entities && typeof entities === 'object') {
      const commonEntities = ['Task', 'Project', 'Client', 'Invoice'] // Most commonly used entities
      commonEntities.forEach(entityName => {
        if (entities[entityName]) {
          try {
            // Access the entity to trigger lazy getter initialization
            const entityObs = entities[entityName]
            if (entityObs) {
              log.info(`[Observable] Pre-initialized ${entityName} entity observable`)
            }
          } catch (error) {
            log.warn(`[Observable] Could not pre-initialize ${entityName}:`, error)
          }
        }
      })
    }
    
  } catch (error) {
    log.error('[Observable] Failed to load org context:', error)
    orgContext$.assign({
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to load organization'
    })
    throw error
  }
}

// Persistent cache for entity observables across schema changes
const globalEntityCache: Record<string, any> = {}

/**
 * Reactive entity observables - automatically recreates when schema changes
 * This creates entity observables lazily and reactively based on schema
 * Following Legend State atomic principles - no manual caching needed
 * 
 * Enhanced for better async initialization handling
 */
export const entities$ = observable(() => {
  const orgId = orgContext$.orgId.get()
  const schema = orgContext$.schema.get()
  const loading = orgContext$.loading.get()
  
  // Return empty object while still loading or no context
  if (loading || !orgId || !schema?.entities) {
    log.info(`[Observable] Entities not ready yet`, {
      loading,
      hasOrgId: !!orgId,
      hasSchema: !!schema,
      hasEntities: !!schema?.entities
    })
    return {}
  }
  
  // Safely get entity keys
  const entityKeys = schema.entities && typeof schema.entities === 'object' ? Object.keys(schema.entities) : []
  
  log.info(`[Observable] Creating entity observables reactively`, {
    orgId,
    schemaVersion: schema.version || 'unknown',
    entityCount: entityKeys.length
  })
  
  // Create entity observables using lazy initialization with global caching
  // This ensures observables persist across schema changes and are created only when accessed
  const entityObservables: Record<string, any> = {}
  
  try {
    entityKeys.forEach(entityName => {
      // Define a getter that creates the observable lazily with caching
      Object.defineProperty(entityObservables, entityName, {
        get() {
          // Use global cache key for this org/entity combination
          const cacheKey = `${orgId}:${entityName}`
          
          // Return cached observable if it exists
          if (globalEntityCache[cacheKey]) {
            return globalEntityCache[cacheKey]
          }
          
          // Create observable only when accessed for the first time
          try {
            const observable = createEntityObservable(orgId, entityName, schema.entities[entityName])
            globalEntityCache[cacheKey] = observable
            return observable
          } catch (entityError) {
            log.error(`[Observable] Error creating observable for entity ${entityName}:`, entityError)
            return null
          }
        },
        enumerable: true,
        configurable: true
      })
    })
    
    log.info(`[Observable] Set up lazy entity observables for ${entityKeys.length} entities`)
    return entityObservables
  } catch (error) {
    log.error('[Observable] Error setting up entity observables:', error)
    // Return empty object on error to prevent crashes
    return {}
  }
})

/**
 * Get a specific entity observable - automatically updates when schema changes
 * Returns the actual syncedCrud observable, not wrapped data
 * Always triggers lazy getter to ensure we get the observable, not the getter function
 */
export function getEntity$(entityName: string) {
  try {
    // Check if we have org context and schema first
    const currentOrgId = orgContext$.orgId.peek()
    const currentSchema = orgContext$.schema.peek()
    
    if (!currentOrgId || !currentSchema?.entities?.[entityName]) {
      log.warn(`[Observable] Entity ${entityName} not available - missing context or schema`)
      return null
    }
    
    // Use global cache directly for more reliable access
    const cacheKey = `${currentOrgId}:${entityName}`
    
    // Check if we already have the observable cached
    if (globalEntityCache[cacheKey]) {
      log.info(`[Observable] Retrieved cached ${entityName} observable`)
      return globalEntityCache[cacheKey]
    }
    
    // Create the observable directly if not cached
    try {
      log.info(`[Observable] Creating new observable for ${entityName}`)
      const observable = createEntityObservable(currentOrgId, entityName, currentSchema.entities[entityName])
      globalEntityCache[cacheKey] = observable
      
      // DEBUG: Check what we created
      log.info(`[Observable] Created ${entityName} observable`, {
        type: typeof observable,
        isFunction: typeof observable === 'function',
        hasGet: typeof observable?.get === 'function',
        hasPeek: typeof observable?.peek === 'function',
        hasSet: typeof observable?.set === 'function',
        hasAssign: typeof observable?.assign === 'function',
        constructor: observable?.constructor?.name
      })
      
      return observable
    } catch (createError) {
      log.error(`[Observable] Error creating observable for ${entityName}:`, createError)
      return null
    }
  } catch (error) {
    log.error(`[Observable] Error getting entity observable for ${entityName}:`, error)
    return null
  }
}

/**
 * Clear all observables (for logout or org switching)
 */
export function clearContext() {
  log.info('[Observable] Clearing all observables')
  
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
  
  log.info(`[Observable] Table notification for ${notification.table}:`, notification.operation)
  
  // Handle schema changes from external sources (other clients)
  if (notification.table === 'entity_schemas') {
    log.info(`[Observable] External entity schema change detected - reloading schema`)
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
    log.warn(`[Observable] Cannot remove entity ${entityName} - no schema loaded`)
    return
  }
  
  if (!currentSchema.entities[entityName]) {
    log.warn(`[Observable] Entity ${entityName} not found in schema`)
    return
  }
  
  log.info(`[Observable] Removing entity ${entityName} from local schema observable`)
  
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
  
  log.info(`[Observable] New schema will have ${Object.keys(newEntities).length} entities (was ${Object.keys(currentSchema.entities).length})`)
  
  // Update the observable immediately - this will trigger all reactive components
  orgContext$.schema.set(newSchema)
  
  log.info(`[Observable] Schema updated locally - UI should update immediately`)
}

/**
 * Reload schema from server (for external changes)
 */
async function reloadOrgSchema(orgId: string) {
  try {
    const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)
    if (schemaResult.success && schemaResult.schema) {
      orgContext$.schema.set(schemaResult.schema)
      log.info(`[Observable] Schema reloaded from server`)
    }
  } catch (error) {
    log.error('[Observable] Failed to reload schema:', error)
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
    log.error('[Observable] Error creating entity groups:', error)
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
      log.warn(`[BatchOperations] ${failures.length}/${ids.length} deletions failed:`, failures)
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
      log.warn(`[BatchOperations] ${failures.length}/${items.length} creations failed:`, failures)
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

      // Pre-validate if requested - disabled for now since validation endpoint doesn't exist
      if (false && options.validate !== false) {
        const orgId = orgContext$.orgId.peek()
        if (orgId) {
          await validateItem(orgId, entityName, data, 'create')
        }
      }

      // According to Legend State docs, for list-based syncedCrud, create by setting with generated ID
      // Generate a temporary ID (will be replaced by server response)
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Set the new record - Legend State will automatically sync to server
      entity$[tempId].set(data)
      
      // Get the result (may have temporary ID initially)
      const result = entity$[tempId].get()
      
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
   * Update entity observable directly - let syncedCrud handle server sync automatically
   * This is the correct Legend State pattern: UI → Observable → syncedCrud → Server
   */
  async updateEntity(entityName: string, id: string, data: any, options: { validate?: boolean } = {}) {
    try {
      log.info(`[Observable] Direct observable update for ${entityName}:${id}`, data)
      
      // Get the entity observable (this is the syncedCrud observable)
      const entity$ = getEntity$(entityName)
      if (!entity$) {
        throw new Error(`Entity ${entityName} observable not found`)
      }
      
      log.info(`[Observable] Found entity record ${entityName}:${id}, updating fields:`, Object.keys(data))
      
      // CORRECT PATTERN: For syncedCrud with list operations, access the record directly
      // entity$[id] gives us the observable for that specific record
      // entity$[id].fieldName.set(value) or entity$[id].assign({...updates})
      
      // FIXED: Use syncedCrud's update function directly
      // syncedCrud observables provide CRUD operations: list, create, update, delete
      // Don't access individual record observables, use the built-in update function
      log.info(`[Observable] Using syncedCrud update for ${entityName}:${id}:`, data)
      
      // Get current data from the observable
      const allRecords = entity$.get()
      const currentRecord = allRecords?.[id]
      
      if (!currentRecord || typeof currentRecord !== 'object') {
        throw new Error(`Record ${id} not found in ${entityName}`)
      }
      
      // Create updated record by merging current data with updates  
      const updatedRecord = { ...currentRecord, ...data, updated_at: new Date().toISOString() }
      log.info(`[Observable] Merged record data:`, updatedRecord)
      
      // CORRECT syncedCrud pattern: update the record in the observable data
      // This will trigger the update function defined in the syncedCrud config and sync to server
      const newRecords = { ...allRecords, [id]: updatedRecord }
      entity$.set(newRecords)
      
      log.info(`✅ [Observable] Observable update completed for ${entityName}:${id}`)
      // syncedCrud will automatically handle the server sync in the background
      
      // Return the updated record that was already merged above
      return updatedRecord
      
    } catch (error) {
      log.error(`❌ [Observable] Update failed for ${entityName}:${id}`, { error: error.message, data })
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

      // According to Legend State docs, for list-based syncedCrud:
      // Delete by removing the record from the observable Record<string, T>
      // This will trigger the delete function in syncedCrud
      const currentRecords = entity$.get()
      const recordToDelete = currentRecords[id]
      
      if (!recordToDelete) {
        throw new Error(`Record with id ${id} not found in entity ${entityName}`)
      }
      
      // Use the same approach as update - call syncedCrud delete function directly
      try {
        // Get the internal sync configuration and call delete function
        const syncConfig = (entity$ as any)[Symbol.for('LegendState_syncedCrud')]
        if (syncConfig && syncConfig.delete) {
          const deleteResult = await syncConfig.delete(recordToDelete, { id })
          log.info(`[Observable] Direct delete result:`, deleteResult)
          return { success: true }
        } else {
          throw new Error('syncedCrud delete function not accessible')
        }
      } catch (directDeleteError) {
        log.warn(`[Observable] Direct syncedCrud delete failed:`, directDeleteError.message)
        
        // Fallback: trigger a manual server delete (bypass Legend State sync)
        const orgId = orgContext$.orgId.peek()
        if (!orgId) {
          throw new Error('No organization context available')
        }
        
        const baseUrl = `/api/dataforge/orgs/${orgId}/data/${entityName}`
        const response = await fetch(`${baseUrl}/${id}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
          credentials: 'include'
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`Server delete failed: ${errorData.message || response.status}`)
        }
        
        // Manually trigger a refresh to get updated data
        log.info(`[Observable] Manual server delete successful, triggering refresh`)
        if (typeof (entity$ as any).refresh === 'function') {
          (entity$ as any).refresh()
        }
        
        return { success: true }
      }
      
      // Emit success event for UI feedback
      window.dispatchEvent(new CustomEvent('vibestack:entity-deleted', {
        detail: { entityName, id }
      }))
      
      return { success: true }
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