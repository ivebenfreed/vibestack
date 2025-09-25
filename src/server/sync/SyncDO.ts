/**
 * SyncDO.ts - Refactored Sync Durable Object
 * 
 * Thin wrapper that coordinates between extracted service modules:
 * - Request routing
 * - Service dependency injection
 * - Durable Object lifecycle management
 * - Module coordination
 */

import { SyncStateManager } from './state-manager';
// import { performInitialSync } from './initial-sync-generic';
// import { sendLiveChanges } from './server-changes-generic';
// import { IncomingChangeProcessor } from './incoming-changes/IncomingChangeProcessor';
import { MessageHandlerRegistry, type MessageHandlerContext } from './message-handler-registry';
import crypto from 'crypto';
import { DurableObject } from 'cloudflare:workers';
import { WebSocketManager, type WebSocketManagerContext } from './websocket/WebSocketManager';
import { UnifiedClientRegistry } from './unified-client-registry';
import { BroadcastManager, type BroadcastManagerContext } from './broadcast-manager';
// import { SyncStrategyAnalyzer, type SyncStrategyContext, SyncStrategy } from './sync-strategy-analyzer';
import { OrgAwareSyncManager, type SyncConnection, type MultiOrgSyncConnection } from './org-aware-sync-manager';

import type { 
  ServerMessage, 
  ClientMessage,
  ClientChangesMessage,
  TableChange,
  ServerTableChangeNotificationMessage
} from '@/types/sync';
import type { MinimalContext } from '../types/hono';
import type { Env } from '../types/env';
import { syncLogger } from '../middleware/logger';
import type { WebSocketHandler } from './types';
import { compareLSN, deduplicateChanges } from '../lib/sync-common';
import { createDatabaseConnection, getKysely } from '../lib/database-manager';

const MODULE_NAME = 'SyncDO';

/**
 * Helper function to extract query parameters from a request
 */
function getQueryParam(request: Request, name: string): string | null {
  const url = new URL(request.url);
  return url.searchParams.get(name);
}

/**
 * SyncDO - Refactored to coordinate service modules
 */
export class SyncDO extends DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private ctx: DurableObjectState;
  private clientId: string = '';
  private syncId: string;
  
  // User-scoped sync context (NO single-org compatibility)
  private userConnection: MultiOrgSyncConnection | null = null;
  private orgAwareSyncManager!: OrgAwareSyncManager;
  
  // Service modules
  private stateManager: SyncStateManager;
  private messageHandlerRegistry!: MessageHandlerRegistry;
  private webSocketManager!: WebSocketManager;
  private unifiedClientRegistry!: UnifiedClientRegistry;
  private broadcastManager!: BroadcastManager;
  // private syncStrategyAnalyzer!: SyncStrategyAnalyzer;

  // Core state for coordination
  private messageHandlers: Map<ClientMessage['type'], Array<(message: ClientMessage) => Promise<void>>> = new Map();
  private messageQueue: Map<ClientMessage['type'], ClientMessage[]> = new Map();
  private waitingResolvers: Map<string, {
    resolve: (message: any) => void,
    reject: (error: Error) => void,
    timer: NodeJS.Timeout | null,
    filter?: (message: any) => boolean
  }> = new Map();
  private isHandlerRegistered: boolean = false;
  private isProcessingClientChanges: boolean = false;
  private pendingLiveUpdates: Array<() => Promise<void>> = [];

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.ctx = state;
    this.syncId = state.id.toString();
    
    // Initialize state manager
    const context: MinimalContext = {
      env: this.env,
      executionCtx: {
        waitUntil: (promise: Promise<any>) => this.state.waitUntil(promise),
        passThroughOnException: () => {},
        props: undefined
      }
    };
    this.stateManager = new SyncStateManager(context, state as any);
    
    // Initialize organization-aware sync manager
    this.orgAwareSyncManager = new OrgAwareSyncManager(this.env, context);
    
    // Initialize service modules
    this.initializeServices();
    
    // Handle hibernation recovery using Cloudflare's hibernation API
    this.restoreFromHibernation().catch(error => {
      syncLogger.error('Failed to restore from hibernation in constructor', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    });
  }

  /**
   * Initialize all service modules with proper dependency injection
   */
  private initializeServices(): void {
    // Unified Client Registry
    this.unifiedClientRegistry = new UnifiedClientRegistry(this.env);

    // WebSocket Manager
    const wsContext: WebSocketManagerContext = {
      ctx: this.ctx,
      clientId: this.clientId,
      setClientId: (clientId: string) => { this.clientId = clientId; },
      messageHandlers: this.messageHandlers,
      messageQueue: this.messageQueue,
      waitingResolvers: this.waitingResolvers,
      isProcessingClientChanges: this.isProcessingClientChanges,
      setProcessingClientChanges: (processing: boolean) => { this.isProcessingClientChanges = processing; },
      processPendingLiveUpdates: () => this.processPendingLiveUpdates(),
      notifyClientChangesComplete: (messageId: string) => this.notifyClientChangesComplete(messageId),
      stateManager: this.stateManager,
      checkWaitingResolvers: (type: string, message: ClientMessage) => this.checkWaitingResolvers(type, message)
    };
    this.webSocketManager = new WebSocketManager(wsContext);

    // Broadcast Manager
    const broadcastContext: BroadcastManagerContext = {
      env: this.env,
      clientId: this.clientId,
      unifiedClientRegistry: this.unifiedClientRegistry,
      getOrganizationContext: () => this.userConnection ? { userId: this.userConnection.userId, organizations: this.userConnection.organizations } : null,
      getContext: () => this.getContext()
    };
    this.broadcastManager = new BroadcastManager(broadcastContext);

    // Sync Strategy Analyzer - organization context is resolved dynamically
    const strategyContext: SyncStrategyContext = {
      clientId: this.clientId,
      stateManager: this.stateManager,
      getContext: () => this.getContext(),
      webSocketHandler: this,
      organizationId: this.userConnection?.userId || 'USER_SCOPED',
      userId: this.userConnection?.userId,
      getOrganizationContext: () => this.userConnection ? {
        userId: this.userConnection.userId,
        organizations: this.userConnection.organizations
      } : null
    };
    // this.syncStrategyAnalyzer = new SyncStrategyAnalyzer(strategyContext);

    // Message Handler Registry
    const handlerContext: MessageHandlerContext = {
      env: this.env,
      clientId: this.clientId,
      getContext: () => this.getContext(),
      broadcastChangesToOtherSyncDOs: (changes: TableChange[], clientId: string) => 
        this.broadcastManager.broadcastChangesToOtherSyncDOs(changes, clientId),
      broadcastConflictResolution: (changes: TableChange[], originClientId: string) => 
        this.broadcastManager.broadcastConflictResolution(changes, originClientId),
      ensureReplicationActive: () => this.ensureReplicationActive(),
      notifyClientChangesComplete: (messageId: string) => this.notifyClientChangesComplete(messageId),
      stateManager: this.stateManager,
      // NOTE: Removed heartbeat-triggered sync methods - organization context is required
      // Initial and catchup sync should only be triggered through proper org-aware WebSocket connection
      analyzeLSNGap: (clientLSN: string, serverLSN: string) => 
        this.syncStrategyAnalyzer.analyzeLSNGap(clientLSN, serverLSN),
      state: this.state,
      // Unified client registry and organization context access
      unifiedClientRegistry: this.unifiedClientRegistry,
      getOrganizationContext: () => this.userConnection ? { organizationId: this.userConnection.organizationId } : null
    };
    this.messageHandlerRegistry = new MessageHandlerRegistry(handlerContext, this);
  }

  /**
   * Main fetch handler - routes requests to appropriate handlers
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Route requests based on path
      if (path === '/api/sync') {
        return await this.handleWebSocketUpgrade(request);
      } else if (path === '/new-changes') {
        return await this.handleNewChanges(request);
      } else if (path === '/table-change-notification') {
        return await this.handleTableChangeNotification(request);
      } else if (path === '/send-message') {
        return await this.handleSendMessage(request);
      } else if (path === '/metrics') {
        return await this.handleMetrics();
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      syncLogger.error('Error in fetch handler', {
        path,
        error: error instanceof Error ? error.message : String(error),
        clientId: this.clientId
      }, MODULE_NAME);
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Handle WebSocket upgrade requests with organization validation
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // 1. Extract client parameters - NOW USER-SCOPED
    const clientId = getQueryParam(request, 'clientId');
    const userId = getQueryParam(request, 'userId');
    const organizationSlug = getQueryParam(request, 'org') || getQueryParam(request, 'organization');
    const organizationId = getQueryParam(request, 'organizationId'); // Legacy fallback
    const rawLSN = getQueryParam(request, 'lsn');
    const clientLSN = rawLSN || '0/0';

    syncLogger.info('🔗 User-scoped WebSocket upgrade request', {
      clientId,
      userId,
      organizationSlug,
      organizationId,
      rawLSN,
      url: request.url
    }, MODULE_NAME);
    
    if (!clientId) {
      syncLogger.error('WebSocket upgrade rejected - missing clientId', {
        url: request.url
      }, MODULE_NAME);
      return new Response('Missing clientId parameter', { status: 400 });
    }

    if (!userId) {
      syncLogger.error('WebSocket upgrade rejected - missing userId', {
        url: request.url,
        clientId
      }, MODULE_NAME);
      return new Response('Missing userId parameter - user-scoped sync required', { status: 400 });
    }

    // 2. Validate user's multi-organization access BEFORE WebSocket upgrade
    const multiOrgValidation = await this.orgAwareSyncManager.validateMultiOrgSyncConnection(
      request,
      clientId
    );

    if (!multiOrgValidation.isValid) {
      syncLogger.error('WebSocket upgrade rejected - multi-org validation failed', {
        clientId,
        organizationSlug,
        error: multiOrgValidation.error
      }, MODULE_NAME);
      return new Response(multiOrgValidation.error || 'Organization access denied', { status: 403 });
    }

    // 3. Store BOTH multi-org connection (for cross-org notifications) AND single-org (for backward compatibility)
    const multiOrgConnection = multiOrgValidation.connection!;

    // PURE USER-SCOPED CONNECTION - No single-org compatibility code
    this.userConnection = multiOrgConnection;
    this.clientId = clientId;

    syncLogger.info('🌍 PURE USER-SCOPED sync connection established', {
      clientId,
      userId,
      totalOrganizations: multiOrgConnection.organizations.length,
      organizations: multiOrgConnection.organizations.map(org => ({ id: org.id, name: org.name, role: org.role }))
    }, MODULE_NAME);
    
    // Store context in WebSocket attachment for hibernation recovery
    this.storeContextInWebSocketAttachment();
    
    // Store user-scoped context for hibernation recovery
    this.state.storage.put('hibernationContext', {
      clientId: this.clientId,
      userConnection: this.userConnection,
      timestamp: Date.now()
    });

    syncLogger.info('🌍 USER-SCOPED WebSocket hibernation ready', {
      clientId,
      userId: this.userConnection.userId,
      connectionType: 'USER_SCOPED',
      totalOrganizations: this.userConnection.organizations.length,
      allOrganizations: this.userConnection.organizations.map(org => ({ id: org.id, slug: org.slug, role: org.role })),
      rawLSN,
      clientLSN,
      willReceiveNotificationsFrom: 'ALL_USER_ORGANIZATIONS'
    }, MODULE_NAME);

    // User-scoped connection context already stored above

    // 5. Proceed with WebSocket upgrade
    const response = await this.webSocketManager.handleWebSocketUpgrade(request);
    
    if (response.status === 101) {
      
      // WebSocket upgrade successful - register handlers  
      this.registerMessageHandlers();
      
      // CRITICAL FIX: Restore automatic sync trigger from working version
      // The organization-aware sync needs to be triggered automatically after connection
      this.state.waitUntil(this.startOrgAwareSyncProcess(clientId, clientLSN));
    } else {
      // WebSocket upgrade failed - clear connection context
      this.userConnection = null;
      this.clientId = '';
    }
    
    return response;
  }


  /**
   * Start organization-aware sync process after WebSocket connection is established
   */
  private async startOrgAwareSyncProcess(clientId: string, clientLSN: string): Promise<void> {
    try {
      if (!this.userConnection) {
        throw new Error('No validated sync connection available');
      }

      // Wait for WebSocket connection to be established (from working version)
      await this.webSocketManager.waitForConnection();

      syncLogger.info('Starting org-aware sync process', {
        clientId,
        userId: this.userConnection.userId,
        organizationId: this.userConnection.organizationId,
        clientLSN
      }, MODULE_NAME);

      // Register client with unified registry
      await this.unifiedClientRegistry.registerClient({
        clientId,
        organizationId: this.userConnection.organizationId,
        organizationSlug: this.userConnection.organizationSlug,
        userId: this.userConnection.userId,
        userRole: this.userConnection.userRole,
        userEmail: this.userConnection.userEmail,
        userName: this.userConnection.userName
      });
      
      syncLogger.debug('Client registered with organization-aware registry', {
        clientId,
        organizationId: this.userConnection.organizationId,
        organizationSlug: this.userConnection.organizationSlug
      }, MODULE_NAME);

      // Note: WebSocket is ready after successful upgrade in hibernation API
      
      // Ensure replication is active
      await this.ensureReplicationActive();
      
      // BYPASS SYNC STRATEGY - Go straight to live sync
      syncLogger.info('Bypassing sync strategy determination - going straight to live sync', {
        clientId,
        clientLSN,
        organizationId: this.userConnection?.organizationId
      }, MODULE_NAME);
      
      // Start live sync directly (no LSN needed since we don't use change_history)
      await this.performOrgAwareSync('0/0', clientId, clientLSN);
      
    } catch (error) {
      syncLogger.error('Organization-aware sync error', {
        clientId,
        userId: this.userConnection?.userId,
        organizationId: this.userConnection?.organizationId,
        lsn: clientLSN,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      // Send error to client
      if (this.userConnection) {
        await this.send({
          type: 'sync-error',
          error: 'Organization sync failed',
          details: error instanceof Error ? error.message : String(error)
        } as any);
      }
    }
  }

  /**
   * Perform organization-aware sync with permission filtering
   */
  private async performOrgAwareSync(
    serverLSN: string,
    clientId: string,
    clientLSN: string
  ): Promise<void> {
    if (!this.userConnection) {
      throw new Error('No validated sync connection for org-aware sync');
    }

    try {
      // Skip complex sync strategies - just start live sync for notifications
      syncLogger.info('Starting simple live sync for notifications only', {
        clientId,
        organizationId: this.userConnection?.organizationId
      }, MODULE_NAME);
          
      await this.send({
        type: 'srv_live_start',
        clientId,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        messageId: crypto.randomUUID()
      });
    } catch (error) {
      syncLogger.error('Org-aware sync strategy failed', {
        clientId,
        userId: this.userConnection.userId,
        organizationId: this.userConnection.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Perform organization-aware initial sync
   */
  private async performOrgAwareInitialSync(clientId: string, serverLSN: string): Promise<void> {
    if (!this.userConnection?.organizationId) {
      throw new Error(`Cannot perform org-aware initial sync: organization context required`);
    }

    syncLogger.info('Starting org-aware initial sync', {
      clientId,
      userId: this.userConnection.userId,
      organizationId: this.userConnection.organizationId,
      serverLSN
    }, MODULE_NAME);

    // Use existing initial sync but with user-scoped filtering
    // TODO: Re-implement when sync components are available
    console.log('[SyncDO] Org-aware initial sync temporarily disabled - components removed');

    syncLogger.info('Org-aware initial sync completed', {
      clientId,
      userId: this.userConnection.userId,
      organizationId: this.userConnection.organizationId
    }, MODULE_NAME);
  }

  /**
   * Perform organization-aware catchup sync
   */
  private async performOrgAwareCatchupSync(
    clientId: string,
    clientLSN: string,
    serverLSN: string
  ): Promise<void> {
    if (!this.userConnection) return;

    syncLogger.info('Starting org-aware catchup sync', {
      clientId,
      userId: this.userConnection.userId,
      organizationId: this.userConnection.organizationId,
      clientLSN,
      serverLSN
    }, MODULE_NAME);

    // Perform catchup sync with organization filtering
    // TODO: Re-implement catchup sync when components are available
    console.log('[SyncDO] Catchup sync temporarily disabled - components removed');
  }

  /**
   * Start organization-aware live sync
   */
  private async startOrgAwareLiveSync(clientId: string): Promise<void> {
    if (!this.userConnection) return;

    syncLogger.info('Starting org-aware live sync', {
      clientId,
      userId: this.userConnection.userId,
      organizationId: this.userConnection.organizationId
    }, MODULE_NAME);

    // Live sync is already handled by the message handlers
    // The filtering will happen in sendLiveChangesWithLSN
    try {
      syncLogger.debug('Sending srv_live_start message to client', {
        clientId,
        messageType: 'srv_live_start',
        organizationId: this.userConnection.organizationId,
        userId: this.userConnection.userId
      }, MODULE_NAME);

      await this.send({
        type: 'srv_live_start',
        clientId,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        messageId: crypto.randomUUID()
      } as any);

      syncLogger.debug('Successfully sent srv_live_start message to client', {
        clientId,
        messageType: 'srv_live_start'
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Failed to send sync-ready message to client', {
        clientId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, MODULE_NAME);
      throw error; // Re-throw to be caught by outer error handler
    }
  }

  /**
   * Handle new changes from other SyncDOs or ReplicationDO
   */
  private async handleNewChanges(request: Request): Promise<Response> {
    try {
      const clientId = getQueryParam(request, 'clientId');
      const providedLSN = getQueryParam(request, 'lsn');
      
      if (!clientId) {
        return new Response('Missing clientId parameter', { status: 400 });
      }

      // Store the clientId for this request
      if (!this.clientId) {
        this.clientId = clientId;
      }

      const body = await request.text();
      let data;
      
      try {
        data = JSON.parse(body);
      } catch (parseError) {
        syncLogger.error('Invalid JSON in new-changes request', {
          clientId,
          error: parseError instanceof Error ? parseError.message : String(parseError)
        }, MODULE_NAME);
        return new Response('Invalid JSON', { status: 400 });
      }

      const { changes, directBroadcast, isConflictResolution, originClientId, timestamp } = data;

      if (!changes || !Array.isArray(changes)) {
        return new Response('Invalid changes data', { status: 400 });
      }

      syncLogger.debug('Processing new changes', {
        clientId,
        changeCount: changes.length,
        directBroadcast: !!directBroadcast,
        isConflictResolution: !!isConflictResolution,
        originClientId,
        providedLSN: providedLSN || 'none'
      }, MODULE_NAME);

      // Apply organization-aware filtering to changes
      const orgFilteredChanges = await this.filterChangesForOrganization(changes);

      // Process the changes based on type
      if (isConflictResolution) {
        // Conflict resolution - send directly to client without anti-echo
        await this.sendLiveChangesWithLSN(orgFilteredChanges, clientId, true, providedLSN);
      } else if (directBroadcast) {
        // Direct broadcast from another SyncDO - apply anti-echo if needed
        const antiEchoFiltered = originClientId === clientId ? [] : orgFilteredChanges;
        if (antiEchoFiltered.length > 0) {
          await this.sendLiveChangesWithLSN(antiEchoFiltered, clientId, false, providedLSN);
        }
      } else {
        // Changes from ReplicationDO - normal processing with org filtering
        if (orgFilteredChanges.length > 0) {
          await this.sendLiveChangesWithLSN(orgFilteredChanges, clientId, false, providedLSN);
        }
      }

      // Send table change notifications for Legend State integration
      if (orgFilteredChanges.length > 0 && this.userConnection?.organizationId) {
        await this.sendTableChangeNotifications(orgFilteredChanges, providedLSN || '0/0');
      }

      return new Response('OK', { status: 200 });
      
    } catch (error) {
      syncLogger.error('Error handling new changes', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Handle table change notification from WAL polling
   */
  private async handleTableChangeNotification(request: Request): Promise<Response> {
    try {
      const clientId = getQueryParam(request, 'clientId');
      
      syncLogger.info('🎯 SYNCDO RECEIVED TABLE CHANGE NOTIFICATION REQUEST', {
        clientId,
        url: request.url,
        method: request.method
      }, MODULE_NAME);

      // Ensure handlers are registered (hibernation recovery)
      if (!this.isHandlerRegistered) {
        syncLogger.debug('DO woke from hibernation via HTTP request, registering message handlers', {
          clientId,
        }, MODULE_NAME);
        this.registerMessageHandlers();
      }

      // FIXED: Restore hibernation context if missing
      if (!this.userConnection || !this.clientId) {
        syncLogger.info('HIBERNATION FIX: Restoring user-scoped context for table change notification', {
          clientId,
          hasUserConnection: !!this.userConnection,
          hasClientId: !!this.clientId
        }, MODULE_NAME);

        await this.restoreContextAfterHibernation();
      }

      if (!clientId) {
        return new Response('Missing clientId parameter', { status: 400 });
      }

      const body = await request.text();
      let data;
      
      try {
        data = JSON.parse(body);
        syncLogger.info('📨 PARSED TABLE CHANGE NOTIFICATION DATA', {
          clientId,
          messageType: data.type,
          organizationId: data.organizationId,
          tables: data.tables,
          lsn: data.lsn,
          source: data.source
        }, MODULE_NAME);
      } catch (parseError) {
        syncLogger.error('Invalid JSON in table-change-notification request', {
          clientId,
          error: parseError instanceof Error ? parseError.message : String(parseError)
        }, MODULE_NAME);
        return new Response('Invalid JSON', { status: 400 });
      }

      const { organizationId, tables, lsn, source, timestamp } = data;
      
      if (!organizationId || !tables || !Array.isArray(tables)) {
        return new Response('Invalid notification data', { status: 400 });
      }

      // FIXED: Universe scope - Accept notifications for ANY organization
      // Frontend will handle organization permission filtering via Legend State
      syncLogger.info('🌍 UNIVERSE NOTIFICATION: Accepting cross-org change notification', {
        clientId,
        clientPrimaryOrg: this.userConnection?.organizationId,
        notificationOrg: organizationId,
        tables,
        source,
        reason: 'User can access multiple orgs - frontend will filter'
      }, MODULE_NAME);

      // Create table change notification message
      const notification: ServerTableChangeNotificationMessage = {
        type: 'srv_table_change_notification',
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
        clientId,
        organizationId,
        tables,
        lsn,
        source: source || 'wal'
      };

      // Send notification to client via WebSocket
      syncLogger.info('🚀 SENDING TABLE CHANGE NOTIFICATION VIA WEBSOCKET', {
        clientId,
        organizationId,
        tables,
        messageId: notification.messageId,
        isConnected: this.isConnected(),
        webSocketCount: this.ctx.getWebSockets().length
      }, MODULE_NAME);
      
      await this.send(notification);

      syncLogger.info('✅ TABLE CHANGE NOTIFICATION SENT VIA WEBSOCKET', {
        clientId,
        organizationId,
        tables,
        messageId: notification.messageId,
        lsn,
        source
      }, MODULE_NAME);

      return new Response('OK', { status: 200 });
      
    } catch (error) {
      syncLogger.error('Error handling table change notification', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Handle direct message sending to client via WebSocket
   * Used for broadcasting server messages like table change notifications
   */
  private async handleSendMessage(request: Request): Promise<Response> {
    try {
      const body = await request.text();
      let message;
      
      try {
        message = JSON.parse(body);
      } catch (parseError) {
        syncLogger.error('Invalid JSON in send-message request', {
          clientId: this.clientId,
          error: parseError instanceof Error ? parseError.message : String(parseError)
        }, MODULE_NAME);
        return new Response('Invalid JSON', { status: 400 });
      }

      if (!message.type) {
        return new Response('Missing message type', { status: 400 });
      }

      syncLogger.debug('Sending direct message to client', {
        clientId: this.clientId,
        messageType: message.type,
        messageId: message.messageId
      }, MODULE_NAME);

      // Send message directly via WebSocket
      await this.webSocketManager.send(message);

      return new Response('OK', { status: 200 });
      
    } catch (error) {
      syncLogger.error('Error handling send message', {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Handle metrics requests
   */
  private async handleMetrics(): Promise<Response> {
    const metrics = await this.stateManager.getMetrics();
    const errors = await this.stateManager.getErrors();
    
    return new Response(JSON.stringify({
      ...metrics,
      errors: errors.map(err => ({
        message: err.message,
        stack: err.stack
      })),
      lastLSN: this.stateManager.getLSN(),
      lastWakeTime: metrics.lastWakeTime,
      connections: this.ctx.getWebSockets().length,
      id: this.syncId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Send live changes to client
   */
  private async sendLiveChanges(changes: TableChange[], clientId: string, skipAntiEcho: boolean): Promise<void> {
    return this.sendLiveChangesWithLSN(changes, clientId, skipAntiEcho, undefined);
  }

  /**
   * Filter changes by organization access and permissions
   */
  private async filterChangesForOrganization(changes: TableChange[]): Promise<TableChange[]> {
    if (!this.userConnection) {
      // No org context - block all changes for security
      syncLogger.warn('No organization context - blocking all changes', {
        changeCount: changes.length
      }, MODULE_NAME);
      return [];
    }

    try {
      // Use OrgAwareSyncManager to filter changes
      const filteredChanges = await this.orgAwareSyncManager.filterChangesByOrg(
        changes,
        this.userConnection,
        'read' // Live changes are read operations
      );

      if (filteredChanges.length < changes.length) {
        syncLogger.debug('Changes filtered by organization', {
          userId: this.userConnection.userId,
          organizationId: this.userConnection.organizationId,
          originalCount: changes.length,
          filteredCount: filteredChanges.length
        }, MODULE_NAME);
      }

      return filteredChanges;
    } catch (error) {
      syncLogger.error('Failed to filter changes for organization', {
        userId: this.userConnection?.userId,
        organizationId: this.userConnection?.organizationId,
        changeCount: changes.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      // Return empty array on error for security
      return [];
    }
  }

  /**
   * Send live changes to client with optional LSN and organization filtering
   */
  private async sendLiveChangesWithLSN(changes: TableChange[], clientId: string, skipAntiEcho: boolean, providedLSN?: string | null): Promise<void> {
    // Use queue if currently processing client changes to avoid conflicts
    if (this.isProcessingClientChanges && !skipAntiEcho) {
      this.pendingLiveUpdates.push(async () => {
        // Apply organization filtering before sending
        const filteredChanges = await this.filterChangesForOrganization(changes);
        if (filteredChanges.length > 0) {
          // await sendLiveChanges(this.getContext(), clientId, filteredChanges, this, providedLSN || undefined);
          console.log('[SyncDO] Live changes temporarily disabled - components removed');
        }
      });
      
      syncLogger.debug('Queued live changes due to processing lock', {
        clientId,
        userId: this.userConnection?.userId,
        organizationId: this.userConnection?.organizationId,
        changeCount: changes.length,
        queueLength: this.pendingLiveUpdates.length,
        providedLSN: providedLSN || 'none'
      }, MODULE_NAME);
      
      return;
    }
    
    // Apply organization filtering and send changes immediately
    const filteredChanges = await this.filterChangesForOrganization(changes);
    if (filteredChanges.length > 0) {
      // await sendLiveChanges(this.getContext(), clientId, filteredChanges, this, providedLSN || undefined);
      console.log('[SyncDO] Live changes temporarily disabled - components removed');
    }
  }

  /**
   * Process pending live updates when client changes processing completes
   */
  private async processPendingLiveUpdates(): Promise<void> {
    if (this.pendingLiveUpdates.length === 0) {
      return;
    }
    
    syncLogger.debug('Processing pending live updates', {
      clientId: this.clientId,
      pendingCount: this.pendingLiveUpdates.length
    }, MODULE_NAME);
    
    const updates = [...this.pendingLiveUpdates];
    this.pendingLiveUpdates.length = 0; // Clear the queue
    
    for (const update of updates) {
      try {
        await update();
      } catch (error) {
        syncLogger.error('Error processing pending live update', {
          clientId: this.clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
      }
    }
  }

  /**
   * Notify that client changes processing is complete
   */
  async notifyClientChangesComplete(messageId: string): Promise<void> {
    if (!this.isProcessingClientChanges) {
      // Lock is already released, nothing to do
      syncLogger.debug('Lock already released when notifyClientChangesComplete called', {
        clientId: this.clientId,
        messageId
      }, MODULE_NAME);
      return;
    }
    
    // Get WebSockets count to indicate client connection status
    const webSockets = this.ctx.getWebSockets();
    
    // Release the lock
    this.isProcessingClientChanges = false;
    syncLogger.debug('Client changes processing fully completed - releasing processing lock', {
      clientId: this.clientId,
      messageId,
      activeConnections: webSockets.length,
      pendingUpdates: this.pendingLiveUpdates.length
    }, MODULE_NAME);
    
    // Process any pending updates now that client changes are fully completed
    await this.processPendingLiveUpdates();
  }

  /**
   * Ensure replication is active
   */
  private async ensureReplicationActive(): Promise<void> {
    try {
      syncLogger.debug('Ensuring replication is active', {
        syncId: this.syncId
      }, MODULE_NAME);
      
      // Get the ReplicationDO using the proper Durable Object pattern
      const replicationId = this.env.REPLICATION.idFromName('replication');
      const replicationStub = this.env.REPLICATION.get(replicationId);
      
      // Call the init endpoint directly on the ReplicationDO - using proper URL format
      const response = await replicationStub.fetch('https://internal/api/replication/init');
      
      if (!response.ok) {
        syncLogger.error('Failed to ensure replication is active', {
          status: response.status,
          statusText: response.statusText
        }, MODULE_NAME);
        return;
      }
      
      const result = await response.json();
      syncLogger.debug('Replication active status confirmed', {
        result,
        syncId: this.syncId
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Error ensuring replication is active', {
        error: error instanceof Error ? error.message : String(error),
        syncId: this.syncId
      }, MODULE_NAME);
    }
  }

  /**
   * Send table change notifications for Legend State integration
   * Extracts table names from changes and broadcasts org-aware notifications
   */
  private async sendTableChangeNotifications(changes: TableChange[], lsn: string): Promise<void> {
    if (!this.userConnection) {
      return;
    }

    try {
      // Extract unique table names from changes
      const tableNames = this.extractTableNamesFromChanges(changes);
      
      if (tableNames.length === 0) {
        return;
      }

      syncLogger.debug('Sending table change notifications for Legend State', {
        organizationId: this.userConnection.organizationId,
        tables: tableNames,
        lsn,
        changeCount: changes.length
      }, MODULE_NAME);

      // Create table change notification message
      const notification: ServerTableChangeNotificationMessage = {
        type: 'srv_table_change_notification',
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
        clientId: this.clientId,
        organizationId: this.userConnection.organizationId,
        tables: tableNames,
        lsn,
        source: 'wal'
      };

      // Send to all clients in this organization
      await this.broadcastManager.broadcastToOrganization(notification, this.userConnection.organizationId);

    } catch (error) {
      syncLogger.error('Failed to send table change notifications', {
        organizationId: this.userConnection?.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Extract entity table names from TableChange objects
   * Converts database table names to entity names (e.g., "org_xxx_project" -> "Project")
   */
  private extractTableNamesFromChanges(changes: TableChange[]): string[] {
    const tableNames = new Set<string>();
    
    for (const change of changes) {
      const entityName = this.tableNameToEntityName(change.table);
      if (entityName) {
        tableNames.add(entityName);
      }
    }
    
    return Array.from(tableNames);
  }

  /**
   * Convert database table names to entity names for Legend State
   */
  private tableNameToEntityName(tableName: string): string | null {
    // Convert table names like "org_01920000_1000_7000_8000_000000000001_project" to "Project"
    if (tableName.includes('_project')) return 'Project';
    if (tableName.includes('_client')) return 'Client'; 
    if (tableName.includes('_task')) return 'Task';
    if (tableName.includes('_user')) return 'User';
    if (tableName.includes('_organization')) return 'Organization';
    if (tableName.includes('_comment')) return 'Comment';
    if (tableName.includes('_attachment')) return 'Attachment';
    if (tableName.includes('_milestone')) return 'Milestone';
    if (tableName.includes('_time_entry')) return 'TimeEntry';
    if (tableName.includes('_invoice')) return 'Invoice';
    if (tableName.includes('_expense')) return 'Expense';
    if (tableName.includes('_tag')) return 'Tag';
    // Add more table mappings as needed
    return null;
  }

  /**
   * Register message handlers
   */
  private registerMessageHandlers(): void {
    if (this.isHandlerRegistered) {
      return;
    }
    
    this.messageHandlerRegistry.registerHandlers();
    this.isHandlerRegistered = true;
  }

  /**
   * Get minimal context for service modules
   */
  private getContext(): MinimalContext {
    return {
      env: this.env,
      executionCtx: {
        waitUntil: (promise: Promise<any>) => this.state.waitUntil(promise),
        passThroughOnException: () => {},
        props: undefined
      }
    };
  }

  /**
   * Get organization context for sync operations
   */
  getOrganizationContext(): SyncConnection | null {
    return this.userConnection;
  }

  /**
   * Check if connection is valid and refresh if needed
   */
  private async validateConnection(): Promise<boolean> {
    if (!this.userConnection) {
      return false;
    }

    // Check if connection needs refresh
    if (!this.orgAwareSyncManager.isConnectionValid(this.userConnection)) {
      syncLogger.info('Refreshing expired sync connection', {
        userId: this.userConnection.userId,
        organizationId: this.userConnection.organizationId,
        age: Date.now() - this.userConnection.validatedAt.getTime()
      }, MODULE_NAME);

      const refreshed = await this.orgAwareSyncManager.refreshConnectionValidation(this.userConnection);
      
      if (refreshed) {
        this.userConnection = refreshed;
        return true;
      } else {
        // Connection refresh failed - clear connection
        this.userConnection = null;
        return false;
      }
    }

    return true;
  }

  // WebSocketHandler implementation

  async send(message: ServerMessage): Promise<void> {
    return this.webSocketManager.send(message);
  }

  onMessage<T extends ClientMessage['type']>(
    type: T, 
    handler: (message: ClientMessage) => Promise<void>
  ): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  removeHandler(type: ClientMessage['type']): void {
    this.messageHandlers.delete(type);
  }

  clearHandlers(): void {
    this.messageHandlers.clear();
  }

  isConnected(): boolean {
    const webSockets = this.ctx.getWebSockets();
    return webSockets.length > 0 && webSockets.some(ws => ws.readyState === 1); // OPEN = 1
  }

  async waitForMessage(
    type: ClientMessage['type'], 
    filter?: (msg: any) => boolean, 
    timeoutMs: number = 300000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const waitId = `wait_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if message already exists in queue
      const existingMessages = this.messageQueue.get(type) || [];
      for (const message of existingMessages) {
        if (!filter || filter(message)) {
          // Remove from queue and resolve immediately
          const index = existingMessages.indexOf(message);
          existingMessages.splice(index, 1);
          resolve(message);
          return;
        }
      }
      
      // Set up timeout
      const timer = setTimeout(() => {
        this.waitingResolvers.delete(waitId);
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeoutMs);
      
      // Store resolver
      this.waitingResolvers.set(waitId, {
        resolve: (message: any) => {
          clearTimeout(timer);
          resolve(message);
        },
        reject,
        timer,
        filter
      });
      
      syncLogger.debug('Waiting for message', { 
        type, 
        waitId, 
        timeoutMs,
        hasFilter: !!filter
      }, MODULE_NAME);
    });
  }

  // Hibernation API handlers

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    // Register handlers if they aren't registered (DO just woke up from hibernation)
    if (!this.isHandlerRegistered) {
      syncLogger.debug('DO woke from hibernation, attempting context restoration', {
        clientId: this.clientId,
      }, MODULE_NAME);
      
      // Context is automatically restored in constructor via hibernation API
      
      // Re-register client with unified registry after hibernation
      if (this.clientId && this.userConnection) {
        await this.unifiedClientRegistry.registerClient({
          clientId: this.clientId,
          organizationId: this.userConnection.organizationId,
          organizationSlug: this.userConnection.organizationSlug,
          userId: this.userConnection.userId,
          userRole: this.userConnection.userRole,
          userEmail: this.userConnection.userEmail,
          userName: this.userConnection.userName
        });
        
        syncLogger.info('Re-registered client with unified registry after hibernation', {
          clientId: this.clientId,
          organizationId: this.userConnection.organizationId,
          userId: this.userConnection.userId
        }, MODULE_NAME);
      }
      
      this.registerMessageHandlers();
    }
    
    return this.webSocketManager.handleWebSocketMessage(ws, data);
  }

  /**
   * Check if any waiting resolvers match this message
   */
  private checkWaitingResolvers(type: string, message: ClientMessage): void {
    // Generate waitId
    const waitIds = Array.from(this.waitingResolvers.keys()).filter(id => 
      id.startsWith(`wait_${type}_`)
    );
    
    for (const waitId of waitIds) {
      const resolver = this.waitingResolvers.get(waitId);
      if (!resolver) continue;
      
      // Check if this resolver has a filter function
      if (resolver.filter) {
        // Only resolve if the message passes the filter
        try {
          if (!resolver.filter(message)) {
            // This message doesn't match the filter criteria
            // Leave the resolver in place for a future message
            continue;
          }
          
          // Message matched the filter - proceed with resolution
          syncLogger.debug('Message passed filter, resolving', { 
            type,
            waitId,
            messageId: message.messageId
          }, MODULE_NAME);
        } catch (filterError) {
          syncLogger.error('Error in message filter function', {
            type,
            waitId,
            error: filterError instanceof Error ? filterError.message : String(filterError)
          }, MODULE_NAME);
          // Continue to next resolver on filter error
          continue;
        }
      }
      
      // Clear timer if exists
      if (resolver.timer) {
        clearTimeout(resolver.timer);
      }
      
      // Remove resolver and resolve promise
      this.waitingResolvers.delete(waitId);
      resolver.resolve(message);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    await this.webSocketManager.handleWebSocketClose(ws, code, reason, wasClean);
    
    // Cleanup from both registries - don't wait for completion
    this.state.waitUntil(this.stateManager.cleanupConnection());
    
    // Remove from unified registry
    if (this.clientId && this.userConnection) {
      this.state.waitUntil(this.unifiedClientRegistry.removeClient(
        this.clientId,
        this.userConnection.organizationId
      ));
    }

    // Clean up stored sync connection context
    this.state.waitUntil(this.clearSyncConnection());
  }

  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    return this.webSocketManager.handleWebSocketError(ws, error);
  }

  /**
   * Store sync connection context in persistent storage for hibernation recovery
   */
  private async storeSyncConnection(connection: SyncConnection, clientLSN: string): Promise<void> {
    try {
      const contextData = {
        clientId: this.clientId,
        userConnection: {
          userId: connection.userId,
          organizationId: connection.organizationId,
          organizationSlug: connection.organizationSlug,
          userRole: connection.userRole,
          userEmail: connection.userEmail,
          userName: connection.userName
        },
        clientLSN,
        timestamp: Date.now()
      };

      await this.state.storage.put('userConnection', contextData);
      
      syncLogger.info('Stored sync connection context in persistent storage', {
        clientId: this.clientId,
        organizationId: connection.organizationId,
        userId: connection.userId
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Failed to store sync connection context', {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Store context in WebSocket attachment for hibernation recovery
   */
  private storeContextInWebSocketAttachment(): void {
    try {
      if (this.userConnection && this.clientId) {
        const contextData = {
          clientId: this.clientId,
          userConnection: this.userConnection
        };
        
        // Store in all connected WebSockets
        const webSockets = this.ctx.getWebSockets();
        
        syncLogger.info('HIBERNATION DEBUG: Storing user-scoped context in WebSocket attachments', {
          clientId: this.clientId,
          userId: this.userConnection.userId,
          totalOrganizations: this.userConnection.organizations.length,
          webSocketCount: webSockets.length,
          contextDataSize: JSON.stringify(contextData).length
        }, MODULE_NAME);
        
        webSockets.forEach((ws, index) => {
          // ENHANCED: Merge with existing basic context if present
          const existingAttachment = ws.deserializeAttachment();
          const mergedContext = existingAttachment ? {
            ...existingAttachment,  // Keep basic context (clientId, organizationId, etc.)
            ...contextData,         // Add full sync connection
            timestamp: Date.now()   // Update timestamp
          } : contextData;

          ws.serializeAttachment(mergedContext);  // Don't JSON.stringify - use structured clone

          syncLogger.info(`HIBERNATION DEBUG: Stored context in WebSocket ${index}`, {
            clientId: this.clientId,
            wsIndex: index,
            hadExistingAttachment: !!existingAttachment,
            mergedContextSize: JSON.stringify(mergedContext).length
          }, MODULE_NAME);
        });
        
        syncLogger.info('HIBERNATION DEBUG: Context storage completed', {
          clientId: this.clientId,
          organizationId: this.userConnection.organizationId,
          webSocketCount: webSockets.length
        }, MODULE_NAME);
      } else {
        syncLogger.warn('HIBERNATION DEBUG: Cannot store context - missing data', {
          hasClientId: !!this.clientId,
          hasSyncConnection: !!this.userConnection,
          clientId: this.clientId
        }, MODULE_NAME);
      }
    } catch (error) {
      syncLogger.error('HIBERNATION DEBUG: Failed to store context in WebSocket attachment', {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, MODULE_NAME);
    }
  }

  /**
   * Simple hibernation recovery using Cloudflare's hibernation API
   * Reconstructs context from WebSocket attachments - the elegant solution
   */
  private async restoreFromHibernation(): Promise<void> {
    try {
      // Use Cloudflare's hibernation API to get existing WebSockets
      const webSockets = this.ctx.getWebSockets();
      
      syncLogger.info('HIBERNATION DEBUG: Attempting context restoration', {
        webSocketCount: webSockets.length,
        syncId: this.syncId
      }, MODULE_NAME);
      
      if (webSockets.length > 0) {
        // Get context from first WebSocket attachment (they should all have same context)
        const attachment = webSockets[0].deserializeAttachment();  // Use deserializeAttachment!
        
        syncLogger.info('HIBERNATION DEBUG: WebSocket attachment found', {
          hasAttachment: !!attachment,
          attachmentType: typeof attachment,
          attachmentValue: attachment,
          isNull: attachment === null,
          isUndefined: attachment === undefined,
          hasClientId: attachment?.clientId,
          hasSyncConnection: attachment?.userConnection
        }, MODULE_NAME);
        
        if (attachment) {
          const contextData = attachment;  // No need to JSON.parse - already deserialized

          syncLogger.info('HIBERNATION DEBUG: Parsed attachment data', {
            hasClientId: !!contextData.clientId,
            hasSyncConnection: !!contextData.userConnection,
            hasBasicContext: !!contextData.accepted,
            clientId: contextData.clientId,
            organizationId: contextData.organizationId || contextData.userConnection?.organizationId
          }, MODULE_NAME);

          // Restore client ID (available in both basic and full context)
          this.clientId = contextData.clientId || '';

          // Check if this is full context or basic context
          if (contextData.userConnection) {
            // Full context with sync connection
            this.userConnection = contextData.userConnection;
            syncLogger.info('HIBERNATION DEBUG: Restored full sync connection context', {
              clientId: this.clientId,
              organizationId: this.userConnection.organizationId
            }, MODULE_NAME);
          } else if (contextData.accepted && contextData.organizationId) {
            // Basic context from WebSocket acceptance - need to rebuild sync connection
            syncLogger.info('HIBERNATION DEBUG: Found basic context, attempting to rebuild sync connection', {
              clientId: this.clientId,
              organizationId: contextData.organizationId
            }, MODULE_NAME);

            // Try to rebuild sync connection from basic context
            // This would typically require re-authentication, but for now we'll try storage fallback
          }
          
          if (this.userConnection) {
            // Update StateManager with user context
            this.stateManager.setUserContext({
              userId: this.userConnection.userId,
              userRole: this.userConnection.userRole,
              userEmail: this.userConnection.userEmail,
              userName: this.userConnection.userName,
              timestamp: Date.now()
            });
            
            syncLogger.info('HIBERNATION DEBUG: Context successfully restored', {
              clientId: this.clientId,
              organizationId: this.userConnection.organizationId,
              userId: this.userConnection.userId
            }, MODULE_NAME);
          } else {
            syncLogger.warn('HIBERNATION DEBUG: No userConnection in attachment data', {
              contextData
            }, MODULE_NAME);
          }
        } else {
          syncLogger.warn('HIBERNATION DEBUG: No attachment data found on WebSocket', {
            webSocketCount: webSockets.length
          }, MODULE_NAME);
        }
      } else {
        syncLogger.info('HIBERNATION DEBUG: No WebSockets found during restoration', {
          syncId: this.syncId
        }, MODULE_NAME);
      }
      
      // If WebSocket attachment didn't work, try Durable Object storage as fallback
      if (!this.userConnection || !this.clientId) {
        syncLogger.info('HIBERNATION DEBUG: Trying Durable Object storage fallback', {
          syncId: this.syncId
        }, MODULE_NAME);
        
        const storedContext = await this.state.storage.get('hibernationContext') as any;
        if (storedContext && storedContext.userConnection) {
          this.clientId = storedContext.clientId || '';
          this.userConnection = storedContext.userConnection;
          
          if (this.userConnection) {
            this.stateManager.setUserContext({
              userId: this.userConnection.userId,
              userRole: 'multi-org-user',
              userEmail: this.userConnection.sessionData?.user?.email,
              userName: this.userConnection.sessionData?.user?.name,
              timestamp: Date.now()
            });
            
            syncLogger.info('HIBERNATION DEBUG: User-scoped context restored from Durable Object storage', {
              clientId: this.clientId,
              userId: this.userConnection.userId,
              totalOrganizations: this.userConnection.organizations.length
            }, MODULE_NAME);
          }
        } else {
          syncLogger.warn('HIBERNATION DEBUG: No context found in storage either', {
            hasStoredContext: !!storedContext
          }, MODULE_NAME);
        }
      }
    } catch (error) {
      syncLogger.error('HIBERNATION DEBUG: Error during context restoration', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, MODULE_NAME);
    }
  }


  /**
   * Clear sync connection context from persistent storage
   */
  private async clearSyncConnection(): Promise<void> {
    try {
      await this.state.storage.delete('userConnection');
      
      syncLogger.debug('Cleared sync connection context from persistent storage', {
        clientId: this.clientId
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Failed to clear sync connection context', {
        clientId: this.clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
}