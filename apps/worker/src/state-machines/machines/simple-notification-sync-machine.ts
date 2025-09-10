/**
 * Simple Notification Sync Machine
 * 
 * Replaces the complex pure-livestore-sync-machine.ts with a simple
 * WebSocket-based table notification system for Legend State integration.
 * 
 * States:
 * - disconnected: No WebSocket connection
 * - connected: WebSocket connected, receiving table notifications
 * - error: Connection error (with auto-retry)
 */

import { setup, assign, fromPromise } from 'xstate'
import { getSyncWebSocketUrl, getOrgActorWebSocketUrl } from '../../sync/config'
import { syncLogger } from '../../sync/utils/SyncLogger'
import { log } from '@/logger';
const fileLog = log('sync/simple-notification-sync-machine.ts');

// Simple context for table notifications only
export interface SimpleNotificationSyncContext {
  // Connection essentials
  clientId: string
  organizationId: string | null
  userId: string | null
  serverUrl: string | null
  
  // Connection state
  isConnected: boolean
  webSocket: WebSocket | null
  
  // Error handling
  error: string | null
  reconnectAttempts: number
  maxReconnectAttempts: number
  
  // Table change notifications
  lastNotification: {
    tables: string[]
    organizationId: string
    timestamp: number
  } | null
}

// Simple events for table notifications
export type SimpleNotificationSyncEvent =
  | { type: 'CONNECT'; organizationId: string; userId: string }
  | { type: 'DISCONNECT' }
  | { type: 'RECONNECT' }
  | { type: 'WS_CONNECTED' }
  | { type: 'WS_DISCONNECTED'; reason?: string }
  | { type: 'WS_ERROR'; error: Error }
  | { type: 'WS_MESSAGE'; message: any }
  | { type: 'TABLE_NOTIFICATION_RECEIVED'; tables: string[]; organizationId: string }
  | { type: 'RETRY' }
  | { type: 'RESET' }

// WebSocket connection service
const connectWebSocket = fromPromise(async ({ input }: { input: { serverUrl: string; clientId: string; organizationId: string } }) => {
  const { serverUrl, clientId, organizationId } = input
  
  return new Promise<WebSocket>((resolve, reject) => {
    try {
      const ws = new WebSocket(`${serverUrl}?clientId=${clientId}&organizationId=${organizationId}&lsn=0/0`)
      
      ws.onopen = () => {
        syncLogger.info('notification-sync', `✅ WebSocket connected for notifications`)
        resolve(ws)
      }
      
      ws.onerror = (error) => {
        syncLogger.error('notification-sync', `❌ WebSocket connection error: ${error}`)
        reject(new Error('WebSocket connection failed'))
      }
      
      ws.onclose = (event) => {
        syncLogger.warn('notification-sync', `🔌 WebSocket closed: ${event.code} ${event.reason}`)
      }
      
    } catch (error) {
      reject(error)
    }
  })
})

// Simple notification sync machine
export const simpleNotificationSyncMachine = setup({
  types: {
    context: {} as SimpleNotificationSyncContext,
    events: {} as SimpleNotificationSyncEvent
  },
  
  actors: {
    connectWebSocket
  },
  
  actions: {
    setupWebSocketListeners: ({ context, self }) => {
      fileLog.info('🔧 Setting up WebSocket listeners')
      if (!context.webSocket) {
        fileLog.warn('❌ No WebSocket to set up listeners on')
        return
      }
      
      context.webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          // DEBUG: Log incoming messages at debug level
          if (message.type !== 'srv_heartbeat') {
            syncLogger.debug('notification-sync', '🔄 RAW WebSocket message received', {
              type: message.type,
              messageId: message.messageId,
              fullMessage: message
            });
          }
          
          // Send message to the XState machine for proper state management
          self.send({ type: 'WS_MESSAGE', message })
          
          // Handle table change notifications immediately for Legend State
          if (message.type === 'srv_table_change_notification') {
            syncLogger.info('notification-sync', `🔔 Table notification: ${JSON.stringify(message.tables)}`)
            fileLog.info('🔔 [SimpleNotificationSync] TABLE CHANGE NOTIFICATION:', {
              tables: message.tables,
              organizationId: message.organizationId,
              lsn: message.lsn,
              source: message.source,
              messageId: message.messageId,
              timestamp: message.timestamp
            })
            
            // DIRECT CustomEvent dispatch in XState handler - bypass the onmessage handler
            fileLog.info('🚀 [SimpleNotificationSync] Dispatching CustomEvent vibestack:table-change-notification')
            fileLog.info('📋 [SimpleNotificationSync] Event detail:', {
              tables: message.tables,
              organizationId: message.organizationId,
              lsn: message.lsn,
              source: message.source,
              messageId: message.messageId,
              timestamp: message.timestamp || Date.now()
            })
            
            window.dispatchEvent(new CustomEvent('vibestack:table-change-notification', {
              detail: {
                tables: message.tables,
                organizationId: message.organizationId,
                lsn: message.lsn,
                source: message.source,
                messageId: message.messageId,
                timestamp: message.timestamp || Date.now()
              }
            }));
            
            fileLog.info('✅ [SimpleNotificationSync] CustomEvent dispatched')
            
          } else if (message.type === 'srv_heartbeat') {
            // Silent heartbeat handling at debug level
            syncLogger.debug('notification-sync', 'Heartbeat received')
          } else if (message.type === 'srv_live_start') {
            // Live sync session started at debug level
            syncLogger.debug('notification-sync', 'Live sync session started', {
              messageId: message.messageId,
              organizationId: message.organizationId,
              clientId: message.clientId
            });
          } else {
            syncLogger.debug('notification-sync', `Unknown message type: ${message.type}`)
          }
          
        } catch (error) {
          syncLogger.error('notification-sync', `Failed to parse WebSocket message: ${error}`)
        }
      }
      
      context.webSocket.onclose = () => {
        syncLogger.warn('notification-sync', 'WebSocket disconnected')
        self.send({ type: 'WS_DISCONNECTED', reason: 'WebSocket closed' })
      }
      
      context.webSocket.onerror = (error) => {
        syncLogger.error('notification-sync', `WebSocket error: ${error}`)
        self.send({ type: 'WS_ERROR', error })
      }
    },
    
    startHeartbeat: ({ context, self }) => {
      // Start client-side heartbeat to trigger server replication
      const heartbeatInterval = 30000; // 30 seconds
      
      const heartbeatTimer = setInterval(() => {
        if (context.webSocket && context.webSocket.readyState === WebSocket.OPEN) {
          try {
            const heartbeatMessage = {
              type: 'clt_heartbeat',
              clientId: context.clientId,
              lsn: '0/0', // Simple implementation - no LSN tracking yet
              organizationId: context.organizationId,
              messageId: `heartbeat_${Date.now()}`,
              timestamp: Date.now()
            };
            
            context.webSocket.send(JSON.stringify(heartbeatMessage));
            // Heartbeat sent at debug level
            syncLogger.debug('notification-sync', `💓 Heartbeat sent - triggering replication`);
          } catch (error) {
            syncLogger.error('notification-sync', `Failed to send heartbeat: ${error}`)
          }
        }
      }, heartbeatInterval);
      
      // Store timer for cleanup
      (context as any).heartbeatTimer = heartbeatTimer;
      syncLogger.info('notification-sync', `💓 Started heartbeat timer (${heartbeatInterval}ms)`);
    },
    
    stopHeartbeat: ({ context }) => {
      if ((context as any).heartbeatTimer) {
        clearInterval((context as any).heartbeatTimer);
        (context as any).heartbeatTimer = null;
        syncLogger.info('notification-sync', `💓 Stopped heartbeat timer`);
      }
    },
    
    cleanupWebSocket: ({ context }) => {
      if (context.webSocket) {
        context.webSocket.close()
      }
    }
  }
  
}).createMachine({
  id: 'simpleNotificationSync',
  
  context: {
    clientId: '',
    organizationId: null,
    userId: null,
    serverUrl: null,
    isConnected: false,
    webSocket: null,
    error: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    lastNotification: null
  },
  
  initial: 'disconnected',
  
  states: {
    disconnected: {
      entry: [
        assign({ 
          isConnected: false, 
          webSocket: null, 
          error: null 
        }),
        () => syncLogger.info('notification-sync', '🔌 Disconnected - ready to connect')
      ],
      
      on: {
        CONNECT: {
          target: 'connecting',
          actions: [
            ({ event }) => {
              fileLog.info('[SimpleNotificationSync] 🔗 CONNECT event received!', {
                organizationId: event.organizationId,
                userId: event.userId
              })
            },
            assign({
              organizationId: ({ event }) => event.organizationId,
              userId: ({ event }) => event.userId,
              clientId: ({ context }) => {
                // Use persistent client ID to maintain connection across reconnects
                let persistentClientId = localStorage.getItem('vibestack_websocket_client_id')
                if (!persistentClientId) {
                  persistentClientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                  localStorage.setItem('vibestack_websocket_client_id', persistentClientId)
                  fileLog.info('🆔 [SimpleNotificationSync] Generated new persistent client ID:', persistentClientId)
                } else {
                  fileLog.info('🆔 [SimpleNotificationSync] Using existing persistent client ID:', persistentClientId)
                }
                return persistentClientId
              },
              serverUrl: ({ event }) => getOrgActorWebSocketUrl(event.organizationId)
            })
          ]
        }
      }
    },
    
    connecting: {
      entry: () => syncLogger.info('notification-sync', '🔄 Connecting to WebSocket...'),
      
      invoke: {
        src: 'connectWebSocket',
        input: ({ context }) => ({
          serverUrl: context.serverUrl!,
          clientId: context.clientId,
          organizationId: context.organizationId!
        }),
        onDone: {
          target: 'connected',
          actions: [
            assign({
              webSocket: ({ event }) => event.output,
              isConnected: true,
              error: null,
              reconnectAttempts: 0
            }),
            'setupWebSocketListeners',
            'startHeartbeat'
          ]
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.error.message,
            reconnectAttempts: ({ context }) => context.reconnectAttempts + 1
          })
        }
      },
      
      on: {
        DISCONNECT: {
          target: 'disconnected',
          actions: ['stopHeartbeat', 'cleanupWebSocket']
        }
      }
    },
    
    connected: {
      entry: () => syncLogger.info('notification-sync', '✅ Connected - listening for table notifications'),
      
      on: {
        WS_MESSAGE: {
          actions: [
            assign(({ event }) => {
              const message = event.message
              if (message.type === 'srv_table_change_notification') {
                // Update context with last notification
                return {
                  lastNotification: {
                    tables: message.tables,
                    organizationId: message.organizationId,
                    timestamp: Date.now()
                  }
                }
              }
              // Return empty object if not a table change notification
              return {}
            })
          ]
        },
        
        WS_DISCONNECTED: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.reason || 'WebSocket disconnected',
            isConnected: false
          })
        },
        
        DISCONNECT: {
          target: 'disconnected',
          actions: ['stopHeartbeat', 'cleanupWebSocket']
        }
      }
    },
    
    error: {
      entry: [
        assign({ isConnected: false }),
        ({ context }) => syncLogger.error('notification-sync', `❌ Error: ${context.error} (attempt ${context.reconnectAttempts}/${context.maxReconnectAttempts})`)
      ],
      
      after: {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        1000: [
          {
            guard: ({ context }) => context.reconnectAttempts < context.maxReconnectAttempts,
            target: 'connecting'
          },
          {
            target: 'disconnected',
            actions: () => syncLogger.error('notification-sync', '💀 Max reconnection attempts exceeded')
          }
        ]
      },
      
      on: {
        RETRY: {
          target: 'connecting',
          actions: assign({ error: null })
        },
        
        RESET: {
          target: 'disconnected',
          actions: [
            assign({ 
              reconnectAttempts: 0, 
              error: null 
            }),
            'cleanupWebSocket'
          ]
        },
        
        DISCONNECT: {
          target: 'disconnected',
          actions: ['stopHeartbeat', 'cleanupWebSocket']
        }
      }
    }
  }
})

// Hook for using the simple notification sync machine
export function useSimpleNotificationSync() {
  // This will be implemented with xstate React hooks
  // For now, just export the machine
  return simpleNotificationSyncMachine
}