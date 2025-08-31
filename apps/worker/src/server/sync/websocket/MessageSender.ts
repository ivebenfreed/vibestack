/**
 * Message Sender
 * 
 * Specialized component for sending messages through WebSocket connections
 * with enhanced logging and error handling.
 */

import type { ServerMessage } from '@repo/sync-types';
import { syncLogger } from '../../middleware/logger';

const MODULE_NAME = 'MessageSender';

export interface MessageSenderContext {
  ctx: DurableObjectState;
  clientId: string;
  isProcessingClientChanges: boolean;
}

export class MessageSender {
  private context: MessageSenderContext;

  constructor(context: MessageSenderContext) {
    this.context = context;
  }

  /**
   * Send a message with enhanced logging and error handling
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
        throw new Error('WebSocketUnavailable: No active WebSocket connections for client ' + this.context.clientId);
      }
      
      // Log message details based on type
      this.logOutgoingMessage(message, webSockets.length);
      
      // Send to all active connections
      for (const ws of webSockets) {
        await this.sendToWebSocket(ws, message);
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
   * Send message to specific WebSocket with error handling
   */
  private async sendToWebSocket(ws: WebSocket, message: ServerMessage): Promise<void> {
    try {
      // Log before sending for live changes to track hibernation issues
      if (message.type === 'srv_live_changes') {
        syncLogger.info('Attempting to send live changes message to WebSocket', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.context.clientId,
          wsReadyState: ws.readyState,
          wsReadyStateLabel: this.getReadyStateLabel(ws.readyState)
        }, MODULE_NAME);
      }
      
      ws.send(JSON.stringify(message));
      
      // Log success based on message type
      if (message.type === 'srv_live_changes') {
        syncLogger.info('Live changes message sent successfully to WebSocket', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.context.clientId,
          wsReadyState: ws.readyState
        }, MODULE_NAME);
      } else {
        syncLogger.debug('Message sent successfully', {
          type: message.type,
          messageId: message.messageId,
          clientId: this.context.clientId
        }, MODULE_NAME);
      }
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

  /**
   * Log outgoing message details
   */
  private logOutgoingMessage(message: ServerMessage, connectionCount: number): void {
    // Add detailed logging for table changes messages
    if (message.type === 'srv_live_changes' || message.type === 'srv_catchup_changes') {
      const changesMessage = message as any;
      if (changesMessage.changes && Array.isArray(changesMessage.changes)) {
        console.log('[MessageSender] Sending table changes:', {
          messageType: message.type,
          clientId: this.context.clientId,
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
        clientId: this.context.clientId,
        connectionCount,
        isProcessingLocked: this.context.isProcessingClientChanges
      }, MODULE_NAME);
    } else {
      // Regular debug log for other messages
      syncLogger.debug('Sending message', {
        type: message.type,
        messageId: message.messageId,
        clientId: this.context.clientId,
        connectionCount
      }, MODULE_NAME);
    }
  }

  /**
   * Get readable WebSocket ready state label
   */
  private getReadyStateLabel(readyState: number): string {
    switch (readyState) {
      case 0: return 'CONNECTING';
      case 1: return 'OPEN';
      case 2: return 'CLOSING';
      case 3: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }
}