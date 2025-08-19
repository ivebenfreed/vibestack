/**
 * LiveStore-Enhanced ServiceCoordinator - Phase 3 Implementation
 * 
 * Extends existing ServiceCoordinator to orchestrate LiveStore + existing sync services.
 * Preserves all existing sync logic while adding LiveStore native capabilities.
 */

import { ServiceCoordinator, type Services, type ServiceCoordinatorConfig } from './ServiceCoordinator';
import { liveStoreSchemaClient, type LiveStoreInstance } from '../../lib/livestore-schema-client';
import { createLiveStoreNativeSync, type LiveStoreNativeSync } from '../../lib/livestore-native-sync';
import type { OrgEntitySchema } from '../../lib/schema-client';
import { syncLogger } from './SyncLogger';

export interface LiveStoreServices extends Services {
  liveStore?: LiveStoreInstance;
  liveStoreSync?: LiveStoreNativeSync;
}

export interface LiveStoreServiceCoordinatorConfig extends ServiceCoordinatorConfig {
  organizationId: string; // Required for LiveStore
  userId: string; // Required for LiveStore sync
  orgSchema: OrgEntitySchema; // Required for LiveStore generation
  enableLiveStore?: boolean; // Toggle LiveStore integration
}

/**
 * Enhanced ServiceCoordinator with LiveStore integration
 * 
 * Integrates LiveStore with existing sync services while preserving all existing functionality.
 */
export class LiveStoreServiceCoordinator extends ServiceCoordinator {
  private liveStoreInstance: LiveStoreInstance | null = null;
  private liveStoreSync: LiveStoreNativeSync | null = null;
  private liveStoreConfig: LiveStoreServiceCoordinatorConfig | null = null;

  constructor() {
    super();
    syncLogger.info('service', 'LiveStoreServiceCoordinator created for enhanced sync');
  }

  /**
   * Initialize services with LiveStore integration
   */
  async initialize(config: LiveStoreServiceCoordinatorConfig): Promise<LiveStoreServices> {
    this.liveStoreConfig = config;
    
    syncLogger.info('service', 'Initializing enhanced services with LiveStore integration', {
      clientId: config.clientId,
      organizationId: config.organizationId,
      enableLiveStore: config.enableLiveStore,
      serverUrl: config.serverUrl
    });

    try {
      // Initialize base services first (existing sync infrastructure)
      const baseServices = await super.initialize(config);
      
      syncLogger.info('service', 'Base services initialized successfully');

      // Initialize LiveStore if enabled
      if (config.enableLiveStore) {
        await this.initializeLiveStore(config);
        await this.initializeLiveStoreSync(config, baseServices);
      } else {
        syncLogger.info('service', 'LiveStore disabled - using base services only');
      }

      const enhancedServices: LiveStoreServices = {
        ...baseServices,
        liveStore: this.liveStoreInstance,
        liveStoreSync: this.liveStoreSync
      };

      syncLogger.serviceInitialized('LiveStoreServiceCoordinator', {
        ...this.getHealthStatus(),
        liveStore: !!this.liveStoreInstance,
        liveStoreSync: !!this.liveStoreSync,
        enhanced: true
      });

      return enhancedServices;

    } catch (error) {
      syncLogger.serviceError('LiveStoreServiceCoordinator', error as Error, 'initialization');
      throw error;
    }
  }

  /**
   * Initialize LiveStore instance for organization
   */
  private async initializeLiveStore(config: LiveStoreServiceCoordinatorConfig): Promise<void> {
    try {
      syncLogger.info('service', 'Initializing LiveStore instance', {
        organizationId: config.organizationId,
        clientId: config.clientId
      });

      this.liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(
        config.organizationId,
        config.clientId
      );

      if (!this.liveStoreInstance) {
        throw new Error('Failed to initialize LiveStore instance');
      }

      await this.liveStoreInstance.ready();
      
      syncLogger.info('service', 'LiveStore instance ready', {
        organizationId: config.organizationId
      });

    } catch (error) {
      syncLogger.serviceError('LiveStore', error as Error, 'initialization');
      throw error;
    }
  }

  /**
   * Initialize LiveStore sync integration with existing services
   */
  private async initializeLiveStoreSync(
    config: LiveStoreServiceCoordinatorConfig,
    baseServices: Services
  ): Promise<void> {
    if (!this.liveStoreInstance) {
      throw new Error('LiveStore instance required for sync initialization');
    }

    try {
      syncLogger.info('service', 'Initializing LiveStore sync integration', {
        organizationId: config.organizationId,
        hasOutgoing: !!baseServices.dexieOutgoing,
        hasIncoming: !!baseServices.incoming
      });

      this.liveStoreSync = await createLiveStoreNativeSync({
        organizationId: config.organizationId,
        clientId: config.clientId,
        userId: config.userId,
        store: this.liveStoreInstance.store,
        orgSchema: config.orgSchema,
        outgoingChangeService: baseServices.dexieOutgoing || baseServices.outgoing,
        incomingChangeService: baseServices.incoming
      });

      syncLogger.info('service', 'LiveStore sync integration ready', {
        organizationId: config.organizationId,
        syncStatus: this.liveStoreSync.getSyncStatus()
      });

    } catch (error) {
      syncLogger.serviceError('LiveStoreSync', error as Error, 'initialization');
      throw error;
    }
  }

  /**
   * Setup enhanced callbacks including LiveStore events
   */
  setupCallbacks(eventHandler: (event: any) => void): void {
    // Setup base service callbacks first
    super.setupCallbacks(eventHandler);

    // Add LiveStore-specific event handlers
    if (this.liveStoreInstance && this.liveStoreSync) {
      this.setupLiveStoreCallbacks(eventHandler);
    }
  }

  /**
   * Setup LiveStore-specific callbacks
   */
  private setupLiveStoreCallbacks(eventHandler: (event: any) => void): void {
    if (!this.liveStoreConfig) {
      return;
    }

    syncLogger.info('service', 'Setting up LiveStore callbacks');

    // Listen for LiveStore sync events
    if (typeof window !== 'undefined') {
      window.addEventListener('livestore:sync:ready', (event: CustomEvent) => {
        if (event.detail.organizationId === this.liveStoreConfig?.organizationId) {
          syncLogger.serviceCallback('LiveStoreSync', 'ready', event.detail);
          eventHandler({ type: 'LIVESTORE_SYNC_READY', detail: event.detail });
        }
      });

      window.addEventListener('livestore:sync:shutdown', (event: CustomEvent) => {
        if (event.detail.organizationId === this.liveStoreConfig?.organizationId) {
          syncLogger.serviceCallback('LiveStoreSync', 'shutdown', event.detail);
          eventHandler({ type: 'LIVESTORE_SYNC_SHUTDOWN', detail: event.detail });
        }
      });

      // Listen for LiveStore org events
      window.addEventListener('livestore:org:ready', (event: CustomEvent) => {
        if (event.detail.orgId === this.liveStoreConfig?.organizationId) {
          syncLogger.serviceCallback('LiveStore', 'orgReady', event.detail);
          eventHandler({ type: 'LIVESTORE_ORG_READY', detail: event.detail });
        }
      });

      window.addEventListener('livestore:org:error', (event: CustomEvent) => {
        if (event.detail.orgId === this.liveStoreConfig?.organizationId) {
          syncLogger.serviceError('LiveStore', event.detail.error, 'org_error');
          eventHandler({ type: 'LIVESTORE_ORG_ERROR', error: event.detail.error });
        }
      });
    }

    syncLogger.serviceInitialized('LiveStoreCallbacks', {
      organizationId: this.liveStoreConfig.organizationId,
      eventHandlerRegistered: true
    });
  }

  /**
   * Get enhanced services including LiveStore
   */
  getServices(): LiveStoreServices | null {
    const baseServices = super.getServices();
    
    if (!baseServices) {
      return null;
    }

    return {
      ...baseServices,
      liveStore: this.liveStoreInstance,
      liveStoreSync: this.liveStoreSync
    };
  }

  /**
   * Update configuration including LiveStore settings
   */
  updateConfig(updates: Partial<LiveStoreServiceCoordinatorConfig>): void {
    super.updateConfig(updates);

    if (updates.organizationId && this.liveStoreConfig) {
      // Handle organization switching
      this.handleOrganizationSwitch(updates.organizationId);
    }
  }

  /**
   * Handle switching to different organization
   */
  private async handleOrganizationSwitch(newOrgId: string): Promise<void> {
    if (!this.liveStoreConfig) {
      return;
    }

    const currentOrgId = this.liveStoreConfig.organizationId;
    
    if (currentOrgId === newOrgId) {
      return; // No change
    }

    syncLogger.info('service', 'Switching LiveStore organization', {
      from: currentOrgId,
      to: newOrgId
    });

    try {
      // Shutdown current LiveStore sync
      if (this.liveStoreSync) {
        await this.liveStoreSync.shutdown();
        this.liveStoreSync = null;
      }

      // Switch LiveStore instance
      this.liveStoreInstance = await liveStoreSchemaClient.switchOrganization(
        currentOrgId,
        newOrgId,
        this.liveStoreConfig.clientId
      );

      // Update config
      this.liveStoreConfig = {
        ...this.liveStoreConfig,
        organizationId: newOrgId
      };

      // Reinitialize sync if LiveStore instance is available
      if (this.liveStoreInstance) {
        const baseServices = super.getServices();
        if (baseServices) {
          await this.initializeLiveStoreSync(this.liveStoreConfig, baseServices);
        }
      }

      syncLogger.info('service', 'Organization switch completed', {
        newOrganizationId: newOrgId
      });

    } catch (error) {
      syncLogger.serviceError('LiveStore', error as Error, 'organization_switch');
      throw error;
    }
  }

  /**
   * Get enhanced health status
   */
  getHealthStatus(): { [serviceName: string]: boolean } {
    const baseHealth = super.getHealthStatus();
    
    return {
      ...baseHealth,
      liveStore: !!this.liveStoreInstance,
      liveStoreSync: !!this.liveStoreSync,
      liveStoreReady: this.liveStoreInstance ? true : false
    };
  }

  /**
   * Get enhanced service statistics
   */
  getServiceStats(): any {
    const baseStats = super.getServiceStats();
    
    const liveStoreStats = {
      liveStore: {
        available: !!this.liveStoreInstance,
        organizationId: this.liveStoreConfig?.organizationId,
        schema: this.liveStoreInstance ? {
          ready: true,
          entities: Object.keys(this.liveStoreConfig?.orgSchema.entities || {}).length
        } : null
      },
      liveStoreSync: {
        available: !!this.liveStoreSync,
        status: this.liveStoreSync?.getSyncStatus() || null
      }
    };

    return {
      ...baseStats,
      enhanced: true,
      ...liveStoreStats
    };
  }

  /**
   * Get LiveStore mutations interface
   */
  getLiveStoreMutations() {
    return this.liveStoreSync?.getMutations() || null;
  }

  /**
   * Get LiveStore sync status
   */
  getLiveStoreSyncStatus() {
    return this.liveStoreSync?.getSyncStatus() || null;
  }

  /**
   * Trigger manual sync for testing
   */
  async triggerManualSync(): Promise<void> {
    if (this.liveStoreSync) {
      await this.liveStoreSync.triggerManualSync();
    } else {
      syncLogger.info('service', 'LiveStore sync not available for manual trigger');
    }
  }

  /**
   * Enhanced destroy with LiveStore cleanup
   */
  destroy(): void {
    syncLogger.info('service', 'LiveStoreServiceCoordinator destroying enhanced services...');

    // Shutdown LiveStore sync first
    if (this.liveStoreSync) {
      try {
        this.liveStoreSync.shutdown();
        syncLogger.info('service', 'LiveStore sync shutdown');
      } catch (error) {
        syncLogger.serviceError('LiveStoreSync', error as Error, 'destruction');
      }
    }

    // Close LiveStore instance
    if (this.liveStoreInstance && this.liveStoreConfig) {
      try {
        liveStoreSchemaClient.closeLiveStore(this.liveStoreConfig.organizationId);
        syncLogger.info('service', 'LiveStore instance closed');
      } catch (error) {
        syncLogger.serviceError('LiveStore', error as Error, 'destruction');
      }
    }

    // Clear LiveStore references
    this.liveStoreInstance = null;
    this.liveStoreSync = null;
    this.liveStoreConfig = null;

    // Destroy base services
    super.destroy();

    syncLogger.serviceInitialized('LiveStoreServiceCoordinator', { destroyed: true, enhanced: true });
  }
}

/**
 * Factory function to create LiveStore-enhanced ServiceCoordinator
 */
export async function createLiveStoreServiceCoordinator(): Promise<LiveStoreServiceCoordinator> {
  return new LiveStoreServiceCoordinator();
}

export default LiveStoreServiceCoordinator;