/**
 * Server-Side Schema Sync Handler
 * 
 * Handles schema update notifications through the WebSocket sync system.
 * Broadcasts schema changes to organization clients in real-time.
 */

import type { WebSocketHandler } from './types';
import type { 
  ServerSchemaUpdatedMessage,
  ServerSchemaMigrationMessage,
  ServerSchemaErrorMessage,
  ClientSchemaRequestMessage,
  ClientSchemaReceivedMessage,
  ClientSchemaAppliedMessage,
  ClientSchemaErrorMessage,
  SchemaChangePayload,
  SchemaChangeType
} from '@repo/sync-types';

/**
 * Schema Sync Handler
 * Manages real-time schema updates for organization clients
 */
export class SchemaSyncHandler {
  private orgConnections = new Map<string, Set<WebSocketHandler>>();
  private pendingUpdates = new Map<string, SchemaChangePayload>();

  constructor(private entityManager?: any) {
    console.log('🔄 Schema sync handler initialized');
  }

  /**
   * Register client for organization schema updates
   */
  registerClient(orgId: string, handler: WebSocketHandler): void {
    if (!this.orgConnections.has(orgId)) {
      this.orgConnections.set(orgId, new Set());
    }
    
    this.orgConnections.get(orgId)!.add(handler);
    
    console.log(`📡 Client registered for schema updates: org=${orgId}, total=${this.orgConnections.get(orgId)!.size}`);

    // Setup client message handlers
    this.setupClientHandlers(handler);
  }

  /**
   * Unregister client from organization schema updates
   */
  unregisterClient(orgId: string, handler: WebSocketHandler): void {
    const clients = this.orgConnections.get(orgId);
    if (clients) {
      clients.delete(handler);
      
      if (clients.size === 0) {
        this.orgConnections.delete(orgId);
      }
    }

    console.log(`📡 Client unregistered from schema updates: org=${orgId}`);
  }

  /**
   * Setup client message handlers
   */
  private setupClientHandlers(handler: WebSocketHandler): void {
    // Handle client schema requests
    handler.onMessage('clt_schema_request', async (message: ClientSchemaRequestMessage) => {
      await this.handleSchemaRequest(handler, message);
    });

    // Handle client schema received acknowledgments
    handler.onMessage('clt_schema_received', async (message: ClientSchemaReceivedMessage) => {
      await this.handleSchemaReceived(handler, message);
    });

    // Handle client schema applied confirmations
    handler.onMessage('clt_schema_applied', async (message: ClientSchemaAppliedMessage) => {
      await this.handleSchemaApplied(handler, message);
    });

    // Handle client schema errors
    handler.onMessage('clt_schema_error', async (message: ClientSchemaErrorMessage) => {
      await this.handleSchemaError(handler, message);
    });
  }

  /**
   * Notify organization clients of schema changes
   */
  async notifySchemaUpdate(
    orgId: string,
    changeType: SchemaChangeType,
    entityChanges: any[],
    version: string,
    migrationId?: string
  ): Promise<void> {
    console.log(`📡 Broadcasting schema update to org: ${orgId}`);
    console.log(`📊 Changes: ${entityChanges.length} entities affected`);

    try {
      // Get updated syncable schema from server
      const updatedSchema = await this.getOrgSyncableSchema(orgId);
      
      const payload: SchemaChangePayload = {
        orgId,
        changeType,
        timestamp: Date.now(),
        version,
        entityChanges,
        migrationId,
        requiresRestart: this.checkIfRequiresRestart(entityChanges),
        updatedSchema
      };

      // Store pending update
      this.pendingUpdates.set(`${orgId}:${version}`, payload);

      const message: ServerSchemaUpdatedMessage = {
        type: 'srv_schema_updated',
        messageId: this.generateMessageId(),
        timestamp: Date.now(),
        clientId: 'server',
        orgId,
        payload,
        broadcastToOrg: true
      };

      // Broadcast to all organization clients
      await this.broadcastToOrganization(orgId, message);

      console.log(`✅ Schema update broadcast completed for org: ${orgId}`);

    } catch (error) {
      console.error(`❌ Failed to broadcast schema update for org ${orgId}:`, error);
      
      // Send error message to clients
      await this.broadcastSchemaError(orgId, 'broadcast_failed', error);
    }
  }

  /**
   * Notify organization clients of schema migration progress
   */
  async notifyMigrationProgress(
    orgId: string,
    migrationId: string,
    status: 'started' | 'in_progress' | 'completed' | 'failed',
    progress?: { current: number; total: number; description: string },
    error?: string
  ): Promise<void> {
    console.log(`🔄 Broadcasting migration progress: ${status} (${migrationId})`);

    const message: ServerSchemaMigrationMessage = {
      type: 'srv_schema_migration',
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      clientId: 'server',
      orgId,
      migrationId,
      status,
      progress,
      error,
      estimatedCompletion: status === 'in_progress' ? Date.now() + 30000 : undefined
    };

    await this.broadcastToOrganization(orgId, message);
  }

  /**
   * Handle client schema request
   */
  private async handleSchemaRequest(
    handler: WebSocketHandler,
    message: ClientSchemaRequestMessage
  ): Promise<void> {
    console.log(`📡 Handling schema request for org: ${message.orgId}`);

    try {
      const schema = await this.getOrgSyncableSchema(message.orgId);
      
      if (!schema) {
        throw new Error(`No schema found for organization: ${message.orgId}`);
      }

      // Create schema update payload
      const payload: SchemaChangePayload = {
        orgId: message.orgId,
        changeType: 'schema_version',
        timestamp: Date.now(),
        version: schema.version || '1.0.0',
        entityChanges: [],
        updatedSchema: schema
      };

      const response: ServerSchemaUpdatedMessage = {
        type: 'srv_schema_updated',
        messageId: this.generateMessageId(),
        timestamp: Date.now(),
        clientId: 'server',
        orgId: message.orgId,
        payload,
        broadcastToOrg: false
      };

      await handler.send(response);

      console.log(`✅ Schema request fulfilled for org: ${message.orgId}`);

    } catch (error) {
      console.error(`❌ Failed to handle schema request:`, error);
      
      await this.sendSchemaError(handler, message.orgId, 'request_failed', error, message.messageId);
    }
  }

  /**
   * Handle client schema received acknowledgment
   */
  private async handleSchemaReceived(
    handler: WebSocketHandler,
    message: ClientSchemaReceivedMessage
  ): Promise<void> {
    console.log(`✅ Client acknowledged schema receipt: org=${message.orgId}, version=${message.version}`);
    
    // Track client receipt for monitoring
    // Could store in database or metrics system
  }

  /**
   * Handle client schema applied confirmation
   */
  private async handleSchemaApplied(
    handler: WebSocketHandler,
    message: ClientSchemaAppliedMessage
  ): Promise<void> {
    console.log(`✅ Client applied schema: org=${message.orgId}, version=${message.version}, success=${message.success}`);
    
    if (!message.success && message.errors) {
      console.error(`❌ Client schema application errors:`, message.errors);
    }

    // Could trigger additional actions based on application success/failure
  }

  /**
   * Handle client schema error
   */
  private async handleSchemaError(
    handler: WebSocketHandler,
    message: ClientSchemaErrorMessage
  ): Promise<void> {
    console.error(`❌ Client schema error: org=${message.orgId}, error=${message.error}, code=${message.errorCode}`);
    
    // Could trigger error handling, alerts, or recovery procedures
  }

  /**
   * Broadcast message to all clients in organization
   */
  private async broadcastToOrganization(orgId: string, message: any): Promise<void> {
    const clients = this.orgConnections.get(orgId);
    
    if (!clients || clients.size === 0) {
      console.log(`📡 No clients connected for org: ${orgId}`);
      return;
    }

    console.log(`📡 Broadcasting to ${clients.size} clients in org: ${orgId}`);

    const promises = Array.from(clients).map(async (handler) => {
      try {
        if (handler.isConnected()) {
          await handler.send(message);
        } else {
          // Remove disconnected client
          clients.delete(handler);
        }
      } catch (error) {
        console.error(`❌ Failed to send message to client:`, error);
        // Remove failed client
        clients.delete(handler);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Broadcast schema error to organization clients
   */
  private async broadcastSchemaError(
    orgId: string,
    errorCode: string,
    error: any
  ): Promise<void> {
    const message: ServerSchemaErrorMessage = {
      type: 'srv_schema_error',
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      clientId: 'server',
      orgId,
      error: error instanceof Error ? error.message : String(error),
      errorCode: errorCode as any,
      details: error
    };

    await this.broadcastToOrganization(orgId, message);
  }

  /**
   * Send schema error to specific client
   */
  private async sendSchemaError(
    handler: WebSocketHandler,
    orgId: string,
    errorCode: string,
    error: any,
    inReplyTo?: string
  ): Promise<void> {
    const message: ServerSchemaErrorMessage = {
      type: 'srv_schema_error',
      messageId: this.generateMessageId(),
      timestamp: Date.now(),
      clientId: 'server',
      orgId,
      error: error instanceof Error ? error.message : String(error),
      errorCode: errorCode as any,
      details: error,
      inReplyTo
    };

    await handler.send(message);
  }

  /**
   * Get organization syncable schema
   */
  private async getOrgSyncableSchema(orgId: string): Promise<any> {
    if (this.entityManager) {
      try {
        return await this.entityManager.getOrgSyncSchema(orgId);
      } catch (error) {
        console.error(`❌ Failed to get org schema from entity manager:`, error);
      }
    }

    // Fallback: could call API endpoint directly
    console.warn(`⚠️ Entity manager not available, schema not loaded for org: ${orgId}`);
    return null;
  }

  /**
   * Check if schema changes require client restart
   */
  private checkIfRequiresRestart(entityChanges: any[]): boolean {
    const restartRequiredTypes = [
      'entity_created',
      'entity_deleted',
      'field_deleted',
      'migration_applied'
    ];

    return entityChanges.some(change => 
      restartRequiredTypes.includes(change.changeType)
    );
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `schema_srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get organization statistics
   */
  getOrganizationStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [orgId, clients] of this.orgConnections.entries()) {
      stats[orgId] = {
        connectedClients: clients.size,
        activeClients: Array.from(clients).filter(c => c.isConnected()).length
      };
    }

    return {
      organizations: Object.keys(this.orgConnections).length,
      totalClients: Array.from(this.orgConnections.values()).reduce((sum, clients) => sum + clients.size, 0),
      orgStats: stats,
      pendingUpdates: this.pendingUpdates.size
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.orgConnections.clear();
    this.pendingUpdates.clear();
    console.log('🧹 Schema sync handler cleaned up');
  }
}

// Export singleton instance
export const schemaSyncHandler = new SchemaSyncHandler();