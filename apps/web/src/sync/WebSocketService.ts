/**
 * WebSocketService - Pure WebSocket connection service
 * 
 * Handles WebSocket communication without state management.
 * Reports events to parent via callbacks rather than maintaining internal state.
 * 
 * Part of Phase 2: Pure Services Extraction
 */

import { syncLogger } from './utils/SyncLogger';

export interface WebSocketServiceConfig {
  serverUrl?: string;
  clientId: string;
  lsn: string;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketServiceCallbacks {
  onMessage?: (message: any) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onError?: (error: Error) => void;
  onConnectionRecovery?: (wasOffline: boolean, durationMs?: number) => void;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: WebSocketServiceCallbacks = {};
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Connection tracking
  private currentStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
  private reconnectAttempts = 0;
  private lastDisconnectTime: number | null = null;

  constructor(private config: WebSocketServiceConfig) {
    // Pure service - no state initialization needed
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: WebSocketServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(serverUrl?: string): Promise<void> {
    const url = serverUrl || this.config.serverUrl;
    if (!url) {
      throw new Error('Server URL is required');
    }

    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) {
      syncLogger.warn('connection', 'Already connected or connecting');
      return;
    }

    this.cleanup();
    this.setStatus('connecting');

    try {
      // Construct WebSocket URL with query parameters like WebSocketConnector
      const wsUrl = new URL(url);
      wsUrl.searchParams.set('clientId', this.config.clientId);
      wsUrl.searchParams.set('lsn', this.config.lsn);
      
      syncLogger.connectionAttempt(wsUrl.toString());
      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        syncLogger.connectionEstablished();
        this.reconnectAttempts = 0;
        
        // Track connection recovery
        if (this.lastDisconnectTime) {
          const offlineDuration = Date.now() - this.lastDisconnectTime;
          this.callbacks.onConnectionRecovery?.(true, offlineDuration);
          this.lastDisconnectTime = null;
        }

        this.setStatus('connected');
        
        if (this.config.enableHeartbeat !== false) {
          syncLogger.info('connection', `Starting heartbeat with interval ${this.config.heartbeatInterval || 30000}ms`);
          this.startHeartbeat();
        } else {
          syncLogger.warn('connection', 'Heartbeat disabled in configuration');
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.callbacks.onMessage?.(message);
        } catch (error) {
          syncLogger.error('message', 'Error parsing message', error);
          this.callbacks.onError?.(new Error('Failed to parse WebSocket message'));
        }
      };

      this.ws.onerror = (error) => {
        syncLogger.error('connection', 'WebSocket error', error);
        this.setStatus('error');
        this.callbacks.onError?.(new Error('WebSocket connection error'));
      };

      this.ws.onclose = (event) => {
        syncLogger.connectionLost(`${event.code} - ${event.reason}`);
        this.lastDisconnectTime = Date.now();
        this.stopHeartbeat();
        this.setStatus('disconnected');
        
        // Auto-reconnect if not manually closed
        if (event.code !== 1000 && this.reconnectAttempts < (this.config.maxReconnectAttempts || 5)) {
          this.scheduleReconnect();
        }
      };

    } catch (error) {
      syncLogger.error('connection', 'Error creating WebSocket', error);
      this.setStatus('error');
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    syncLogger.info('connection', 'Disconnecting...');
    this.cleanup();
    this.setStatus('disconnected');
  }

  /**
   * Send message to server
   */
  send(message: any): void {
    syncLogger.debug('message', 'Send called', {
      hasWebSocket: !!this.ws,
      readyState: this.ws?.readyState,
      messageType: message?.type,
      isOpen: this.ws?.readyState === WebSocket.OPEN
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      syncLogger.error('message', 'WebSocket not ready for sending', {
        hasWebSocket: !!this.ws,
        readyState: this.ws?.readyState,
        OPEN: WebSocket.OPEN
      });
      throw new Error('WebSocket is not connected');
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      // SyncLogger filters heartbeats automatically
      syncLogger.messageSent(message.type);
      this.ws.send(messageStr);
      // Success logging handled by SyncLogger
    } catch (error) {
      syncLogger.error('message', 'Error sending message', error);
      this.callbacks.onError?.(new Error('Failed to send WebSocket message'));
      throw error;
    }
  }

  /**
   * Update connection parameters (for heartbeat updates)
   */
  updateConnectionParams(clientId: string, lsn: string): void {
    this.config.clientId = clientId;
    this.config.lsn = lsn;
  }

  /**
   * Get current connection status
   */
  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    return this.currentStatus;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    syncLogger.info('connection', 'Destroying...');
    this.cleanup();
    this.callbacks = {};
  }

  // Private methods

  private setStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.callbacks.onStatusChange?.(status);
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
    this.stopReconnectTimer();
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Manual disconnect');
      }
      
      this.ws = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    const interval = this.config.heartbeatInterval || 30000; // 30 seconds default
    syncLogger.info('connection', `Setting up heartbeat timer with ${interval}ms interval`);
    
    this.heartbeatTimer = setInterval(() => {
      syncLogger.debug('connection', 'Heartbeat timer fired', {
        isConnected: this.isConnected(),
        clientId: this.config.clientId,
        lsn: this.config.lsn
      });
      
      if (this.isConnected()) {
        try {
          this.send({
            type: 'clt_heartbeat',
            clientId: this.config.clientId,
            lsn: this.config.lsn,
            messageId: `heartbeat_${Date.now()}`,
            timestamp: Date.now()
          });
          syncLogger.debug('connection', 'Heartbeat sent successfully');
        } catch (error) {
          syncLogger.error('connection', 'Error sending heartbeat', error);
        }
      } else {
        syncLogger.warn('connection', 'Heartbeat timer fired but connection not ready');
      }
    }, interval);
    
    syncLogger.info('connection', `Heartbeat timer started with ID: ${this.heartbeatTimer}`);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      syncLogger.info('connection', `Stopping heartbeat timer: ${this.heartbeatTimer}`);
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.stopReconnectTimer();
    
    const delay = this.config.reconnectDelay || 3000;
    const backoffDelay = delay * Math.pow(2, this.reconnectAttempts);
    
    syncLogger.info('connection', `Scheduling reconnect in ${backoffDelay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        syncLogger.error('connection', 'Reconnect failed', error);
      });
    }, backoffDelay);
  }

  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
} 