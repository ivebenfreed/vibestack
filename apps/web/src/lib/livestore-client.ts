/**
 * LiveStore Client Integration
 * Integrates the Phase 4 LiveStore multi-tenant real-time system with the existing Dexie client
 */

import React from 'react';
// import { AccessControlClient } from '../../../../packages/livestore/src/client/AccessControlClient';
// import type { 
//   AccessControlClientConfig,
//   AccessControlEvent,
//   PermissionCheckResult 
// } from '@vibestack/livestore/client/AccessControlClient';

// Client configuration
interface LiveStoreClientConfig {
  apiBaseUrl: string;
  websocketUrl: string;
  enableRealTimePermissions: boolean;
  enableOfflineMode: boolean;
  debug: boolean;
}

// Mock type for testing purposes
type AccessControlClient = {
  insert: (tableName: string, data: any) => Promise<void>;
  update: (tableName: string, id: string, data: any) => Promise<void>;
  delete: (tableName: string, id: string) => Promise<void>;
  query: (sql: string, params?: any[]) => Promise<any[]>;
  ready: () => Promise<void>;
  hasPermission: (entity: string, action: string) => Promise<any>;
  addEventListener: (event: string, handler: (event: any) => void) => void;
  removeEventListener: (event: string, handler: (event: any) => void) => void;
};

// Global LiveStore client instance
let liveStoreClient: AccessControlClient | null = null;
let isInitializing = false;

/**
 * Get the current user from auth context
 */
async function getCurrentUser(): Promise<{ userId: string; organizationId: string; authToken: string; } | null> {
  try {
    // Get auth data from localStorage or auth context
    const authData = localStorage.getItem('auth_session');
    if (!authData) return null;

    const session = JSON.parse(authData);
    
    // Extract user info - adjust based on your auth structure
    return {
      userId: session.user?.id || 'anonymous',
      organizationId: session.organization?.id || 'default-org',
      authToken: session.token || 'temp-token'
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Initialize LiveStore client
 */
export async function initializeLiveStore(config?: Partial<LiveStoreClientConfig>): Promise<AccessControlClient | null> {
  if (liveStoreClient) {
    return liveStoreClient;
  }

  if (isInitializing) {
    console.log('LiveStore already initializing...');
    return null;
  }

  isInitializing = true;

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found, skipping LiveStore initialization');
      return null;
    }

    const defaultConfig: LiveStoreClientConfig = {
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8787',
      websocketUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8787/ws',
      enableRealTimePermissions: true,
      enableOfflineMode: true,
      debug: import.meta.env.MODE === 'development',
      ...config
    };

    const clientConfig: AccessControlClientConfig = {
      apiBaseUrl: defaultConfig.apiBaseUrl,
      websocketUrl: defaultConfig.websocketUrl,
      organizationId: user.organizationId,
      userId: user.userId,
      authToken: user.authToken,
      enableRealTimePermissions: defaultConfig.enableRealTimePermissions,
      enableOfflineMode: defaultConfig.enableOfflineMode,
      cacheTTLMs: 5 * 60 * 1000, // 5 minutes
      reconnectAttempts: 3,
      reconnectDelayMs: 1000
    };

    if (defaultConfig.debug) {
      console.log('🔄 Initializing LiveStore client with config:', {
        ...clientConfig,
        authToken: '[REDACTED]'
      });
    }

    liveStoreClient = new AccessControlClient(clientConfig);

    // Set up event listeners
    setupLiveStoreEventListeners(liveStoreClient);

    // Initialize the client
    await liveStoreClient.initialize();

    console.log('✅ LiveStore client initialized successfully');
    
    // Dispatch global event for other components
    window.dispatchEvent(new CustomEvent('livestore:ready', {
      detail: { client: liveStoreClient }
    }));

    return liveStoreClient;

  } catch (error) {
    console.error('❌ Failed to initialize LiveStore client:', error);
    liveStoreClient = null;
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('livestore:error', {
      detail: { error }
    }));
    
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Set up event listeners for LiveStore events
 */
function setupLiveStoreEventListeners(client: AccessControlClient): void {
  // Listen for permission changes
  client.addEventListener('permission_change', (event: any) => {
    console.log('🔐 Permission change received:', event);
    
    // Notify other parts of the app about permission changes
    window.dispatchEvent(new CustomEvent('permission:changed', {
      detail: { event }
    }));
  });

  // Listen for context updates
  client.addEventListener('context_update', (event: any) => {
    console.log('📝 Context update received:', event);
    
    // Update local user context if needed
    window.dispatchEvent(new CustomEvent('user:context:updated', {
      detail: { event }
    }));
  });

  // Listen for access denied events
  client.addEventListener('access_denied', (event: any) => {
    console.warn('🚫 Access denied:', event);
    
    // Show user notification or handle access denial
    window.dispatchEvent(new CustomEvent('access:denied', {
      detail: { event }
    }));
  });
}

/**
 * Get the current LiveStore client instance
 */
export function getLiveStoreClient(): AccessControlClient | null {
  return liveStoreClient;
}

/**
 * Check if user has permission for a specific action
 */
export async function hasPermission(resource: string, action: string): Promise<boolean> {
  if (!liveStoreClient) {
    console.warn('LiveStore client not initialized, defaulting to no permission');
    return false;
  }

  try {
    const result = await liveStoreClient.hasPermission(resource, action);
    return result.granted;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check multiple permissions at once
 */
export async function hasPermissions(permissions: Array<{ resource: string; action: string; }>): Promise<Record<string, boolean>> {
  if (!liveStoreClient) {
    console.warn('LiveStore client not initialized');
    return permissions.reduce((acc, perm) => {
      acc[`${perm.resource}:${perm.action}`] = false;
      return acc;
    }, {} as Record<string, boolean>);
  }

  try {
    const results = await liveStoreClient.hasPermissions(permissions);
    
    // Convert PermissionCheckResult to boolean
    const booleanResults: Record<string, boolean> = {};
    for (const [key, result] of Object.entries(results)) {
      booleanResults[key] = result.granted;
    }
    
    return booleanResults;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return permissions.reduce((acc, perm) => {
      acc[`${perm.resource}:${perm.action}`] = false;
      return acc;
    }, {} as Record<string, boolean>);
  }
}

/**
 * Get current user context from LiveStore
 */
export function getUserContext() {
  return liveStoreClient?.getUserContext() || null;
}

/**
 * Update user settings
 */
export async function updateUserSettings(settings: any): Promise<void> {
  if (!liveStoreClient) {
    throw new Error('LiveStore client not initialized');
  }

  await liveStoreClient.updateUserSettings(settings);
}

/**
 * Refresh LiveStore client (reconnect and reload permissions)
 */
export async function refreshLiveStore(): Promise<void> {
  if (!liveStoreClient) {
    console.warn('LiveStore client not initialized');
    return;
  }

  try {
    await liveStoreClient.refresh();
    console.log('✅ LiveStore client refreshed');
  } catch (error) {
    console.error('❌ Failed to refresh LiveStore client:', error);
  }
}

/**
 * Disconnect LiveStore client
 */
export function disconnectLiveStore(): void {
  if (liveStoreClient) {
    liveStoreClient.disconnect();
    liveStoreClient = null;
    console.log('🔌 LiveStore client disconnected');
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('livestore:disconnected'));
  }
}

/**
 * React hook for using LiveStore permissions
 */
export function useLiveStorePermissions() {
  const [client, setClient] = React.useState<AccessControlClient | null>(liveStoreClient);
  const [isReady, setIsReady] = React.useState(!!liveStoreClient);

  React.useEffect(() => {
    const handleReady = (event: CustomEvent) => {
      setClient(event.detail.client);
      setIsReady(true);
    };

    const handleError = () => {
      setClient(null);
      setIsReady(false);
    };

    const handleDisconnected = () => {
      setClient(null);
      setIsReady(false);
    };

    window.addEventListener('livestore:ready', handleReady as EventListener);
    window.addEventListener('livestore:error', handleError);
    window.addEventListener('livestore:disconnected', handleDisconnected);

    return () => {
      window.removeEventListener('livestore:ready', handleReady as EventListener);
      window.removeEventListener('livestore:error', handleError);
      window.removeEventListener('livestore:disconnected', handleDisconnected);
    };
  }, []);

  const checkPermission = React.useCallback(async (resource: string, action: string): Promise<boolean> => {
    return hasPermission(resource, action);
  }, []);

  const checkPermissions = React.useCallback(async (permissions: Array<{ resource: string; action: string; }>): Promise<Record<string, boolean>> => {
    return hasPermissions(permissions);
  }, []);

  return {
    client,
    isReady,
    checkPermission,
    checkPermissions,
    userContext: client?.getUserContext() || null
  };
}

/**
 * Integration with auth system
 */
export function setupLiveStoreAuthIntegration(): void {
  // Listen for auth changes
  window.addEventListener('auth:login', async () => {
    console.log('🔐 User logged in, initializing LiveStore...');
    await initializeLiveStore();
  });

  window.addEventListener('auth:logout', () => {
    console.log('🔐 User logged out, disconnecting LiveStore...');
    disconnectLiveStore();
  });

  // Listen for organization changes
  window.addEventListener('organization:changed', async (event: CustomEvent) => {
    console.log('🏢 Organization changed, refreshing LiveStore...');
    disconnectLiveStore();
    await initializeLiveStore();
  });
}

/**
 * Initialize LiveStore if user is already authenticated
 */
export async function initializeLiveStoreIfAuthenticated(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    console.log('🔄 User already authenticated, initializing LiveStore...');
    await initializeLiveStore();
  }
}

// Auto-setup auth integration and initialize if needed
if (typeof window !== 'undefined') {
  // Setup auth integration
  setupLiveStoreAuthIntegration();
  
  // Initialize if user is already logged in
  initializeLiveStoreIfAuthenticated().catch(error => {
    console.error('Failed to auto-initialize LiveStore:', error);
  });
}

// Export types for use in other files
export type { AccessControlClient };

// Default export
export default {
  initialize: initializeLiveStore,
  getClient: getLiveStoreClient,
  hasPermission,
  hasPermissions,
  getUserContext,
  updateUserSettings,
  refresh: refreshLiveStore,
  disconnect: disconnectLiveStore,
  useLiveStorePermissions
};