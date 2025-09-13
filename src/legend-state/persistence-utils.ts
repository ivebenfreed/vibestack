/**
 * Persistence Utilities
 * 
 * Utility functions for setting up persistence configuration.
 * This file is separate from observables.ts to avoid circular imports.
 */

import { log } from '@/logger'

const fileLog = log('legend-state/persistence-utils')

// External reference to the persistence manager
let persistenceManagerRef: any = null

// External reference to global persistence config setter
let persistenceConfigSetter: ((config: any) => void) | null = null

export function setPersistenceManagerReference(manager: any) {
  persistenceManagerRef = manager
  fileLog.info('[PersistenceUtils] Persistence manager reference set')
}

export function setPersistenceConfigSetter(setter: (config: any) => void) {
  persistenceConfigSetter = setter
  fileLog.info('[PersistenceUtils] Persistence config setter reference set')
}

/**
 * Set up full persistence configuration when entities exist
 */
export async function setupFullPersistenceConfig(entityNames: string[], orgId: string): Promise<{ persistOptions: any; entityTableMap: any } | null> {
  if (!persistenceManagerRef) {
    fileLog.warn('[PersistenceUtils] No persistence manager available for full configuration')
    return null
  }
  
  try {
    fileLog.info(`[PersistenceUtils] Setting up full persistence configuration for ${entityNames.length} entities`)
    
    // Create IndexedDB configuration using the persistence manager
    const persistenceConfiguration = await persistenceManagerRef.createIndexedDBConfig(entityNames)
    
    if (!persistenceConfiguration) {
      fileLog.warn('[PersistenceUtils] Failed to create persistence configuration - persistence manager returned null')
      return null
    }
    
    fileLog.info(`[PersistenceUtils] ✅ Full persistence configuration complete`, {
      entityCount: entityNames.length,
      orgId,
      hasPersistOptions: !!persistenceConfiguration.persistOptions,
      entityTableMap: persistenceConfiguration.entityTableMap
    })
    
    // Store the configuration globally so entities can use it
    if (persistenceConfigSetter) {
      persistenceConfigSetter(persistenceConfiguration)
      fileLog.info(`[PersistenceUtils] 🎯 Global persistence config updated`)
    } else {
      fileLog.warn(`[PersistenceUtils] No persistence config setter available - global config not updated`)
    }
    
    return persistenceConfiguration
    
  } catch (error) {
    fileLog.error('[PersistenceUtils] Failed to setup full persistence configuration:', error)
    throw error
  }
}