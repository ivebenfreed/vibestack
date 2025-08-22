/**
 * Configure Legend State with persistence and create custom sync adapters
 * Based on the official Legend State documentation patterns
 */

import { configureSynced } from '@legendapp/state/sync'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { observablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'

// Store configured syncedCrud instances per organization
const configuredSyncByOrg = new Map<string, ReturnType<typeof configureSynced>>()

/**
 * Get or create a configured syncedCrud for a specific organization
 * This creates a version of syncedCrud with IndexedDB persistence pre-configured
 */
export function getConfiguredSyncedCrud(orgId: string, entityNames: string[]) {
  const cacheKey = `${orgId}_${entityNames.sort().join(',')}`
  
  if (!configuredSyncByOrg.has(cacheKey)) {
    console.log(`[Legend State] Creating configured syncedCrud for org ${orgId} with entities:`, entityNames)
    
    // Create a configured version of syncedCrud with IndexedDB persistence
    // This follows the pattern from the Legend State docs
    const configuredSync = configureSynced(syncedCrud, {
      persist: {
        plugin: observablePersistIndexedDB({
          databaseName: `VibeStack_${orgId}`,
          version: 1,
          // Pre-define all entity table names from the schema
          tableNames: entityNames
        }),
        retrySync: true
      },
      // Default retry configuration
      retry: {
        infinite: true,
        delay: 1000,
        backoff: 'exponential',
        maxDelay: 30000
      }
    })
    
    configuredSyncByOrg.set(cacheKey, configuredSync)
  }
  
  return configuredSyncByOrg.get(cacheKey)!
}

/**
 * Initialize Legend State persistence for an organization
 * This should be called during app initialization after schema is loaded
 */
export function initializePersistence(orgId: string, schema: any) {
  const entityNames = schema?.entities ? Object.keys(schema.entities) : []
  
  if (entityNames.length === 0) {
    console.warn('[Legend State] No entities found in schema, persistence not initialized')
    return
  }
  
  console.log(`[Legend State] Initializing persistence for org ${orgId} with ${entityNames.length} entities`)
  
  // Pre-create the configured sync to ensure IndexedDB is set up
  getConfiguredSyncedCrud(orgId, entityNames)
  
  console.log('[Legend State] Persistence initialized successfully')
}