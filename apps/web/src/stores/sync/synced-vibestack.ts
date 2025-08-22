/**
 * VibeStack Sync Adapter for Legend State
 * 
 * Uses Legend State's built-in differential sync with proper mode handling:
 * - Uses built-in changesSince="last-sync" with fieldUpdatedAt
 * - Enables built-in IndexedDB persistence
 * - Subscribes to WebSocket table change notifications
 * - All CRUD operations use standard VibeStack API endpoints
 */

import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { type SyncedCrudOptions } from '@legendapp/state/sync-plugins/crud'

export interface VibeStackSyncConfig {
  orgId: string
  entityName: string
  schema?: any // Will use schema observable to derive endpoints
  softDelete?: boolean
  optimisticUpdates?: boolean
}

/**
 * Create a Legend State sync adapter for VibeStack entities
 * Uses Legend State's built-in differential sync with proper mode handling
 */
export function syncedVibeStack(config: VibeStackSyncConfig): SyncedCrudOptions {
  const { orgId, entityName, schema, softDelete = true, optimisticUpdates = true } = config
  
  // Derive URL from schema if available, otherwise use standard pattern
  const baseUrl = schema?.endpoints?.[entityName]?.base || 
                  `/api/archetype/orgs/${orgId}/data/${entityName}`
  
  return syncedCrud({
    // LIST - Let Legend State handle differential sync automatically
    list: async (params) => {
      console.log(`[syncedVibeStack] Loading ${entityName} data...`, { 
        lastSync: params?.lastSync, 
        mode: params?.mode 
      })
      
      let url = baseUrl
      const urlParams = new URLSearchParams()
      
      // Legend State passes lastSync when using changesSince: "last-sync"
      if (params?.lastSync) {
        const lastSyncDate = new Date(params.lastSync).toISOString()
        urlParams.set('changesSince', lastSyncDate)
        console.log(`[syncedVibeStack] Using diff sync for ${entityName} since ${lastSyncDate}`)
      } else {
        console.log(`[syncedVibeStack] Full data fetch for ${entityName}`)
      }
      
      if (urlParams.toString()) {
        url += `?${urlParams.toString()}`
      }
      
      try {
        const res = await fetch(url, { 
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        })
        
        if (!res.ok) {
          console.warn(`[syncedVibeStack] Failed to load ${entityName}:`, res.status)
          return []
        }
        
        const result = await res.json()
        const data = result.data || []
        
        console.log(`[syncedVibeStack] Loaded ${data.length} ${entityName} records`)
        return data
        
      } catch (error) {
        console.error(`[syncedVibeStack] Error loading ${entityName}:`, error)
        return []
      }
    },
    
    // CREATE - Post to entity endpoint
    create: async (item: any) => {
      console.log(`[syncedVibeStack] Creating ${entityName}:`, item)
      
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!res.ok) {
        throw new Error(`Failed to create ${entityName}: ${res.status}`)
      }
      
      const result = await res.json()
      return result.data || item
    },
    
    // UPDATE - Put to entity endpoint with ID
    update: async (item: any) => {
      console.log(`[syncedVibeStack] Updating ${entityName}:`, item)
      
      const res = await fetch(`${baseUrl}/${item.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!res.ok) {
        throw new Error(`Failed to update ${entityName}: ${res.status}`)
      }
      
      const result = await res.json()
      return result.data || item
    },
    
    // DELETE - Soft or hard delete
    delete: async (item: any) => {
      console.log(`[syncedVibeStack] Deleting ${entityName}:`, item)
      
      if (softDelete) {
        // Soft delete - just update the deleted field
        const res = await fetch(`${baseUrl}/${item.id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ deleted: true })
        })
        
        if (!res.ok) {
          throw new Error(`Failed to soft delete ${entityName}: ${res.status}`)
        }
        
        const result = await res.json()
        return result.data
        
      } else {
        // Hard delete
        const res = await fetch(`${baseUrl}/${item.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        })
        
        if (!res.ok) {
          throw new Error(`Failed to delete ${entityName}: ${res.status}`)
        }
        
        return undefined
      }
    },
    
    // SUBSCRIBE - WebSocket notification listener for real-time updates
    subscribe: (params) => {
      const handler = (e: CustomEvent) => {
        const notification = e.detail
        
        // Check if notification is for this entity (notification.tables is an array)
        if (notification?.tables?.includes(entityName.toLowerCase()) || 
            notification?.tables?.includes(entityName) ||
            notification?.table === entityName.toLowerCase() || 
            notification?.table === entityName) {
          console.log(`[syncedVibeStack] WebSocket notification for ${entityName}:`, notification)
          
          // Trigger update - Legend State will handle differential sync automatically
          params.refresh()
        }
      }
      
      // Listen for table change notifications
      window.addEventListener('vibestack:table-change-notification', handler as any)
      
      console.log(`[syncedVibeStack] Subscribed to WebSocket notifications for ${entityName}`)
      
      // Return cleanup function
      return () => {
        window.removeEventListener('vibestack:table-change-notification', handler as any)
        console.log(`[syncedVibeStack] Unsubscribed from WebSocket notifications for ${entityName}`)
      }
    },
    
    // Enable Legend State's built-in differential sync
    changesSince: 'last-sync',
    
    // Field configuration for built-in differential sync and soft deletes
    fieldId: 'id',
    fieldCreatedAt: 'created_at', 
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: softDelete ? 'deleted' : undefined,
    
    // Generate IDs client-side for optimistic updates
    generateId: () => crypto.randomUUID(),
    
    // Persistence disabled due to WeakMap compatibility issues
    // persist: {
    //   name: `vibestack_${orgId}_${entityName}`,
    //   plugin: 'indexeddb'
    // },
    
    // Configure for array-based data
    as: 'array',
    
    // Enable optimistic updates for instant UI feedback
    updateLocal: optimisticUpdates,
    
    // Retry configuration for offline support
    retry: {
      infinite: true,
      delay: 1000,
      backoff: 'exponential',
      maxDelay: 30000
    },
    
    // Debounce configuration to batch operations
    debounce: {
      wait: 500,
      save: 1000
    },
    
    // Initial value - empty array for array-based syncedCrud
    initial: []
  })
}

/**
 * Create a sync adapter with schema-aware configuration
 * Automatically derives endpoints and configuration from schema
 */
export function syncedVibeStackWithSchema(
  orgId: string,
  entityName: string,
  schema: any,
  overrides?: Partial<VibeStackSyncConfig>
): SyncedCrudOptions {
  // Extract entity-specific configuration from schema
  const entitySchema = schema?.entities?.[entityName]
  const entityConfig = entitySchema?.syncConfig || {}
  
  // Merge schema config with overrides
  const config: VibeStackSyncConfig = {
    orgId,
    entityName,
    schema,
    softDelete: entityConfig.softDelete ?? overrides?.softDelete ?? true,
    optimisticUpdates: entityConfig.optimisticUpdates ?? overrides?.optimisticUpdates ?? true,
    ...overrides
  }
  
  console.log(`[syncedVibeStack] Creating schema-aware sync for ${entityName}`, config)
  
  return syncedVibeStack(config)
}