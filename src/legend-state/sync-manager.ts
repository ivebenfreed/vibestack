/**
 * Legend State Reactive Sync Manager
 * 
 * Replaces the XState simple notification sync machine with pure Legend State
 * reactive observables for WebSocket connection management and table notifications.
 * 
 * Features:
 * - Reactive connection state management
 * - Auto-reconnection with exponential backoff
 * - Direct observable updates (no CustomEvent bridge)
 * - Persistent client ID management
 * - Heartbeat mechanism for server replication
 */

import { observable, computed, when } from '@legendapp/state'
import { getOrgActorWebSocketUrl, syncConfig } from '../sync/config'
import { log } from '@/logger'

const fileLog = log('legend-state/sync-manager.ts')

// Reactive sync state observable
export interface SyncState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  
  // Connection details
  organizationId: string | null
  userId: string | null
  clientId: string
  serverUrl: string | null
  
  // WebSocket reference
  webSocket: WebSocket | null
  
  // Reconnection management
  reconnectAttempts: number
  maxReconnectAttempts: number
  reconnectTimeout: NodeJS.Timeout | null
  
  // Heartbeat management
  heartbeatInterval: NodeJS.Timeout | null
  
  // Notification tracking
  lastNotification: {
    tables: string[]
    organizationId: string
    timestamp: number
    lsn?: string
    source?: string
    messageId?: string
  } | null
}

// Main sync state observable
export const syncState$ = observable<SyncState>({
  isConnected: false,
  isConnecting: false,
  error: null,
  
  organizationId: null,
  userId: null,
  clientId: '',
  serverUrl: null,
  
  webSocket: null,
  
  reconnectAttempts: 0,
  maxReconnectAttempts: syncConfig.maxReconnectAttempts,
  reconnectTimeout: null,
  
  heartbeatInterval: null,
  
  lastNotification: null
})

// Computed connection status for easier consumption
export const connectionStatus$ = computed(() => {
  const state = syncState$.get()
  
  if (state.error) return 'error'
  if (state.isConnecting) return 'connecting'
  if (state.isConnected) return 'connected'
  return 'disconnected'
})

// Computed status text for debugging
export const statusText$ = computed(() => {
  const state = syncState$.get()
  const status = connectionStatus$.get()
  
  switch (status) {
    case 'error':
      return `Error: ${state.error} (attempt ${state.reconnectAttempts}/${state.maxReconnectAttempts})`
    case 'connecting':
      return 'Connecting to WebSocket...'
    case 'connected':
      return 'Connected - receiving notifications'
    case 'disconnected':
      return 'Disconnected'
    default:
      return 'Unknown'
  }
})

/**
 * Generate or retrieve persistent client ID for WebSocket connection
 */
function getPersistentClientId(): string {
  let persistentClientId = localStorage.getItem('vibestack_websocket_client_id')
  if (!persistentClientId) {
    persistentClientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    localStorage.setItem('vibestack_websocket_client_id', persistentClientId)
    fileLog.info('🆔 Generated new persistent client ID:', persistentClientId)
  } else {
    fileLog.info('🆔 Using existing persistent client ID:', persistentClientId)
  }
  return persistentClientId
}

/**
 * Create WebSocket connection with reactive state management
 */
async function createWebSocketConnection(serverUrl: string, clientId: string, organizationId: string): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    try {
      const ws = new WebSocket(`${serverUrl}?clientId=${clientId}&organizationId=${organizationId}&lsn=0/0`)
      
      const connectionTimeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket connection timeout'))
      }, syncConfig.connectionTimeout)
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout)
        fileLog.info('✅ WebSocket connected for notifications')
        resolve(ws)
      }
      
      ws.onerror = (error) => {
        clearTimeout(connectionTimeout)
        fileLog.error('❌ WebSocket connection error:', error)
        reject(new Error('WebSocket connection failed'))
      }
      
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout)
        fileLog.warn('🔌 WebSocket closed:', event.code, event.reason)
      }
      
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Set up WebSocket message and event handlers
 */
function setupWebSocketHandlers(ws: WebSocket) {
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      
      // Log non-heartbeat messages for debugging
      if (message.type !== 'srv_heartbeat') {
        fileLog.debug('🔄 WebSocket message received:', {
          type: message.type,
          messageId: message.messageId,
          fullMessage: message
        })
      }
      
      // Handle table change notifications
      if (message.type === 'srv_table_change_notification') {
        fileLog.info('🔔 Table notification:', JSON.stringify(message.tables))
        
        // Update sync state with notification data
        syncState$.lastNotification.set({
          tables: message.tables,
          organizationId: message.organizationId,
          timestamp: message.timestamp || Date.now(),
          lsn: message.lsn,
          source: message.source,
          messageId: message.messageId
        })
        
        // Dispatch direct event to Legend State observables (replacing CustomEvent)
        fileLog.info('📋 Processing table notification directly in Legend State')
        
        // TODO: Direct Legend State entity refresh will replace this event dispatch
        // For now, maintain compatibility with existing CustomEvent pattern
        window.dispatchEvent(new CustomEvent('vibestack:table-change-notification', {
          detail: {
            tables: message.tables,
            organizationId: message.organizationId,
            lsn: message.lsn,
            source: message.source,
            messageId: message.messageId,
            timestamp: message.timestamp || Date.now()
          }
        }))
        
      } else if (message.type === 'srv_heartbeat') {
        fileLog.debug('💓 Heartbeat received')
      } else if (message.type === 'srv_live_start') {
        fileLog.debug('🚀 Live sync session started:', {
          messageId: message.messageId,
          organizationId: message.organizationId,
          clientId: message.clientId
        })
      } else {
        fileLog.debug(`❓ Unknown message type: ${message.type}`)
      }
      
    } catch (error) {
      fileLog.error('Failed to parse WebSocket message:', error)
    }
  }
  
  ws.onclose = () => {
    fileLog.warn('WebSocket disconnected')
    // Trigger reconnection attempt
    handleDisconnection('WebSocket closed')
  }
  
  ws.onerror = (error) => {
    fileLog.error('WebSocket error:', error)
    handleDisconnection('WebSocket error')
  }
}

/**
 * Start heartbeat to trigger server replication
 */
function startHeartbeat() {
  const heartbeatTimer = setInterval(() => {
    const state = syncState$.peek()
    if (state.webSocket && state.webSocket.readyState === WebSocket.OPEN) {
      try {
        const heartbeatMessage = {
          type: 'clt_heartbeat',
          clientId: state.clientId,
          lsn: '0/0',
          organizationId: state.organizationId,
          messageId: `heartbeat_${Date.now()}`,
          timestamp: Date.now()
        }
        
        state.webSocket.send(JSON.stringify(heartbeatMessage))
        fileLog.debug('💓 Heartbeat sent - triggering replication')
      } catch (error) {
        fileLog.error('Failed to send heartbeat:', error)
      }
    }
  }, syncConfig.heartbeatInterval)
  
  syncState$.heartbeatInterval.set(heartbeatTimer)
  fileLog.info(`💓 Started heartbeat timer (${syncConfig.heartbeatInterval}ms)`)
}

/**
 * Stop heartbeat timer
 */
function stopHeartbeat() {
  const heartbeatTimer = syncState$.heartbeatInterval.peek()
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    syncState$.heartbeatInterval.set(null)
    fileLog.info('💓 Stopped heartbeat timer')
  }
}

/**
 * Handle disconnection with reconnection logic
 */
function handleDisconnection(reason: string) {
  const currentState = syncState$.peek()
  
  // Update connection state
  syncState$.assign({
    isConnected: false,
    isConnecting: false,
    error: reason
  })
  
  // Stop heartbeat
  stopHeartbeat()
  
  // Clean up WebSocket
  if (currentState.webSocket) {
    currentState.webSocket.close()
    syncState$.webSocket.set(null)
  }
  
  // Attempt reconnection if under max attempts
  if (currentState.reconnectAttempts < currentState.maxReconnectAttempts) {
    const delay = syncConfig.reconnectBaseDelay * Math.pow(2, currentState.reconnectAttempts)
    
    fileLog.info(`🔄 Reconnecting in ${delay}ms (attempt ${currentState.reconnectAttempts + 1}/${currentState.maxReconnectAttempts})`)
    
    const timeout = setTimeout(async () => {
      try {
        syncState$.reconnectTimeout.set(null)
        await syncActions.connect(currentState.organizationId!, currentState.userId!)
      } catch (error) {
        fileLog.error('Reconnection failed:', error)
      }
    }, delay)
    
    syncState$.reconnectTimeout.set(timeout)
    syncState$.reconnectAttempts.set(currentState.reconnectAttempts + 1)
    
  } else {
    fileLog.error('💀 Max reconnection attempts exceeded')
    syncState$.error.set('Max reconnection attempts exceeded')
  }
}

/**
 * Sync actions for external control
 */
export const syncActions = {
  /**
   * Connect to WebSocket server
   */
  async connect(organizationId: string, userId: string): Promise<void> {
    fileLog.info('🔗 Initiating sync connection:', { organizationId, userId })
    
    // Update connection state
    syncState$.assign({
      isConnecting: true,
      error: null,
      organizationId,
      userId,
      clientId: getPersistentClientId(),
      serverUrl: getOrgActorWebSocketUrl(organizationId)
    })
    
    try {
      const ws = await createWebSocketConnection(
        syncState$.serverUrl.peek()!,
        syncState$.clientId.peek(),
        organizationId
      )
      
      // Set up message handlers
      setupWebSocketHandlers(ws)
      
      // Update state to connected
      syncState$.assign({
        webSocket: ws,
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0
      })
      
      // Start heartbeat
      startHeartbeat()
      
      fileLog.info('✅ Sync connection established successfully')
      
    } catch (error) {
      fileLog.error('❌ Failed to connect:', error)
      syncState$.assign({
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        reconnectAttempts: syncState$.reconnectAttempts.peek() + 1
      })
      
      // Trigger reconnection attempt
      handleDisconnection(error instanceof Error ? error.message : 'Connection failed')
    }
  },
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    fileLog.info('🔌 Disconnecting sync')
    
    const state = syncState$.peek()
    
    // Clear reconnection timeout
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout)
    }
    
    // Stop heartbeat
    stopHeartbeat()
    
    // Close WebSocket
    if (state.webSocket) {
      state.webSocket.close()
    }
    
    // Reset state
    syncState$.assign({
      isConnected: false,
      isConnecting: false,
      error: null,
      webSocket: null,
      reconnectAttempts: 0,
      reconnectTimeout: null,
      heartbeatInterval: null
    })
    
    fileLog.info('✅ Sync disconnected')
  },
  
  /**
   * Force reconnection attempt
   */
  async reconnect(): Promise<void> {
    const state = syncState$.peek()
    
    if (!state.organizationId || !state.userId) {
      throw new Error('Cannot reconnect without organization and user ID')
    }
    
    // Reset reconnection attempts
    syncState$.assign({
      reconnectAttempts: 0,
      error: null
    })
    
    // Disconnect first
    this.disconnect()
    
    // Wait briefly then reconnect
    await new Promise(resolve => setTimeout(resolve, 100))
    await this.connect(state.organizationId, state.userId)
  },
  
  /**
   * Reset sync state completely
   */
  reset(): void {
    this.disconnect()
    
    syncState$.assign({
      organizationId: null,
      userId: null,
      clientId: '',
      serverUrl: null,
      lastNotification: null
    })
    
    fileLog.info('🔄 Sync state reset')
  }
}

/**
 * Cleanup function for HMR compatibility
 */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    fileLog.info('🔥 HMR: Cleaning up sync manager')
    syncActions.disconnect()
  })
  
  import.meta.hot.accept(() => {
    fileLog.info('🔥 HMR: Sync manager reloaded')
  })
}

// Export for debugging
if (import.meta.env.DEV) {
  ;(window as any).__vibestack_sync_manager = {
    syncState$,
    connectionStatus$,
    statusText$,
    syncActions
  }
}