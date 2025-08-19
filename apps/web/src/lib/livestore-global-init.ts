/**
 * Global LiveStore initialization - independent from sync
 * Initialized by app init machine using global instance
 */

import { liveStoreSchemaClient } from '@/lib/livestore-schema-client';

// Track initialization state
let isInitialized = false;
let initializationInProgress = false;

/**
 * Initialize global LiveStore when app init machine requests it
 */
async function initializeGlobalLiveStore(organizationId: string): Promise<void> {
  if (initializationInProgress) {
    console.log('[LiveStore Global Init] Already initializing, skipping');
    return;
  }

  if (isInitialized && (window as any).globalLiveStore) {
    console.log('[LiveStore Global Init] Already initialized, sending ready');
    window.dispatchEvent(new CustomEvent('livestore:ready', {
      detail: { 
        orgId: organizationId,
        instance: (window as any).globalLiveStore
      }
    }));
    return;
  }

  try {
    initializationInProgress = true;
    
    console.log(`[LiveStore Global Init] Initializing global LiveStore for org: ${organizationId}`);
    
    // Generate client ID for this session
    const clientId = `global-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize the ONE global LiveStore instance
    const instance = await liveStoreSchemaClient.initializeLiveStore(
      organizationId,
      clientId
    );
    
    if (instance) {
      console.log('[LiveStore Global Init] ✅ Global LiveStore initialized successfully');
      
      // Set the SINGLE global instance
      (window as any).LiveStore = instance;
      (window as any).globalLiveStore = instance;
      isInitialized = true;
      
      console.log('[LiveStore Global Init] ✅ Global LiveStore exposed on window');
      
      // Notify app init machine that LiveStore is ready
      window.dispatchEvent(new CustomEvent('livestore:ready', {
        detail: { 
          orgId: organizationId,
          clientId,
          instance
        }
      }));
    } else {
      throw new Error('Failed to create global LiveStore instance');
    }
    
  } catch (error) {
    console.error('[LiveStore Global Init] ❌ Global LiveStore initialization failed:', error);
    
    // Notify app init machine of error
    window.dispatchEvent(new CustomEvent('livestore:error', {
      detail: { 
        error: error instanceof Error ? error.message : 'Global LiveStore init failed',
        orgId: organizationId
      }
    }));
  } finally {
    initializationInProgress = false;
  }
}

/**
 * Handle database:check events from app init machine
 */
function handleDatabaseCheck(event: CustomEvent) {
  console.log('[LiveStore Global Init] Received database:check from app init machine');
  
  // Get current organization from auth machine
  const authActor = (window as any).authMachineActor;
  if (!authActor) {
    console.log('[LiveStore Global Init] No auth actor - sending database:ready without LiveStore');
    window.dispatchEvent(new CustomEvent('database:ready'));
    return;
  }
  
  const authSnapshot = authActor.getSnapshot();
  const currentOrganization = authSnapshot.context.currentOrganization;
  
  if (!currentOrganization?.id) {
    console.log('[LiveStore Global Init] No organization - sending database:ready without LiveStore');
    window.dispatchEvent(new CustomEvent('database:ready'));
    return;
  }
  
  // Initialize LiveStore for the organization
  initializeGlobalLiveStore(currentOrganization.id);
}

/**
 * Set up global event listeners
 */
function setupGlobalListeners() {
  console.log('[LiveStore Global Init] Setting up global event listeners');
  
  // Listen for database check events from app init machine
  window.addEventListener('database:check', handleDatabaseCheck as EventListener);
  
  // Listen for organization changes to reset state
  const handleOrgChange = (event: CustomEvent) => {
    console.log('[LiveStore Global Init] Organization changed, resetting state');
    isInitialized = false;
    initializationInProgress = false;
    
    // Clear global instances
    (window as any).LiveStore = null;
    (window as any).globalLiveStore = null;
  };
  
  window.addEventListener('auth:organization-changed', handleOrgChange as EventListener);
}

// Initialize when module loads
setupGlobalListeners();

export { initializeGlobalLiveStore };