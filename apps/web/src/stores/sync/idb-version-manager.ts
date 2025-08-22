/**
 * IndexedDB Version Manager
 * 
 * Manages IndexedDB database versions and migrations when entities change.
 * This solves the problem where adding/removing entities causes IDB errors
 * because the object stores don't match the schema.
 */

import { observable } from '@legendapp/state'

// Store the current IDB versions per organization
const idbVersions = new Map<string, number>()

// Store schema hashes to detect changes
const schemaHashes = new Map<string, string>()

/**
 * Generate a hash of the entity names to detect schema changes
 */
function generateSchemaHash(entityNames: string[]): string {
  return entityNames.sort().join('|')
}

/**
 * Get the current IDB version for an organization
 */
export function getIDBVersion(orgId: string): number {
  const key = `vibestack_idb_version_${orgId}`
  
  if (!idbVersions.has(orgId)) {
    // Check localStorage for persisted version
    const stored = localStorage.getItem(key)
    const version = stored ? parseInt(stored, 10) : 1
    idbVersions.set(orgId, version)
  }
  
  return idbVersions.get(orgId) || 1
}

/**
 * Increment the IDB version when schema changes
 */
export function incrementIDBVersion(orgId: string): number {
  const currentVersion = getIDBVersion(orgId)
  const newVersion = currentVersion + 1
  
  idbVersions.set(orgId, newVersion)
  localStorage.setItem(`vibestack_idb_version_${orgId}`, newVersion.toString())
  
  console.log(`[IDB Version Manager] Incremented version for org ${orgId} from ${currentVersion} to ${newVersion}`)
  
  return newVersion
}

/**
 * Check if schema has changed and update version if needed
 */
export function checkSchemaChange(orgId: string, entityNames: string[]): boolean {
  const newHash = generateSchemaHash(entityNames)
  const oldHash = schemaHashes.get(orgId)
  
  if (!oldHash) {
    // First time, just store the hash
    schemaHashes.set(orgId, newHash)
    localStorage.setItem(`vibestack_schema_hash_${orgId}`, newHash)
    return false
  }
  
  if (oldHash !== newHash) {
    console.log(`[IDB Version Manager] Schema changed for org ${orgId}`)
    console.log(`  Old entities: ${oldHash}`)
    console.log(`  New entities: ${newHash}`)
    
    // Update hash and increment version
    schemaHashes.set(orgId, newHash)
    localStorage.setItem(`vibestack_schema_hash_${orgId}`, newHash)
    incrementIDBVersion(orgId)
    
    return true
  }
  
  return false
}

/**
 * Load persisted schema hash
 */
export function loadSchemaHash(orgId: string): void {
  const stored = localStorage.getItem(`vibestack_schema_hash_${orgId}`)
  if (stored) {
    schemaHashes.set(orgId, stored)
  }
}

/**
 * Clear all IDB databases for an organization (nuclear option)
 */
export async function clearIDBForOrg(orgId: string): Promise<void> {
  const dbName = `VibeStack_${orgId}`
  
  try {
    // Close any open connections
    const dbs = await indexedDB.databases()
    const ourDb = dbs.find(db => db.name === dbName)
    
    if (ourDb) {
      // Delete the database
      await new Promise((resolve, reject) => {
        const deleteReq = indexedDB.deleteDatabase(dbName)
        deleteReq.onsuccess = resolve
        deleteReq.onerror = reject
      })
      
      console.log(`[IDB Version Manager] Cleared IDB for org ${orgId}`)
    }
    
    // Reset version to 1
    idbVersions.set(orgId, 1)
    localStorage.setItem(`vibestack_idb_version_${orgId}`, '1')
    
    // Clear schema hash to force recreation
    schemaHashes.delete(orgId)
    localStorage.removeItem(`vibestack_schema_hash_${orgId}`)
  } catch (error) {
    console.error(`[IDB Version Manager] Failed to clear IDB for org ${orgId}:`, error)
  }
}

/**
 * Initialize version manager for an organization
 */
export function initializeVersionManager(orgId: string, entityNames: string[]): { version: number, changed: boolean } {
  // Load persisted hash
  loadSchemaHash(orgId)
  
  // Check if schema changed
  const changed = checkSchemaChange(orgId, entityNames)
  
  // Get current version
  const version = getIDBVersion(orgId)
  
  console.log(`[IDB Version Manager] Initialized for org ${orgId}:`, {
    version,
    changed,
    entities: entityNames.length
  })
  
  return { version, changed }
}

/**
 * Handle IndexedDB upgrade when schema changes
 * This is called during the onupgradeneeded event
 */
export function handleIDBUpgrade(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number,
  entityNames: string[]
): void {
  console.log(`[IDB Version Manager] Upgrading IDB from v${oldVersion} to v${newVersion}`)
  
  // Get existing object stores
  const existingStores = Array.from(db.objectStoreNames)
  
  // Always include Legend State internal stores
  const internalStores = ['__legend_state_meta__', '__legend_state_sync__']
  const allRequiredStores = [...entityNames, ...internalStores]
  
  // Determine what needs to be added/removed
  const storesToAdd = allRequiredStores.filter(name => !existingStores.includes(name))
  const storesToRemove = existingStores.filter(name => 
    !allRequiredStores.includes(name) && 
    !name.startsWith('__') // Don't remove other Legend State internal stores
  )
  
  console.log(`[IDB Version Manager] Migration plan:`, {
    existing: existingStores,
    toAdd: storesToAdd,
    toRemove: storesToRemove
  })
  
  // Remove obsolete stores
  for (const storeName of storesToRemove) {
    try {
      db.deleteObjectStore(storeName)
      console.log(`[IDB Version Manager] Removed object store: ${storeName}`)
    } catch (error) {
      console.warn(`[IDB Version Manager] Failed to remove store ${storeName}:`, error)
    }
  }
  
  // Add new stores
  for (const storeName of storesToAdd) {
    try {
      if (storeName.startsWith('__')) {
        // Legend State internal stores don't need indexes
        db.createObjectStore(storeName)
      } else {
        // Entity stores need id as keyPath
        const store = db.createObjectStore(storeName, { keyPath: 'id' })
        store.createIndex('updated_at', 'updated_at', { unique: false })
      }
      console.log(`[IDB Version Manager] Created object store: ${storeName}`)
    } catch (error) {
      console.warn(`[IDB Version Manager] Failed to create store ${storeName}:`, error)
    }
  }
}

/**
 * Ensure IndexedDB has all required object stores
 * This is a safety check that runs before Legend State tries to use the DB
 */
export async function ensureIDBStores(orgId: string, entityNames: string[]): Promise<void> {
  const dbName = `VibeStack_${orgId}`
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName)
    
    request.onsuccess = () => {
      const db = request.result
      const existingStores = Array.from(db.objectStoreNames)
      
      // Check if all required stores exist
      const missingStores = entityNames.filter(name => !existingStores.includes(name))
      
      if (missingStores.length > 0) {
        console.warn(`[IDB Version Manager] Missing stores detected:`, missingStores)
        db.close()
        
        // Force a version increment to trigger upgrade
        incrementIDBVersion(orgId)
        
        // Clear the database to force recreation
        clearIDBForOrg(orgId).then(() => resolve()).catch(reject)
      } else {
        db.close()
        resolve()
      }
    }
    
    request.onerror = () => {
      console.error(`[IDB Version Manager] Failed to open database:`, request.error)
      reject(request.error)
    }
  })
}

// Export for debugging
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).idbVersionManager = {
    getIDBVersion,
    incrementIDBVersion,
    checkSchemaChange,
    clearIDBForOrg,
    idbVersions,
    schemaHashes
  }
}