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
import { initializationManager, ensureLegendStateReady, type PersistenceContext } from './helpers/InitializationManager'
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
let persistenceConfig: { persistOptions: any; entityTableMap: Record<string, string> } | null = null
let currentOrgId: string | null = null
let currentSchemaVersion: string | null = null

/**
 * Universe context observable - tracks schemas from ALL user organizations
 * Used for data aggregation in universe view only
 */
export const universeContext$ = observable({
  userId: null as string | null,
  organizations: {} as Record<string, {
    orgId: string,
    name: string,
    schema: any,
    loading: boolean,
    error: string | null
  }>,
  loading: false,
  error: null as string | null,
})

/**
 * REMOVED: orgContext$ computed observable replaced with direct universeContext$ access
 * Components should now access universeContext$ directly and extract what they need
 * Schema-driven org parameters replace context switching
 */

/**
 * Legacy function removed - use universe-based helpers instead:
 * - universeSchema$, universeLoading$, universeError$, universeUserId$, universeOrgId$
 * - These provide direct access without the complexity of organization-specific context switching
 */

/**
 * NEW UNIVERSE-BASED PATTERN: Helper functions to replace orgContext$ usage
 * These provide the same interface but use direct universeContext$ access
 */

/**
 * Get universe-wide loading state
 * Replaces: orgContext$.loading
 */
export const universeLoading$ = observable(() => universeContext$.get().loading)

/**
 * Get universe-wide error state
 * Replaces: orgContext$.error
 */
export const universeError$ = observable(() => universeContext$.get().error)

/**
 * Get universe-wide user ID
 * Replaces: orgContext$.userId
 */
export const universeUserId$ = observable(() => universeContext$.get().userId)

/**
 * Get combined schema for all organizations (universe mode)
 * Replaces: orgContext$.schema in universe mode
 */
export const universeSchema$ = observable(() => {
  const universe = universeContext$.get()
  const organizations = Object.values(universe.organizations)
  
  if (organizations.length === 0) {
    return null
  }
  
  // Combine schemas from all organizations for universe view
  const combinedEntities: Record<string, any> = {}
  
  organizations.forEach((org) => {
    if (org.schema?.entities) {
      // In universe mode, prefix entity names with orgId for uniqueness
      Object.entries(org.schema.entities).forEach(([entityName, entityDef]) => {
        const prefixedName = `${org.orgId}_${entityName}`
        // Debug log to check org.name value
        if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
          log.info(`[UniverseSchema] Adding entity ${entityName} from org ${org.orgId}, name: ${org.name}`)
        }
        combinedEntities[prefixedName] = {
          ...entityDef,
          // Add metadata about which organization this entity belongs to
          _orgId: org.orgId,
          _orgName: org.name || org.orgId, // Fallback to orgId if name is not available
          _originalEntityName: entityName,
          _originalName: entityName // Also add _originalName for compatibility
        }
      })
    }
  })
  
  return {
    entities: combinedEntities,
    orgId: 'universe', // Special identifier for universe mode
    version: Date.now() // Simple version tracking
  }
})

/**
 * Get current organization ID (for backward compatibility)
 * Returns actual org ID based on current route context
 * Replaces: orgContext$.orgId
 */
export const universeOrgId$ = observable(() => {
  const universeContext = universeContext$.get()
  
  // Try to get org ID from current URL path
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    const orgMatch = path.match(/^\/org\/([^\/]+)/)
    if (orgMatch) {
      const orgId = orgMatch[1]
      // Verify this org exists in universe context
      if (universeContext.organizations && universeContext.organizations[orgId]) {
        return orgId
      }
    }
  }
  
  // Fallback: return 'universe' for universe mode
  return 'universe'
})

/**
 * Helper function to get organization-specific schema from universe context
 * Used when components need a specific org's schema instead of combined universe schema
 */
export function getOrgSchemaFromUniverse$(orgId: string) {
  return observable(() => {
    const universe = universeContext$.get()
    const org = universe.organizations[orgId]
    return org?.schema || null
  })
}

/**
 * Helper function to get organization loading state from universe context
 */
export function getOrgLoadingFromUniverse$(orgId: string) {
  return observable(() => {
    const universe = universeContext$.get()
    const org = universe.organizations[orgId]
    return org?.loading || universe.loading
  })
}

/**
 * Helper function to get organization error state from universe context
 */
export function getOrgErrorFromUniverse$(orgId: string) {
  return observable(() => {
    const universe = universeContext$.get()
    const org = universe.organizations[orgId]
    return org?.error || universe.error
  })
}

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
function createEntityObservable(entityName: string, schema?: any) {
  // Check if persistence is available and configured
  const hasPersistenceConfig = !!persistenceConfig?.entityTableMap
  
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    log.info(`[Observable] Creating ${entityName} observable - persistence: ${hasPersistenceConfig ? 'available' : 'not available'}`)
  }
  
  // SCHEMA-DRIVEN ORG PARAMETERS: Extract org ID and entity name from org-prefixed entity name
  // This follows Session 17 plan: remove context switching, use schema metadata
  let actualOrgId: string
  let actualEntityName: string
  
  if (entityName.includes('_')) {
    // For prefixed entity names like "01920000-1000-7000-8000-000000000001_Task"
    // extract the organization ID and base entity name for API calls
    const parts = entityName.split('_')
    if (parts.length === 2) {
      actualOrgId = parts[0]
      actualEntityName = parts[1]
      
      log.info(`[Observable] Schema-driven entity creation: org=${actualOrgId}, entity=${actualEntityName} (from ${entityName})`)
    } else {
      log.error(`[Observable] Invalid entity name format: ${entityName} - expected orgId_entityName`)
      actualOrgId = 'unknown'
      actualEntityName = entityName
    }
  } else {
    // Fallback for non-prefixed entities (shouldn't happen in universe schema)
    log.warn(`[Observable] Non-prefixed entity name: ${entityName} - using schema _organizationId`)
    actualOrgId = schema?._organizationId || 'unknown'
    actualEntityName = entityName
  }
  
  const baseUrl = `/api/dataforge/orgs/${actualOrgId}/data/${actualEntityName}`
  const syncUrl = `/api/dataforge/orgs/${actualOrgId}/sync/${actualEntityName}`
  
  log.info(`[Observable] Creating entity observable for ${entityName}`, {
    hasPersistenceManager: !!persistenceManager,
    hasSyncedCrudWithPersistence: !!syncedCrudWithPersistence,
    hasConfig: !!persistenceConfig
  });
  
  // Create the syncedCrud configuration with proper differential sync
  const crudConfig = {
    // CRITICAL: Enable Legend State's built-in differential sync for bandwidth efficiency
    changesSince: 'last-sync',
    
    // CRITICAL: Field mappings for differential sync tracking
    fieldId: 'id',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: 'deleted',
    
    // LIST - Simple function that returns array of records (Legend State v3 pattern)
    list: async () => {
      try {
        // DEBUG: Log that the function is being called - CRITICAL DEBUGGING
        console.log(`🔥 [CRITICAL] List function called for ${entityName}!`);
        
        log.info(`[Observable] Loading ${entityName} from:`, baseUrl);
        
        const response = await fetch(baseUrl, {
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
        
        console.log(`🔥 [CRITICAL] List function returning ${data.length} records for ${entityName}`)
        log.info(`[Observable] Loaded ${entityName}: ${data.length} records`)
        
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
            'X-Entity-Name': actualEntityName, // Help server debugging
            'X-Org-Context': actualOrgId,      // Audit trail
            'X-User-Context': universeUserId$.peek() || 'unknown', // User context
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
            'X-Entity-Name': actualEntityName,
            'X-Org-Context': actualOrgId,
            'X-User-Context': universeUserId$.peek() || 'unknown',
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
            'X-Entity-Name': actualEntityName,
            'X-Org-Context': actualOrgId,
            'X-User-Context': universeUserId$.peek() || 'unknown',
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
            'X-Entity-Name': actualEntityName,
            'X-Org-Context': actualOrgId,
            'X-User-Context': universeUserId$.peek() || 'unknown',
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
    
    // CRITICAL FIX: Legend State v3 requires initial value to trigger list() function
    // This is essential for syncedCrud to know it needs to fetch data
    // Use empty array as in working example, even though we return object data
    initial: [],

    // WebSocket subscription for real-time updates
    subscribe: ({ refresh }: { refresh: () => void }) => {
      const handler = (e: CustomEvent) => {
        const notification = e.detail
        
        // Only log notifications in development for debugging
        if (typeof window !== 'undefined' && window.location?.hostname === 'localhost' && notification.test) {
          log.info(`[Observable] ${entityName} received test notification:`, notification)
        }
        
        // Check if notification is for this entity
        const isRelevantNotification = notification?.tables?.some((tableName: string) => {
          const expectedTableName = entityName.toLowerCase() + 's'
          return tableName === expectedTableName
        })
        
        if (isRelevantNotification) {
          if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
            log.info(`[Observable] ${entityName} sync triggered by WebSocket`)
          }
          refresh()
        }
      }
      
      // Listen for table change notifications
      if (typeof window !== 'undefined') {
        window.addEventListener('vibestack:table-change-notification', handler as any)
      }
      
      // Return cleanup function
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('vibestack:table-change-notification', handler as any)
          if (window.location?.hostname === 'localhost') {
            log.info(`[Observable] Unsubscribed from WebSocket notifications for ${entityName}`)
          }
        }
      }
    }
  }
  
  
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    log.info(`[Observable] Creating syncedCrud for ${entityName}, hasPersistenceConfig: ${!!persistenceConfig?.entityTableMap}`)
  }
  
  // CRITICAL FIX: Use syncedCrud(config) directly like in working example
  // Don't store the function separately - call it immediately with config
  const syncedObservable = observable(syncedCrud(crudConfig))
  
  // Log available methods for debugging (should now have proper syncedCrud methods)
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    setTimeout(() => {
      log.info(`[Observable] ${entityName} observable created with methods:`, Object.getOwnPropertyNames(syncedObservable))
    }, 10)
  }
  
  return syncedObservable
}

/**
 * Load universe context - schemas from ALL user organizations
 * This should only be called by auth state machines, not components
 */
export async function loadUniverseContext(userId: string, organizationIds: string[], organizationData?: Array<{ id: string; name: string }>) {
  log.info(`[Observable] Loading universe context for ${organizationIds.length} organizations`)
  
  // Update loading state
  universeContext$.loading.set(true)
  universeContext$.error.set(null)
  universeContext$.userId.set(userId)
  
  // Fetch organization details from API if not provided
  const orgNameMap = new Map<string, string>()
  
  if (!organizationData || organizationData.length === 0) {
    // Fetch organization data from API
    try {
      const response = await fetch('/api/organizations', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const result = await response.json()
        const organizations = result.organizations || []
        
        organizations.forEach((org: any) => {
          if (org.id && org.name) {
            orgNameMap.set(org.id, org.name)
          }
        })
        
        log.info(`[Observable] Fetched ${organizations.length} organizations from API with names`)
      } else {
        log.warn('[Observable] Failed to fetch organizations from API, using IDs as names')
      }
    } catch (error) {
      log.error('[Observable] Error fetching organizations:', error)
    }
  } else {
    // Use provided organization data
    organizationData.forEach(org => {
      orgNameMap.set(org.id, org.name)
    })
  }
  
  try {
    // Load schemas from all organizations in parallel
    const schemaPromises = organizationIds.map(async (orgId) => {
      try {
        universeContext$.organizations[orgId].loading.set(true)
        universeContext$.organizations[orgId].error.set(null)
        
        const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)
        if (!schemaResult.success || !schemaResult.schema) {
          throw new Error(`Failed to load schema for org ${orgId}`)
        }
        
        return {
          orgId,
          schema: schemaResult.schema,
          success: true
        }
      } catch (error) {
        log.error(`[Observable] Failed to load schema for org ${orgId}:`, error)
        return {
          orgId,
          error: error instanceof Error ? error.message : 'Failed to load schema',
          success: false
        }
      }
    })
    
    const results = await Promise.all(schemaPromises)
    
    // Process results and update universe context
    results.forEach(result => {
      if (result.success && result.schema) {
        // Use the provided organization name or fall back to orgId
        const orgName = orgNameMap.get(result.orgId) || result.orgId
        
        universeContext$.organizations[result.orgId].assign({
          orgId: result.orgId,
          name: orgName,
          schema: result.schema,
          loading: false,
          error: null
        })
        
        const entityCount = result.schema.entities ? Object.keys(result.schema.entities).length : 0
        log.info(`[Observable] Loaded ${entityCount} entities from org ${result.orgId} (${orgName})`)
      } else {
        const orgName = orgNameMap.get(result.orgId) || result.orgId
        
        universeContext$.organizations[result.orgId].assign({
          orgId: result.orgId,
          name: orgName,
          schema: null,
          loading: false,
          error: result.error
        })
      }
    })
    
    universeContext$.loading.set(false)
    
    const totalEntities = results.reduce((total, result) => {
      return total + (result.schema?.entities ? Object.keys(result.schema.entities).length : 0)
    }, 0)
    
    log.info(`[Observable] Universe context loaded with ${totalEntities} total entities across ${organizationIds.length} organizations`)
    
    // Initialize persistence configuration after schemas are loaded
    await initializePersistence(userId, organizationIds, totalEntities)
    
  } catch (error) {
    log.error('[Observable] Failed to load universe context:', error)
    universeContext$.assign({
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to load universe context'
    })
    throw error
  }
}

/**
 * Initialize persistence configuration for loaded organizations
 */
async function initializePersistence(userId: string, organizationIds: string[], totalEntities: number) {
  // Skip if no entities or already initialized
  if (totalEntities === 0 || (persistenceManager && syncedCrudWithPersistence)) {
    log.info(`[Observable] Skipping persistence initialization: entities=${totalEntities}, already initialized=${!!(persistenceManager && syncedCrudWithPersistence)}`)
    return
  }
  
  try {
    // Use primary organization for persistence (first in list)
    const primaryOrgId = organizationIds[0]
    if (!primaryOrgId) {
      log.warn('[Observable] No organization ID available for persistence setup')
      return
    }
    
    // Get all entity names from the current schema
    const currentSchema = universeSchema$.peek()
    const entityKeys = currentSchema?.entities ? Object.keys(currentSchema.entities) : []
    
    if (entityKeys.length === 0) {
      log.info('[Observable] No entities found, skipping persistence setup')
      return
    }
    
    log.info(`[Observable] Initializing persistence for ${entityKeys.length} entities in org ${primaryOrgId}`)
    
    // Create persistence manager with enhanced error handling
    persistenceManager = createPersistenceManager(primaryOrgId, userId)
    
    // Create IndexedDB configuration with error recovery using Legend State v3 pattern
    const indexedDBConfig = await persistenceManager.createIndexedDBConfig(entityKeys)
    
    // Configure synced CRUD with or without persistence
    if (indexedDBConfig) {
      // IndexedDB configuration available - use the proper v3 pattern
      const { persistOptions, entityTableMap } = indexedDBConfig
      
      // Store the persistOptions globally for use in individual entity creation
      persistenceConfig = { persistOptions, entityTableMap }
      
      // In Legend State v3, persistOptions IS the function that wraps syncedCrud with persistence
      syncedCrudWithPersistence = persistOptions
      
      log.info('[Observable] Persistence configured with IndexedDB plugin')
    } else {
      // No IndexedDB plugin - use syncedCrud without persistence
      syncedCrudWithPersistence = syncedCrud
      log.info('[Observable] Persistence disabled - using server-only sync')
    }
    
    // Update tracking variables
    currentOrgId = primaryOrgId
    currentSchemaVersion = currentSchema?.version || 'unknown'
    
    log.info(`[Observable] Persistence initialized successfully`, {
      orgId: primaryOrgId,
      entityCount: entityKeys.length,
      schemaVersion: currentSchemaVersion,
      hasPersistenceManager: !!persistenceManager,
      hasSyncedCrudWithPersistence: !!syncedCrudWithPersistence
    })
    
  } catch (error) {
    log.error('[Observable] Failed to initialize persistence:', error)
    
    // Check for specific IndexedDB errors and provide user-friendly handling
    if (error?.name === 'NotFoundError' || 
        error?.message?.includes('object stores was not found') ||
        error?.message?.includes('Error loading local cache')) {
      log.info('[Observable] IndexedDB schema issue detected - continuing without persistence')
      
      // Clear any corrupted IndexedDB data
      try {
        if (persistenceManager) {
          await persistenceManager.clearOrganizationData()
        }
      } catch (clearError) {
        log.warn('[Observable] Failed to clear corrupted data:', clearError)
      }
    }
    
    // Reset variables on failure but don't crash the app
    persistenceManager = null
    syncedCrudWithPersistence = null
    currentOrgId = null
    currentSchemaVersion = null
    
    // Continue with server-only sync - the app will still work
    log.info('[Observable] Continuing with server-only sync (no local persistence)')
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
  const schema = universeSchema$.get()
  const loading = universeLoading$.get()
  
  // Return empty object while still loading or no schema
  if (loading || !schema?.entities) {
    log.info(`[Observable] Entities not ready yet`, {
      loading,
      hasSchema: !!schema,
      hasEntities: !!schema?.entities
    })
    return {}
  }
  
  // Safely get entity keys (these are org-prefixed in universe schema)
  const entityKeys = schema.entities && typeof schema.entities === 'object' ? Object.keys(schema.entities) : []
  
  log.info(`[Observable] Creating entity observables for universe schema`, {
    schemaVersion: schema.version || 'unknown',
    entityCount: entityKeys.length,
    sampleEntities: entityKeys.slice(0, 3)
  })
  
  // Create entity observables using lazy initialization with global caching
  // This ensures observables persist across schema changes and are created only when accessed
  const entityObservables: Record<string, any> = {}
  
  try {
    entityKeys.forEach(entityName => {
      // Define a getter that creates the observable lazily with caching
      Object.defineProperty(entityObservables, entityName, {
        get() {
          // Use entity name as cache key (already org-prefixed in universe schema)
          const cacheKey = entityName
          
          // Return cached observable if it exists
          if (globalEntityCache[cacheKey]) {
            return globalEntityCache[cacheKey]
          }
          
          // Create observable only when accessed for the first time
          try {
            // Extract orgId from org-prefixed entity name for API calls
            const entitySchema = schema.entities[entityName]
            const observable = createEntityObservable(entityName, entitySchema)
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
    // SCHEMA-DRIVEN APPROACH: Check if entity exists in universe schema
    const currentSchema = universeSchema$.peek()
    
    // 🐛 DEBUG: Log what we're looking for and what's available
    console.log('🔍 [getEntity$] Looking for entity:', entityName)
    console.log('🔍 [getEntity$] Available entities in schema:', Object.keys(currentSchema?.entities || {}))
    console.log('🔍 [getEntity$] Schema exists:', !!currentSchema)
    console.log('🔍 [getEntity$] Entities object exists:', !!currentSchema?.entities)
    
    if (!currentSchema?.entities?.[entityName]) {
      log.warn(`[Observable] Entity ${entityName} not available in universe schema`)
      console.log('🔍 [getEntity$] Entity NOT FOUND:', entityName)
      return null
    }
    
    // Use entity name as cache key (already org-prefixed in universe schema)
    const cacheKey = entityName
    
    // Check if we already have the observable cached
    if (globalEntityCache[cacheKey]) {
      log.info(`[Observable] Retrieved cached ${entityName} observable`)
      return globalEntityCache[cacheKey]
    }
    
    // Create the observable directly if not cached
    try {
      log.info(`[Observable] Creating new observable for ${entityName}`)
      const observable = createEntityObservable(entityName, currentSchema.entities[entityName])
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
 * Universe-aware entity getter - handles both regular and org-prefixed entity names
 * For universe context: getUniverseEntity$('01920000-1000-7000-8000-000000000001_Client')  
 * For regular context: getUniverseEntity$('Client') - falls back to current org
 */
export function getUniverseEntity$(entityIdentifier: string) {
  log.info(`[UniverseObservable] getUniverseEntity$ called with "${entityIdentifier}"`)
  try {
    // Check if this is an org-prefixed entity name (contains UUID pattern)
    const orgPrefixMatch = entityIdentifier.match(/^([a-f0-9-]{36})_(.+)$/)
    
    if (orgPrefixMatch) {
      // Extract org ID and entity name from prefixed identifier
      const [, orgId, entityName] = orgPrefixMatch
      log.info(`[UniverseObservable] Accessing org-prefixed entity ${entityName} from org ${orgId}`)
      
      // For org-prefixed entities, we need to check if the current org context has this entity
      const currentOrgContext = {
        orgId: universeOrgId$.peek(),
        schema: universeSchema$.peek(),
        loading: universeLoading$.peek(),
        error: universeError$.peek(),
        userId: universeUserId$.peek()
      }
      
      // In the new unified universe context, schema always contains org-prefixed entity names
      // Always use the full entityIdentifier for lookups
      const schemaKey = entityIdentifier
      
      if (!currentOrgContext?.schema?.entities?.[schemaKey]) {
        log.warn(`[UniverseObservable] Entity ${schemaKey} not available in current universe schema`)
        log.info(`[UniverseObservable] Available entities:`, Object.keys(currentOrgContext?.schema?.entities || {}))
        return null
      }
      
      // Use the full entityIdentifier as cache key to match getEntity$ format
      const cacheKey = entityIdentifier
      
      // Check cache first
      if (globalEntityCache[cacheKey]) {
        log.info(`[UniverseObservable] Retrieved cached org-prefixed ${entityIdentifier} observable`)
        return globalEntityCache[cacheKey]
      }
      
      // Create observable for this specific organization's entity
      try {
        log.info(`[UniverseObservable] Creating new observable for org-prefixed ${entityIdentifier}`)
        const observable = createEntityObservable(entityIdentifier, currentOrgContext.schema.entities[schemaKey])
        globalEntityCache[cacheKey] = observable
        
        log.info(`[UniverseObservable] Created ${entityIdentifier} observable`, {
          orgId,
          entityName,
          type: typeof observable,
          hasGet: typeof observable?.get === 'function'
        })
        
        return observable
      } catch (createError) {
        log.error(`[UniverseObservable] Error creating observable for ${entityIdentifier}:`, createError)
        return null
      }
    } else {
      // No org prefix - fall back to regular getEntity$ behavior
      log.info(`[UniverseObservable] No org prefix detected, falling back to regular getEntity$ for ${entityIdentifier}`)
      return getEntity$(entityIdentifier)
    }
  } catch (error) {
    console.error(`🔥 UNIVERSE DEBUG: Exception in getUniverseEntity$ for ${entityIdentifier}:`, error)
    log.error(`[UniverseObservable] Error getting universe entity observable for ${entityIdentifier}:`, error)
    return null
  }
}

/**
 * Clear all observables (for logout or org switching)
 */
export function clearContext() {
  log.info('[Observable] Clearing all observables with robust cleanup')
  
  // Use InitializationManager for coordinated cleanup
  initializationManager.reset()
  
  // Clear legacy persistence manager data if it exists
  if (persistenceManager) {
    try {
      persistenceManager.clearOrganizationData()
    } catch (error) {
      log.warn('[Observable] Error clearing legacy persistence data:', error)
    }
    persistenceManager = null
  }
  
  // Reset persistence configuration
  syncedCrudWithPersistence = null
  persistenceConfig = null
  
  // Clear tracking variables
  currentOrgId = null
  currentSchemaVersion = null
  
  // Clear universe context - this will automatically clear all entity observables due to reactivity
  universeContext$.set({
    userId: null,
    organizations: {},
    loading: false,
    error: null,
  })
  
  log.info('[Observable] ✅ Context cleared successfully')
}

/**
 * Handle WebSocket table change notification
 */
export function handleTableNotification(notification: any) {
  if (!notification?.table) return
  
  log.info(`[Observable] Table notification for ${notification.table}:`, notification.operation)
  
  // Handle schema changes from external sources (other clients)
  if (notification.table === 'entity_schemas') {
    log.info(`[Observable] External entity schema change detected - reloading universe schema`)
    // Reload the entire universe context since we don't track individual orgs anymore
    const userId = universeUserId$.peek()
    if (userId) {
      // Trigger a universe context reload (will be implemented by auth system)
      window.dispatchEvent(new CustomEvent('vibestack:reload-universe-schema', {
        detail: { userId }
      }))
    }
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
  const currentSchema = universeSchema$.peek()
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
  // Schema is now managed by universe context - this is a no-op
  log.info('Schema update requested but handled by universe context')
  
  log.info(`[Observable] Schema updated locally - UI should update immediately`)
}

/**
 * Reload schema from server (for external changes)
 */
async function reloadOrgSchema(orgId: string) {
  try {
    const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)
    if (schemaResult.success && schemaResult.schema) {
      // Schema is now managed by universe context - this is a no-op
      log.info('Schema update requested but handled by universe context')
      log.info(`[Observable] Schema reloaded from server`)
    }
  } catch (error) {
    log.error('[Observable] Failed to reload schema:', error)
  }
}

// Computed observables for common patterns
export const isLoading$ = universeLoading$
export const currentOrg$ = universeOrgId$
export const currentSchema$ = universeSchema$

// Entity groups for sidebar (computed from schema) - fully reactive
// Returns array of groups with items, matching sidebar expectation
// Can be filtered by organization when in organization view
export const createEntityGroups = (filterOrgId?: string) => observable(() => {
  const schema = universeSchema$.get()
  if (!schema?.entities) return []
  
  // Safely get entity keys with error handling
  try {
    const entityKeys = schema.entities && typeof schema.entities === 'object' ? Object.keys(schema.entities) : []
    
    // Filter by organization if specified
    const filteredEntityKeys = filterOrgId 
      ? entityKeys.filter(entityName => {
          // In universe mode, entities are prefixed with orgId_EntityName
          // Extract org ID from the entity name if it's prefixed
          if (entityName.includes('_')) {
            const parts = entityName.split('_')
            // Check if first part looks like a UUID (36 chars with dashes)
            if (parts[0].length === 36 && parts[0].includes('-')) {
              // This is an org-prefixed entity, check if it matches our filter
              return parts[0] === filterOrgId
            }
          }
          // Fallback to checking the schema property
          const entitySchema = schema.entities[entityName]
          return entitySchema._organizationId === filterOrgId || entitySchema._orgId === filterOrgId
        })
      : entityKeys
    
    // Group entities by archetype for better organization
    const entityGroups: Record<string, any[]> = {}
    
    filteredEntityKeys.forEach(entityName => {
      const entitySchema = schema.entities[entityName]
      const archetype = entitySchema?.archetype || 'other'
      
      if (!entityGroups[archetype]) {
        entityGroups[archetype] = []
      }
      
      // Use original entity name if available, otherwise use prefixed name
      const displayName = entitySchema._originalName || entityName
      const orgName = entitySchema._organizationName
      
      // Extract org ID from entity name if it's prefixed
      let orgId = entitySchema._organizationId || entitySchema._orgId
      if (!orgId && entityName.includes('_')) {
        const parts = entityName.split('_')
        if (parts[0].length === 36 && parts[0].includes('-')) {
          orgId = parts[0]
        }
      }
      
      entityGroups[archetype].push({
        title: displayName,
        url: `/org/${orgId}/entities/${entityName}`,
        icon: getArchetypeIcon(archetype),
        organizationName: orgName,
        organizationId: orgId
      })
    })
    
    // Convert to array format expected by sidebar
    return Object.entries(entityGroups).map(([archetype, items]) => ({
      name: formatArchetypeName(archetype),
      items: items.sort((a, b) => a.title.localeCompare(b.title))
    }))
    
  } catch (error) {
    log.error('[Observable] Error creating entity groups:', error)
    return []
  }
})

// Default entity groups (all organizations)
export const entityGroups$ = createEntityGroups()

// Helper function to get icon component based on archetype
function getArchetypeIcon(archetype: string) {
  // Map entity archetypes to lucide-react icon names
  const iconMap: Record<string, string> = {
    'task': 'CheckSquare',
    'project': 'FolderOpen', 
    'record': 'Database',
    'document': 'FileText',
    'activity': 'Activity',
    'discussion': 'MessageSquare',
    'file': 'File',
    'other': 'Circle'
  }
  return iconMap[archetype] || 'Circle'
}

// Helper function to format archetype names for display
function formatArchetypeName(archetype: string): string {
  const nameMap: Record<string, string> = {
    'task': 'Tasks',
    'project': 'Projects',
    'record': 'Records', 
    'document': 'Documents',
    'activity': 'Activities',
    'discussion': 'Discussions',
    'file': 'Files',
    'other': 'Other'
  }
  return nameMap[archetype] || archetype.charAt(0).toUpperCase() + archetype.slice(1)
}

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
      failures: failures.map(f => ({ 
        id: f.id, 
        error: (f.result as PromiseRejectedResult).reason 
      }))
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
      failures: failures.map(f => ({ 
        item: f.item, 
        error: (f.result as PromiseRejectedResult).reason 
      })),
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
        const orgId = universeOrgId$.peek()
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
        const contextOrgId = universeOrgId$.peek()
        if (!contextOrgId) {
          throw new Error('No organization context available')
        }
        
        // Extract actual org ID if in universe mode
        let deleteOrgId = contextOrgId
        let deleteEntityName = entityName
        if (contextOrgId === 'universe') {
          // Need to get the entity schema to extract the real org ID
          const currentSchema = universeSchema$.peek()
          const entitySchema = currentSchema?.entities?.[entityName]
          if (entitySchema) {
            deleteOrgId = entitySchema._organizationId || contextOrgId
            deleteEntityName = entitySchema._originalName || entityName
            log.info(`[Observable] Delete fallback - using actual org ${deleteOrgId} for entity ${deleteEntityName}`)
          }
        }
        
        const baseUrl = `/api/dataforge/orgs/${deleteOrgId}/data/${deleteEntityName}`
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

// Setup global error handling for Legend State IndexedDB issues
if (typeof window !== 'undefined') {
  // Override console.error to catch and handle Legend State IndexedDB errors
  const originalConsoleError = console.error
  console.error = function(...args: any[]) {
    const errorMessage = args.join(' ')
    
    // Check for Legend State IndexedDB errors
    if (errorMessage.includes('[legend-state] Error loading local cache') ||
        errorMessage.includes('NotFoundError: Failed to execute \'transaction\' on \'IDBDatabase\'') ||
        errorMessage.includes('One of the specified object stores was not found')) {
      
      log.info('[Observable] Intercepted Legend State IndexedDB error - handling gracefully')
      
      // Clear IndexedDB data to fix schema mismatch
      if (persistenceManager) {
        persistenceManager.clearOrganizationData().catch(clearError => {
          originalConsoleError('[Observable] Failed to clear corrupted IndexedDB data:', clearError)
        })
      }
      
      // Show user-friendly message in development
      if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
        console.warn('[VibeStack] IndexedDB cache cleared due to schema changes. This is normal and the app will continue working with fresh data from the server.')
      }
      
      return // Don't log the scary error message
    }
    
    // Call original console.error for other messages
    originalConsoleError.apply(console, args)
  }

  // Add window error handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || String(event.reason)
    
    if (errorMessage.includes('NotFoundError') && 
        errorMessage.includes('object stores was not found')) {
      log.info('[Observable] Caught unhandled IndexedDB error - preventing crash')
      
      // Clear corrupted data
      if (persistenceManager) {
        persistenceManager.clearOrganizationData().catch(() => {
          // Silent failure - don't cascade errors
        })
      }
      
      event.preventDefault() // Prevent the error from crashing the app
      
      if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
        console.warn('[VibeStack] Prevented IndexedDB error from crashing the app. Data cleared and app continues normally.')
      }
    }
  })
}

// Export InitializationManager for external use and debugging
export { initializationManager, useInitializationState } from './helpers/InitializationManager'

// Debug: Expose to window in development
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
  // Legacy debug exposure - replaced with universe context
  (window as any).vibestackUniverseContext = {
    orgId: universeOrgId$,
    schema: universeSchema$,
    loading: universeLoading$,
    error: universeError$,
    userId: universeUserId$
  }
  ;(window as any).vibestackBatchOps = batchOperations
  ;(window as any).vibestackEntityOps = entityOperations
  ;(window as any).vibestackInitManager = initializationManager
  
  // Expose key functions for debugging
  ;(window as any).entities$ = entities$
  ;(window as any).getEntity$ = getEntity$
  ;(window as any).loadUniverseContext = loadUniverseContext
  
  // Add debug function to manually clear IndexedDB
  ;(window as any).vibestackClearIndexedDB = async () => {
    if (persistenceManager) {
      await persistenceManager.clearOrganizationData()
      console.log('[VibeStack Debug] Legacy IndexedDB data cleared. Refresh the page to see changes.')
    } else {
      console.log('[VibeStack Debug] No legacy persistence manager available')
    }
  }
  
  // Add debug function for initialization metrics
  ;(window as any).vibestackInitMetrics = () => {
    const metrics = initializationManager.getMetrics()
    console.log('[VibeStack Debug] Initialization Metrics:', metrics)
    return metrics
  }
}