/**
 * Legend State Initialization Manager
 * 
 * Provides robust, singleton-based initialization for Legend State entity observables
 * with persistence setup and data hydration coordination.
 * 
 * Solves the core problems:
 * 1. Multiple persistence initialization race conditions
 * 2. IndexedDB schema version thrashing  
 * 3. Unreliable async observable creation
 * 4. Legend State v3 configuration conflicts
 */

import { observable, when } from '@legendapp/state'
import { configureSynced } from '@legendapp/state/sync'
import { createPersistenceManager, type PersistenceManager } from './PersistenceManager'
import { log } from '@/logger'

const fileLog = log('legend-state/helpers/InitializationManager.ts')

export interface InitializationState {
  status: 'idle' | 'initializing' | 'ready' | 'error'
  progress: {
    persistenceSetup: boolean
    syncConfiguration: boolean
    schemaValidation: boolean
    dataHydration: boolean
  }
  error?: string
  timestamp?: number
  orgId?: string
  userId?: string
  entityCount?: number
}

export interface PersistenceContext {
  persistenceManager: PersistenceManager
  persistOptions: any
  entityTableMap: Record<string, string>
  isConfigured: boolean
}

/**
 * Singleton Initialization Manager for Legend State
 * Ensures one-time, coordinated setup of persistence and observables
 */
class InitializationManager {
  private static instance: InitializationManager
  private persistenceContext: PersistenceContext | null = null
  private initializationPromise: Promise<void> | null = null
  
  // Observable state for reactive components
  public readonly state$ = observable<InitializationState>({
    status: 'idle',
    progress: {
      persistenceSetup: false,
      syncConfiguration: false,
      schemaValidation: false,
      dataHydration: false
    }
  })

  private constructor() {}

  static getInstance(): InitializationManager {
    if (!InitializationManager.instance) {
      InitializationManager.instance = new InitializationManager()
    }
    return InitializationManager.instance
  }

  /**
   * Initialize Legend State with robust error handling and coordination
   * This is idempotent - safe to call multiple times
   */
  async initialize(orgId: string, userId: string, entityKeys: string[]): Promise<PersistenceContext | null> {
    // Return existing context if already initialized for this user (universe mode covers all orgs)
    if (this.persistenceContext?.isConfigured && 
        this.state$.userId.peek() === userId && 
        this.state$.status.peek() === 'ready') {
      fileLog.info(`[InitManager] Already initialized for user ${userId} in universe mode, returning existing context`)
      return this.persistenceContext
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      fileLog.info(`[InitManager] Initialization in progress, waiting...`)
      await this.initializationPromise
      return this.persistenceContext
    }

    // Start new initialization
    this.initializationPromise = this.performInitialization(orgId, userId, entityKeys)
    
    try {
      await this.initializationPromise
      return this.persistenceContext
    } finally {
      this.initializationPromise = null
    }
  }

  private async performInitialization(orgId: string, userId: string, entityKeys: string[]): Promise<void> {
    // Always use universe mode since users can access multiple orgs
    const universalOrgId = 'universe'
    fileLog.info(`[InitManager] Starting universe initialization for user ${userId} with ${entityKeys.length} entities`)
    
    // Update state to initializing
    this.state$.assign({
      status: 'initializing',
      orgId: universalOrgId,
      userId,
      entityCount: entityKeys.length,
      timestamp: Date.now(),
      progress: {
        persistenceSetup: false,
        syncConfiguration: false,
        schemaValidation: false,
        dataHydration: false
      }
    })

    try {
      // Step 1: Persistence Setup
      fileLog.info(`[InitManager] Step 1: Setting up persistence`)
      const persistenceManager = createPersistenceManager(universalOrgId, userId)
      
      // Create IndexedDB configuration with enhanced error recovery
      const indexedDBConfig = await persistenceManager.createIndexedDBConfig(entityKeys)
      
      this.state$.progress.persistenceSetup.set(true)
      fileLog.info(`[InitManager] ✅ Persistence setup complete`)

      // Step 2: Sync Configuration (Legend State v3)
      fileLog.info(`[InitManager] Step 2: Configuring Legend State sync`)
      let persistOptions: any = null
      let entityTableMap: Record<string, string> = {}

      if (indexedDBConfig) {
        const { persistOptions: configuredOptions, entityTableMap: tableMap } = indexedDBConfig
        persistOptions = configuredOptions
        entityTableMap = tableMap
        
        fileLog.info(`[InitManager] ✅ IndexedDB persistence configured with ${Object.keys(tableMap).length} entity mappings`)
      } else {
        fileLog.info(`[InitManager] ⚠️  No IndexedDB persistence - using server-only sync`)
      }
      
      this.state$.progress.syncConfiguration.set(true)
      fileLog.info(`[InitManager] ✅ Sync configuration complete`)

      // Step 3: Schema Validation
      fileLog.info(`[InitManager] Step 3: Validating entity schema`)
      const validEntityKeys = this.validateEntitySchema(entityKeys)
      
      if (validEntityKeys.length !== entityKeys.length) {
        fileLog.warn(`[InitManager] Schema validation filtered ${entityKeys.length - validEntityKeys.length} invalid entities`)
      }
      
      this.state$.progress.schemaValidation.set(true)
      fileLog.info(`[InitManager] ✅ Schema validation complete: ${validEntityKeys.length} valid entities`)

      // Step 4: Create persistence context
      this.persistenceContext = {
        persistenceManager,
        persistOptions,
        entityTableMap,
        isConfigured: true
      }
      
      this.state$.progress.dataHydration.set(true)
      fileLog.info(`[InitManager] ✅ Data hydration setup complete`)

      // Mark as ready
      this.state$.status.set('ready')
      this.state$.timestamp.set(Date.now())
      
      fileLog.info(`[InitManager] 🎉 Universe initialization complete for user ${userId}`)

    } catch (error) {
      fileLog.error(`[InitManager] ❌ Initialization failed:`, error)
      
      this.state$.assign({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown initialization error',
        timestamp: Date.now()
      })
      
      // Clean up on failure
      this.persistenceContext = null
      throw error
    }
  }

  private validateEntitySchema(entityKeys: string[]): string[] {
    // Filter out invalid entity names
    return entityKeys.filter(entityName => {
      // Basic validation - entity name should be non-empty string
      if (!entityName || typeof entityName !== 'string') {
        fileLog.warn(`[InitManager] Invalid entity name: ${entityName}`)
        return false
      }
      
      // Check for special characters that could cause issues
      if (!/^[a-zA-Z0-9_-]+$/.test(entityName.replace(/^[a-f0-9-]{36}_/, ''))) {
        fileLog.warn(`[InitManager] Entity name contains invalid characters: ${entityName}`)
        return false
      }
      
      return true
    })
  }

  /**
   * Get current persistence context (null if not ready)
   */
  getPersistenceContext(): PersistenceContext | null {
    return this.persistenceContext
  }

  /**
   * Wait for initialization to complete
   */
  async waitForReady(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      const checkReady = () => {
        const status = this.state$.status.peek()
        
        if (status === 'ready') {
          resolve(true)
          return
        }
        
        if (status === 'error') {
          resolve(false)
          return
        }
        
        if (Date.now() - startTime > timeoutMs) {
          fileLog.warn(`[InitManager] Timeout waiting for initialization after ${timeoutMs}ms`)
          resolve(false)
          return
        }
        
        // Check again in 100ms
        setTimeout(checkReady, 100)
      }
      
      checkReady()
    })
  }

  /**
   * Reset initialization (for testing or org switching)
   */
  reset(): void {
    fileLog.info(`[InitManager] Resetting initialization state`)
    
    // Clear persistence context
    if (this.persistenceContext?.persistenceManager) {
      try {
        this.persistenceContext.persistenceManager.clearOrganizationData()
      } catch (error) {
        fileLog.warn(`[InitManager] Error clearing persistence data:`, error)
      }
    }
    
    this.persistenceContext = null
    this.initializationPromise = null
    
    // Reset state
    this.state$.assign({
      status: 'idle',
      progress: {
        persistenceSetup: false,
        syncConfiguration: false,
        schemaValidation: false,
        dataHydration: false
      },
      error: undefined,
      timestamp: undefined,
      orgId: undefined,
      userId: undefined,
      entityCount: undefined
    })
  }

  /**
   * Get initialization metrics for debugging
   */
  getMetrics() {
    const state = this.state$.peek()
    const context = this.persistenceContext
    
    return {
      state,
      context: context ? {
        hasPersistenceManager: !!context.persistenceManager,
        hasPersistOptions: !!context.persistOptions,
        entityTableCount: Object.keys(context.entityTableMap).length,
        isConfigured: context.isConfigured
      } : null,
      performance: {
        initializationTime: state.timestamp ? Date.now() - state.timestamp : null,
        isReady: state.status === 'ready',
        hasError: state.status === 'error'
      }
    }
  }
}

// Export singleton instance
export const initializationManager = InitializationManager.getInstance()

/**
 * Reactive hook for components to track initialization state
 */
export function useInitializationState() {
  return initializationManager.state$
}

/**
 * Wait for Legend State to be fully initialized before creating observables
 * This prevents race conditions and ensures proper persistence setup
 * Note: Always initializes in universe mode since users can access multiple orgs
 */
export async function ensureLegendStateReady(orgId: string, userId: string, entityKeys: string[]): Promise<PersistenceContext | null> {
  fileLog.info(`[InitManager] Ensuring Legend State ready for user ${userId} (orgId: ${orgId})`)
  
  try {
    const context = await initializationManager.initialize(orgId, userId, entityKeys)
    const isReady = await initializationManager.waitForReady(10000)
    
    if (!isReady) {
      throw new Error('Legend State initialization timeout')
    }
    
    fileLog.info(`[InitManager] ✅ Legend State is ready`)
    return context
  } catch (error) {
    fileLog.error(`[InitManager] ❌ Failed to ensure Legend State ready:`, error)
    throw error
  }
}