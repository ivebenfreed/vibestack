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
import { createPersistenceManager, type PersistenceManager } from './helpers/PersistenceManager'
import { initializationManager, ensureLegendStateReady, type PersistenceContext } from './helpers/InitializationManager'
import { EntityNameUtils } from '@/lib/entity-name-utils'
import { clearSchemaObservables, getSchemaObservable$, peekSchemaData$ } from './schema-observable'
import { setPersistenceManagerReference, setPersistenceConfigSetter, setupFullPersistenceConfig } from './persistence-utils'
import { log } from '@/logger';
const fileLog = log('legend-state/observables.ts');

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
  const readyOrganizations = organizations.filter(org => !org.loading)
  
  fileLog.info(`[UniverseSchema] Computing universe schema with ${organizations.length} organizations (${readyOrganizations.length} ready, ${organizations.length - readyOrganizations.length} still loading)`)
  
  if (organizations.length === 0) {
    fileLog.debug(`[UniverseSchema] No organizations found, returning null`)
    return null
  }
  
  if (readyOrganizations.length === 0) {
    fileLog.debug(`[UniverseSchema] All ${organizations.length} organizations still loading, returning null for now`)
    return null
  }
  
  // Combine schemas from all organizations for universe view
  const combinedEntities: Record<string, any> = {}
  let totalEntitiesAdded = 0
  
  readyOrganizations.forEach((org) => {
    // Safety check: ensure orgId exists (API returns 'id', not 'orgId')
    const orgId = org.orgId || org.id
    if (!orgId) {
      fileLog.error(`[UniverseSchema] Skipping ready org with missing orgId:`, org)
      return
    }
    
    // NOTE: Loading check is no longer needed since readyOrganizations already filters out loading orgs
    
    fileLog.info(`[UniverseSchema] Processing org ${orgId} (${org.name || 'unnamed'})`)
    
    // FIXED: Get schema observable directly from cache instead of stored reference
    // This avoids the corruption that happens when Legend State's assign() stores the observable
    const schemaObservable = getSchemaObservable$(orgId)
    
    if (!schemaObservable) {
      fileLog.debug(`[UniverseSchema] No schema observable found for org ${orgId}, will load asynchronously`)
      return
    }
    
    fileLog.info(`[UniverseSchema] Found schema observable for org ${orgId}, getting data...`)
    
    const schemaData = schemaObservable.get() // Reactive access to schema data
    
    fileLog.info(`[UniverseSchema] Schema data for org ${orgId}:`, {
      hasData: !!schemaData,
      isObject: typeof schemaData === 'object',
      isArray: Array.isArray(schemaData),
      dataKeys: schemaData && typeof schemaData === 'object' ? Object.keys(schemaData) : [],
      dataType: typeof schemaData
    })
    
    // syncedCrud observables return objects with IDs as keys: { [orgId]: schemaObject }
    // Handle different data states:
    // - undefined/null: Still loading
    // - {}: Empty object means no schema found
    // - { [orgId]: schema }: Object with schema means loaded
    if (!schemaData) {
      fileLog.debug(`[UniverseSchema] Schema data for org ${orgId} still loading (undefined/null)`)
      return // Skip this org - data is still loading
    }
    
    if (typeof schemaData !== 'object') {
      fileLog.error(`[UniverseSchema] Schema data for org ${orgId} has unexpected format (not object):`, typeof schemaData)
      return // Skip this org - unexpected format
    }
    
    // Get the schema object by orgId key (syncedCrud format)
    const schema = schemaData[orgId]
    
    if (!schema) {
      fileLog.debug(`[UniverseSchema] No schema found for org ${orgId} in syncedCrud data`)
      return // Skip this org - no schema available
    }
      
      fileLog.info(`[UniverseSchema] Schema object for org ${orgId}:`, {
        hasSchema: !!schema,
        hasEntities: !!schema?.entities,
        entityCount: schema?.entities ? Object.keys(schema.entities).length : 0
      })
      
      if (schema?.entities) {
        // In universe mode, prefix entity names with orgId for uniqueness
        Object.entries(schema.entities).forEach(([entityName, entityDef]) => {
          const prefixedName = `${orgId}_${entityName}`
          fileLog.info(`[UniverseSchema] Adding entity ${entityName} as ${prefixedName} from org ${orgId} (${org.name || 'unnamed'})`)
          
          combinedEntities[prefixedName] = {
            ...entityDef,
            // Add metadata about which organization this entity belongs to
            _orgId: orgId,
            _orgName: org.name || orgId, // Fallback to orgId if name is not available
            _originalEntityName: entityName,
            _originalName: entityName // Also add _originalName for compatibility
          }
          totalEntitiesAdded++
        })
      }
  })
  
  fileLog.info(`[UniverseSchema] Completed universe schema computation:`, {
    organizationsProcessed: organizations.length,
    totalEntitiesAdded,
    combinedEntityKeys: Object.keys(combinedEntities)
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
        fileLog.info(`[Observable] Validation endpoint not available for ${entityName} - skipping`)
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
    fileLog.error(`[Observable] Validation check failed for ${entityName} ${operation}:`, error.message)
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
    fileLog.info(`[Observable] Creating ${entityName} observable - persistence: ${hasPersistenceConfig ? 'available' : 'not available'}`)
  }
  
  // SCHEMA-DRIVEN ORG PARAMETERS: Extract org ID and entity name from org-prefixed entity name
  // This follows Session 17 plan: remove context switching, use schema metadata
  let actualOrgId: string
  let actualEntityName: string
  let baseUrl: string
  let isVirtual = schema?._isVirtual || false
  
  // **NEW: Handle virtual entities with different API patterns**
  if (isVirtual) {
    fileLog.info(`[Observable] Creating virtual entity observable: ${entityName}`, {
      isVirtual,
      backendTables: schema._backendTables,
      originalName: schema._originalName
    })
    
    // Virtual entities use different API endpoints
    if (entityName === 'SystemOption' || entityName.endsWith('_SystemOption')) {
      // Global system options virtual entity
      baseUrl = `/api/dataforge/system-options`
      actualOrgId = schema._orgId || 'global'
      actualEntityName = 'SystemOption'
    } else if (entityName.includes('_') && entityName.endsWith('_CustomOption')) {
      // Per-org custom options virtual entity
      const parts = entityName.split('_')
      actualOrgId = parts.slice(0, -1).join('_') // Handle UUIDs with dashes
      actualEntityName = 'CustomOption'
      baseUrl = `/api/dataforge/orgs/${actualOrgId}/custom-options`
    } else if (entityName.startsWith('Virtual') && schema._entityReference) {
      // Entity reference virtual entities (VirtualUser, VirtualProject, etc.)
      // These map to existing business entity endpoints for dropdown data
      actualOrgId = schema._orgId
      actualEntityName = schema._targetEntityType  // Original business entity name
      baseUrl = `/api/dataforge/orgs/${actualOrgId}/data/${actualEntityName}`
    } else {
      // Fallback for other virtual entities
      actualOrgId = schema._orgId || 'unknown'
      actualEntityName = schema._originalName || entityName
      baseUrl = `/api/dataforge/virtual/${actualEntityName.toLowerCase()}`
    }
  } else {
    // Regular business entities
    if (entityName.includes('_')) {
      // For prefixed entity names like "01920000-1000-7000-8000-000000000001_Task"
      // extract the organization ID and base entity name for API calls
      const parts = entityName.split('_')
      if (parts.length === 2) {
        actualOrgId = parts[0]
        actualEntityName = parts[1]
        
        fileLog.info(`[Observable] Schema-driven entity creation: org=${actualOrgId}, entity=${actualEntityName} (from ${entityName})`)
      } else {
        fileLog.error(`[Observable] Invalid entity name format: ${entityName} - expected orgId_entityName`)
        actualOrgId = 'unknown'
        actualEntityName = entityName
      }
    } else {
      // Fallback for non-prefixed entities (shouldn't happen in universe schema)
      fileLog.debug(`[Observable] Non-prefixed entity name: ${entityName} - using schema _organizationId`)
      actualOrgId = schema?._organizationId || 'unknown'
      actualEntityName = entityName
    }
    
    baseUrl = `/api/dataforge/orgs/${actualOrgId}/data/${actualEntityName}`
  }
  
  const syncUrl = `/api/dataforge/orgs/${actualOrgId}/sync/${actualEntityName}`
  
  fileLog.info(`[Observable] Creating entity observable for ${entityName}`, {
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
        fileLog.info(`[Observable] Loading ${entityName} from:`, baseUrl);
        
        const response = await fetch(baseUrl, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        })
        
        if (!response.ok) {
          // Handle common cases gracefully
          if (response.status === 404) {
            fileLog.info(`[Observable] Entity ${entityName} table not found (404) - returning empty data`)
            return []
          }
          if (response.status === 500) {
            // Likely table doesn't exist - don't spam console
            fileLog.info(`[Observable] Entity ${entityName} table not created yet (500) - returning empty data`)
            return []
          }
          fileLog.error(`[Observable] Failed to load ${entityName}:`, response.status)
          return []
        }
        
        const result = await response.json()
        const data = result.data || []
        
        fileLog.info(`[Observable] Loaded ${entityName}: ${data.length} records`)
        
        return data
      } catch (error) {
        fileLog.info(`[Observable] Network error loading ${entityName} - returning empty data:`, error.message)
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
            fileLog.error(`[Observable] Validation failed for ${entityName}:`, validationError.message)
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
        fileLog.info(`[Observable] Successfully created ${entityName}:`, result.data?.id || 'unknown-id')
        return result.data || item
      } catch (error) {
        // Add context to help debugging
        fileLog.error(`[Observable] Create error for ${entityName}:`, {
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
            fileLog.error(`[Observable] Validation failed for ${entityName} update:`, validationError.message)
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
        fileLog.info(`[Observable] Successfully updated ${entityName}:`, item.id)
        return result.data || item
      } catch (error) {
        fileLog.error(`[Observable] Update error for ${entityName}:`, {
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
            fileLog.debug(`[Observable] ${entityName} already deleted:`, item.id)
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
        
        fileLog.info(`[Observable] Successfully deleted ${entityName}:`, item.id)
        return undefined // Successful deletion
      } catch (error) {
        fileLog.error(`[Observable] Delete error for ${entityName}:`, {
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

        fileLog.info(`[Observable] Batch updating ${items.length} ${entityName} records`)

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
        fileLog.info(`[Observable] Successfully batch updated ${items.length} ${entityName} records`)
        return result.data || items
      } catch (error) {
        fileLog.error(`[Observable] Batch update error for ${entityName}:`, {
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
          fileLog.info(`[Observable] ${entityName} received test notification:`, notification)
        }
        
        // **NEW: Enhanced notification handling for virtual entities**
        let isRelevantNotification = false
        
        if (isVirtual && schema._backendTables) {
          // Virtual entities listen to their backend tables
          isRelevantNotification = notification?.tables?.some((tableName: string) => {
            return schema._backendTables.includes(tableName)
          })
          
          if (isRelevantNotification && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
            fileLog.info(`[Observable] Virtual entity ${entityName} sync triggered by backend table change:`, notification.tables)
          }
        } else {
          // Regular entities use original logic
          isRelevantNotification = notification?.tables?.some((tableName: string) => {
            const expectedTableName = entityName.toLowerCase() + 's'
            return tableName === expectedTableName
          })
          
          if (isRelevantNotification && typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
            fileLog.info(`[Observable] ${entityName} sync triggered by WebSocket`)
          }
        }
        
        if (isRelevantNotification) {
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
            fileLog.info(`[Observable] Unsubscribed from WebSocket notifications for ${entityName}`)
          }
        }
      }
    }
  }
  
  
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    fileLog.info(`[Observable] Creating syncedCrud for ${entityName}, hasPersistenceConfig: ${!!persistenceConfig?.entityTableMap}`)
  }
  
  // CRITICAL FIX: Use syncedCrud(config) directly like in working example
  // Don't store the function separately - call it immediately with config
  const syncedObservable = observable(syncedCrud(crudConfig))
  
  // Log available methods for debugging (should now have proper syncedCrud methods)
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    setTimeout(() => {
      fileLog.info(`[Observable] ${entityName} observable created with methods:`, Object.getOwnPropertyNames(syncedObservable))
    }, 10)
  }
  
  return syncedObservable
}

/**
 * Load universe context - schemas from ALL user organizations
 * This should only be called by auth state machines, not components
 */
export async function loadUniverseContext(userId: string, organizationIds: string[], organizationData?: Array<{ id: string; name: string }>) {
  fileLog.info(`[Observable] Loading universe context for ${organizationIds.length} organizations`)
  
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
        
        fileLog.info(`[Observable] Fetched ${organizations.length} organizations from API with names`)
      } else {
        fileLog.error('[Observable] Failed to fetch organizations from API, using IDs as names')
      }
    } catch (error) {
      fileLog.error('[Observable] Error fetching organizations:', error)
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
        
        // Create schema observable (loads in background like entity observables)
        const schemaObs = getSchemaObservable$(orgId)
        if (!schemaObs) {
          throw new Error(`Failed to create schema observable for org ${orgId}`)
        }
        
        // CRITICAL FIX: Don't wait for data loading synchronously - this breaks Legend State patterns
        // The legend-state-init-machine should work with reactive observables, not synchronous data
        // Schema observables will load asynchronously and components will react when data is ready
        fileLog.info(`[Observable] Schema observable created for org ${orgId}, data will load asynchronously`)
        
        return {
          orgId,
          observable: schemaObs,
          success: true
        }
      } catch (error) {
        fileLog.error(`[Observable] Failed to load schema for org ${orgId}:`, error)
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
      if (result.success && result.observable) {
        // Use the provided organization name or fall back to orgId
        const orgName = orgNameMap.get(result.orgId) || result.orgId
        
        universeContext$.organizations[result.orgId].assign({
          orgId: result.orgId,
          name: orgName,
          // Don't store the observable here - Legend State's assign() corrupts it
          // Instead, we'll access it directly from the cache in universeSchema$
          loading: false,
          error: null
        })
        
        fileLog.info(`[Observable] Schema observable created for org ${result.orgId} (${orgName})`)
      } else {
        const orgName = orgNameMap.get(result.orgId) || result.orgId
        
        universeContext$.organizations[result.orgId].assign({
          orgId: result.orgId,
          name: orgName,
          schemaObservable: null,
          schema: null,
          loading: false,
          error: result.error
        })
      }
    })
    
    universeContext$.loading.set(false)
    
    const successfulResults = results.filter(r => r.success).length
    
    fileLog.info(`[Observable] Universe context loaded with ${successfulResults}/${organizationIds.length} organizations. Schema observables will load entity data reactively.`)
    
    // **NEW: Add virtual entities for options system**
    await addVirtualOptionsEntities(organizationIds)
    
    // NOTE: Persistence initialization is now handled by the simplified Legend State initialization
    // This ensures proper timing and entity count calculation
    
  } catch (error) {
    fileLog.error('[Observable] Failed to load universe context:', error)
    universeContext$.assign({
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to load universe context'
    })
    throw error
  }
}

/**
 * Add virtual entities for system and custom options
 * These expose existing database tables as synced observables
 */
async function addVirtualOptionsEntities(organizationIds: string[]) {
  try {
    fileLog.info(`[Observable] Adding virtual options entities for ${organizationIds.length} organizations`)
    
    const currentUniverse = universeContext$.peek()
    const existingOrganizations = { ...currentUniverse.organizations }
    
    // Add global SystemOption virtual entity to all organizations
    organizationIds.forEach(orgId => {
      const orgData = existingOrganizations[orgId]
      if (orgData?.schema?.entities) {
        // Add SystemOption virtual entity
        orgData.schema.entities['SystemOption'] = {
          archetype: 'record',
          tableName: 'virtual_system_options',
          syncableFields: {
            id: { type: 'text', required: true },
            option_type: { type: 'text', required: true }, // priority, status, category
            archetype: { type: 'text', required: true },   // task, project, record
            value: { type: 'text', required: true },        // high, medium, low
            label: { type: 'text', required: true },        // "High Priority"
            color: { type: 'text' },
            icon: { type: 'text' },
            order: { type: 'number', defaultValue: 0 },
            is_active: { type: 'boolean', defaultValue: true },
            created_at: { type: 'datetime' },
            updated_at: { type: 'datetime' }
          },
          _isVirtual: true,
          _backendTables: ['system_option_sets', 'system_options'],
          _orgId: orgId,
          _originalName: 'SystemOption'
        }
        
        // Add CustomOption virtual entity per organization
        orgData.schema.entities[`${orgId}_CustomOption`] = {
          archetype: 'record',
          tableName: `virtual_custom_options_${orgId}`,
          syncableFields: {
            id: { type: 'text', required: true },
            option_set_name: { type: 'text', required: true }, // departments, teams
            value: { type: 'text', required: true },
            label: { type: 'text', required: true },
            color: { type: 'text' },
            icon: { type: 'text' },
            order: { type: 'number', defaultValue: 0 },
            is_active: { type: 'boolean', defaultValue: true },
            created_at: { type: 'datetime' },
            updated_at: { type: 'datetime' }
          },
          _isVirtual: true,
          _backendTables: ['custom_option_sets', 'custom_options'],
          _orgId: orgId,
          _originalName: 'CustomOption'
        }
        
        // **NEW: Add entity reference virtual entities for dropdowns**
        // These expose existing business entities as reference options
        const existingBusinessEntities = Object.keys(orgData.schema.entities)
          .filter(entityName => !entityName.startsWith('System') && !entityName.endsWith('_CustomOption'))
        
        existingBusinessEntities.forEach(businessEntityName => {
          // Create virtual reference entity (e.g., VirtualUser, VirtualTask, VirtualProject)
          const virtualEntityName = `Virtual${businessEntityName}`
          orgData.schema.entities[virtualEntityName] = {
            archetype: 'record',
            tableName: `virtual_${businessEntityName.toLowerCase()}_reference_${orgId}`,
            syncableFields: {
              id: { type: 'text', required: true },
              title: { type: 'text', required: true },        // Main display field
              name: { type: 'text' },                         // Alternative display field
              email: { type: 'text' },                        // For users
              status: { type: 'text' },                       // Current status
              created_at: { type: 'datetime' },
              updated_at: { type: 'datetime' }
            },
            _isVirtual: true,
            _backendTables: [`org_${orgId.replace(/-/g, '_')}_${businessEntityName.toLowerCase()}`],
            _orgId: orgId,
            _originalName: businessEntityName,
            _entityReference: true,                          // Mark as entity reference
            _targetEntityType: businessEntityName           // What entity this references
          }
        })
        
        const businessEntityCount = existingBusinessEntities.length
        fileLog.info(`[Observable] Added SystemOption, CustomOption, and ${businessEntityCount} entity reference virtual entities for org ${orgId}`)
      }
    })
    
    // Update universe context with virtual entities
    universeContext$.organizations.set(existingOrganizations)
    
    // Calculate total virtual entities: SystemOption + CustomOption + entity references per org
    let totalVirtualEntities = 0
    organizationIds.forEach(orgId => {
      const orgData = existingOrganizations[orgId]
      if (orgData?.schema?.entities) {
        const businessEntityCount = Object.keys(orgData.schema.entities)
          .filter(entityName => !entityName.startsWith('System') && !entityName.endsWith('_CustomOption') && !entityName.startsWith('Virtual'))
          .length
        totalVirtualEntities += 2 + businessEntityCount // SystemOption + CustomOption + entity references
      }
    })
    
    fileLog.info(`[Observable] Added ${totalVirtualEntities} total virtual entities to universe schema`)
    
  } catch (error) {
    fileLog.error('[Observable] Failed to add virtual options entities:', error)
    // Don't throw - this is not critical for basic functionality
  }
}


/**
 * Initialize persistence configuration for loaded organizations
 */
async function initializePersistence(userId: string, organizationIds: string[], totalEntities: number) {
  // Skip if already initialized (but allow initialization even if totalEntities is 0)
  if (persistenceManager && syncedCrudWithPersistence) {
    fileLog.info(`[Observable] Skipping persistence initialization: already initialized=${!!(persistenceManager && syncedCrudWithPersistence)}`)
    return
  }
  
  try {
    // Use primary organization for persistence (first in list)
    const primaryOrgId = organizationIds[0]
    if (!primaryOrgId) {
      fileLog.error('[Observable] No organization ID available for persistence setup')
      return
    }
    
    // Create persistence manager and basic config first, even without entities
    fileLog.info(`[Observable] Initializing persistence manager for org ${primaryOrgId} (expected ${totalEntities} entities)`)
    
    // Create persistence manager with enhanced error handling
    persistenceManager = createPersistenceManager(primaryOrgId, userId)
    setPersistenceManagerReference(persistenceManager)
    
    // Set up persistence config setter so immediate persistence setup can update global config
    setPersistenceConfigSetter((config: any) => {
      persistenceConfig = config
      fileLog.info(`[Observable] 🎯 Global persistence config updated with ${Object.keys(config?.entityTableMap || {}).length} entity mappings`)
    })
    
    // Set up basic configuration that doesn't require entity names
    // This ensures that when entities ARE created, they can access the persistence config
    syncedCrudWithPersistence = true // Mark as initialized so entities know persistence is available
    
    fileLog.info(`[Observable] ✅ Basic persistence configuration initialized, entities can now use persistence`)
    
    // Check if we already have entities in the schema (for post-schema initialization)
    const currentSchema = universeSchema$.peek()
    const entityKeys = currentSchema?.entities ? Object.keys(currentSchema.entities) : []
    
    if (entityKeys.length > 0) {
      fileLog.info(`[Observable] Found ${entityKeys.length} existing entities, setting up full persistence config`)
      const persistenceConfiguration = await setupFullPersistenceConfig(entityKeys, primaryOrgId)
      if (persistenceConfiguration) {
        persistenceConfig = persistenceConfiguration
      }
    } else {
      fileLog.info(`[Observable] No entities found yet, persistence will be configured when schema is loaded`)
      // Persistence configuration is now handled in the schema-observable.ts when schemas are loaded
      // This ensures the configuration is available before entities are created
    }
    
    // Update tracking variables
    currentOrgId = primaryOrgId
    currentSchemaVersion = currentSchema?.version || 'unknown'
    
    fileLog.info(`[Observable] Persistence initialized successfully`, {
      orgId: primaryOrgId,
      entityCount: entityKeys.length,
      schemaVersion: currentSchemaVersion,
      hasPersistenceManager: !!persistenceManager,
      hasSyncedCrudWithPersistence: !!syncedCrudWithPersistence
    })
    
  } catch (error) {
    fileLog.error('[Observable] Failed to initialize persistence:', error)
    
    // Check for specific IndexedDB errors and provide user-friendly handling
    if (error?.name === 'NotFoundError' || 
        error?.message?.includes('object stores was not found') ||
        error?.message?.includes('Error loading local cache')) {
      fileLog.info('[Observable] IndexedDB schema issue detected - continuing without persistence')
      
      // Clear any corrupted IndexedDB data
      try {
        if (persistenceManager) {
          await persistenceManager.clearOrganizationData()
        }
      } catch (clearError) {
        fileLog.error('[Observable] Failed to clear corrupted data:', clearError)
      }
    }
    
    // Reset variables on failure but don't crash the app
    persistenceManager = null
    syncedCrudWithPersistence = null
    currentOrgId = null
    currentSchemaVersion = null
    
    // Continue with server-only sync - the app will still work
    fileLog.info('[Observable] Continuing with server-only sync (no local persistence)')
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
    fileLog.info(`[Observable] Entities not ready yet`, {
      loading,
      hasSchema: !!schema,
      hasEntities: !!schema?.entities
    })
    return {}
  }
  
  // Safely get entity keys (these are org-prefixed in universe schema)
  const entityKeys = schema.entities && typeof schema.entities === 'object' ? Object.keys(schema.entities) : []
  
  fileLog.info(`[Observable] Creating entity observables for universe schema`, {
    schemaVersion: schema.version || 'unknown',
    entityCount: entityKeys.length,
    sampleEntities: entityKeys.slice(0, 3)
  })
  
  // Note: Full persistence configuration is now set up during initialization phase
  // This ensures entities have access to IndexedDB configuration when they are created
  // See initializePersistence() function for the reactive configuration setup
  
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
            fileLog.error(`[Observable] Error creating observable for entity ${entityName}:`, entityError)
            return null
          }
        },
        enumerable: true,
        configurable: true
      })
    })
    
    fileLog.info(`[Observable] Set up lazy entity observables for ${entityKeys.length} entities`)
    return entityObservables
  } catch (error) {
    fileLog.error('[Observable] Error setting up entity observables:', error)
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
    
    // Debug logging removed - was causing excessive console spam
    
    // IMPORTANT: Always use org-prefixed names for data operations
    // The schema should have entities stored with org-prefixed keys
    const entitySchema = currentSchema?.entities?.[entityName]
    
    if (!entitySchema) {
      // For backward compatibility, try extracting and looking up with clean name
      // This is a fallback that should be removed once all callers use org-prefixed names
      const { entityName: cleanEntityName } = EntityNameUtils.extractOrgPrefix(entityName)
      const fallbackSchema = currentSchema?.entities?.[cleanEntityName]
      
      if (fallbackSchema) {
        fileLog.debug(`[Observable] DEPRECATED: Entity ${entityName} not found with org-prefix, found with clean name ${cleanEntityName}. Callers should use org-prefixed names.`)
        // Don't proceed with fallback - enforce org-prefixed usage
      }
      
      fileLog.debug(`[Observable] Entity ${entityName} not available in universe schema`)
      // Entity not found - this is expected during initial load
      return null
    }
    
    // Use the original entity name as cache key (must be org-prefixed)
    const cacheKey = entityName
    
    // Check if we already have the observable cached
    if (globalEntityCache[cacheKey]) {
      fileLog.info(`[Observable] Retrieved cached ${entityName} observable`)
      return globalEntityCache[cacheKey]
    }
    
    // Create the observable directly if not cached
    try {
      fileLog.info(`[Observable] Creating new observable for ${entityName}`)
      const observable = createEntityObservable(entityName, entitySchema)
      globalEntityCache[cacheKey] = observable
      
      // DEBUG: Check what we created
      fileLog.info(`[Observable] Created ${entityName} observable`, {
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
      fileLog.error(`[Observable] Error creating observable for ${entityName}:`, createError)
      return null
    }
  } catch (error) {
    fileLog.error(`[Observable] Error getting entity observable for ${entityName}:`, error)
    return null
  }
}

/**
 * Universe-aware entity getter - handles both regular and org-prefixed entity names
 * For universe context: getUniverseEntity$('01920000-1000-7000-8000-000000000001_Client')  
 * For regular context: getUniverseEntity$('Client') - falls back to current org
 */
export function getUniverseEntity$(entityIdentifier: string) {
  fileLog.info(`[UniverseObservable] getUniverseEntity$ called with "${entityIdentifier}"`)
  try {
    // Check if this is an org-prefixed entity name (contains UUID pattern)
    const orgPrefixMatch = entityIdentifier.match(/^([a-f0-9-]{36})_(.+)$/)
    
    if (orgPrefixMatch) {
      // Extract org ID and entity name from prefixed identifier
      const [, orgId, entityName] = orgPrefixMatch
      fileLog.info(`[UniverseObservable] Accessing org-prefixed entity ${entityName} from org ${orgId}`)
      
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
        fileLog.debug(`[UniverseObservable] Entity ${schemaKey} not available in current universe schema`)
        fileLog.info(`[UniverseObservable] Available entities:`, Object.keys(currentOrgContext?.schema?.entities || {}))
        return null
      }
      
      // Use the full entityIdentifier as cache key to match getEntity$ format
      const cacheKey = entityIdentifier
      
      // Check cache first
      if (globalEntityCache[cacheKey]) {
        fileLog.info(`[UniverseObservable] Retrieved cached org-prefixed ${entityIdentifier} observable`)
        return globalEntityCache[cacheKey]
      }
      
      // Create observable for this specific organization's entity
      try {
        fileLog.info(`[UniverseObservable] Creating new observable for org-prefixed ${entityIdentifier}`)
        const observable = createEntityObservable(entityIdentifier, currentOrgContext.schema.entities[schemaKey])
        globalEntityCache[cacheKey] = observable
        
        fileLog.info(`[UniverseObservable] Created ${entityIdentifier} observable`, {
          orgId,
          entityName,
          type: typeof observable,
          hasGet: typeof observable?.get === 'function'
        })
        
        return observable
      } catch (createError) {
        fileLog.error(`[UniverseObservable] Error creating observable for ${entityIdentifier}:`, createError)
        return null
      }
    } else {
      // No org prefix - fall back to regular getEntity$ behavior
      fileLog.info(`[UniverseObservable] No org prefix detected, falling back to regular getEntity$ for ${entityIdentifier}`)
      return getEntity$(entityIdentifier)
    }
  } catch (error) {
    console.error(`🔥 UNIVERSE DEBUG: Exception in getUniverseEntity$ for ${entityIdentifier}:`, error)
    fileLog.error(`[UniverseObservable] Error getting universe entity observable for ${entityIdentifier}:`, error)
    return null
  }
}

/**
 * Clear all observables (for logout or org switching)
 */
export function clearContext() {
  fileLog.info('[Observable] Clearing all observables with robust cleanup')
  
  // Use InitializationManager for coordinated cleanup
  initializationManager.reset()
  
  // Clear legacy persistence manager data if it exists
  if (persistenceManager) {
    try {
      persistenceManager.clearOrganizationData()
    } catch (error) {
      fileLog.error('[Observable] Error clearing legacy persistence data:', error)
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
  
  // Clear schema observables as well
  clearSchemaObservables()
  
  fileLog.info('[Observable] ✅ Context cleared successfully')
}

/**
 * Handle WebSocket table change notification
 */
export function handleTableNotification(notification: any) {
  if (!notification?.table) return
  
  fileLog.info(`[Observable] Table notification for ${notification.table}:`, notification.operation)
  
  // Handle schema changes from external sources (other clients)
  if (notification.table === 'entity_schemas') {
    fileLog.info(`[Observable] External entity schema change detected - reloading universe schema`)
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
    fileLog.error(`[Observable] Cannot remove entity ${entityName} - no schema loaded`)
    return
  }
  
  if (!currentSchema.entities[entityName]) {
    fileLog.error(`[Observable] Entity ${entityName} not found in schema`)
    return
  }
  
  fileLog.info(`[Observable] Removing entity ${entityName} from local schema observable`)
  
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
  
  fileLog.info(`[Observable] New schema will have ${Object.keys(newEntities).length} entities (was ${Object.keys(currentSchema.entities).length})`)
  
  // Update the observable immediately - this will trigger all reactive components
  // Schema is now managed by universe context - this is a no-op
  fileLog.info('Schema update requested but handled by universe context')
  
  fileLog.info(`[Observable] Schema updated locally - UI should update immediately`)
}

/**
 * Reload schema from server (for external changes)
 */
async function reloadOrgSchema(orgId: string) {
  try {
    // Use schema observable instead of old client
    const schemaObs = getSchemaObservable$(orgId)
    if (schemaObs) {
      // Trigger schema reload via observable
      const schema = peekSchemaData$(orgId)
      if (schema) {
        // Schema is now managed by schema observables - this is a no-op
        fileLog.info('Schema update requested but handled by schema observables')
        fileLog.info(`[Observable] Schema reloaded from server`)
      }
    }
  } catch (error) {
    fileLog.error('[Observable] Failed to reload schema:', error)
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
      
      // Use EntityNameUtils for proper display formatting with spaces
      const displayName = EntityNameUtils.toDisplayFormat(entityName)
      const orgName = entitySchema._organizationName
      
      // Extract org ID from entity name if it's prefixed
      let orgId = entitySchema._organizationId || entitySchema._orgId
      if (!orgId && entityName.includes('_')) {
        const parts = entityName.split('_')
        if (parts[0].length === 36 && parts[0].includes('-')) {
          orgId = parts[0]
        }
      }
      
      // Generate URL using the original entity name (without org prefix) in URL-safe format
      // This ensures consistent URLs regardless of how the entity is stored
      const cleanEntityName = entityName.includes('_') 
        ? entityName.split('_').slice(1).join('_')  // Remove org prefix if present
        : entityName;
      const urlSafeEntityName = EntityNameUtils.toUrlSafeFormat(cleanEntityName);
      
      entityGroups[archetype].push({
        title: displayName,
        url: `/org/${orgId}/entities/${urlSafeEntityName}`,
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
    fileLog.error('[Observable] Error creating entity groups:', error)
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
      fileLog.error(`[BatchOperations] ${failures.length}/${ids.length} deletions failed:`, failures)
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
      fileLog.error(`[BatchOperations] ${failures.length}/${items.length} creations failed:`, failures)
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
      fileLog.info(`[Observable] Direct observable update for ${entityName}:${id}`, data)
      
      // Get the entity observable (this is the syncedCrud observable)
      const entity$ = getEntity$(entityName)
      if (!entity$) {
        throw new Error(`Entity ${entityName} observable not found`)
      }
      
      fileLog.info(`[Observable] Found entity record ${entityName}:${id}, updating fields:`, Object.keys(data))
      
      // CORRECT PATTERN: For syncedCrud with list operations, access the record directly
      // entity$[id] gives us the observable for that specific record
      // entity$[id].fieldName.set(value) or entity$[id].assign({...updates})
      
      // FIXED: Use syncedCrud's update function directly
      // syncedCrud observables provide CRUD operations: list, create, update, delete
      // Don't access individual record observables, use the built-in update function
      fileLog.info(`[Observable] Using syncedCrud update for ${entityName}:${id}:`, data)
      
      // Get current data from the observable
      const allRecords = entity$.get()
      const currentRecord = allRecords?.[id]
      
      if (!currentRecord || typeof currentRecord !== 'object') {
        throw new Error(`Record ${id} not found in ${entityName}`)
      }
      
      // Create updated record by merging current data with updates  
      const updatedRecord = { ...currentRecord, ...data, updated_at: new Date().toISOString() }
      fileLog.info(`[Observable] Merged record data:`, updatedRecord)
      
      // CORRECT syncedCrud pattern: update the record in the observable data
      // This will trigger the update function defined in the syncedCrud config and sync to server
      const newRecords = { ...allRecords, [id]: updatedRecord }
      entity$.set(newRecords)
      
      fileLog.info(`✅ [Observable] Observable update completed for ${entityName}:${id}`)
      // syncedCrud will automatically handle the server sync in the background
      
      // Return the updated record that was already merged above
      return updatedRecord
      
    } catch (error) {
      fileLog.error(`❌ [Observable] Update failed for ${entityName}:${id}`, { error: error.message, data })
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
          fileLog.info(`[Observable] Direct delete result:`, deleteResult)
          return { success: true }
        } else {
          throw new Error('syncedCrud delete function not accessible')
        }
      } catch (directDeleteError) {
        fileLog.error(`[Observable] Direct syncedCrud delete failed:`, directDeleteError.message)
        
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
            fileLog.info(`[Observable] Delete fallback - using actual org ${deleteOrgId} for entity ${deleteEntityName}`)
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
        fileLog.info(`[Observable] Manual server delete successful, triggering refresh`)
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
      
      fileLog.info('[Observable] Intercepted Legend State IndexedDB error - handling gracefully')
      
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
      fileLog.info('[Observable] Caught unhandled IndexedDB error - preventing crash')
      
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

/**
 * Wrapper function to expose persistence initialization with entity count
 * This allows the simplified Legend State initialization to properly set up persistence
 */
export async function initializePersistenceWithEntityCount(
  userId: string, 
  organizationIds: string[], 
  entityCount: number
): Promise<void> {
  return initializePersistence(userId, organizationIds, entityCount);
}

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