/**
 * LiveStore Global Client - Pre-bundled initialization
 * 
 * This provides a global LiveStore client that's properly bundled by Vite
 * and can be used throughout the application.
 */

import { liveStoreSchemaClient } from './livestore-schema-client';

// Global LiveStore instance
let globalLiveStoreInstance: any = null;
let initializationPromise: Promise<any> | null = null;

/**
 * Initialize LiveStore globally with proper bundling
 */
export async function initializeGlobalLiveStore(
  organizationId: string, 
  clientId: string
): Promise<any> {
  // Return existing initialization if in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return existing instance if available
  if (globalLiveStoreInstance) {
    return globalLiveStoreInstance;
  }

  console.log('🚀 Initializing global LiveStore client...');

  // Create initialization promise
  initializationPromise = (async () => {
    try {
      console.log('📋 Loading LiveStore schema for org:', organizationId);
      
      // Load schema first
      const schemaResult = await liveStoreSchemaClient.loadLiveStoreSchema(organizationId);
      console.log('📋 Schema result:', schemaResult);

      if (!schemaResult.success) {
        throw new Error(`Schema loading failed: ${schemaResult.error}`);
      }

      console.log('🔧 Creating LiveStore instance...');
      
      // Create LiveStore instance
      const liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(organizationId, clientId);
      
      if (!liveStoreInstance) {
        throw new Error('LiveStore instance creation returned null');
      }

      console.log('✅ LiveStore instance created successfully');
      
      // Wait for it to be ready
      await liveStoreInstance.ready();
      console.log('✅ LiveStore instance ready');

      // Test basic functionality
      const tables = await liveStoreInstance.query(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log('📊 LiveStore tables found:', tables.length);

      // Store globally
      globalLiveStoreInstance = liveStoreInstance;

      // Make available on window for debugging and sync system
      if (typeof window !== 'undefined') {
        window.LiveStore = liveStoreInstance;
        window.dispatchEvent(new CustomEvent('livestore:ready', {
          detail: { 
            client: liveStoreInstance,
            organizationId 
          }
        }));
      }

      console.log('🎉 Global LiveStore client initialized successfully!');
      return liveStoreInstance;

    } catch (error) {
      console.error('❌ Failed to initialize global LiveStore client:', error);
      
      // Reset state on failure
      globalLiveStoreInstance = null;
      initializationPromise = null;
      
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Get the global LiveStore client
 */
export function getGlobalLiveStore(): any {
  return globalLiveStoreInstance;
}

/**
 * Check if LiveStore is available
 */
export function isLiveStoreAvailable(): boolean {
  return !!globalLiveStoreInstance;
}

/**
 * Reset global LiveStore state (for testing/cleanup)
 */
export function resetGlobalLiveStore(): void {
  globalLiveStoreInstance = null;
  initializationPromise = null;
  
  if (typeof window !== 'undefined' && window.LiveStore) {
    delete window.LiveStore;
  }
}

// Export the schema client for direct access if needed
export { liveStoreSchemaClient };