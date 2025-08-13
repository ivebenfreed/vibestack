/**
 * LiveStore Proof of Concept
 * Simple demonstration of LiveStore loading and basic functionality
 */

import React from 'react';
import { AccessControlClient } from '@vibestack/livestore/client/AccessControlClient';
import { OrganizationDataSynchronizer } from '@vibestack/livestore/sync/OrganizationDataSynchronizer';
import { RealTimePermissionUpdater } from '@vibestack/livestore/permissions/RealTimePermissionUpdater';

// Simple POC configuration
interface LiveStorePOCConfig {
  apiUrl: string;
  wsUrl: string;
  userId: string;
  organizationId: string;
  authToken: string;
}

// POC state
interface LiveStorePOCState {
  isLoaded: boolean;
  isConnected: boolean;
  userContext: any;
  lastSync: Date | null;
  permissions: string[];
  error: string | null;
}

class LiveStorePOC {
  private client: AccessControlClient | null = null;
  private synchronizer: OrganizationDataSynchronizer | null = null;
  private permissionUpdater: RealTimePermissionUpdater | null = null;
  private state: LiveStorePOCState = {
    isLoaded: false,
    isConnected: false,
    userContext: null,
    lastSync: null,
    permissions: [],
    error: null
  };

  /**
   * Initialize LiveStore POC
   */
  async initialize(config: LiveStorePOCConfig): Promise<void> {
    console.log('🚀 Initializing LiveStore POC...');
    
    try {
      // 1. Initialize Access Control Client
      await this.initializeAccessControl(config);
      
      // 2. Initialize Data Synchronizer
      await this.initializeDataSync(config);
      
      // 3. Initialize Permission System
      await this.initializePermissions(config);
      
      // 4. Update state
      this.state.isLoaded = true;
      this.state.error = null;
      
      console.log('✅ LiveStore POC initialized successfully');
      this.emitStateChange();
      
    } catch (error) {
      console.error('❌ LiveStore POC initialization failed:', error);
      this.state.error = String(error);
      this.emitStateChange();
      throw error;
    }
  }

  /**
   * Initialize Access Control Client
   */
  private async initializeAccessControl(config: LiveStorePOCConfig): Promise<void> {
    console.log('🔐 Initializing Access Control...');
    
    this.client = new AccessControlClient({
      apiBaseUrl: config.apiUrl,
      websocketUrl: config.wsUrl,
      organizationId: config.organizationId,
      userId: config.userId,
      authToken: config.authToken,
      enableRealTimePermissions: true,
      enableOfflineMode: true,
      cacheTTLMs: 5 * 60 * 1000,
      reconnectAttempts: 3,
      reconnectDelayMs: 1000
    });

    // Set up event listeners
    this.client.addEventListener('permission_change', (event) => {
      console.log('🔐 Permission changed:', event);
      this.updatePermissions();
    });

    this.client.addEventListener('context_update', (event) => {
      console.log('📝 Context updated:', event);
      this.updateUserContext();
    });

    // Initialize client (this will try to connect but may fail in POC)
    try {
      await this.client.initialize();
      this.state.isConnected = true;
    } catch (error) {
      console.warn('⚠️ Client connection failed (expected in POC):', error);
      this.state.isConnected = false;
    }

    // Update state with user context
    this.state.userContext = this.client.getUserContext();
    
    console.log('✅ Access Control initialized');
  }

  /**
   * Initialize Data Synchronizer
   */
  private async initializeDataSync(config: LiveStorePOCConfig): Promise<void> {
    console.log('🔄 Initializing Data Synchronizer...');
    
    this.synchronizer = new OrganizationDataSynchronizer();
    
    // Initialize organization sync
    await this.synchronizer.initializeOrganizationSync(config.organizationId);
    
    // Create a sample sync operation to show it works
    await this.createSampleSyncOperation(config);
    
    this.state.lastSync = new Date();
    
    console.log('✅ Data Synchronizer initialized');
  }

  /**
   * Initialize Permission System
   */
  private async initializePermissions(config: LiveStorePOCConfig): Promise<void> {
    console.log('🔐 Initializing Permission System...');
    
    this.permissionUpdater = new RealTimePermissionUpdater();
    
    // Create a sample permission update
    await this.createSamplePermissionUpdate(config);
    
    // Update permissions in state
    await this.updatePermissions();
    
    console.log('✅ Permission System initialized');
  }

  /**
   * Create sample sync operation
   */
  private async createSampleSyncOperation(config: LiveStorePOCConfig): Promise<void> {
    if (!this.synchronizer) return;

    try {
      const operation = await this.synchronizer.createSyncOperation(
        'create',
        'project',
        'sample-project-001',
        config.organizationId,
        config.userId,
        {
          name: 'Sample Project',
          description: 'This is a sample project created by LiveStore POC',
          status: 'active',
          createdAt: new Date()
        },
        {
          source: 'poc',
          priority: 'normal'
        }
      );

      console.log('📋 Created sample sync operation:', operation.id);
    } catch (error) {
      console.warn('⚠️ Sample sync operation failed (expected in POC):', error);
    }
  }

  /**
   * Create sample permission update
   */
  private async createSamplePermissionUpdate(config: LiveStorePOCConfig): Promise<void> {
    if (!this.permissionUpdater) return;

    try {
      const update = await this.permissionUpdater.createPermissionUpdate(
        'permission_grant',
        config.organizationId,
        {
          userId: config.userId,
          permissions: ['project.read', 'project.write', 'task.read', 'task.write']
        },
        {
          source: 'poc',
          priority: 'normal'
        },
        'system',
        'POC permission setup'
      );

      console.log('🔐 Created sample permission update:', update.id);
    } catch (error) {
      console.warn('⚠️ Sample permission update failed (expected in POC):', error);
    }
  }

  /**
   * Update permissions in state
   */
  private async updatePermissions(): Promise<void> {
    if (!this.client) return;

    const commonPermissions = [
      { resource: 'project', action: 'read' },
      { resource: 'project', action: 'write' },
      { resource: 'task', action: 'read' },
      { resource: 'task', action: 'write' },
      { resource: 'file', action: 'read' },
      { resource: 'discussion', action: 'read' }
    ];

    try {
      const results = await this.client.hasPermissions(commonPermissions);
      this.state.permissions = Object.entries(results)
        .filter(([_, granted]) => granted)
        .map(([permission, _]) => permission);
    } catch (error) {
      console.warn('⚠️ Permission check failed (expected in POC):', error);
      this.state.permissions = commonPermissions.map(p => `${p.resource}.${p.action}`);
    }
  }

  /**
   * Update user context
   */
  private updateUserContext(): void {
    if (this.client) {
      this.state.userContext = this.client.getUserContext();
      this.emitStateChange();
    }
  }

  /**
   * Get current state
   */
  getState(): LiveStorePOCState {
    return { ...this.state };
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return this.synchronizer?.getSyncStatus(this.state.userContext?.organizationId || 'default-org') || {
      isOnline: false,
      lastSyncTime: this.state.lastSync,
      pendingOperations: 0,
      conflicts: 0,
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageSyncTime: 0
      }
    };
  }

  /**
   * Test permission checking
   */
  async testPermissions(): Promise<Record<string, boolean>> {
    if (!this.client) {
      return { 'project.read': true, 'task.write': true }; // Mock permissions
    }

    return await this.client.hasPermissions([
      { resource: 'project', action: 'read' },
      { resource: 'project', action: 'write' },
      { resource: 'task', action: 'read' },
      { resource: 'task', action: 'write' }
    ]);
  }

  /**
   * Create a test entity
   */
  async createTestEntity(type: string, data: any): Promise<string> {
    if (!this.synchronizer || !this.state.userContext) {
      throw new Error('LiveStore not properly initialized');
    }

    const operation = await this.synchronizer.createSyncOperation(
      'create',
      type as any,
      `test-${type}-${Date.now()}`,
      this.state.userContext.organizationId,
      this.state.userContext.userId,
      data,
      { source: 'poc_test', priority: 'normal' }
    );

    return operation.id;
  }

  /**
   * Emit state change event
   */
  private emitStateChange(): void {
    window.dispatchEvent(new CustomEvent('livestore:poc:state-changed', {
      detail: this.getState()
    }));
  }

  /**
   * Cleanup POC
   */
  cleanup(): void {
    if (this.client) {
      this.client.disconnect();
    }
    
    this.state = {
      isLoaded: false,
      isConnected: false,
      userContext: null,
      lastSync: null,
      permissions: [],
      error: null
    };

    console.log('🧹 LiveStore POC cleaned up');
  }
}

// Global POC instance
const liveStorePOC = new LiveStorePOC();

/**
 * Initialize LiveStore POC with default config
 */
export async function initializeLiveStorePOC(): Promise<void> {
  const config: LiveStorePOCConfig = {
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8787',
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8787/ws',
    userId: 'poc-user-001',
    organizationId: 'poc-org-001',
    authToken: 'poc-auth-token-123'
  };

  await liveStorePOC.initialize(config);
}

/**
 * Get POC state
 */
export function getLiveStorePOCState(): LiveStorePOCState {
  return liveStorePOC.getState();
}

/**
 * Get sync status
 */
export function getLiveStoreSyncStatus() {
  return liveStorePOC.getSyncStatus();
}

/**
 * Test permissions
 */
export async function testLiveStorePermissions(): Promise<Record<string, boolean>> {
  return await liveStorePOC.testPermissions();
}

/**
 * Create test entity
 */
export async function createTestEntity(type: string, data: any): Promise<string> {
  return await liveStorePOC.createTestEntity(type, data);
}

/**
 * Cleanup POC
 */
export function cleanupLiveStorePOC(): void {
  liveStorePOC.cleanup();
}

/**
 * React hook for LiveStore POC
 */
export function useLiveStorePOC() {
  const [state, setState] = React.useState<LiveStorePOCState>(liveStorePOC.getState());

  React.useEffect(() => {
    const handleStateChange = (event: CustomEvent) => {
      setState(event.detail);
    };

    window.addEventListener('livestore:poc:state-changed', handleStateChange as EventListener);

    return () => {
      window.removeEventListener('livestore:poc:state-changed', handleStateChange as EventListener);
    };
  }, []);

  const initialize = React.useCallback(async () => {
    await initializeLiveStorePOC();
  }, []);

  const testPermissions = React.useCallback(async () => {
    return await testLiveStorePermissions();
  }, []);

  const createEntity = React.useCallback(async (type: string, data: any) => {
    return await createTestEntity(type, data);
  }, []);

  return {
    state,
    syncStatus: getLiveStoreSyncStatus(),
    initialize,
    testPermissions,
    createEntity,
    cleanup: cleanupLiveStorePOC
  };
}

// Auto-initialize POC in development mode
if (import.meta.env.MODE === 'development' && typeof window !== 'undefined') {
  console.log('🔄 Auto-initializing LiveStore POC in development mode...');
  
  // Wait a bit for the app to load, then initialize
  setTimeout(() => {
    initializeLiveStorePOC().catch(error => {
      console.error('Failed to auto-initialize LiveStore POC:', error);
    });
  }, 2000);
}

export default liveStorePOC;
export type { LiveStorePOCConfig, LiveStorePOCState };