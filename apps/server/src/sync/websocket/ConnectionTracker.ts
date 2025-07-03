/**
 * Connection Tracker
 * 
 * Tracks WebSocket connection state, manages waiting resolvers,
 * and handles connection lifecycle events.
 */

import type { ClientMessage } from '@repo/sync-types';
import { syncLogger } from '../../middleware/logger';

const MODULE_NAME = 'ConnectionTracker';

// WebSocket ready states
const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

export interface WaitingResolver {
  resolve: (message: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout | null;
  filter?: (message: any) => boolean;
}

export interface ConnectionTrackerContext {
  clientId: string;
  ctx: DurableObjectState;
}

export class ConnectionTracker {
  private context: ConnectionTrackerContext;
  private waitingResolvers: Map<string, WaitingResolver> = new Map();

  constructor(context: ConnectionTrackerContext) {
    this.context = context;
  }

  /**
   * Wait for a specific message type with optional filter
   */
  async waitForMessage<T extends ClientMessage>(
    type: T['type'], 
    timeoutMs: number = 30000,
    filter?: (message: T) => boolean
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const waitId = `wait_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Set up timeout
      const timer = setTimeout(() => {
        this.waitingResolvers.delete(waitId);
        reject(new Error(`Timeout waiting for message type: ${type}`));
      }, timeoutMs);
      
      // Store resolver
      this.waitingResolvers.set(waitId, {
        resolve: (message: T) => {
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

  /**
   * Check if any waiting resolvers match this message
   */
  checkWaitingResolvers(type: string, message: ClientMessage): void {
    // Find matching waiters
    const waitIds = Array.from(this.waitingResolvers.keys()).filter(id => 
      id.startsWith(`wait_${type}_`)
    );
    
    for (const waitId of waitIds) {
      const resolver = this.waitingResolvers.get(waitId);
      if (!resolver) continue;
      
      // Check if this resolver has a filter function
      if (resolver.filter) {
        try {
          if (!resolver.filter(message)) {
            // This message doesn't match the filter criteria
            continue;
          }
          
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

  /**
   * Wait for WebSocket connection to be established
   */
  async waitForConnection(maxRetries: number = 10, retryDelay: number = 100): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      const webSockets = this.context.ctx.getWebSockets();
      if (webSockets.length > 0 && webSockets[0].readyState === WS_READY_STATE.OPEN) {
        syncLogger.debug('WebSocket connection established', {
          clientId: this.context.clientId,
          retries
        }, MODULE_NAME);
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retries++;
    }

    const error = new Error('WebSocket connection failed to establish within timeout');
    syncLogger.error('WebSocket connection timeout', {
      clientId: this.context.clientId,
      maxRetries,
      retryDelay
    }, MODULE_NAME);
    throw error;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    connectionCount: number;
    readyStates: number[];
  } {
    const webSockets = this.context.ctx.getWebSockets();
    
    return {
      isConnected: webSockets.length > 0 && webSockets.some(ws => ws.readyState === WS_READY_STATE.OPEN),
      connectionCount: webSockets.length,
      readyStates: webSockets.map(ws => ws.readyState)
    };
  }

  /**
   * Clear all waiting resolvers (cleanup)
   */
  clearAllResolvers(): void {
    const resolverCount = this.waitingResolvers.size;
    
    // Reject all pending resolvers
    for (const [waitId, resolver] of this.waitingResolvers.entries()) {
      if (resolver.timer) {
        clearTimeout(resolver.timer);
      }
      resolver.reject(new Error('Connection closed'));
    }
    
    this.waitingResolvers.clear();
    
    if (resolverCount > 0) {
      syncLogger.debug('Cleared all waiting resolvers', {
        clientId: this.context.clientId,
        clearedCount: resolverCount
      }, MODULE_NAME);
    }
  }

  /**
   * Get waiting resolver statistics
   */
  getResolverStats(): {
    totalWaiting: number;
    waitingByType: Record<string, number>;
  } {
    const stats = {
      totalWaiting: this.waitingResolvers.size,
      waitingByType: {} as Record<string, number>
    };

    for (const waitId of this.waitingResolvers.keys()) {
      // Extract type from waitId format: wait_{type}_{timestamp}_{random}
      const typeMatch = waitId.match(/^wait_([^_]+)_/);
      if (typeMatch) {
        const type = typeMatch[1];
        stats.waitingByType[type] = (stats.waitingByType[type] || 0) + 1;
      }
    }

    return stats;
  }
}