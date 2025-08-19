/**
 * LiveStore Schema Client Integration
 * 
 * Bridges existing organization schema client with LiveStore dynamic schema generation.
 * Provides seamless migration path from Dexie to LiveStore.
 */

import { orgSchemaClient, type OrgEntitySchema } from './schema-client';
import { 
  liveStoreSchemaManager, 
  type LiveStoreSchema, 
  LiveStoreDynamicSchemaGenerator 
} from './livestore-dynamic-schema';
import { 
  LiveStoreEventSyncService, 
  createLiveStoreEventSync 
} from './livestore-event-sync-service';
import type { TableChange } from '@/types/sync';

export interface LiveStoreSchemaResult {
  success: boolean;
  schema?: LiveStoreSchema;
  events?: Record<string, any>;
  orgSchema?: OrgEntitySchema;
  error?: string;
  cached?: boolean;
}

// Real LiveStore imports
import { Store, createStore } from '@livestore/livestore';
import { makePersistedAdapter, makeInMemoryAdapter } from '@livestore/adapter-web';
import type { Schema } from '@livestore/livestore';

// LiveStore worker imports - using official pattern from docs
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker';
import LiveStoreWorker from '../livestore/livestore.worker.ts?worker';

export interface LiveStoreInstance {
  store: Store;
  schema: LiveStoreSchema;
  events: Record<string, any>;
  ready(): Promise<void>;
  query(sql: string, params?: any[]): Promise<any[]>;
  apply(event: any): Promise<void>;
  close(): Promise<void>;
}

/**
 * LiveStore Schema Client
 * Manages organization-specific LiveStore instances with dynamic schemas
 */
export class LiveStoreSchemaClient {
  private liveStoreInstances = new Map<string, LiveStoreInstance>();
  private eventSyncServices = new Map<string, LiveStoreEventSyncService>();
  private initializingOrgs = new Set<string>();

  /**
   * Load LiveStore schema for organization
   */
  async loadLiveStoreSchema(orgId: string): Promise<LiveStoreSchemaResult> {
    try {
      // Load organization schema first
      const orgSchemaResult = await orgSchemaClient.loadOrgSchema(orgId);
      
      if (!orgSchemaResult.success || !orgSchemaResult.schema) {
        return {
          success: false,
          error: orgSchemaResult.error || 'Failed to load organization schema'
        };
      }

      // Generate LiveStore schema from organization schema
      const { schema, events } = await liveStoreSchemaManager.loadOrgLiveStoreSchema(
        orgId, 
        orgSchemaResult.schema
      );

      // Validate generated schema
      const validation = liveStoreSchemaManager.validateSchema(schema);
      if (!validation.valid) {
        return {
          success: false,
          error: `Schema validation failed: ${validation.errors.join(', ')}`
        };
      }

      return {
        success: true,
        schema,
        events,
        orgSchema: orgSchemaResult.schema,
        cached: orgSchemaResult.cached
      };

    } catch (error) {
      console.error('Failed to load LiveStore schema:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Initialize LiveStore instance for organization
   */
  async initializeLiveStore(orgId: string, clientId: string): Promise<LiveStoreInstance | null> {
    // Prevent duplicate initialization
    if (this.initializingOrgs.has(orgId)) {
      console.log(`LiveStore already initializing for org: ${orgId}`);
      return null;
    }

    // Return existing instance if available
    const existing = this.liveStoreInstances.get(orgId);
    if (existing) {
      return existing;
    }

    this.initializingOrgs.add(orgId);

    try {
      console.log(`🔄 Initializing LiveStore for organization: ${orgId}`);

      // Load schema
      const schemaResult = await this.loadLiveStoreSchema(orgId);
      if (!schemaResult.success || !schemaResult.schema || !schemaResult.events) {
        throw new Error(schemaResult.error || 'Failed to load schema');
      }

      // Create LiveStore instance (placeholder implementation)
      const liveStoreInstance = await this.createLiveStoreInstance(
        orgId, 
        clientId, 
        schemaResult.schema, 
        schemaResult.events
      );

      // Cache the instance
      this.liveStoreInstances.set(orgId, liveStoreInstance);

      // Skip event sync initialization for now to test basic functionality
      console.log('ℹ️ Skipping event sync initialization - focusing on basic LiveStore functionality');

      console.log(`✅ LiveStore initialized for organization: ${orgId}`);
      
      // Dispatch ready event
      window.dispatchEvent(new CustomEvent('livestore:org:ready', {
        detail: { orgId, instance: liveStoreInstance }
      }));

      return liveStoreInstance;

    } catch (error) {
      console.error(`❌ Failed to initialize LiveStore for org ${orgId}:`, error);
      
      // Dispatch error event
      window.dispatchEvent(new CustomEvent('livestore:org:error', {
        detail: { orgId, error }
      }));

      return null;
    } finally {
      this.initializingOrgs.delete(orgId);
    }
  }

  /**
   * Get existing LiveStore instance for organization
   */
  getLiveStoreInstance(orgId: string): LiveStoreInstance | null {
    return this.liveStoreInstances.get(orgId) || null;
  }

  /**
   * Get existing LiveStore instance for organization (alias for hooks)
   */
  async getLiveStore(orgId: string): Promise<LiveStoreInstance | null> {
    return this.getLiveStoreInstance(orgId);
  }

  /**
   * Get organization schema
   */
  async getOrgSchema(orgId: string) {
    const schemaResult = await this.loadLiveStoreSchema(orgId);
    return schemaResult.success ? schemaResult.orgSchema : null;
  }

  /**
   * Switch to different organization
   */
  async switchOrganization(fromOrgId: string | null, toOrgId: string, clientId: string): Promise<LiveStoreInstance | null> {
    console.log(`🔄 Switching organization: ${fromOrgId} → ${toOrgId}`);

    // Close previous organization's LiveStore
    if (fromOrgId) {
      await this.closeLiveStore(fromOrgId);
    }

    // Initialize new organization's LiveStore
    return await this.initializeLiveStore(toOrgId, clientId);
  }

  /**
   * Close LiveStore instance for organization
   */
  async closeLiveStore(orgId: string): Promise<void> {
    // Stop event sync first
    const eventSync = this.eventSyncServices.get(orgId);
    if (eventSync) {
      eventSync.stopEventSync();
      this.eventSyncServices.delete(orgId);
      console.log(`🔌 Stopped event sync for organization: ${orgId}`);
    }

    const instance = this.liveStoreInstances.get(orgId);
    if (instance) {
      try {
        await instance.close();
        console.log(`🔌 Closed LiveStore for organization: ${orgId}`);
      } catch (error) {
        console.error(`Error closing LiveStore for org ${orgId}:`, error);
      }
      
      this.liveStoreInstances.delete(orgId);
      
      // Dispatch closed event
      window.dispatchEvent(new CustomEvent('livestore:org:closed', {
        detail: { orgId }
      }));
    }
  }

  /**
   * Refresh schema for organization (when schema changes)
   */
  async refreshOrgSchema(orgId: string): Promise<void> {
    console.log(`🔄 Refreshing schema for organization: ${orgId}`);

    // Clear schema cache
    orgSchemaClient.clearCache(orgId);
    liveStoreSchemaManager.clearOrgCache(orgId);

    // Close and reinitialize LiveStore instance
    const instance = this.liveStoreInstances.get(orgId);
    if (instance) {
      const clientId = this.extractClientIdFromInstance(instance);
      await this.closeLiveStore(orgId);
      await this.initializeLiveStore(orgId, clientId);
      
      // Dispatch schema updated event
      window.dispatchEvent(new CustomEvent('livestore:schema:updated', {
        detail: { orgId }
      }));
    }
  }

  /**
   * Hot-swap schema without full restart (for POC)
   */
  async hotSwapSchema(orgId: string, newSchema: any): Promise<boolean> {
    console.log(`🔄 Hot-swapping schema for organization: ${orgId}`);
    
    try {
      const instance = this.liveStoreInstances.get(orgId);
      if (!instance) {
        console.log('No LiveStore instance found, performing full refresh');
        await this.refreshOrgSchema(orgId);
        return true;
      }

      // For POC: simulate hot schema swap by refreshing
      // In full implementation, this would update the LiveStore schema in-place
      console.log('🔄 Performing hot schema swap (POC simulation)');
      
      // Clear caches
      orgSchemaClient.clearCache(orgId);
      liveStoreSchemaManager.clearOrgCache(orgId);
      
      // Regenerate LiveStore schema
      const schemaResult = await this.loadLiveStoreSchema(orgId);
      if (!schemaResult.success) {
        throw new Error(`Failed to load new schema: ${schemaResult.error}`);
      }
      
      // Update instance schema reference
      instance.schema = schemaResult.schema!;
      instance.events = schemaResult.events!;
      
      // Dispatch hot swap event
      window.dispatchEvent(new CustomEvent('livestore:schema:hotswap', {
        detail: { orgId, newSchema: schemaResult.schema }
      }));
      
      console.log(`✅ Hot schema swap completed for org: ${orgId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Hot schema swap failed for org ${orgId}:`, error);
      
      // Fallback to full refresh
      console.log('🔄 Falling back to full schema refresh');
      await this.refreshOrgSchema(orgId);
      return false;
    }
  }

  /**
   * Clear all caches and close all instances
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up all LiveStore instances');

    // Stop all event sync services
    for (const [orgId, eventSync] of this.eventSyncServices) {
      eventSync.stopEventSync();
      console.log(`🔌 Stopped event sync for org: ${orgId}`);
    }
    this.eventSyncServices.clear();

    // Close all instances
    const closePromises = Array.from(this.liveStoreInstances.keys()).map(orgId => 
      this.closeLiveStore(orgId)
    );
    
    await Promise.all(closePromises);

    // Clear all caches
    orgSchemaClient.clearCache();
    liveStoreSchemaManager.clearAllCaches();
  }

  /**
   * Get table name for entity in organization
   */
  getTableName(orgId: string, entityName: string): string {
    return liveStoreSchemaManager.getTableName(orgId, entityName);
  }

  /**
   * Validate organization data against its schema
   */
  async validateOrgData(orgId: string, entityName: string, data: any): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    return await orgSchemaClient.validateEntityData(orgId, entityName, data);
  }

  // Private methods

  /**
   * Initialize event sync for organization
   */
  private async initializeEventSync(
    orgId: string, 
    clientId: string, 
    liveStoreInstance: LiveStoreInstance
  ): Promise<void> {
    try {
      console.log(`🔄 Initializing event sync for org: ${orgId}`);
      
      // Create mock WebSocket sender for now (replace with real one)
      const webSocketSender = this.createWebSocketSender();
      
      const eventSync = await createLiveStoreEventSync({
        orgId,
        liveStoreInstance,
        webSocketSender,
        clientId,
        autoStart: true
      });
      
      this.eventSyncServices.set(orgId, eventSync);
      
      console.log(`✅ Event sync initialized for org: ${orgId}`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize event sync for org ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Create WebSocket sender (mock for now)
   */
  private createWebSocketSender() {
    return {
      async send(message: TableChange): Promise<void> {
        console.log('📤 [LiveStore→WebSocket] Sending:', {
          table: message.table,
          operation: message.operation,
          orgId: message.orgId,
          entityId: message.data?.id
        });
        // TODO: Replace with real WebSocket sender from existing sync infrastructure
        // This will integrate with your existing WebSocket/sync system
      }
    };
  }

  /**
   * Create LiveStore instance with real LiveStore
   */
  private async createLiveStoreInstance(
    orgId: string, 
    clientId: string, 
    schema: LiveStoreSchema, 
    events: Record<string, any>
  ): Promise<LiveStoreInstance> {
    console.log(`🔄 Creating LiveStore instance for org: ${orgId}`);
    console.log('ℹ️ Using correct LiveStore v0.3.1 client instead of old implementation');
    
    try {
      // Import and use the correct LiveStore client
      const { initializeLiveStoreForOrg } = await import('./livestore-correct-client');
      
      // Initialize using the correct v0.3.1 API
      const correctStore = await initializeLiveStoreForOrg(orgId);
      
      if (!correctStore) {
        throw new Error('Correct LiveStore client returned null');
      }
      
      console.log(`✅ LiveStore initialized using correct v0.3.1 client for org: ${orgId}`);
      
      // Create wrapper that matches the expected interface
      const instance: LiveStoreInstance = {
        store: correctStore,
        schema,
        events,
        
        async ready(): Promise<void> {
          console.log(`✅ LiveStore ready for org: ${orgId}`);
          // Correct client handles readiness internally
        },
        
        async query(sql: string, params: any[] = []): Promise<any[]> {
          console.log(`📊 LiveStore query for org ${orgId}:`, sql, params);
          
          try {
            // Use the correct store's query method
            const result = await correctStore.query(sql, params);
            return Array.isArray(result) ? result : [];
          } catch (error) {
            console.error(`Query failed for org ${orgId}:`, error);
            return [];
          }
        },
        
        async apply(event: any): Promise<void> {
          console.log(`📨 LiveStore apply event for org ${orgId}:`, event);
          
          try {
            // Use the correct store's commit method for events
            await correctStore.commit(event);
          } catch (error) {
            console.error(`Event application failed for org ${orgId}:`, error);
          }
        },
        
        async close(): Promise<void> {
          console.log(`🔌 LiveStore closed for org: ${orgId}`);
          // Use correct client cleanup
          const { closeLiveStoreForOrg } = await import('./livestore-correct-client');
          await closeLiveStoreForOrg(orgId);
        }
      };

      return instance;
      
    } catch (error) {
      console.error(`❌ Failed to create LiveStore instance for org ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Get event sync service for organization
   */
  getEventSyncService(orgId: string): LiveStoreEventSyncService | null {
    return this.eventSyncServices.get(orgId) || null;
  }

  /**
   * Get sync status for organization
   */
  getSyncStatus(orgId: string) {
    const eventSync = this.eventSyncServices.get(orgId);
    if (!eventSync) {
      return { running: false, orgId, error: 'No event sync service' };
    }
    return eventSync.getStatus();
  }

  /**
   * Get sync status for all organizations
   */
  getAllSyncStatuses() {
    const statuses: Record<string, any> = {};
    for (const [orgId, eventSync] of this.eventSyncServices) {
      statuses[orgId] = eventSync.getStatus();
    }
    return statuses;
  }

  /**
   * Extract client ID from instance (placeholder)
   */
  private extractClientIdFromInstance(instance: LiveStoreInstance): string {
    // TODO: Implement proper client ID extraction
    return 'default-client-id';
  }
}

/**
 * React Hook for LiveStore Schema Management
 */
export function useLiveStoreSchema(orgId: string | null) {
  const [schemaResult, setSchemaResult] = React.useState<LiveStoreSchemaResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadSchema = React.useCallback(async () => {
    if (!orgId) {
      setSchemaResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await liveStoreSchemaClient.loadLiveStoreSchema(orgId);
      setSchemaResult(result);
      
      if (!result.success) {
        setError(result.error || 'Failed to load schema');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setSchemaResult({ success: false, error: errorMessage });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  return {
    schemaResult,
    schema: schemaResult?.schema || null,
    events: schemaResult?.events || null,
    orgSchema: schemaResult?.orgSchema || null,
    loading,
    error,
    cached: schemaResult?.cached || false,
    refetch: loadSchema
  };
}

/**
 * React Hook for LiveStore Instance Management
 */
export function useLiveStoreInstance(orgId: string | null, clientId: string) {
  const [instance, setInstance] = React.useState<LiveStoreInstance | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const initializeInstance = React.useCallback(async () => {
    if (!orgId) {
      setInstance(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(orgId, clientId);
      setInstance(liveStoreInstance);
      
      if (!liveStoreInstance) {
        setError('Failed to initialize LiveStore instance');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setInstance(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, clientId]);

  React.useEffect(() => {
    initializeInstance();
  }, [initializeInstance]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (orgId) {
        liveStoreSchemaClient.closeLiveStore(orgId);
      }
    };
  }, [orgId]);

  return {
    instance,
    loading,
    error,
    refetch: initializeInstance
  };
}

// Singleton instance
export const liveStoreSchemaClient = new LiveStoreSchemaClient();

import React from 'react';