/**
 * @deprecated This class is being replaced by WebSocketService in the pure services architecture.
 * Use WebSocketService instead for new implementations.
 */

import { SyncEventEmitter } from './SyncEventEmitter';
import { ClientMessage, ServerMessage } from './SyncManager'; // Or local types
import { IMessageSender } from './interfaces';
import { getDefaultServerUrl } from './config'; // Assuming config provides this
import { syncConfig } from './config'; // Import sync config for heartbeat settings

// Add heartbeat-related interfaces
interface HeartbeatState {
  interval: NodeJS.Timeout | null;
  timeoutTimer: NodeJS.Timeout | null;
  lastPongReceived: number;
  missedHeartbeats: number;
  isActive: boolean;
}

export class WebSocketConnector implements IMessageSender {
  private webSocket: WebSocket | null = null;
  private serverUrl: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5; // Or from config
  private reconnectDelay: number = 2000; // Or from config
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isExplicitlyDisconnecting: boolean = false; // Renamed from isDisconnecting
  private currentClientId: string = ''; // Needed for connection URL
  private currentLsn: string = '0/0'; // Needed for connection URL

  // Heartbeat state
  private heartbeat: HeartbeatState = {
    interval: null,
    timeoutTimer: null,
    lastPongReceived: 0,
    missedHeartbeats: 0,
    isActive: false
  };
  
  private readonly maxMissedHeartbeats: number = 3;

  // Dependencies
  private events: SyncEventEmitter;

  constructor(eventEmitter: SyncEventEmitter) {
    this.events = eventEmitter;
    this.serverUrl = getDefaultServerUrl(); // Initialize default URL
    
    // Listen for heartbeat responses
    this.events.on('websocket:message', this.handleHeartbeatMessage.bind(this));
    
    // Add window online/offline listeners here
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline); // Good practice to handle offline too
    
    // Listen for page visibility changes to optimize heartbeat
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }

  // --- Heartbeat Management ---
  
  /**
   * Start sending heartbeats at configured intervals
   */
  private startHeartbeat(): void {
    if (this.heartbeat.isActive) {
      return; // Already active
    }
    
    console.log('[WebSocketConnector] Starting heartbeat mechanism');
    this.heartbeat.isActive = true;
    this.heartbeat.lastPongReceived = Date.now();
    this.heartbeat.missedHeartbeats = 0;
    
    this.heartbeat.interval = setInterval(() => {
      if (this.isConnected()) {
        this.sendHeartbeat();
      }
    }, syncConfig.heartbeatInterval);
  }
  
  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    console.log('[WebSocketConnector] Stopping heartbeat mechanism');
    this.heartbeat.isActive = false;
    
    if (this.heartbeat.interval) {
      clearInterval(this.heartbeat.interval);
      this.heartbeat.interval = null;
    }
    
    if (this.heartbeat.timeoutTimer) {
      clearTimeout(this.heartbeat.timeoutTimer);
      this.heartbeat.timeoutTimer = null;
    }
  }
  
  /**
   * Send heartbeat message to server
   */
  private sendHeartbeat(): void {
    try {
      const heartbeatMessage: Omit<ClientMessage, 'clientId' | 'messageId' | 'timestamp'> = {
        type: 'clt_heartbeat',
        lsn: this.currentLsn,
        // Include additional context that might be useful for server
        state: this.getCurrentSyncState(),
        active: !document.hidden // Browser tab visibility
      };
      
      this.send(heartbeatMessage);
      
      // Start timeout timer for this heartbeat
      this.startHeartbeatTimeout();
      
      console.log('[WebSocketConnector] Heartbeat sent', {
        lsn: this.currentLsn,
        missedCount: this.heartbeat.missedHeartbeats
      });
      
    } catch (error) {
      console.error('[WebSocketConnector] Failed to send heartbeat:', error);
      this.handleHeartbeatError();
    }
  }
  
  /**
   * Start timeout timer for current heartbeat
   */
  private startHeartbeatTimeout(): void {
    // Clear any existing timeout
    if (this.heartbeat.timeoutTimer) {
      clearTimeout(this.heartbeat.timeoutTimer);
    }
    
    this.heartbeat.timeoutTimer = setTimeout(() => {
      this.handleHeartbeatTimeout();
    }, syncConfig.connectionTimeout);
  }
  
  /**
   * Handle heartbeat timeout (no response from server)
   */
  private handleHeartbeatTimeout(): void {
    this.heartbeat.missedHeartbeats++;
    
    console.warn('[WebSocketConnector] Heartbeat timeout', {
      missedCount: this.heartbeat.missedHeartbeats,
      lastPong: new Date(this.heartbeat.lastPongReceived).toISOString()
    });
    
    this.events.emit('heartbeat:timeout', {
      missedCount: this.heartbeat.missedHeartbeats,
      lastPongReceived: this.heartbeat.lastPongReceived
    });
    
    if (this.heartbeat.missedHeartbeats >= this.maxMissedHeartbeats) {
      console.error('[WebSocketConnector] Too many missed heartbeats, forcing reconnection');
      
      this.events.emit('heartbeat:connection_lost', {
        missedCount: this.heartbeat.missedHeartbeats,
        lastPongReceived: this.heartbeat.lastPongReceived
      });
      
      // Force reconnection
      this.handleConnectionLost();
    }
  }
  
  /**
   * Handle heartbeat-related errors
   */
  private handleHeartbeatError(): void {
    console.error('[WebSocketConnector] Heartbeat error detected');
    this.events.emit('heartbeat:error');
    
    // Increment missed heartbeats as if we had a timeout
    this.handleHeartbeatTimeout();
  }
  
  /**
   * Process heartbeat response messages
   */
  private handleHeartbeatMessage(rawData: string | Buffer | ArrayBuffer | Blob): void {
    try {
      let message: ServerMessage;
      
      if (typeof rawData === 'string') {
        message = JSON.parse(rawData);
      } else {
        return; // Not a heartbeat response if it's binary
      }
      
      if (message.type === 'srv_heartbeat') {
        this.onHeartbeatResponse(message);
      }
    } catch (error) {
      // Ignore parsing errors for heartbeat processing
      // The main message handler will deal with actual message processing
    }
  }
  
  /**
   * Handle heartbeat response from server
   */
  private onHeartbeatResponse(message: ServerMessage): void {
    const now = Date.now();
    const previousMissedCount = this.heartbeat.missedHeartbeats;
    
    // Reset heartbeat state
    this.heartbeat.lastPongReceived = now;
    this.heartbeat.missedHeartbeats = 0;
    
    // Clear timeout timer
    if (this.heartbeat.timeoutTimer) {
      clearTimeout(this.heartbeat.timeoutTimer);
      this.heartbeat.timeoutTimer = null;
    }
    
    console.log('[WebSocketConnector] Heartbeat response received', {
      responseTime: now,
      previousMissedCount
    });
    
    this.events.emit('heartbeat:response', {
      responseTime: now,
      wasRecovery: previousMissedCount > 0,
      serverMessage: message
    });
    
    // Check for any server-side warnings in heartbeat response
    if (message.serverLSN && message.serverLSN !== this.currentLsn) {
      console.warn('[WebSocketConnector] LSN drift detected in heartbeat', {
        clientLSN: this.currentLsn,
        serverLSN: message.serverLSN
      });
      
      this.events.emit('heartbeat:lsn_drift_detected', {
        clientLSN: this.currentLsn,
        serverLSN: message.serverLSN
      });
    }
  }
  
  /**
   * Handle connection lost scenario
   */
  private handleConnectionLost(): void {
    console.log('[WebSocketConnector] Connection lost, initiating recovery');
    
    // Stop heartbeat first
    this.stopHeartbeat();
    
    // Emit connection lost event
    this.events.emit('connection:lost', {
      reason: 'heartbeat_timeout',
      missedHeartbeats: this.heartbeat.missedHeartbeats
    });
    
    // Force disconnect and reconnect
    this.disconnect();
    
    if (this.autoReconnectEnabled) {
      setTimeout(() => {
        this.attemptReconnect();
      }, 1000);
    }
  }
  
  /**
   * Get current sync state for heartbeat context
   */
  private getCurrentSyncState(): string {
    // This could be enhanced to get actual sync state from SyncManager
    // For now, just return connection state
    return this.getStatus();
  }
  
  /**
   * Handle page visibility changes to optimize heartbeat frequency
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('[WebSocketConnector] Page hidden, heartbeat continues but marked as inactive');
    } else {
      console.log('[WebSocketConnector] Page visible, heartbeat marked as active');
      
      // Send immediate heartbeat when page becomes visible
      if (this.isConnected() && this.heartbeat.isActive) {
        setTimeout(() => this.sendHeartbeat(), 100);
      }
    }
  }

  // --- IMessageSender Implementation ---
  public send(messageData: Omit<ClientMessage, 'clientId' | 'messageId' | 'timestamp'>): void {
    if (!this.isConnected()) {
      throw new Error('Cannot send message: not connected');
    }

    try {
      const fullMessage: ClientMessage = {
        type: messageData.type,
        ...messageData,
        clientId: this.currentClientId,
        messageId: this.generateMessageId(),
        timestamp: Date.now()
      };

      // Log different message types appropriately
      if (messageData.type === 'clt_send_changes') {
        console.log(`[WebSocketConnector] Sending ${(messageData as any).changes?.length || 0} changes to server (clientId: ${this.currentClientId})`);
      } else if (messageData.type === 'clt_integrity_validation') {
        console.log(`[WebSocketConnector] Sending integrity validation request to server (clientId: ${this.currentClientId})`);
      } else {
        console.log(`[WebSocketConnector] Sending ${messageData.type} message to server (clientId: ${this.currentClientId})`);
      }

      const messageString = JSON.stringify(fullMessage);
      this.webSocket!.send(messageString);
      
      // Debug logging for integrity validation messages
      if (messageData.type === 'clt_integrity_validation') {
        console.log(`[WebSocketConnector] ✅ Successfully sent integrity validation message to server`);
        console.log(`[WebSocketConnector] WebSocket state:`, this.webSocket?.readyState, 'Message size:', messageString.length);
      }
    } catch (error) {
      console.error(`[WebSocketConnector] Failed to send message:`, error);
      // Optionally throw an error or emit a specific event
    }
  }

  // getClientId is not part of IMessageSender anymore, but setConnectionParams is.
  // public getClientId(): string {
  //   return this.currentClientId;
  // }

  /**
   * Get the current client ID - used by OutgoingChangeProcessor for anti-echo
   */
  public getClientId(): string {
    return this.currentClientId;
  }

  public setConnectionParams(clientId: string, lsn: string): void {
    this.currentClientId = clientId;
    this.currentLsn = lsn;
  }

  public isConnected(): boolean {
    return !!this.webSocket && this.webSocket.readyState === WebSocket.OPEN;
  }

  public getStatus(): 'connected' | 'disconnected' | 'connecting' | 'error' {
     if (!this.webSocket) return 'disconnected';
     switch (this.webSocket.readyState) {
        case WebSocket.CONNECTING: return 'connecting';
        case WebSocket.OPEN: return 'connected';
        // WebSocket.CLOSING could be mapped to 'connecting' or a specific 'disconnecting' status if needed
        case WebSocket.CLOSING: return 'connecting';
        case WebSocket.CLOSED: return 'disconnected';
        default: return 'error'; // Or 'unknown' if that's more appropriate
     }
  }
  
  private autoReconnectEnabled: boolean = true; // Internal state for auto-reconnect behavior

  public setAutoReconnect(enabled: boolean): void {
    this.autoReconnectEnabled = enabled;
    if (enabled && !this.isConnected() && this.webSocket?.readyState === WebSocket.CLOSED) {
        console.log("[WebSocketConnector] Auto-reconnect enabled, attempting to connect.");
        this.attemptReconnect();
    }
  }

  public isOnline(): boolean {
    // This can be a simple check or more sophisticated if needed
    return navigator.onLine;
  }

  public on(event: string, listener: (...args: any[]) => void): void {
     // Listeners should primarily use the SyncEventEmitter instance passed to SyncManager
     // This forwarding is for strict IMessageSender compliance if absolutely necessary
     this.events.on(event, listener);
  }
  public off(event: string, listener: (...args: any[]) => void): void {
     this.events.off(event, listener);
  }
  // --- End IMessageSender ---

  // Added suppressAuthErrors parameter to match SyncManager's call
  public async connect(serverUrlOverride?: string, suppressAuthErrors: boolean = false): Promise<boolean> {
    // suppressAuthErrors can be used in handleClose/handleError if specific auth errors occur
    // For now, its direct use in connect logic is minimal, but it's passed for consistency.
    if (this.isConnected()) {
        console.log('[WebSocketConnector] Already connected. Disconnecting first.');
        await this.disconnect(); // Use internal disconnect
    }
    this.isExplicitlyDisconnecting = false; // Reset flag on new connect attempt
    this.events.emit('connection:status', false); // Signal disconnected before connecting
    this.events.emit('connection:connecting'); // New event

    if (serverUrlOverride) {
        this.serverUrl = serverUrlOverride;
    }

    if (!this.currentClientId || !this.currentLsn) {
        console.error("[WebSocketConnector] Cannot connect without Client ID and LSN.");
        throw new Error("Client ID and LSN must be set before connecting.");
    }

    console.log(`[WebSocketConnector] Connecting to ${this.serverUrl} with LSN: ${this.currentLsn}, ClientID: ${this.currentClientId}`);

    return new Promise<boolean>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            console.warn('[WebSocketConnector] Connection timeout.');
            if (this.webSocket && this.webSocket.readyState === WebSocket.CONNECTING) {
                this.webSocket.close(1001, "Connection timeout"); // Close with appropriate code
            }
            // handleClose will manage state and reject/reconnect logic
            // reject(new Error('Connection timeout')); // Let handleClose reject if needed
        }, 10000); // 10s timeout

        const wsUrl = new URL(this.serverUrl);
        wsUrl.searchParams.set('clientId', this.currentClientId);
        wsUrl.searchParams.set('lsn', this.currentLsn);

        try {
            this.webSocket = new WebSocket(wsUrl.toString());
            this.webSocket.onopen = (event) => {
                clearTimeout(timeoutId);
                this.handleOpen(event);
                resolve(true);
            };
            this.webSocket.onclose = (event) => {
                clearTimeout(timeoutId);
                this.handleClose(event);
                // Reject only if it wasn't an explicit disconnect and not already resolved
                if (!this.isExplicitlyDisconnecting) {
                   reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`));
                }
                // If it was explicit, the disconnect method handles cleanup.
            };
            this.webSocket.onerror = (event) => {
                clearTimeout(timeoutId);
                this.handleError(event);
                reject(new Error('WebSocket connection error'));
            };
            this.webSocket.onmessage = this.handleMessage.bind(this); // Forward raw message
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('[WebSocketConnector] Error creating WebSocket:', error);
            this.webSocket = null; // Ensure ws is null on creation error
            this.events.emit('connection:status', false); // Ensure state is disconnected
            reject(error);
        }
    });
  }

  public async disconnect(): Promise<void> {
    // Adapted logic from SyncManager.disconnect() and completeDisconnect()
    if (this.isExplicitlyDisconnecting) return; // Prevent double disconnect
    console.log('[WebSocketConnector] Initiating disconnect...');
    this.isExplicitlyDisconnecting = true;

    // Stop heartbeat when disconnecting
    this.stopHeartbeat();

    if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    const ws = this.webSocket;
    this.webSocket = null; // Clear immediately

    this.events.emit('connection:status', false); // Emit disconnected status

    if (!ws || ws.readyState === WebSocket.CLOSED) {
        console.log('[WebSocketConnector] No active connection or already closed.');
        this.isExplicitlyDisconnecting = false; // Reset flag
        return;
    }

    return new Promise((resolve) => {
         const closeTimeout = setTimeout(() => {
            console.warn('[WebSocketConnector] Disconnect close event timeout. Forcing cleanup.');
            ws.onopen = null;
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            this.isExplicitlyDisconnecting = false;
            resolve();
         }, 2000); // 2s timeout for close event

         ws.onclose = () => {
            clearTimeout(closeTimeout);
            console.log('[WebSocketConnector] Disconnect successful (WebSocket closed).');
            this.isExplicitlyDisconnecting = false;
            resolve();
         };

         ws.onerror = (err) => { // Handle errors during close
            clearTimeout(closeTimeout);
            console.error('[WebSocketConnector] Error during disconnect:', err);
            this.isExplicitlyDisconnecting = false;
            resolve(); // Resolve anyway after error
         };

         if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, 'Client initiated disconnect');
         } else {
            // If CLOSING, just wait for the onclose handler
            console.log('[WebSocketConnector] WebSocket already closing.');
         }
    });
  }

  // Private handlers
  private handleOpen(event: Event): void {
    console.log('[WebSocketConnector] WebSocket connected.');
    this.reconnectAttempts = 0; // Reset on successful connection
    
    // Start heartbeat on successful connection
    this.startHeartbeat();
    
    this.events.emit('connection:status', true);
    this.events.emit('websocket:open', event);
  }

  private handleClose(event: CloseEvent): void {
     // Only handle if not explicitly disconnecting or if ws reference still exists
     if (this.isExplicitlyDisconnecting) {
         console.log(`[WebSocketConnector] Ignoring close event during explicit disconnect: ${event.code}`);
         return;
     }
     console.log(`[WebSocketConnector] WebSocket disconnected: ${event.code} ${event.reason}`);
     
     // Stop heartbeat on connection close
     this.stopHeartbeat();
     
     this.webSocket = null; // Ensure it's null
     this.events.emit('connection:status', false);
     this.events.emit('websocket:close', event);

     // Special handling for dev server restarts (code 1006)
     if (event.code === 1006 && import.meta.env.DEV) {
         console.log('🔍 [WS] Detected dev server restart, will attempt graceful reconnect without triggering state resets');
         console.log('🔍 [WS] autoReconnectEnabled:', this.autoReconnectEnabled);
         console.log('🔍 [WS] isExplicitlyDisconnecting:', this.isExplicitlyDisconnecting);
         // Reset reconnect attempts for dev server restarts
         this.reconnectAttempts = 0;
         // Use a longer delay for dev server restarts to allow HMR to complete
         setTimeout(() => {
             // Only reconnect if we're still in a valid state (not destroyed)
             if (this.autoReconnectEnabled && !this.isExplicitlyDisconnecting) {
                 console.log('🔍 [WS] Attempting reconnect after dev server restart delay');
                 this.connect().catch(error => {
                     console.error('🔍 [WS] Dev server reconnect failed:', error);
                 });
             } else {
                 console.log('🔍 [WS] Skipping reconnect - conditions not met');
             }
         }, 2000); // Increased delay to allow HMR updates to settle
         return;
     }

     // Attempt reconnect only for non-clean closes and if autoReconnect is enabled
     if (this.autoReconnectEnabled && event.code !== 1000 && event.code !== 1005 /* No Status Received */ && !this.isExplicitlyDisconnecting) {
         this.attemptReconnect();
     }
  }

  private handleError(event: Event): void {
    console.error('[WebSocketConnector] WebSocket error:', event);
    this.events.emit('websocket:error', event);
    // Close event will likely follow, triggering reconnect logic if needed
  }

  private handleMessage(event: MessageEvent): void {
    // Forward the raw message data via the event emitter
    // Parsing and specific handling will be done by SyncMessageHandler
    this.events.emit('websocket:message', event.data);
  }

  private attemptReconnect(): void {
    // Logic from SyncManager.attemptReconnect() - ensure autoReconnectEnabled is checked
    if (!this.autoReconnectEnabled || this.isExplicitlyDisconnecting) {
        if (this.isExplicitlyDisconnecting) console.log("[WebSocketConnector] Explicit disconnect, not attempting reconnect.");
        else console.log("[WebSocketConnector] Auto-reconnect disabled, not attempting reconnect.");
        return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log(`[WebSocketConnector] Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
        this.events.emit('websocket:maxReconnectAttempts'); // Emit an event
        return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`[WebSocketConnector] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
        console.log(`[WebSocketConnector] Attempting reconnect ${this.reconnectAttempts}...`);
        this.connect().catch(error => {
            console.error(`[WebSocketConnector] Reconnect attempt ${this.reconnectAttempts} failed:`, error);
            // handleClose should trigger the next attempt if appropriate
        });
    }, delay);
  }

  private handleOnline = (): void => {
    console.log('[WebSocketConnector] Network online.');
    // Attempt immediate reconnect if disconnected, not explicitly disconnected, and autoReconnect is enabled
    if (this.autoReconnectEnabled && !this.isConnected() && !this.isExplicitlyDisconnecting && this.webSocket?.readyState !== WebSocket.CONNECTING) {
        console.log('[WebSocketConnector] Attempting to reconnect after network came online...');
        this.reconnectAttempts = 0; // Reset attempts on network recovery
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer); // Clear scheduled retry
        this.connect(undefined, true).catch(err => { // Pass undefined for URL, true for suppressAuthErrors
            console.error('[WebSocketConnector] Reconnect attempt after online failed:', err);
        });
    }
  }
  
  private handleOffline = (): void => {
     console.warn('[WebSocketConnector] Network offline.');
     this.events.emit('network:offline'); // Emit network offline event
     // Optional: Could immediately close the socket if desired,
     // but letting it fail naturally might be better for reconnect logic.
     if (this.reconnectTimer) {
         clearTimeout(this.reconnectTimer); // Stop scheduled reconnects while offline
         this.reconnectTimer = null;
         console.log('[WebSocketConnector] Cleared reconnect timer due to network offline.');
     }
  }

  // Helper to generate message IDs (can be simple UUIDs or other unique strings)
  private generateMessageId(): string {
    // Using a simple timestamp-random combo for now, replace with UUID if available and preferred
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private getWebSocketStateString(state: number): string {
     switch (state) {
       case WebSocket.CONNECTING: return 'CONNECTING';
       case WebSocket.OPEN: return 'OPEN';
       case WebSocket.CLOSING: return 'CLOSING';
       case WebSocket.CLOSED: return 'CLOSED';
       default: return `UNKNOWN (${state})`;
     }
  }

  public destroy(): void {
     console.log('[WebSocketConnector] Destroying...');
     window.removeEventListener('online', this.handleOnline);
     window.removeEventListener('offline', this.handleOffline);
     if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
     this.disconnect(); // Ensure connection is closed
  }
}

// HMR: Accept hot updates for this module
if (import.meta.hot) {
  import.meta.hot.accept();
}