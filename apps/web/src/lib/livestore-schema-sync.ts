/**
 * LiveStore Schema Sync Integration
 * 
 * Integrates real-time schema updates with the existing sync system.
 * Allows LiveStore schemas to update without app reload through WebSocket messages.
 */

import { liveStoreSchemaClient } from './livestore-schema-client';
import { orgSchemaClient } from './schema-client';
import { 
  liveStoreSchemaManager, 
  LiveStoreDynamicSchemaGenerator 
} from './livestore-dynamic-schema';
import type { 
  SchemaUpdateEvent,
  SchemaUpdateHandler,
  ServerSchemaUpdatedMessage,
  ServerSchemaMigrationMessage,
  ServerSchemaErrorMessage,
  ClientSchemaReceivedMessage,
  ClientSchemaAppliedMessage,
  LiveStoreSchemaUpdate
} from '@/types/sync';

/**
 * Schema Sync Service
 * Handles real-time schema updates through WebSocket sync system
 */
export class LiveStoreSchemaSync implements SchemaUpdateHandler {
  private generator = new LiveStoreDynamicSchemaGenerator();
  private currentOrgId: string | null = null;
  private listeners = new Set<(event: SchemaUpdateEvent) => void>();
  private pendingUpdates = new Map<string, SchemaUpdateEvent>();

  constructor(private webSocketService?: any) {
    this.setupWebSocketHandlers();
  }

  /**
   * Initialize schema sync for organization
   */
  async initialize(orgId: string, clientId: string): Promise<void> {
    console.log(`🔄 Initializing schema sync for org: ${orgId}`);
    
    this.currentOrgId = orgId;
    
    // Request current schema from server if needed
    await this.requestSchemaUpdate(orgId);
  }

  /**
   * Setup WebSocket message handlers for schema updates
   */
  private setupWebSocketHandlers(): void {
    if (!this.webSocketService) {
      console.warn('⚠️ WebSocket service not available for schema sync');
      return;
    }

    // Handle server schema update messages
    this.webSocketService.onMessage('srv_schema_updated', (message: ServerSchemaUpdatedMessage) => {
      this.handleSchemaUpdated(message);
    });

    this.webSocketService.onMessage('srv_schema_migration', (message: ServerSchemaMigrationMessage) => {
      this.handleSchemaMigration(message);
    });

    this.webSocketService.onMessage('srv_schema_error', (message: ServerSchemaErrorMessage) => {
      this.handleSchemaError(message);
    });

    console.log('✅ Schema sync WebSocket handlers registered');
  }

  /**
   * Handle schema updated message from server
   */
  private async handleSchemaUpdated(message: ServerSchemaUpdatedMessage): Promise<void> {
    console.log(`📡 Received schema update for org: ${message.orgId}`);
    
    // Only process if this is for our current organization
    if (message.orgId !== this.currentOrgId) {
      console.log(`⏭️ Ignoring schema update for different org: ${message.orgId}`);
      return;
    }

    try {
      // Process the schema update
      const updateEvent: SchemaUpdateEvent = {
        type: 'schema:updated',
        orgId: message.orgId,
        payload: message.payload,
        timestamp: Date.now()
      };

      // Store pending update
      this.pendingUpdates.set(message.messageId, updateEvent);

      // Apply the schema update
      await this.onSchemaUpdated(updateEvent);

      // Send acknowledgment to server
      await this.sendSchemaReceived(message);

    } catch (error) {
      console.error('❌ Failed to handle schema update:', error);
      await this.sendSchemaError(message.messageId, 'apply_failed', error);
    }
  }

  /**
   * Handle schema migration message from server
   */
  private async handleSchemaMigration(message: ServerSchemaMigrationMessage): Promise<void> {
    console.log(`🔄 Schema migration update: ${message.status} (${message.migrationId})`);

    const updateEvent: SchemaUpdateEvent = {
      type: 'schema:migration',
      orgId: message.orgId,
      payload: message,
      timestamp: Date.now()
    };

    await this.onSchemaMigration(updateEvent);
    this.notifyListeners(updateEvent);
  }

  /**
   * Handle schema error message from server
   */
  private async handleSchemaError(message: ServerSchemaErrorMessage): Promise<void> {
    console.error(`❌ Schema error from server: ${message.error}`);

    const updateEvent: SchemaUpdateEvent = {
      type: 'schema:error',
      orgId: message.orgId,
      payload: message,
      timestamp: Date.now()
    };

    await this.onSchemaError(updateEvent);
    this.notifyListeners(updateEvent);
  }

  /**
   * Apply schema update to LiveStore
   */
  async onSchemaUpdated(event: SchemaUpdateEvent): Promise<void> {
    const payload = event.payload as any; // SchemaChangePayload
    
    console.log(`🔄 Applying schema update for org: ${event.orgId}`);
    console.log(`📊 Changes:`, payload.entityChanges?.length || 0, 'entities affected');

    try {
      // Clear existing cache
      orgSchemaClient.clearCache(event.orgId);
      liveStoreSchemaManager.clearOrgCache(event.orgId);

      let updatedOrgSchema;
      
      if (payload.updatedSchema) {
        // Use the complete schema from the server
        updatedOrgSchema = payload.updatedSchema;
        console.log('✅ Using complete schema from server');
      } else {
        // Load fresh schema from server
        const schemaResult = await orgSchemaClient.loadOrgSchema(event.orgId);
        if (!schemaResult.success || !schemaResult.schema) {
          throw new Error('Failed to load updated schema from server');
        }
        updatedOrgSchema = schemaResult.schema;
        console.log('✅ Loaded fresh schema from server');
      }

      // Generate new LiveStore schema
      const liveStoreSchema = this.generator.generateSchema(updatedOrgSchema);
      const liveStoreEvents = this.generator.generateEvents(updatedOrgSchema);

      // Validate the new schema
      const validation = liveStoreSchemaManager.validateSchema(liveStoreSchema);
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if LiveStore instance needs restart
      const requiresRestart = this.checkIfInstanceRestartRequired(payload.entityChanges);

      if (requiresRestart) {
        console.log('🔄 Schema changes require LiveStore instance restart');
        
        // Refresh the LiveStore instance with new schema
        await liveStoreSchemaClient.refreshOrgSchema(event.orgId);
        
        // Dispatch instance restart event
        this.dispatchLiveStoreEvent('instance:restarted', {
          orgId: event.orgId,
          reason: 'schema_update',
          changes: payload.entityChanges
        });
      } else {
        console.log('✅ Schema changes applied without instance restart');
        
        // Update cached schemas
        await liveStoreSchemaManager.loadOrgLiveStoreSchema(event.orgId, updatedOrgSchema);
        
        // Dispatch schema update event
        this.dispatchLiveStoreEvent('schema:updated', {
          orgId: event.orgId,
          version: payload.version,
          changes: payload.entityChanges
        });
      }

      console.log(`✅ Schema update completed for org: ${event.orgId}`);
      this.notifyListeners(event);

    } catch (error) {
      console.error('❌ Failed to apply schema update:', error);
      throw error;
    }
  }

  /**
   * Handle schema migration progress
   */
  async onSchemaMigration(event: SchemaUpdateEvent): Promise<void> {
    const message = event.payload as ServerSchemaMigrationMessage;
    
    console.log(`🔄 Schema migration ${message.status}: ${message.migrationId}`);
    
    if (message.progress) {
      console.log(`📊 Progress: ${message.progress.current}/${message.progress.total} - ${message.progress.description}`);
    }

    // Dispatch migration progress event
    this.dispatchLiveStoreEvent('migration:progress', {
      orgId: event.orgId,
      migrationId: message.migrationId,
      status: message.status,
      progress: message.progress,
      error: message.error
    });

    if (message.status === 'completed') {
      console.log('✅ Schema migration completed - refreshing schema');
      // Migration completed, refresh schema
      await this.requestSchemaUpdate(event.orgId);
    }
  }

  /**
   * Handle schema errors
   */
  async onSchemaError(event: SchemaUpdateEvent): Promise<void> {
    const message = event.payload as ServerSchemaErrorMessage;
    
    console.error(`❌ Schema error: ${message.error} (${message.errorCode})`);
    
    // Dispatch error event
    this.dispatchLiveStoreEvent('schema:error', {
      orgId: event.orgId,
      error: message.error,
      errorCode: message.errorCode,
      details: message.details
    });
  }

  /**
   * Request schema update from server
   */
  private async requestSchemaUpdate(orgId: string, forceRefresh = false): Promise<void> {
    if (!this.webSocketService) {
      console.warn('⚠️ Cannot request schema update - WebSocket service not available');
      return;
    }

    console.log(`📡 Requesting schema update for org: ${orgId}`);

    const message = {
      type: 'clt_schema_request',
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      clientId: this.getClientId(),
      orgId: orgId,
      forceRefresh: forceRefresh
    };

    await this.webSocketService.send(message);
  }

  /**
   * Send schema received acknowledgment
   */
  private async sendSchemaReceived(originalMessage: ServerSchemaUpdatedMessage): Promise<void> {
    if (!this.webSocketService) return;

    const message: ClientSchemaReceivedMessage = {
      type: 'clt_schema_received',
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      clientId: this.getClientId(),
      orgId: originalMessage.orgId,
      version: originalMessage.payload.version,
      inReplyTo: originalMessage.messageId,
      changeCount: originalMessage.payload.entityChanges.length
    };

    await this.webSocketService.send(message);
    console.log(`✅ Sent schema received acknowledgment for org: ${originalMessage.orgId}`);
  }

  /**
   * Send schema applied confirmation
   */
  private async sendSchemaApplied(
    orgId: string, 
    version: string, 
    appliedChanges: string[], 
    inReplyTo: string,
    success = true,
    errors?: string[]
  ): Promise<void> {
    if (!this.webSocketService) return;

    const message: ClientSchemaAppliedMessage = {
      type: 'clt_schema_applied',
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      clientId: this.getClientId(),
      orgId: orgId,
      version: version,
      appliedChanges: appliedChanges,
      success: success,
      errors: errors,
      inReplyTo: inReplyTo
    };

    await this.webSocketService.send(message);
    console.log(`✅ Sent schema applied confirmation for org: ${orgId}`);
  }

  /**
   * Send schema error message
   */
  private async sendSchemaError(
    inReplyTo: string,
    errorCode: string,
    error: any
  ): Promise<void> {
    if (!this.webSocketService || !this.currentOrgId) return;

    const message = {
      type: 'clt_schema_error',
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      clientId: this.getClientId(),
      orgId: this.currentOrgId,
      error: error instanceof Error ? error.message : String(error),
      errorCode: errorCode,
      details: error,
      inReplyTo: inReplyTo
    };

    await this.webSocketService.send(message);
  }

  /**
   * Check if schema changes require LiveStore instance restart
   */
  private checkIfInstanceRestartRequired(entityChanges: any[]): boolean {
    // Major schema changes that require instance restart
    const majorChangeTypes = [
      'entity_created',
      'entity_deleted', 
      'field_deleted',
      'migration_applied'
    ];

    return entityChanges.some(change => 
      majorChangeTypes.includes(change.changeType)
    );
  }

  /**
   * Dispatch LiveStore-specific events
   */
  private dispatchLiveStoreEvent(type: string, detail: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`livestore:${type}`, { detail }));
    }
  }

  /**
   * Add event listener for schema updates
   */
  addListener(listener: (event: SchemaUpdateEvent) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: (event: SchemaUpdateEvent) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of schema update events
   */
  private notifyListeners(event: SchemaUpdateEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('❌ Error in schema update listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.listeners.clear();
    this.pendingUpdates.clear();
    this.currentOrgId = null;
  }

  // Utility methods
  private generateMessageId(): string {
    return `schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientId(): string {
    // Get from WebSocket service or generate
    return this.webSocketService?.getClientId() || 'unknown-client';
  }
}

/**
 * React Hook for Schema Sync
 */
export function useSchemaSync(orgId: string | null, webSocketService?: any) {
  const [schemaSync] = React.useState(() => new LiveStoreSchemaSync(webSocketService));
  const [lastUpdate, setLastUpdate] = React.useState<SchemaUpdateEvent | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    if (orgId) {
      schemaSync.initialize(orgId, 'client-id').catch(console.error);
    }

    return () => {
      schemaSync.cleanup();
    };
  }, [orgId, schemaSync]);

  React.useEffect(() => {
    const handleSchemaUpdate = (event: SchemaUpdateEvent) => {
      setLastUpdate(event);
      setIsUpdating(event.type === 'schema:updated');
      
      // Clear updating state after successful update
      if (event.type === 'schema:updated') {
        setTimeout(() => setIsUpdating(false), 1000);
      }
    };

    schemaSync.addListener(handleSchemaUpdate);

    return () => {
      schemaSync.removeListener(handleSchemaUpdate);
    };
  }, [schemaSync]);

  return {
    schemaSync,
    lastUpdate,
    isUpdating,
    requestUpdate: (forceRefresh = false) => {
      if (orgId) {
        return schemaSync.requestSchemaUpdate(orgId, forceRefresh);
      }
    }
  };
}

// React import
declare const React: any;

// Global instance for non-React usage
export const globalSchemaSync = new LiveStoreSchemaSync();