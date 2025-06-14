/**
 * Global DataSource Singleton Manager
 * 
 * This module provides a global singleton for the NewPGliteDataSource that can be safely
 * accessed from anywhere in the application - atoms, route loaders, React components, etc.
 * 
 * Key features:
 * - Thread-safe concurrent initialization
 * - Single datasource instance across the entire app
 * - Proper error handling and cleanup
 * - Integration with existing PGliteProvider pattern
 */

import { NewPGliteDataSource, createNewPGliteDataSource, NewPGliteDataSourceOptions } from './newtypeorm/NewDataSource';
import { clientEntities } from '@repo/dataforge/client-entities';
import { DB_NAME } from './db';

// Global state
let globalDataSource: NewPGliteDataSource | null = null;
let initializationPromise: Promise<NewPGliteDataSource> | null = null;
let isDestroyed = false;

/**
 * Get or create the global datasource instance
 * Safe for concurrent calls - all concurrent requests will wait for the same initialization
 */
export async function getGlobalDataSource(config?: NewPGliteDataSourceOptions): Promise<NewPGliteDataSource> {
  // If already initialized and ready, return immediately
  if (globalDataSource && globalDataSource.isInitialized && !isDestroyed) {
    return globalDataSource;
  }

  // If currently initializing, wait for that promise
  if (initializationPromise) {
    console.log('[GlobalDataSource] Waiting for existing initialization to complete...');
    return initializationPromise;
  }

  // Clean up any uninitialized datasource
  if (globalDataSource && !globalDataSource.isInitialized) {
    await globalDataSource.destroy().catch(err => 
      console.error('[GlobalDataSource] Error destroying previous uninitialized instance:', err)
    );
    globalDataSource = null;
  }

  // Start new initialization and track the promise
  console.log('[GlobalDataSource] Starting new initialization...');
  initializationPromise = initializeGlobalDataSource(config);

  try {
    const dataSource = await initializationPromise;
    return dataSource;
  } finally {
    // Clear the initialization promise once done (success or failure)
    initializationPromise = null;
  }
}

/**
 * Internal initialization function
 */
async function initializeGlobalDataSource(config?: NewPGliteDataSourceOptions): Promise<NewPGliteDataSource> {
  try {
    console.log('[GlobalDataSource] Creating new datasource instance...');
    
    // Merge provided config with defaults
    const effectiveConfig: NewPGliteDataSourceOptions = {
      database: DB_NAME,
      entities: clientEntities,
      synchronize: false,
      logging: true,
      ...config, // Allow overrides
    };
    
    const dataSource = createNewPGliteDataSource(effectiveConfig);
    
    console.log('[GlobalDataSource] Initializing datasource...');
    await dataSource.initialize();
    console.log('[GlobalDataSource] ✅ Datasource initialized successfully');
    
    globalDataSource = dataSource;
    isDestroyed = false;
    
    return dataSource;
    
  } catch (error) {
    console.error('[GlobalDataSource] ❌ Failed to initialize datasource:', error);
    
    // Clean up on failure
    if (globalDataSource) {
      await globalDataSource.destroy().catch(err => 
        console.error('[GlobalDataSource] Error during cleanup:', err)
      );
      globalDataSource = null;
    }
    
    throw error;
  }
}

/**
 * Check if the global datasource is ready (synchronous check)
 */
export function isGlobalDataSourceReady(): boolean {
  return !!(globalDataSource && globalDataSource.isInitialized && !isDestroyed);
}

/**
 * Get the global datasource if it's ready, otherwise return null (no waiting)
 */
export function getGlobalDataSourceSync(): NewPGliteDataSource | null {
  if (isGlobalDataSourceReady()) {
    return globalDataSource;
  }
  return null;
}

/**
 * Wait for the global datasource to be ready with timeout
 */
export async function waitForGlobalDataSource(timeoutMs: number = 30000): Promise<NewPGliteDataSource> {
  if (isGlobalDataSourceReady()) {
    return globalDataSource!;
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      if (isGlobalDataSourceReady()) {
        clearInterval(checkInterval);
        resolve(globalDataSource!);
        return;
      }
      
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error(`[GlobalDataSource] Timeout waiting for datasource after ${timeoutMs}ms`));
        return;
      }
    }, 100);
  });
}

/**
 * Destroy the global datasource (for cleanup, testing, HMR)
 */
export async function destroyGlobalDataSource(): Promise<void> {
  console.log('[GlobalDataSource] Destroying global datasource...');
  
  isDestroyed = true;
  
  // Wait for any ongoing initialization to complete
  if (initializationPromise) {
    try {
      await initializationPromise;
    } catch {
      // Ignore errors during destruction
    }
  }
  
  if (globalDataSource) {
    try {
      await globalDataSource.destroy();
    } catch (error) {
      console.error('[GlobalDataSource] Error during destruction:', error);
    }
    globalDataSource = null;
  }
  
  initializationPromise = null;
  console.log('[GlobalDataSource] ✅ Global datasource destroyed');
}

/**
 * HMR support - reset the global state
 */
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    console.log('[GlobalDataSource] HMR cleanup...');
    await destroyGlobalDataSource();
  });
} 