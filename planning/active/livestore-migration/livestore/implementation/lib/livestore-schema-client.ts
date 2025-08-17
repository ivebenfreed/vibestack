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

export interface LiveStoreSchemaResult {
  success: boolean;
  schema?: LiveStoreSchema;
  events?: Record<string, any>;
  orgSchema?: OrgEntitySchema;
  error?: string;
  cached?: boolean;
}

// Real LiveStore imports
import { Store, createStore, type CreateStoreOptions } from '@livestore/livestore';
import { makePersistedAdapter } from '@livestore/adapter-web';
import type { Schema } from '@livestore/livestore';

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
    }
  }

  /**
   * Clear all caches and close all instances
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up all LiveStore instances');

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
   * Create LiveStore instance with real LiveStore
   */
  private async createLiveStoreInstance(
    orgId: string, 
    clientId: string, 
    schema: LiveStoreSchema, 
    events: Record<string, any>
  ): Promise<LiveStoreInstance> {
    console.log(`🔄 Creating real LiveStore instance for org: ${orgId}`);
    
    try {
      // Import the converter
      const { createOrgStoreConfig } = await import('./livestore-schema-converter');
      
      // Convert our schema to LiveStore format
      const storeConfig = createOrgStoreConfig(orgId, schema, events);
      
      // Create web adapter
      const adapter = makePersistedAdapter({
        // Configure for organization
        databaseName: storeConfig.databaseName,
        // Add sync configuration when available
        // sync: { backend: makeCfSync({ url: syncUrl }) }
      });
      
      // Create LiveStore instance
      const store = await createStore({
        schema: storeConfig.schema,
        adapter: adapter,
        // Add sync events when available
        // events: storeConfig.events
      });
      
      // Wait for store to be ready
      await store.ready();
      
      const instance: LiveStoreInstance = {
        store,
        schema,
        events,
        
        async ready(): Promise<void> {
          await store.ready();
          console.log(`✅ LiveStore ready for org: ${orgId}`);
        },
        
        async query(sql: string, params?: any[]): Promise<any[]> {
          console.log(`📊 LiveStore query for org ${orgId}:`, sql);
          try {
            // Use LiveStore's query capability
            const result = await store.queryDb(sql, params);
            return result;
          } catch (error) {
            console.error(`❌ Query failed for org ${orgId}:`, error);
            throw error;
          }
        },
        
        async apply(event: any): Promise<void> {
          console.log(`📨 LiveStore apply event for org ${orgId}:`, event);
          try {
            // Apply event to LiveStore (to be implemented with actual LiveStore event API)
            console.log(`⚠️ Event application not yet implemented, event:`, event);
            // TODO: Implement actual event application once we understand LiveStore event API
          } catch (error) {
            console.error(`❌ Event application failed for org ${orgId}:`, error);
            throw error;
          }
        },
        
        async close(): Promise<void> {
          console.log(`🔌 Closing LiveStore for org: ${orgId}`);
          try {
            await store.close();
          } catch (error) {
            console.error(`❌ Error closing LiveStore for org ${orgId}:`, error);
            throw error;
          }
        }
      };

      console.log(`✅ LiveStore instance created successfully for org: ${orgId}`);
      return instance;
      
    } catch (error) {
      console.error(`❌ Failed to create LiveStore instance for org ${orgId}:`, error);
      throw error;
    }
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

// React import (will be available in React context)
declare const React: any;