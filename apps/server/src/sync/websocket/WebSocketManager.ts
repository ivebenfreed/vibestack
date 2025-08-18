/**
 * WebSocket Manager
 * 
 * Handles WebSocket connection lifecycle, message routing, and connection state management.
 * Extracted from SyncDO to provide focused WebSocket management.
 */

import type { 
  ServerMessage, 
  ClientMessage
} from '@repo/sync-types';
import type { Env } from '../../types/env';
import { syncLogger } from '../../middleware/logger';

const MODULE_NAME = 'WebSocketManager';

// WebSocket ready states
const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

export interface WebSocketManagerContext {
  ctx: DurableObjectState;
  clientId: string;
  setClientId: (clientId: string) => void;
  messageHandlers: Map<ClientMessage['type'], Array<(message: ClientMessage) => Promise<void>>>;
  messageQueue: Map<ClientMessage['type'], ClientMessage[]>;
  waitingResolvers: Map<string, {
    resolve: (message: any) => void,
    reject: (error: Error) => void,
    timer: NodeJS.Timeout | null,
    filter?: (message: any) => boolean
  }>;
  isProcessingClientChanges: boolean;
  setProcessingClientChanges: (processing: boolean) => void;
  processPendingLiveUpdates: () => void;
  notifyClientChangesComplete: (messageId: string) => Promise<void>;
  stateManager: any; // StateManager type
  checkWaitingResolvers: (type: string, message: ClientMessage) => void;
}

export class WebSocketManager {
  private context: WebSocketManagerContext;
  private webSocket: WebSocket | null = null;

  constructor(context: WebSocketManagerContext) {
    this.context = context;
  }

  /**
   * Handle WebSocket upgrade request
   */
  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // Extract parameters
    let clientId = this.getQueryParam(request, 'clientId');
    let clientLSN = this.getQueryParam(request, 'lsn');
    let organizationId = this.getQueryParam(request, 'organizationId');
    
    // Log request parameters
    syncLogger.debug('WebSocket connection request', {
      clientId,
      lsn: clientLSN,
      organizationId
    }, MODULE_NAME);
    
    // CRITICAL: Require all essential parameters for security
    if (!clientId) {
      return new Response('Missing clientId parameter', { status: 400 });
    }
    
    if (!organizationId) {
      return new Response('Missing organizationId parameter - organization context is required for all sync operations', { status: 400 });
    }
    
    // Validate LSN if provided
    if (clientLSN && !this.isValidLSN(clientLSN)) {
      syncLogger.error('Invalid LSN format', {
        clientId,
        lsn: clientLSN
      }, MODULE_NAME);
      return new Response('Invalid LSN format', { status: 400 });
    }
    
    // If LSN is missing, default to initial sync with explicit 0/0
    if (!clientLSN) {
      clientLSN = '0/0';
      syncLogger.debug('No LSN provided, will perform initial sync', {
        clientId
      }, MODULE_NAME);
    }
    
    // Set up WebSocket
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    // Store client ID
    this.context.setClientId(clientId);

    // Configure WebSocket with hibernation API
    if (server) {
      this.context.ctx.acceptWebSocket(server);
    }
    
    // Return connection info for further processing by parent
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * WebSocket message handler for hibernation API
   */
  async handleWebSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    try {
      // Convert data to string if it's ArrayBuffer
      const messageStr = typeof data === 'string' ? data : new TextDecoder().decode(data);
      const message = JSON.parse(messageStr) as ClientMessage;
      
      // Store in message queue for waitForMessage
      if (!this.context.messageQueue.has(message.type)) {
        this.context.messageQueue.set(message.type, []);
      }
      this.context.messageQueue.get(message.type)!.push(message);
      
      // Check if someone is waiting for this message type
      this.context.checkWaitingResolvers(message.type, message);
      
      // Check if this is a client changes message, if so, set the processing lock
      if (message.type === 'clt_send_changes') {
        this.context.setProcessingClientChanges(true);
        syncLogger.info('Client changes processing started - setting processing lock', {
          clientId: this.context.clientId,
          messageId: message.messageId
        }, MODULE_NAME);
      }
      
      // Process handlers for this message type
      const handlers = this.context.messageHandlers.get(message.type) || [];
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
            this.context.setProcessingClientChanges(false);
            syncLogger.info('Client changes processing failed - releasing processing lock', {
              clientId: this.context.clientId,
              messageId: message.messageId
            }, MODULE_NAME);
            
            // Process any pending updates
            this.context.processPendingLiveUpdates();
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
  async handleWebSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Log websocket closure
    syncLogger.info('WebSocket closed', {
      clientId: this.context.clientId || 'no-client-id',
      code,
      reason: reason || 'No reason specified',
      wasClean
    }, MODULE_NAME);
    
    // Clear WebSocket reference
    this.webSocket = null;
    
    // Return cleanup info for parent to handle
    return;
  }

  /**
   * WebSocket error handler for hibernation API
   */
  async handleWebSocketError(ws: WebSocket, error: Error): Promise<void> {
    syncLogger.error('WebSocket error', {
      clientId: this.context.clientId,
      error: error.message,
      stack: error.stack
    }, MODULE_NAME);
    
    this.webSocket = null;
  }

  /**
   * Send a message to the client using type-safe interface
   */
  async send(message: ServerMessage): Promise<void> {
    try {
      // Get all active WebSocket connections
      const webSockets = this.context.ctx.getWebSockets();
      
      if (webSockets.length === 0) {
        syncLogger.warn('No active WebSocket connections', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.context.clientId
        }, MODULE_NAME);
        // Throw an error with a consistent message format that's easy to detect
        throw new Error('WebSocketUnavailable: No active WebSocket connections for client ' + this.context.clientId);
      }
      
      // Add detailed logging for table changes messages to debug null/object conversion
      if (message.type === 'srv_live_changes' || message.type === 'srv_catchup_changes') {
        const changesMessage = message as any;
        if (changesMessage.changes && Array.isArray(changesMessage.changes)) {
          syncLogger.debug('Sending table changes', {
            messageType: message.type,
            clientId: this.context.clientId,
            changeCount: changesMessage.changes.length
          }, MODULE_NAME);
        }
      }
      
      // Enhanced logging for acknowledgment messages (at DEBUG level to reduce noise)
      const isAcknowledgment = message.type === 'srv_changes_received' || 
                             message.type === 'srv_changes_applied';
      
      if (isAcknowledgment) {
        syncLogger.debug('Sending acknowledgment message', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.context.clientId,
          connectionCount: webSockets.length,
          isProcessingLocked: this.context.isProcessingClientChanges
        }, MODULE_NAME);
      } else {
        // Regular debug log for other messages
        syncLogger.debug('Sending message', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.context.clientId,
          connectionCount: webSockets.length
        }, MODULE_NAME);
      }
      
      // Send to all active connections
      for (const ws of webSockets) {
        try {
          ws.send(JSON.stringify(message));
          
          // Log success only at debug level to reduce noise
          syncLogger.debug('Message sent successfully', {
            type: message.type,
            messageId: message.messageId,
            clientId: this.context.clientId,
            wsReadyState: ws.readyState
          }, MODULE_NAME);
        } catch (sendError) {
          syncLogger.error('Error sending message to WebSocket', {
            type: message.type,
            messageId: message.messageId,
            clientId: this.context.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
          throw sendError;
        }
      }
    } catch (error) {
      syncLogger.error('Unexpected error in send method', {
        type: message.type,
        messageId: message.messageId,
        clientId: this.context.clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Wait for WebSocket connection to be established
   */
  async waitForConnection(): Promise<void> {
    let retries = 0;
    const maxRetries = 10;
    const retryDelay = 100;

    while (retries < maxRetries) {
      const webSockets = this.context.ctx.getWebSockets();
      if (webSockets.length > 0 && webSockets[0]?.readyState === WS_READY_STATE.OPEN) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retries++;
    }

    throw new Error('WebSocket connection failed to establish within timeout');
  }


  /**
   * Helper function to extract query parameters from a request
   */
  private getQueryParam(request: Request, name: string): string | null {
    const url = new URL(request.url);
    return url.searchParams.get(name);
  }

  /**
   * Check if LSN is in valid format
   */
  private isValidLSN(lsn: string): boolean {
    // LSN is typically in format X/X where X is a hexadecimal number
    return /^[0-9A-Fa-f]+\/[0-9A-Fa-f]+$/.test(lsn) || lsn === '0/0';
  }
}