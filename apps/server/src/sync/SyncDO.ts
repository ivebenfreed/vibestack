/**
 * SyncDO.ts - Improved Sync Durable Object
 * 
 * This is a refactored version of SyncDO with clearer separation of concerns:
 * - Request routing
 * - Connection management
 * - Sync strategy determination
 * - Module delegation
 * - State transitions
 */

import { SyncStateManager } from './state-manager';
import { performInitialSync } from './initial-sync';
import { performCatchupSync, sendLiveChanges, createLiveSyncConfirmation, processLiveUpdateNotification } from './server-changes';
import { IncomingChangeProcessor } from './incoming-changes/IncomingChangeProcessor';
import type { 
  ServerMessage, 
  ClientMessage,
  ClientChangesMessage,
  ServerSyncStatsMessage,
  ServerCatchupCompletedMessage
} from '@repo/sync-types';
import type { MinimalContext } from '../types/hono';
import type { Env } from '../types/env';
import { syncLogger } from '../middleware/logger';
import type { WebSocketHandler } from './types';

// Type for direct broadcast messages between SyncDOs
interface DirectBroadcastBody {
  changes: TableChange[];
  originClientId: string;
  timestamp: string;
}
import { compareLSN, deduplicateChanges, getLatestChangeHistoryLSN } from '../lib/sync-common';
import { getDBClient } from '../lib/db';
import type { TableChange } from '@repo/sync-types';

// WebSocket ready states
const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

const MODULE_NAME = 'SyncDO';

/**
 * Type of sync to perform based on client state
 */
enum SyncStrategy {
  INITIAL = 'initial',
  CATCHUP = 'catchup',
  LIVE = 'live'
}

/**
 * Helper function to extract query parameters from a request
 */
function getQueryParam(request: Request, name: string): string | null {
  const url = new URL(request.url);
  return url.searchParams.get(name);
}

/**
 * Check if LSN is in valid format
 */
function isValidLSN(lsn: string): boolean {
  // LSN is typically in format X/X where X is a hexadecimal number
  return /^[0-9A-Fa-f]+\/[0-9A-Fa-f]+$/.test(lsn) || lsn === '0/0';
}

/**
 * SyncDO is responsible for managing WebSocket connections and sync flow
 */
export class SyncDO implements DurableObject, WebSocketHandler {
  private state: DurableObjectState;
  private env: Env;
  private ctx: DurableObjectState;
  private webSocket: WebSocket | null = null;
  private stateManager: SyncStateManager;
  private clientId: string = '';
  private syncId: string;
  private messageHandlers: Map<ClientMessage['type'], Array<(message: ClientMessage) => Promise<void>>> = new Map();
  private messageQueue: Map<ClientMessage['type'], ClientMessage[]> = new Map();
  private waitingResolvers: Map<string, {
    resolve: (message: any) => void,
    reject: (error: Error) => void,
    timer: NodeJS.Timeout | null,
    filter?: (message: any) => boolean
  }> = new Map();
  private isHandlerRegistered: boolean = false;
  
  // Add processing lock to prevent race conditions
  private isProcessingClientChanges: boolean = false;
  private pendingLiveUpdates: Array<() => Promise<void>> = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.ctx = state;
    
    // Create context for state manager
    const context: MinimalContext = {
      env: this.env,
      executionCtx: {
        waitUntil: (promise: Promise<any>) => this.state.waitUntil(promise),
        passThroughOnException: () => {},
        props: undefined
      }
    };
    
    this.stateManager = new SyncStateManager(context, state as any);
    this.syncId = state.id.toString();
    
    // We no longer register handlers in the constructor
    // to prevent duplicate registrations when DO wakes from hibernation
    
    // Schedule cleanup alarm if not already set
    this.checkAndSetCleanupAlarm();
  }

  /**
   * Register message handlers only once
   */
  private registerMessageHandlers(): void {
    if (this.isHandlerRegistered) {
      syncLogger.debug('Message handlers already registered, skipping', {
        clientId: this.clientId,
      }, MODULE_NAME);
      return;
    }

    // Register message handler for client changes
    this.onMessage('clt_send_changes', async (message: ClientMessage) => {
      syncLogger.info('Received client changes', {
        type: message.type,
        messageId: message.messageId
      }, MODULE_NAME);
      
      try {
        // Ensure replication is active when clients send changes
        await this.ensureReplicationActive();
        
        // BROADCAST FIRST: Send changes to other SyncDOs before database write (primary path)
        const clientChangesMessage = message as ClientChangesMessage;
        if (clientChangesMessage.changes && clientChangesMessage.changes.length > 0) {
          await this.broadcastChangesToOtherSyncDOs(
            clientChangesMessage.changes, 
            clientChangesMessage.clientId
          );
        }
        
        // Get database connection
        const dbClient = getDBClient(this.getContext());
        
        try {
          // Connect to the database before processing
          await dbClient.connect();
          
          // Use the new IncomingChangeProcessor with conflict rebroadcast
          const processor = new IncomingChangeProcessor(
            dbClient, 
            this, // WebSocketHandler
            this.env,
            undefined, // Use default config
            async (conflictedChanges: TableChange[], originClientId: string) => {
              // Rebroadcast conflicts with isConflictResolution flag
              await this.broadcastConflictResolution(conflictedChanges, originClientId);
            }
          );
          
          await processor.processIncomingChanges(message as ClientChangesMessage);
          
          // Small delay to ensure acknowledgments are fully processed by client
          // before we start sending any live updates
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Notify that processing is complete (only after all acknowledgments are sent)
          syncLogger.info('Notifying client changes complete', {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId
          }, MODULE_NAME);
          await this.notifyClientChangesComplete(message.messageId);
          
        } finally {
          // Ensure we always close the connection
          try {
            await dbClient.end();
          } catch (err) {
            // Just silently close the connection - no need to log errors here
          }
        }
      } catch (error) {
        // Check if this is a WebSocket unavailability error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isWebSocketUnavailable = errorMessage.includes('WebSocketUnavailable') || 
                                     errorMessage.includes('No active WebSocket connections');
        
        if (isWebSocketUnavailable) {
          // Log with more specific error about client disconnection
          syncLogger.warn(`Client appears to be disconnected, cannot acknowledge changes: ${errorMessage}`, {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId
          }, MODULE_NAME);
        } else {
          // Log regular processing errors
          syncLogger.error('Error processing client changes', {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId,
            error: errorMessage
          }, MODULE_NAME);
        }
        
        // Make sure we still release the lock in case of error
        try {
          await this.notifyClientChangesComplete(message.messageId);
        } catch (notifyError) {
          // Just log, don't throw
          syncLogger.error(`Failed to notify client changes completion: ${
            notifyError instanceof Error ? notifyError.message : String(notifyError)
          }`, {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId
          }, MODULE_NAME);
        }
      }
    });

    // Add handler for catchup acknowledgments to update client LSN
    this.onMessage('clt_catchup_received', async (message: ClientMessage) => {
      // Cast to any to access the lsn property which is specific to this message type
      const catchupMessage = message as any;
      if (catchupMessage.lsn) {
        // Update the state manager with the LSN from each acknowledgment
        await this.stateManager.updateClientLSN(catchupMessage.clientId || this.clientId, catchupMessage.lsn);
        syncLogger.debug('Updated client LSN from catchup acknowledgment', {
          clientId: catchupMessage.clientId || this.clientId,
          lsn: catchupMessage.lsn
        }, MODULE_NAME);
      }
    });

    // Add handler for client heartbeats
    this.onMessage('clt_heartbeat', async (message: ClientMessage) => {
      const heartbeatMessage = message as any;
      
      syncLogger.debug('Received client heartbeat', {
        clientId: heartbeatMessage.clientId || this.clientId,
        lsn: heartbeatMessage.lsn,
        state: heartbeatMessage.state,
        active: heartbeatMessage.active
      }, MODULE_NAME);
      
      try {
        // Get current server LSN for comparison using existing function
        const context = this.getContext();
        const serverLSN = (await getLatestChangeHistoryLSN(context)) || '0/0';
        
        // Send heartbeat response with current server state
        await this.send({
          type: 'srv_heartbeat',
          clientId: heartbeatMessage.clientId || this.clientId,
          messageId: `hb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        } as any); // Type assertion since ServerHeartbeatMessage doesn't exist yet
        
        // Check for LSN gap and handle accordingly
        if (heartbeatMessage.lsn && heartbeatMessage.lsn !== serverLSN) {
          // Special case: If client has LSN 0/0, always trigger initial sync
          if (heartbeatMessage.lsn === '0/0') {
            syncLogger.warn('Client LSN is 0/0 in heartbeat - triggering initial sync', {
              clientId: heartbeatMessage.clientId || this.clientId,
              clientLSN: heartbeatMessage.lsn,
              serverLSN
            }, MODULE_NAME);
            
            // Trigger initial sync for LSN 0/0 (integrity reset scenario)
            this.state.waitUntil(this.triggerInitialSyncFromHeartbeat(
              heartbeatMessage.clientId || this.clientId,
              serverLSN
            ));
          } else {
            // Normal LSN gap analysis for non-zero LSNs
            const lsnGapResult = this.analyzeLSNGap(heartbeatMessage.lsn, serverLSN);
            
            if (lsnGapResult.shouldTriggerCatchup) {
              syncLogger.warn('Large LSN gap detected in heartbeat - triggering catchup sync', {
                clientId: heartbeatMessage.clientId || this.clientId,
                clientLSN: heartbeatMessage.lsn,
                serverLSN,
                gapSize: lsnGapResult.gapSize,
                threshold: lsnGapResult.threshold
              }, MODULE_NAME);
              
              // Trigger catchup sync for large gaps
              this.state.waitUntil(this.triggerCatchupFromHeartbeat(
                heartbeatMessage.clientId || this.clientId,
                heartbeatMessage.lsn,
                serverLSN
              ));
            } else {
              syncLogger.debug('Normal LSN gap in heartbeat - no action needed', {
                clientId: heartbeatMessage.clientId || this.clientId,
                clientLSN: heartbeatMessage.lsn,
                serverLSN,
                gapSize: lsnGapResult.gapSize,
                threshold: lsnGapResult.threshold
              }, MODULE_NAME);
            }
          }
        }
        
        // REMOVED: Don't call replication init from heartbeat
        // The cron-tester is the single source of replication heartbeat
        
      } catch (error) {
        syncLogger.error('Error processing heartbeat', {
          clientId: heartbeatMessage.clientId || this.clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        
        // Still try to send a basic heartbeat response even if LSN fetch fails
        try {
          await this.send({
            type: 'srv_heartbeat',
            clientId: heartbeatMessage.clientId || this.clientId,
            messageId: `hb_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
          } as any);
        } catch (sendError) {
          // If we can't even send a response, the connection might be broken
          syncLogger.error('Failed to send heartbeat response', {
            clientId: heartbeatMessage.clientId || this.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
        }
      }
    });

    // Add handler for integrity validation requests (both baseline and full validation)
    this.onMessage('clt_integrity_validation', async (message: ClientMessage) => {
      const validationMessage = message as any;
      
      syncLogger.info('Received integrity validation request', {
        clientId: validationMessage.clientId || this.clientId,
        currentLSN: validationMessage.currentLSN,
        tableCount: Object.keys(validationMessage.tableFingerprints || {}).length
      }, MODULE_NAME);
      
      try {
        // Import IntegrityManager for validation
        const { IntegrityManager } = await import('./integrity-manager');
        const context = this.getContext();
        const integrityManager = new IntegrityManager(context, this);
        
        // Perform validation with baseline validation support
        const result = await integrityManager.validateClientIntegrity({
          clientId: validationMessage.clientId || this.clientId,
          currentLSN: validationMessage.currentLSN,
          tableFingerprints: validationMessage.tableFingerprints,
          timestamp: validationMessage.timestamp,
          validationType: validationMessage.validationType,
          baselineTimestamp: validationMessage.baselineTimestamp,
          recordCount: validationMessage.recordCount
        });
        
        // Send response back to client
        await this.send({
          type: 'srv_integrity_validation_response',
          clientId: validationMessage.clientId || this.clientId,
          messageId: `integrity_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          isValid: result.isValid,
          issues: result.issues,
          recommendedAction: result.recommendedAction,
          serverFingerprints: result.serverFingerprints,
          validationTimestamp: result.validationTimestamp
        } as any);
        
        syncLogger.info('Integrity validation completed and response sent', {
          clientId: validationMessage.clientId || this.clientId,
          isValid: result.isValid,
          issueCount: result.issues.length,
          recommendedAction: result.recommendedAction
        }, MODULE_NAME);
        
      } catch (error) {
        syncLogger.error('Error processing integrity validation', {
          clientId: validationMessage.clientId || this.clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        
        // Send error response
        try {
          await this.send({
            type: 'srv_integrity_validation_response',
            clientId: validationMessage.clientId || this.clientId,
            messageId: `integrity_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            isValid: false,
            issues: [{
              type: 'data_corruption',
              table: 'unknown',
              severity: 'critical',
              description: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
              details: {}
            }],
            recommendedAction: 'none',
            serverFingerprints: {},
            validationTimestamp: Date.now()
          } as any);
        } catch (sendError) {
          syncLogger.error('Failed to send integrity validation error response', {
            clientId: validationMessage.clientId || this.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
        }
      }
    });

    // Add handler specifically for baseline integrity validation requests
    this.onMessage('clt_integrity_baseline_validation', async (message: ClientMessage) => {
      const validationMessage = message as any;
      
      syncLogger.info('Received baseline integrity validation request', {
        clientId: validationMessage.clientId || this.clientId,
        baselineTimestamp: validationMessage.baselineTimestamp,
        recordCount: validationMessage.recordCount,
        tableCount: Object.keys(validationMessage.fingerprints || {}).length
      }, MODULE_NAME);
      
      try {
        // Import IntegrityManager for validation
        const { IntegrityManager } = await import('./integrity-manager');
        const context = this.getContext();
        const integrityManager = new IntegrityManager(context, this);
        
        // Perform baseline validation with the baseline validation support
        const result = await integrityManager.validateClientIntegrity({
          clientId: validationMessage.clientId || this.clientId,
          currentLSN: validationMessage.currentLSN,
          tableFingerprints: validationMessage.fingerprints,
          timestamp: validationMessage.timestamp,
          validationType: 'baseline_incremental', // Force baseline validation type
          baselineTimestamp: validationMessage.baselineTimestamp,
          recordCount: validationMessage.recordCount?.totalChanges || 0
        });
        
        // Send response back to client
        await this.send({
          type: 'srv_integrity_validation_response',
          clientId: validationMessage.clientId || this.clientId,
          messageId: `baseline_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          isValid: result.isValid,
          issues: result.issues,
          recommendedAction: result.recommendedAction,
          serverFingerprints: result.serverFingerprints,
          validationTimestamp: result.validationTimestamp
        } as any);
        
        syncLogger.info('Baseline integrity validation completed and response sent', {
          clientId: validationMessage.clientId || this.clientId,
          isValid: result.isValid,
          issueCount: result.issues.length,
          recommendedAction: result.recommendedAction
        }, MODULE_NAME);
        
      } catch (error) {
        syncLogger.error('Error processing baseline integrity validation', {
          clientId: validationMessage.clientId || this.clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        
        // Send error response
        try {
          await this.send({
            type: 'srv_integrity_validation_response',
            clientId: validationMessage.clientId || this.clientId,
            messageId: `baseline_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            isValid: false,
            issues: [{
              type: 'data_corruption',
              table: 'unknown',
              severity: 'critical',
              description: `Baseline validation failed: ${error instanceof Error ? error.message : String(error)}`,
              details: {}
            }],
            recommendedAction: 'none',
            serverFingerprints: {},
            validationTimestamp: Date.now()
          } as any);
        } catch (sendError) {
          syncLogger.error('Failed to send baseline integrity validation error response', {
            clientId: validationMessage.clientId || this.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
        }
      }
    });

    this.isHandlerRegistered = true;
    syncLogger.info('Message handlers registered', {
      clientId: this.clientId,
    }, MODULE_NAME);
  }

  /**
   * Main handler for all requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Route requests based on path
      if (path === '/api/sync') {
        // This is the main WebSocket connect point from index.ts
        return this.handleWebSocketUpgrade(request);
      } else if (path.startsWith('/api/sync/ws')) {
        // Legacy path, also handle WebSocket
        return this.handleWebSocketUpgrade(request);
      } else if (path === '/api/sync/new-changes' || path === '/new-changes') {
        // Handle both paths for backward compatibility
        return this.handleNewChanges(request);
      } else if (path === '/api/sync/metrics' || path === '/metrics') {
        // Handle both paths for metrics too
        return this.handleMetrics();
      } else if (path === '/sync-stats' || path === '/api/sync/sync-stats') {
        // Handle sync stats messages from process-changes
        return this.handleSyncStats(request);
      } else if (path === '/broadcast') {
        // Handle direct SyncDO-to-SyncDO broadcast
        return this.handleDirectBroadcast(request);
      } else {
        // No route matched
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      syncLogger.error('Request handling error', {
        path,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, MODULE_NAME);
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle WebSocket upgrade requests
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // Extract parameters
    let clientId = getQueryParam(request, 'clientId');
    let clientLSN = getQueryParam(request, 'lsn');
    
    // Log request parameters
    syncLogger.info('WebSocket connection request', {
      clientId,
      lsn: clientLSN
    }, MODULE_NAME);
    
    // Basic validation
    if (!clientId) {
      return new Response('Missing clientId parameter', { status: 400 });
    }
    
    // Validate LSN if provided
    if (clientLSN && !isValidLSN(clientLSN)) {
      syncLogger.error('Invalid LSN format', {
        clientId,
        lsn: clientLSN
      }, MODULE_NAME);
      return new Response('Invalid LSN format', { status: 400 });
    }
    
    // If LSN is missing, default to initial sync with explicit 0/0
    if (!clientLSN) {
      clientLSN = '0/0';
      syncLogger.info('No LSN provided, will perform initial sync', {
        clientId
      }, MODULE_NAME);
    }
    
    // Set up WebSocket
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    // Store client ID
    this.clientId = clientId;

    // Configure WebSocket with hibernation API
    this.ctx.acceptWebSocket(server);
    
    // Register message handlers only once per clientId
    this.registerMessageHandlers();
    
    // Store the client LSN for use after connection is established
    const finalClientId = clientId;
    const finalClientLSN = clientLSN;
    
    // Start sync process AFTER connection is fully established
    this.state.waitUntil((async () => {
      try {
        // Wait for WebSocket to be fully established
        // Use a more reliable way to check connection status
        let retries = 0;
        const maxRetries = 10;
        const retryDelay = 100;

        while (retries < maxRetries) {
          const webSockets = this.ctx.getWebSockets();
          if (webSockets.length > 0 && webSockets[0].readyState === WS_READY_STATE.OPEN) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retries++;
        }

        if (retries >= maxRetries) {
          throw new Error('WebSocket connection failed to establish within timeout');
        }
        
        // Determine sync strategy and perform sync
        const { strategy, serverLSN } = await this.determineSyncStrategy(finalClientId, finalClientLSN);
        await this.performSync({ strategy, serverLSN }, finalClientId, finalClientLSN);
      } catch (error) {
        syncLogger.error('WebSocket sync error', {
          clientId: finalClientId,
          lsn: finalClientLSN,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
      }
    })());
    
    // Return the client WebSocket IMMEDIATELY to establish the connection
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketEventHandlers(ws: WebSocket): void {
    // When using hibernation API, we don't need event listeners here
    // Event handling will be done via the webSocketMessage, webSocketClose, etc. methods
    
    // Keep track of active WebSocket for sending methods
    this.webSocket = ws;
  }
  
  /**
   * WebSocket message handler for hibernation API
   */
  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    // Register handlers if they aren't registered (DO just woke up from hibernation)
    if (!this.isHandlerRegistered) {
      syncLogger.info('DO woke from hibernation, registering message handlers', {
        clientId: this.clientId,
      }, MODULE_NAME);
      this.registerMessageHandlers();
    }
    
    try {
      // Convert data to string if it's ArrayBuffer
      const messageStr = typeof data === 'string' ? data : new TextDecoder().decode(data);
      const message = JSON.parse(messageStr) as ClientMessage;
      
      // Store in message queue for waitForMessage
      if (!this.messageQueue.has(message.type)) {
        this.messageQueue.set(message.type, []);
      }
      this.messageQueue.get(message.type)!.push(message);
      
      // Check if someone is waiting for this message type
      this.checkWaitingResolvers(message.type, message);
      
      // Check if this is a client changes message, if so, set the processing lock
      if (message.type === 'clt_send_changes') {
        this.isProcessingClientChanges = true;
        syncLogger.info('Client changes processing started - setting processing lock', {
          clientId: this.clientId,
          messageId: message.messageId
        }, MODULE_NAME);
      }
      
      // Process handlers for this message type
      const handlers = this.messageHandlers.get(message.type) || [];
      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (handlerError) {
          syncLogger.error('Handler error', {
            type: message.type,
            error: handlerError instanceof Error ? handlerError.message : String(handlerError)
          }, MODULE_NAME);
          
          // If this was a client changes message and it failed, release the lock
          // Note: We're not releasing the lock here anymore - lock will be released
          // after acknowledgments are sent via notifyClientChangesComplete
          if (message.type === 'clt_send_changes' && 
              (handlerError instanceof Error && !handlerError.message.includes('WebSocketUnavailable'))) {
            // For non-WebSocket errors, release lock immediately
            this.isProcessingClientChanges = false;
            syncLogger.info('Client changes processing failed - releasing processing lock', {
              clientId: this.clientId,
              messageId: message.messageId
            }, MODULE_NAME);
            
            // Process any pending updates
            this.processPendingLiveUpdates();
          }
        }
      }
      
      // Note: We no longer automatically release the lock here after processing client changes
      // It will be released via notifyClientChangesComplete after acks are sent
    } catch (error) {
      syncLogger.error('Message parse error', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * WebSocket close handler for hibernation API
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Log websocket closure
    syncLogger.info('WebSocket closed', {
      clientId: this.clientId || 'no-client-id',
      code,
      reason: reason || 'No reason specified',
      wasClean
    }, MODULE_NAME);
    
    // Clear WebSocket reference
    this.webSocket = null;
    
    // Mark client as inactive in KV - don't wait for completion
    this.state.waitUntil(this.stateManager.cleanupConnection());
    
    // We don't clear the clientId since it's properly persisted
    // and may be needed for additional operations
  }
  
  /**
   * WebSocket error handler for hibernation API
   */
  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    syncLogger.error('WebSocket error', {
      clientId: this.clientId,
      error: error.message,
      stack: error.stack
    }, MODULE_NAME);
    
    this.webSocket = null;
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
      
      // Resolve with the message
      resolver.resolve(message);
      
      // Remove from waiting resolvers
      this.waitingResolvers.delete(waitId);
    }
  }

  /**
   * Handle incoming WebSocket messages - this is replaced by webSocketMessage with hibernation API
   * Keeping the method for backward compatibility but it won't be called
   */
  private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
    // This won't be called with hibernation API
    syncLogger.warn('handleWebSocketMessage called but using hibernation API', {}, MODULE_NAME);
  }
  
  /**
   * Determine which sync strategy to use based on client state
   */
  private async determineSyncStrategy(
    clientId: string, 
    clientLSN: string
  ): Promise<{ strategy: SyncStrategy, serverLSN: string }> {
    // Ensure replication is active when client connects
    await this.ensureReplicationActive();
    
    // Register the client
    await this.stateManager.registerClient(clientId);
    
    // Store the client's LSN
    await this.stateManager.updateClientLSN(clientId, clientLSN);
    
    // Message handler for client changes is already registered in the constructor
    
    // Get the current server LSN from change_history, default to '0/0'
    const context = this.getContext(); // Get context for DB query
    const serverLSN = (await getLatestChangeHistoryLSN(context)) || '0/0';
    
    // If client has no LSN (0/0), it needs initial sync
    if (clientLSN === '0/0') {
      syncLogger.info('Client needs initial sync', {
        clientId
      }, MODULE_NAME);
      return { strategy: SyncStrategy.INITIAL, serverLSN };
    }
    
    // If client LSN is behind server LSN, client needs catchup sync
    if (compareLSN(clientLSN, serverLSN) < 0) {
      syncLogger.info('Client needs catchup sync', {
        clientId,
        clientLSN,
        serverLSN
      }, MODULE_NAME);
      return { strategy: SyncStrategy.CATCHUP, serverLSN };
    }
    
    // Client is up to date
    syncLogger.info('Client is up to date', {
      clientId,
      lsn: clientLSN
    }, MODULE_NAME);
    return { strategy: SyncStrategy.LIVE, serverLSN };
  }
  
  /**
   * Perform the appropriate sync based on determined strategy
   */
  private async performSync(
    { strategy, serverLSN }: { strategy: SyncStrategy, serverLSN: string },
    clientId: string,
    lsn: string
  ): Promise<void> {
    const context = this.getContext();
    
    switch (strategy) {
      case SyncStrategy.INITIAL:
        // Update sync state
        await this.stateManager.updateClientSyncState(clientId, 'initial');
        
        // Perform initial sync
        await performInitialSync(
          context,
          this,  // WebSocketHandler - we implement this interface now
          this.stateManager,
          clientId
        );
        
        // After initial sync completes, get the current client and server LSNs
        // to determine if catchup sync is needed
        const updatedClientLSN = await this.stateManager.getLSN() || '0/0';
        const currentServerLSN = await this.stateManager.getServerLSN();
        
        syncLogger.info('Initial sync completed, checking if catchup sync is needed', {
          clientId,
          updatedClientLSN,
          currentServerLSN
        }, MODULE_NAME);
        
        // If client LSN is still behind server LSN, perform catchup sync
        if (compareLSN(updatedClientLSN, currentServerLSN) < 0) {
          syncLogger.info('Starting automatic catchup sync after initial sync', {
            clientId,
            clientLSN: updatedClientLSN,
            serverLSN: currentServerLSN
          }, MODULE_NAME);
          
          // Update client's sync state in storage
          await this.stateManager.updateClientSyncState(clientId, 'catchup');
          
          // Perform catchup sync with both LSNs
          await performCatchupSync(
            context,
            clientId,
            updatedClientLSN,   // Use updated client LSN after initial sync
            currentServerLSN,   // Use current server LSN
            this,
            this.stateManager
          );
        } else {
          // Client is up to date after initial sync, proceed to live sync
          syncLogger.info('Client is up to date after initial sync, transitioning to live', {
            clientId,
            lsn: updatedClientLSN
          }, MODULE_NAME);
          
          // Update sync state (server-side)
          await this.stateManager.updateClientSyncState(clientId, 'live');
          
          // Send a live start message as the client is now up-to-date
          syncLogger.info('Sending live start message as catchup was skipped', { clientId, lsn: updatedClientLSN }, MODULE_NAME);
          const liveStartMsg = createLiveSyncConfirmation(clientId, updatedClientLSN);
          await this.send(liveStartMsg);
        }
        break;
        
      case SyncStrategy.CATCHUP:
        // Update client's sync state in storage (this just updates internal state
        // and doesn't send any WebSocket messages)
        await this.stateManager.updateClientSyncState(clientId, 'catchup');
        
        // Perform catchup sync with both LSNs
        await performCatchupSync(
          context,
          clientId,
          lsn,           // Client LSN
          serverLSN,     // Server LSN - already retrieved by determineSyncStrategy
          this,
          this.stateManager
        );
        break;
        
      case SyncStrategy.LIVE:
        // Update sync state
        await this.stateManager.updateClientSyncState(clientId, 'live');
        
        // Send confirmation message for live sync
        const liveSyncMessage = createLiveSyncConfirmation(clientId, lsn);
        await this.send(liveSyncMessage);
        
        syncLogger.info('Live sync confirmed', {
          clientId,
          lsn
        }, MODULE_NAME);
        break;
    }
  }
  
  /**
   * Handle new changes notification
   */
  private async handleNewChanges(request: Request): Promise<Response> {
    // Extract parameters from request
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId')!;
    const lsnFromUrl = url.searchParams.get('lsn');

    if (!clientId) {
      return new Response('Client ID is required', { status: 400 });
    }

    // Parse request body to check for pushed changes
    let body: any = {};
    try {
      const rawBody = await request.text();
      if (rawBody) {
        body = JSON.parse(rawBody);
      }
    } catch (error) {
      syncLogger.error('Failed to parse request body', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }

    syncLogger.info('Raw request body contents', {
      clientId,
      body: body,
      bodyKeys: Object.keys(body),
      bodyType: typeof body
    }, MODULE_NAME);

    let lsnFromBody, changeCount, pushedChanges, directBroadcast, originClientId, isConflictResolution;
    try {
      ({ lsn: lsnFromBody, changeCount, changes: pushedChanges, directBroadcast, originClientId, isConflictResolution } = body);
    } catch (destructuringError) {
      syncLogger.error('Failed to destructure request body', {
        clientId,
        body: body,
        error: destructuringError instanceof Error ? destructuringError.message : String(destructuringError)
      }, MODULE_NAME);
      return new Response('Bad Request', { status: 400 });
    }

    syncLogger.info('Parsed request body for broadcast check', {
      directBroadcast,
      isConflictResolution,
      hasPushedChanges: !!pushedChanges,
      pushedChangesLength: pushedChanges?.length,
      conditionResult: !!(directBroadcast || isConflictResolution) && !!pushedChanges
    }, MODULE_NAME);

    // Handle direct broadcast OR conflict resolution from another SyncDO
    if ((directBroadcast || isConflictResolution) && pushedChanges) {
      syncLogger.info(`Received ${isConflictResolution ? 'conflict resolution' : 'direct broadcast'} via new-changes route`, {
        targetClientId: clientId,
        originClientId,
        changeCount: pushedChanges.length,
        isConflictResolution: !!isConflictResolution,
        tables: [...new Set(pushedChanges.map((change: TableChange) => change.table))].join(', '),
        operations: pushedChanges.map((change: TableChange) => `${change.table}:${change.operation}`).join(', ')
      }, MODULE_NAME);

      // Forward changes to connected client immediately
      // Use Cloudflare's hibernation API to get active WebSocket connections
      const webSockets = this.ctx.getWebSockets();
      const activeWebSocket = webSockets.length > 0 ? webSockets[0] : null;
      
      syncLogger.info('WebSocket forwarding check', {
        targetClientId: clientId,
        totalWebSockets: webSockets.length,
        hasActiveWebSocket: !!activeWebSocket,
        activeWebSocketState: activeWebSocket?.readyState,
        expectedState: WS_READY_STATE.OPEN,
        willForward: !!(activeWebSocket && activeWebSocket.readyState === WS_READY_STATE.OPEN)
      }, MODULE_NAME);
      
      if (activeWebSocket && activeWebSocket.readyState === WS_READY_STATE.OPEN) {
        const liveChangesMessage = {
          type: 'srv_live_changes',
          messageId: `${isConflictResolution ? 'conflict_resolution' : 'direct_broadcast'}_${Date.now()}`,
          timestamp: Date.now(),
          clientId: this.clientId,
          changes: pushedChanges,
          lastLSN: '', // LSN will be updated later via WAL if needed
          isConflictResolution: !!isConflictResolution // Pass through the flag
        };

        activeWebSocket.send(JSON.stringify(liveChangesMessage));
        
        syncLogger.info(`Forwarded ${isConflictResolution ? 'conflict resolution' : 'direct broadcast'} changes to client`, {
          originClientId,
          targetClientId: this.clientId,
          changeCount: pushedChanges.length,
          isConflictResolution: !!isConflictResolution,
          messageType: liveChangesMessage.type,
          messageId: liveChangesMessage.messageId,
          tables: [...new Set(pushedChanges.map((change: TableChange) => change.table))].join(', '),
          operations: pushedChanges.map((change: TableChange) => `${change.table}:${change.operation}`).join(', ')
        }, MODULE_NAME);
      } else {
        syncLogger.debug('Cannot forward broadcast - no active WebSocket', {
          targetClientId: this.clientId,
          totalWebSockets: webSockets.length,
          hasActiveWebSocket: !!activeWebSocket,
          activeWebSocketState: activeWebSocket?.readyState
        }, MODULE_NAME);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    syncLogger.info('Received new changes notification', {
      clientId,
      lsnFromUrl,
      lsnFromBody,
      hasPushedChanges: !!pushedChanges,
      pushedChangeCount: pushedChanges?.length || 0
    }, MODULE_NAME);

    // Set the client ID if it's not already set
    if (!this.clientId) {
      this.clientId = clientId;
      await this.stateManager.registerClient(clientId);
    }

    // Check if client changes are being processed (for queuing logic)
    if (this.isProcessingClientChanges) {
      // If we have pushed changes, we need to modify the queued handler to use them
      if (pushedChanges && Array.isArray(pushedChanges)) {
        syncLogger.info('Client is currently processing changes, queuing live push update', {
          clientId,
          pushedChangeCount: pushedChanges.length
        }, MODULE_NAME);
        
        // Create a promise for the response
        const responsePromise = new Promise<Response>((resolve) => {
          // Add to pending updates queue
          this.pendingLiveUpdates.push(async () => {
            try {
              // Import and use the new push handler
              const { handlePushedLiveChanges } = await import('./live-push');
              
              const result = await handlePushedLiveChanges(
                pushedChanges,
                lsnFromBody || '0/0',
                clientId,
                this
              );
              
              // Update client's LSN if successful
              if (result.success && this.clientId === clientId) {
                await this.stateManager.updateClientLSN(clientId, result.finalLSN);
              }
              
              // Resolve with success response
              resolve(new Response(JSON.stringify({
                success: result.success,
                notified: true,
                changeCount: result.changeCount,
                lsn: result.finalLSN,
                queued: true,
                method: 'push'
              }), {
                status: result.success ? 200 : 500,
                headers: { 'Content-Type': 'application/json' }
              }));
            } catch (error) {
              // Check if this is a WebSocket unavailability error
              const errorMessage = error instanceof Error ? error.message : String(error);
              const isWebSocketUnavailable = errorMessage.includes('WebSocketUnavailable') || 
                                          errorMessage.includes('No active WebSocket connections');
              
              if (isWebSocketUnavailable) {
                // Clean up client
                await this.stateManager.cleanupConnection();
                
                // Resolve with WebSocket unavailable response
                resolve(new Response(JSON.stringify({
                  success: false,
                  notified: false,
                  error: 'Client has no active WebSocket connection',
                  cleaned: true,
                  queued: true,
                  method: 'push'
                }), {
                  status: 410,
                  headers: { 'Content-Type': 'application/json' }
                }));
              } else {
                // Resolve with error response
                resolve(new Response(JSON.stringify({
                  success: false,
                  error: 'Failed to process queued live push update',
                  details: errorMessage,
                  queued: true,
                  method: 'push'
                }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
                }));
              }
            }
          });
        });
        
        return responsePromise;
      }
      
      // Fall through to existing queuing logic for pull-based updates
    }

    // Fast path: If changes are provided, use the new push handler
    if (pushedChanges && Array.isArray(pushedChanges)) {
      syncLogger.info('Using pushed changes from ReplicationDO', {
        clientId,
        changeCount: pushedChanges.length,
        method: 'push'
      }, MODULE_NAME);

      try {
        // Get all active WebSocket connections first
        const webSockets = this.ctx.getWebSockets();
        
        // If there are no active WebSockets, this client is disconnected
        if (webSockets.length === 0) {
          syncLogger.info('Client has no active WebSocket connection, cleaning up', {
            clientId
          }, MODULE_NAME);
          
          // Clean up client registration
          await this.stateManager.cleanupConnection();
          
          return new Response(JSON.stringify({
            success: false,
            notified: false,
            error: 'Client has no active WebSocket connection',
            cleaned: true,
            method: 'push'
          }), {
            status: 410,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Import and use the new push handler
        const { handlePushedLiveChanges } = await import('./live-push');
        
        const result = await handlePushedLiveChanges(
          pushedChanges,
          lsnFromBody || (await getLatestChangeHistoryLSN(this.getContext())) || '0/0',
          clientId,
          this
        );

        // Update client's LSN if successful
        if (result.success && this.clientId === clientId) {
          await this.stateManager.updateClientLSN(clientId, result.finalLSN);
          syncLogger.debug('Updated client LSN from pushed live changes', {
            clientId,
            newLSN: result.finalLSN
          }, MODULE_NAME);
        }

        return new Response(JSON.stringify({
          success: result.success,
          notified: true,
          changeCount: result.changeCount,
          lsn: result.finalLSN,
          method: 'push'
        }), {
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        // Handle WebSocket unavailable errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('WebSocketUnavailable')) {
          await this.stateManager.cleanupConnection();
          return new Response(JSON.stringify({
            success: false,
            notified: false,
            error: 'Client has no active WebSocket connection',
            cleaned: true,
            method: 'push'
          }), {
            status: 410,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        syncLogger.error('Unexpected error handling pushed changes', {
          clientId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }, MODULE_NAME);
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to process pushed changes',
          details: errorMessage,
          method: 'push'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Fallback: Use existing pull-based logic
    syncLogger.info('Using pull-based notification (no changes provided)', {
      clientId,
      method: 'pull'
    }, MODULE_NAME);

    // Get server LSN from change_history, default to '0/0'
    const ctx = this.getContext(); // Get context for DB query
    const serverLSN = (await getLatestChangeHistoryLSN(ctx)) || '0/0';
    syncLogger.info('Processing changes notification', {
      clientId,
      serverLSN
    }, MODULE_NAME);

    let clientLSN: string;
    try {
      // Use getLSN from state manager
      clientLSN = await this.stateManager.getLSN() || '0/0';
    } catch (error) {
      syncLogger.error('Failed to get client LSN for notification', { clientId }, MODULE_NAME);
      clientLSN = '0/0';
    }

    // Check if client changes are being processed
    if (this.isProcessingClientChanges) {
      syncLogger.info('Client is currently processing changes, queuing live update', {
        clientId,
        serverLSN
      }, MODULE_NAME);
      
      // Create a promise for the response
      const responsePromise = new Promise<Response>((resolve) => {
        // Add to pending updates queue
        this.pendingLiveUpdates.push(async () => {
          try {
            // Process live update
            const result = await processLiveUpdateNotification(
              ctx,
              clientId,
              clientLSN,
              serverLSN,
              this
            );
            
            // Update client's LSN if successful
            if (result.success && this.clientId === clientId) {
               await this.stateManager.updateClientLSN(clientId, result.finalLSN);
            }
            
            // Resolve with success response
            resolve(new Response(JSON.stringify({
              success: result.success,
              notified: true,
              changeCount: result.changeCount,
              lsn: result.finalLSN,
              queued: true
            }), {
              status: result.success ? 200 : 500,
              headers: { 'Content-Type': 'application/json' }
            }));
          } catch (error) {
            // Check if this is a WebSocket unavailability error
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isWebSocketUnavailable = errorMessage.includes('WebSocketUnavailable') || 
                                        errorMessage.includes('No active WebSocket connections');
            
            if (isWebSocketUnavailable) {
              // Clean up client
              await this.stateManager.cleanupConnection();
              
              // Resolve with WebSocket unavailable response
              resolve(new Response(JSON.stringify({
                success: false,
                notified: false,
                error: 'Client has no active WebSocket connection',
                cleaned: true,
                queued: true
              }), {
                status: 410,
                headers: { 'Content-Type': 'application/json' }
              }));
            } else {
              // Resolve with error response
              resolve(new Response(JSON.stringify({
                success: false,
                error: 'Failed to process queued live update notification',
                details: errorMessage,
                queued: true
              }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              }));
            }
          }
        });
      });
      
      return responsePromise;
    }

    // Normal (non-queued) processing path
    try {
      // Get all active WebSocket connections
      const webSockets = this.ctx.getWebSockets();
      
      // If there are no active WebSockets, this client is disconnected
      // Handle cleanup here instead of in webSocketClose to avoid errors
      if (webSockets.length === 0) {
        syncLogger.info('Client has no active WebSocket connection, cleaning up', {
          clientId
        }, MODULE_NAME);
        
        // Clean up client registration
        await this.stateManager.cleanupConnection();
        
        return new Response(JSON.stringify({
          success: false,
          notified: false,
          error: 'Client has no active WebSocket connection',
          cleaned: true
        }), {
          status: 410,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Call the dedicated function in server-changes to process the notification
      const result = await processLiveUpdateNotification(
        ctx,
        clientId,
        clientLSN,
        serverLSN,
        this // Pass SyncDO instance as the WebSocketHandler
      );
      
      // Update client's LSN if successful and this is our client
      if (result.success && this.clientId === clientId) {
         await this.stateManager.updateClientLSN(clientId, result.finalLSN);
         syncLogger.debug('Updated client LSN from live sync notification handler', {
            clientId,
            newLSN: result.finalLSN
         }, MODULE_NAME);
      }
      
      // Return success response based on the result
      return new Response(JSON.stringify({
        success: result.success,
        notified: true, // Indicate notification was processed
        changeCount: result.changeCount,
        lsn: result.finalLSN
      }), {
        status: result.success ? 200 : 500, // Use 500 if processing failed
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      // Check if this is a WebSocket unavailability error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isWebSocketUnavailable = errorMessage.includes('WebSocketUnavailable') || 
                                   errorMessage.includes('No active WebSocket connections');
      
      // If WebSocket is unavailable, clean up the client registration
      if (isWebSocketUnavailable) {
        syncLogger.warn('Client has no active WebSocket connection, cleaning up registration', {
          clientId,
          errorMessage
        }, MODULE_NAME);
        
        try {
          // Clean up this client's registration - be explicit about which client
          await this.stateManager.cleanupConnection();
          
          // Log cleanup success
          syncLogger.info('Successfully cleaned up disconnected client registration', {
            clientId,
            timestamp: Date.now()
          }, MODULE_NAME);
          
          return new Response(JSON.stringify({
            success: false,
            notified: false,
            error: 'Client has no active WebSocket connection',
            cleaned: true
          }), {
            status: 410, // Gone - indicates the resource is no longer available
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (cleanupError) {
          // Log cleanup failure but still return 410
          syncLogger.error('Failed to clean up disconnected client registration', {
            clientId,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }, MODULE_NAME);
          
          return new Response(JSON.stringify({
            success: false,
            notified: false,
            error: 'Client has no active WebSocket connection',
            cleaned: false,
            cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }), {
            status: 410, // Still use Gone status
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Handle other errors
      syncLogger.error('Unexpected error handling changes notification', {
        clientId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }, MODULE_NAME);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to process changes notification',
        details: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle metrics request
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
      connections: this.webSocket ? 1 : 0,
      id: this.syncId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  /**
   * Create a minimal context for use with other modules
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
  
  // WebSocketHandler implementation
  
  /**
   * Send a message to the client using type-safe interface
   */
  async send(message: ServerMessage): Promise<void> {
    try {
      // Get all active WebSocket connections
      const webSockets = this.ctx.getWebSockets();
      
      if (webSockets.length === 0) {
        syncLogger.warn('No active WebSocket connections', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.clientId
        }, MODULE_NAME);
        // Throw an error with a consistent message format that's easy to detect
        throw new Error('WebSocketUnavailable: No active WebSocket connections for client ' + this.clientId);
      }
      
      // Add detailed logging for table changes messages to debug null/object conversion
      if (message.type === 'srv_live_changes' || message.type === 'srv_catchup_changes') {
        const changesMessage = message as any;
        if (changesMessage.changes && Array.isArray(changesMessage.changes)) {
          console.log('[SyncDO] Sending table changes:', {
            messageType: message.type,
            clientId: this.clientId,
            changeCount: changesMessage.changes.length,
            changes: changesMessage.changes.map((change: any, index: number) => ({
              index,
              table: change.table,
              operation: change.operation,
              dataKeys: Object.keys(change.data || {}),
              estimatedDuration: {
                value: change.data?.estimatedDuration,
                type: typeof change.data?.estimatedDuration,
                isNull: change.data?.estimatedDuration === null,
                isUndefined: change.data?.estimatedDuration === undefined,
                stringified: JSON.stringify(change.data?.estimatedDuration)
              },
              timeRange: {
                value: change.data?.timeRange,
                type: typeof change.data?.timeRange,
                isNull: change.data?.timeRange === null,
                isUndefined: change.data?.timeRange === undefined,
                stringified: JSON.stringify(change.data?.timeRange)
              }
            }))
          });
        }
      }
      
      // Enhanced logging for acknowledgment messages (at DEBUG level to reduce noise)
      const isAcknowledgment = message.type === 'srv_changes_received' || 
                             message.type === 'srv_changes_applied';
      
      if (isAcknowledgment) {
        syncLogger.debug('Sending acknowledgment message', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.clientId,
          connectionCount: webSockets.length,
          isProcessingLocked: this.isProcessingClientChanges
        }, MODULE_NAME);
      } else {
        // Regular debug log for other messages
        syncLogger.debug('Sending message', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.clientId,
          connectionCount: webSockets.length
        }, MODULE_NAME);
      }
      
      // Send to all active connections
      for (const ws of webSockets) {
        try {
          // Log BEFORE sending for live changes to track hibernation issues
          if (message.type === 'srv_live_changes') {
            syncLogger.info('Attempting to send live changes message to WebSocket', {
              type: message.type,
              messageId: message.messageId,
              clientId: this.clientId,
              wsReadyState: ws.readyState,
              wsReadyStateLabel: ws.readyState === 0 ? 'CONNECTING' : 
                                 ws.readyState === 1 ? 'OPEN' : 
                                 ws.readyState === 2 ? 'CLOSING' : 'CLOSED'
            }, MODULE_NAME);
          }
          
          ws.send(JSON.stringify(message));
          
          // Log success at INFO level for live changes, DEBUG for others
          if (message.type === 'srv_live_changes') {
            syncLogger.info('Live changes message sent successfully to WebSocket', {
              type: message.type,
              messageId: message.messageId,
              clientId: this.clientId,
              wsReadyState: ws.readyState
            }, MODULE_NAME);
          } else {
            syncLogger.debug('Message sent successfully', {
              type: message.type,
              messageId: message.messageId,
              clientId: this.clientId
            }, MODULE_NAME);
          }
        } catch (sendError) {
          syncLogger.error('Error sending message to WebSocket', {
            type: message.type,
            messageId: message.messageId,
            clientId: this.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
          throw sendError;
        }
      }
    } catch (error) {
      syncLogger.error('Unexpected error in send method', {
        type: message.type,
        messageId: message.messageId,
        clientId: this.clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }
  
  /**
   * Register a message handler for a specific message type
   */
  onMessage<T extends ClientMessage['type']>(
    type: T, 
    handler: (message: ClientMessage) => Promise<void>
  ): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)!.push(handler);
    
    syncLogger.debug('Registered message handler', { 
      type,
      handlersCount: this.messageHandlers.get(type)!.length
    }, MODULE_NAME);
  }
  
  /**
   * Remove a message handler for a specific type
   */
  removeHandler(type: ClientMessage['type']): void {
    this.messageHandlers.delete(type);
    syncLogger.debug('Removed all handlers for type', { type }, MODULE_NAME);
  }
  
  /**
   * Clear all message handlers
   */
  clearHandlers(): void {
    this.messageHandlers.clear();
    syncLogger.debug('Cleared all message handlers', {}, MODULE_NAME);
  }
  
  /**
   * Check if the WebSocket is connected
   */
  isConnected(): boolean {
    return this.webSocket !== null && this.webSocket.readyState === WS_READY_STATE.OPEN;
  }
  
  /**
   * Wait for a specific message type from client
   */
  async waitForMessage(
    type: ClientMessage['type'], 
    filter?: ((msg: any) => boolean) | undefined, 
    timeoutMs: number = 300000  // Increased timeout to 5 minutes to accommodate larger data processing on client
  ): Promise<any> {
    // Check if we already have a message of this type in the queue
    const existingMessages = this.messageQueue.get(type) || [];
    
    // If we have messages and no filter, return the first one
    if (existingMessages.length > 0 && !filter) {
      const message = existingMessages.shift();
      return message;
    }
    
    // If we have messages and a filter, check if any match
    if (existingMessages.length > 0 && filter) {
      const index = existingMessages.findIndex(msg => filter(msg));
      if (index >= 0) {
        const message = existingMessages.splice(index, 1)[0];
        return message;
      }
    }
    
    // Otherwise, we need to wait for a new message
    return new Promise((resolve, reject) => {
      const waitId = `wait_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Set up timeout
      const timer = setTimeout(() => {
        if (this.waitingResolvers.has(waitId)) {
          this.waitingResolvers.delete(waitId);
          reject(new Error(`Timeout waiting for message of type ${type}`));
        }
      }, timeoutMs);
      
      // Store resolver
      this.waitingResolvers.set(waitId, {
        resolve: (message: any) => {
          // Filter is now checked in checkWaitingResolvers
          resolve(message);
        },
        reject,
        timer,
        filter  // Save the filter function for use in checkWaitingResolvers
      });
      
      syncLogger.debug('Waiting for message', { 
        type,
        waitId,
        timeout: timeoutMs,
        hasFilter: filter !== undefined
      }, MODULE_NAME);
    });
  }

  /**
   * Handle sync stats messages
   * This is used by the replication module to send detailed processing statistics
   */
  private async handleSyncStats(request: Request): Promise<Response> {
    // Extract client ID from query params
    const clientId = getQueryParam(request, 'clientId');
    
    if (!clientId) {
      return new Response('Missing clientId parameter', { status: 400 });
    }
    
    try {
      // Parse the request body to get the stats message
      const statsMessage = await request.json() as ServerSyncStatsMessage;
      
      // Ensure client ID is set in the message (should already be from process-changes)
      if (!statsMessage.clientId) {
        statsMessage.clientId = clientId;
      }
      
      // Forward stats message to connected WebSocket client
      if (this.webSocket && this.webSocket.readyState === WS_READY_STATE.OPEN) {
        this.webSocket.send(JSON.stringify(statsMessage));
        
        syncLogger.debug('Forwarded sync stats to client', {
          clientId,
          syncType: statsMessage.syncType,
          deduped: statsMessage.deduplicationStats?.reduction || 0,
          filtered: statsMessage.filteringStats?.filtered || 0
        }, MODULE_NAME);
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        syncLogger.warn('Could not forward sync stats - WebSocket not connected', {
          clientId
        }, MODULE_NAME);
        
        return new Response(JSON.stringify({ 
          success: false,
          error: 'WebSocket not connected'
        }), {
          status: 200, // Still return 200 to avoid retries
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      syncLogger.error('Error handling sync stats', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle direct broadcast from another SyncDO instance
   * Follows the exact same pattern as new-changes handler
   */
  private async handleDirectBroadcast(request: Request): Promise<Response> {
    try {
      // Extract query parameters - following ReplicationDO pattern
      const url = new URL(request.url);
      const targetClientId = url.searchParams.get('clientId');
      const originClientId = url.searchParams.get('originClientId');
      
      // Parse the broadcast body - following ReplicationDO pattern
      const broadcastBody = await request.json() as DirectBroadcastBody;
      
      syncLogger.debug('Received direct broadcast', {
        originClientId: originClientId || broadcastBody.originClientId,
        targetClientId: targetClientId || this.clientId,
        changeCount: broadcastBody.changes?.length || 0
      }, MODULE_NAME);

      // Forward changes to connected client immediately
      if (this.webSocket && this.webSocket.readyState === WS_READY_STATE.OPEN && broadcastBody.changes) {
        const liveChangesMessage = {
          type: 'srv_live_changes',
          messageId: `direct_broadcast_${Date.now()}`,
          timestamp: Date.now(),
          clientId: this.clientId,
          changes: broadcastBody.changes,
          lastLSN: '', // LSN will be updated later via WAL if needed
          isConflictResolution: false // This is primary path
        };

        this.webSocket.send(JSON.stringify(liveChangesMessage));
        
        syncLogger.debug('Forwarded broadcast changes to client', {
          originClientId: originClientId || broadcastBody.originClientId,
          targetClientId: this.clientId,
          changeCount: broadcastBody.changes.length
        }, MODULE_NAME);
      } else {
        syncLogger.debug('Cannot forward broadcast - no active WebSocket', {
          targetClientId: this.clientId,
          hasWebSocket: !!this.webSocket,
          webSocketState: this.webSocket?.readyState
        }, MODULE_NAME);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      syncLogger.error('Error handling direct broadcast', {
        targetClientId: this.clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Process any pending live update functions in the queue
   */
  private async processPendingLiveUpdates(): Promise<void> {
    if (this.pendingLiveUpdates.length === 0) {
      return;
    }
    
    syncLogger.info(`Processing ${this.pendingLiveUpdates.length} pending live updates`, {
      clientId: this.clientId
    }, MODULE_NAME);
    
    // Copy and clear the queue 
    const updates = [...this.pendingLiveUpdates];
    this.pendingLiveUpdates = [];
    
    // Process each pending update
    for (const updateFn of updates) {
      try {
        await updateFn();
      } catch (updateError) {
        syncLogger.error('Error processing queued live update', {
          error: updateError instanceof Error ? updateError.message : String(updateError),
          clientId: this.clientId
        }, MODULE_NAME);
      }
    }
  }

  /**
   * Notify that client changes processing is complete (including sending acknowledgments)
   * This is called by processClientChanges after sending the final acknowledgment
   */
  async notifyClientChangesComplete(messageId: string): Promise<void> {
    if (!this.isProcessingClientChanges) {
      // Lock is already released, nothing to do
      syncLogger.info('Lock already released when notifyClientChangesComplete called', {
        clientId: this.clientId,
        messageId
      }, MODULE_NAME);
      return;
    }
    
    // Get WebSockets count to indicate client connection status
    const webSockets = this.ctx.getWebSockets();
    
    // Release the lock
    this.isProcessingClientChanges = false;
    syncLogger.info('Client changes processing fully completed - releasing processing lock', {
      clientId: this.clientId,
      messageId,
      activeConnections: webSockets.length,
      pendingUpdates: this.pendingLiveUpdates.length
    }, MODULE_NAME);
    
    // Process any pending updates now that client changes are fully completed
    await this.processPendingLiveUpdates();
  }

  /**
   * Set up a periodic cleanup alarm if one doesn't exist
   */
  private async checkAndSetCleanupAlarm(): Promise<void> {
    try {
      const hasAlarm = await this.state.storage.getAlarm();
      if (!hasAlarm) {
        // Schedule cleanup in 1 hour
        const ONE_HOUR = 60 * 60 * 1000;
        this.state.storage.setAlarm(Date.now() + ONE_HOUR);
        syncLogger.info('Scheduled cleanup alarm', {}, MODULE_NAME);
      }
    } catch (error) {
      syncLogger.error('Failed to set cleanup alarm', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Alarm handler - called by Cloudflare runtime when an alarm fires
   * Used for regular cleanup of expired clients
   */
  async alarm(): Promise<void> {
    syncLogger.info('Cleanup alarm fired', {}, MODULE_NAME);
    
    try {
      // NOTE: Removed cleanupConnection() call that was incorrectly marking active clients as inactive
      // Cleanup happens automatically when WebSocket connections close
      // Individual SyncDO instances should not clean up themselves via alarm
      
      // Reschedule the next cleanup
      const ONE_HOUR = 60 * 60 * 1000;
      this.state.storage.setAlarm(Date.now() + ONE_HOUR);
      
      syncLogger.info('Cleanup alarm rescheduled (no cleanup needed)', {}, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Error during scheduled alarm', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Even if rescheduling fails, try again
      const ONE_HOUR = 60 * 60 * 1000;
      this.state.storage.setAlarm(Date.now() + ONE_HOUR);
    }
  }

  /**
   * Ensure replication is active by calling the replication init endpoint
   */
  private async ensureReplicationActive(): Promise<void> {
    try {
      syncLogger.info('Ensuring replication is active', {
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
      syncLogger.info('Replication active status confirmed', {
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
   * Analyze the LSN gap between client and server to determine if catchup is needed
   */
  private analyzeLSNGap(clientLSN: string, serverLSN: string): {
    gapSize: number;
    shouldTriggerCatchup: boolean;
    threshold: number;
  } {
    // Calculate the gap size by converting LSN hex values to decimal
    const clientDecimal = this.lsnToDecimal(clientLSN);
    const serverDecimal = this.lsnToDecimal(serverLSN);
    const gapSize = serverDecimal - clientDecimal;
    
    // Threshold for triggering catchup sync
    // ~16MB worth of WAL (typical for significant missed changes)
    const CATCHUP_THRESHOLD = 16 * 1024 * 1024; // 16MB in bytes
    
    return {
      gapSize,
      shouldTriggerCatchup: gapSize > CATCHUP_THRESHOLD,
      threshold: CATCHUP_THRESHOLD
    };
  }

  /**
   * Convert LSN string to decimal for gap calculation
   */
  private lsnToDecimal(lsn: string): number {
    const [major, minor] = lsn.split('/');
    // PostgreSQL LSN: major part * 16MB + minor part
    return parseInt(major, 16) * 0x1000000 + parseInt(minor, 16);
  }

  /**
   * Trigger initial sync from heartbeat when client LSN is 0/0 (integrity reset scenario)
   */
  private async triggerInitialSyncFromHeartbeat(
    clientId: string, 
    serverLSN: string
  ): Promise<void> {
    try {
      syncLogger.info('Triggering initial sync from heartbeat for LSN 0/0', {
        clientId,
        serverLSN
      }, MODULE_NAME);

      // Send state change to initial to the client
      await this.send({
        type: 'srv_state_change',
        clientId,
        messageId: `initial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        state: 'initial',
        lsn: serverLSN
      } as any);

      // Perform initial sync (client LSN is 0/0)
      await this.performSync(
        { strategy: SyncStrategy.INITIAL, serverLSN },
        clientId,
        '0/0'
      );

      syncLogger.info('Heartbeat-triggered initial sync completed', {
        clientId,
        startLSN: '0/0',
        endLSN: serverLSN
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in heartbeat-triggered initial sync', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Trigger catchup sync from heartbeat when large LSN gap is detected
   */
  private async triggerCatchupFromHeartbeat(
    clientId: string, 
    clientLSN: string, 
    serverLSN: string
  ): Promise<void> {
    try {
      syncLogger.info('Triggering catchup sync from heartbeat', {
        clientId,
        clientLSN,
        serverLSN
      }, MODULE_NAME);

      // Send state change to catchup to the client
      await this.send({
        type: 'srv_state_change',
        clientId,
        messageId: `catchup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        state: 'catchup',
        lsn: serverLSN
      } as any);

             // Perform catchup sync
       await performCatchupSync(
         this.getContext(),
         clientId,
         clientLSN,
         serverLSN,
         this, // WebSocketHandler
         this.stateManager
       );

      syncLogger.info('Heartbeat-triggered catchup sync completed', {
        clientId,
        startLSN: clientLSN,
        endLSN: serverLSN
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in heartbeat-triggered catchup sync', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Broadcast changes directly to other SyncDO instances via KV registry
   * Primary path for low-latency client-to-client sync
   */
  async broadcastChangesToOtherSyncDOs(changes: TableChange[], originClientId: string): Promise<void> {
    try {
      syncLogger.info('Starting SyncDO broadcast', {
        changeCount: changes.length,
        originClientId
      }, MODULE_NAME);

      // Get all registered clients from KV registry with optimized lookup
      const activeClients = await this.getActiveClientsFromRegistry();
      
      syncLogger.info('Active clients found for broadcast', {
        originClientId,
        activeClients,
        totalActiveClients: activeClients.length
      }, MODULE_NAME);
      
      // Filter out the originating client (anti-echo for primary path)
      const targetClients = activeClients.filter(clientId => clientId !== originClientId);
      
      syncLogger.info('Target clients after filtering', {
        originClientId,
        targetClients,
        filteredCount: targetClients.length
      }, MODULE_NAME);
      
      if (targetClients.length === 0) {
        syncLogger.debug('No target clients for broadcast', { originClientId }, MODULE_NAME);
        return;
      }

      // Broadcast to each target client's SyncDO
      const broadcastPromises = targetClients.map(async (targetClientId) => {
        try {
          syncLogger.info('Sending broadcast to target SyncDO', {
            originClientId,
            targetClientId,
            changeCount: changes.length,
            tables: [...new Set(changes.map(change => change.table))].join(', '),
            operations: changes.map(change => `${change.table}:${change.operation}`).join(', ')
          }, MODULE_NAME);
          
          await this.sendChangesToSyncDO(targetClientId, changes);
          
          syncLogger.debug('Broadcast sent successfully', {
            originClientId,
            targetClientId,
            changeCount: changes.length
          }, MODULE_NAME);
        } catch (error) {
          syncLogger.error('Failed to broadcast to SyncDO', {
            originClientId,
            targetClientId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }, MODULE_NAME);
          // Continue with other broadcasts even if one fails
        }
      });

      await Promise.allSettled(broadcastPromises);
      
      syncLogger.info('SyncDO broadcast completed', {
        originClientId,
        targetCount: targetClients.length,
        changeCount: changes.length
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in SyncDO broadcast', {
        originClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      // Don't throw - this is a best-effort optimization
    }
  }

  /**
   * Broadcast CRDT conflict resolution to ALL clients (including originator)
   * Authoritative path for conflict resolution - no anti-echo filtering
   */
  async broadcastConflictResolution(conflictedChanges: TableChange[], originClientId: string): Promise<void> {
    try {
      syncLogger.info('Starting CRDT conflict resolution broadcast', {
        changeCount: conflictedChanges.length,
        originClientId,
        conflictTables: [...new Set(conflictedChanges.map(c => c.table))]
      }, MODULE_NAME);

      // Get all registered clients from KV registry (including originator for authoritative resolution)
      const activeClients = await this.getActiveClientsFromRegistry();
      
      if (activeClients.length === 0) {
        syncLogger.debug('No active clients for conflict resolution broadcast', { originClientId }, MODULE_NAME);
        return;
      }

      syncLogger.info('Broadcasting conflict resolution to all clients', {
        originClientId,
        targetClients: activeClients,
        clientCount: activeClients.length,
        changeCount: conflictedChanges.length
      }, MODULE_NAME);

      // Broadcast to ALL clients (no anti-echo filtering for authoritative resolution)
      const broadcastPromises = activeClients.map(async (targetClientId) => {
        try {
          await this.sendConflictResolutionToSyncDO(targetClientId, conflictedChanges, originClientId);
          
          syncLogger.debug('Conflict resolution broadcast sent successfully', {
            originClientId,
            targetClientId,
            changeCount: conflictedChanges.length
          }, MODULE_NAME);
          
        } catch (error) {
          syncLogger.error('Failed to broadcast conflict resolution to SyncDO', {
            originClientId,
            targetClientId,
            error: error instanceof Error ? error.message : String(error)
          }, MODULE_NAME);
          // Continue with other broadcasts even if one fails
        }
      });

      await Promise.allSettled(broadcastPromises);
      
      syncLogger.info('CRDT conflict resolution broadcast completed', {
        originClientId,
        targetCount: activeClients.length,
        changeCount: conflictedChanges.length
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in CRDT conflict resolution broadcast', {
        originClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      // Don't throw - this is a best-effort optimization
    }
  }

  /**
   * Send conflict resolution to a specific SyncDO instance with isConflictResolution flag
   * Implements "mark inactive on fail" approach for failed broadcasts
   */
  private async sendConflictResolutionToSyncDO(targetClientId: string, conflictedChanges: TableChange[], originClientId: string): Promise<void> {
    try {
      // Get the SyncDO instance
      const id = this.env.SYNC.idFromName(`client:${targetClientId}`);
      const syncDO = this.env.SYNC.get(id);

      // Create the URL with required parameters
      const url = new URL('http://internal/new-changes');
      url.searchParams.set('clientId', targetClientId);
      url.searchParams.set('lsn', '0/0');

      // Send with conflict resolution flag
      const response = await syncDO.fetch(url.toString(), {
        method: 'POST',
        body: JSON.stringify({ 
          changes: conflictedChanges,
          isConflictResolution: true, // This flag removes anti-echo filtering
          originClientId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Conflict resolution broadcast failed with status ${response.status}: ${responseText}`);
      }

    } catch (error) {
      syncLogger.error('Error sending conflict resolution to SyncDO - marking client inactive', {
        targetClientId,
        originClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Mark the failed client as inactive using "mark inactive on fail" approach
      await this.markClientsInactive([targetClientId]);
      
      throw error;
    }
  }

  /**
   * Get list of active clients from KV registry with optimized batch lookup
   * Uses parallel processing to minimize latency
   */
  private async getActiveClientsFromRegistry(): Promise<string[]> {
    try {
      // Use list operation to get all client keys in one call
      const listResult = await this.env.CLIENT_REGISTRY.list({ prefix: 'client:' });
      
      if (listResult.keys.length === 0) {
        return [];
      }

      // Process clients in parallel batches for better performance
      const BATCH_SIZE = 10;
      const activeClients: string[] = [];
      const failedClients: string[] = [];

      for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
        const batch = listResult.keys.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (key: any) => {
          const clientId = key.name.replace('client:', '');
          
          try {
            const clientData = await this.env.CLIENT_REGISTRY.get(key.name);
            if (clientData) {
              const data = JSON.parse(clientData);
              return data.active === true ? clientId : null;
            }
          } catch (error) {
            failedClients.push(clientId);
            syncLogger.warn('Failed to read client data during registry lookup', {
              clientId,
              error: error instanceof Error ? error.message : String(error)
            }, MODULE_NAME);
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        activeClients.push(...batchResults.filter(Boolean) as string[]);
      }

      // Clean up failed clients by marking them inactive
      if (failedClients.length > 0) {
        this.state.waitUntil(this.markClientsInactive(failedClients));
      }

      return activeClients;
    } catch (error) {
      syncLogger.error('Error getting active clients from registry', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Mark multiple clients as inactive in KV registry
   * Used by "mark inactive on fail" approach when clients can't be reached
   */
  private async markClientsInactive(clientIds: string[]): Promise<void> {
    const promises = clientIds.map(async (clientId) => {
      try {
        const key = `client:${clientId}`;
        const existingData = await this.env.CLIENT_REGISTRY.get(key);
        
        if (existingData) {
          let data;
          try {
            data = JSON.parse(existingData);
          } catch (parseError) {
            // Create new data object if parsing fails
            data = {};
          }
          
          // Mark as inactive and record when it failed
          await this.env.CLIENT_REGISTRY.put(
            key,
            JSON.stringify({
              ...data,
              active: false,
              lastSeen: data.lastSeen || Date.now(),
              disconnectedAt: Date.now(),
              markedInactiveReason: 'registry_access_failed'
            })
          );
          
          syncLogger.debug('Marked client inactive due to access failure', {
            clientId,
            reason: 'registry_access_failed'
          }, MODULE_NAME);
        }
      } catch (error) {
        syncLogger.error('Failed to mark client as inactive', {
          clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Send changes to a specific SyncDO instance
   * Follows the exact same pattern as ReplicationDO -> SyncDO communication
   * Implements "mark inactive on fail" approach for failed broadcasts
   */
  private async sendChangesToSyncDO(targetClientId: string, changes: TableChange[]): Promise<void> {
    try {
      // Get the SyncDO instance - EXACT SAME PATTERN as ReplicationDO
      const id = this.env.SYNC.idFromName(`client:${targetClientId}`);
      const syncDO = this.env.SYNC.get(id);

      // Create the URL with required parameters - EXACT SAME as ReplicationDO
      const url = new URL('http://internal/new-changes');
      url.searchParams.set('clientId', targetClientId);
      url.searchParams.set('lsn', '0/0'); // Matching ReplicationDO pattern

      // Send via fetch - EXACT SAME PATTERN as ReplicationDO
      syncLogger.debug('About to send fetch to target SyncDO', {
        targetClientId,
        url: url.toString(),
        bodySize: JSON.stringify({ changes, originClientId: this.clientId, timestamp: new Date().toISOString() }).length
      }, MODULE_NAME);
      
      const response = await syncDO.fetch(url.toString(), {
        method: 'POST',
        body: JSON.stringify({ 
          changes,
          directBroadcast: true, // Flag to identify this as direct broadcast vs ReplicationDO
          originClientId: this.clientId
        })
      });

      syncLogger.debug('Received response from target SyncDO', {
        targetClientId,
        status: response.status,
        statusText: response.statusText
      }, MODULE_NAME);

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Broadcast failed with status ${response.status}: ${responseText}`);
      }

      syncLogger.debug('Successfully sent direct broadcast', {
        targetClientId,
        originClientId: this.clientId,
        changeCount: changes.length,
        responseStatus: response.status
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error sending changes to SyncDO - marking client inactive', {
        targetClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Mark the failed client as inactive using "mark inactive on fail" approach
      await this.markClientsInactive([targetClientId]);
      
      throw error;
    }
  }
} 