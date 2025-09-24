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

// Global setup guard to prevent multiple configurations
let globalPersistenceSetupComplete = false

export function setPersistenceManagerReference(manager: any) {
  persistenceManagerRef = manager
  fileLog.info('[PersistenceUtils] Persistence manager reference set')
}

export function setPersistenceConfigSetter(setter: (config: any) => void) {
  persistenceConfigSetter = setter
  fileLog.info('[PersistenceUtils] Persistence config setter reference set')
}

export function resetGlobalPersistenceSetup() {
  globalPersistenceSetupComplete = false
  fileLog.info('[PersistenceUtils] Global persistence setup reset')
}

/**
 * Set up global persistence configuration after all schemas are loaded
 * This prevents multiple version increments from individual schema loads
 */
export async function setupGlobalPersistenceConfig(): Promise<void> {
  if (globalPersistenceSetupComplete) {
    fileLog.info('[PersistenceUtils] Global persistence setup already completed, skipping')
    return
  }

  if (!persistenceManagerRef) {
    fileLog.warn('[PersistenceUtils] No persistence manager available for global configuration')
    return
  }

  try {
    // Collect all entities from all loaded schemas
    const { universeSchema$ } = await import('./index')
    const schema = universeSchema$.peek()

    if (!schema || !schema.entities) {
      fileLog.info('[PersistenceUtils] No schema entities found, skipping persistence configuration')
      return
    }

    // Collect all entity names from all organizations
    const allEntityNames: string[] = []
    Object.keys(schema.entities).forEach(entityKey => {
      allEntityNames.push(entityKey)
    })

    // Also include schema table names for each organization
    const { universeContext$ } = await import('./observables')
    const universeContext = universeContext$.peek()
    const orgIds = Object.keys(universeContext?.organizations || {})
    const schemaTableNames = orgIds.map(orgId => `schema_${orgId}`)

    const allTableNames = [...allEntityNames, ...schemaTableNames]

    if (allEntityNames.length === 0) {
      fileLog.info('[PersistenceUtils] No entities found across all schemas, skipping persistence configuration')
      return
    }

    fileLog.info(`[PersistenceUtils] Setting up global persistence configuration for ${allEntityNames.length} entities + ${schemaTableNames.length} schema tables (${allTableNames.length} total)`)

    // Set up persistence with all entities and schema tables at once
    const persistenceConfiguration = await persistenceManagerRef.createIndexedDBConfig(allTableNames)

    if (!persistenceConfiguration) {
      fileLog.warn('[PersistenceUtils] Failed to create global persistence configuration - persistence manager returned null')
      return
    }

    fileLog.info(`[PersistenceUtils] ✅ Global persistence configuration complete`, {
      entityCount: allEntityNames.length,
      schemaTableCount: schemaTableNames.length,
      totalTableCount: allTableNames.length,
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

    // Mark global setup as complete
    globalPersistenceSetupComplete = true

  } catch (error) {
    fileLog.error('[PersistenceUtils] Failed to setup global persistence configuration:', error)
    throw error
  }
}

/**
 * Set up full persistence configuration when entities exist (legacy - individual org)
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