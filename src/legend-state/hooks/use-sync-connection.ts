/**
 * React Hook for Sync Connection State
 * 
 * Provides reactive access to the Legend State sync manager for React components.
 * This replaces the XState-based useSync hook with pure Legend State patterns.
 */

import { use$ } from '@legendapp/state/react'
import { syncState$, connectionStatus$, statusText$, syncActions, type SyncState } from '../sync-manager'

export interface SyncConnectionState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  connectionStatus: 'connected' | 'connecting' | 'error' | 'disconnected'
  error: string | null
  statusText: string
  
  // Connection details
  organizationId: string | null
  userId: string | null
  clientId: string
  serverUrl: string | null
  
  // Reconnection info
  reconnectAttempts: number
  maxReconnectAttempts: number
  
  // Notification data
  lastNotification: SyncState['lastNotification']
  
  // Actions
  connect: (organizationId: string, userId: string) => Promise<void>
  disconnect: () => void
  reconnect: () => Promise<void>
  reset: () => void
}

/**
 * Hook for accessing sync connection state and actions
 */
export function useSyncConnection(): SyncConnectionState {
  // Use reactive Legend State observables
  const syncState = use$(syncState$)
  const connectionStatus = use$(connectionStatus$)
  const statusText = use$(statusText$)
  
  return {
    // Connection state
    isConnected: syncState.isConnected,
    isConnecting: syncState.isConnecting,
    connectionStatus,
    error: syncState.error,
    statusText,
    
    // Connection details
    organizationId: syncState.organizationId,
    userId: syncState.userId,
    clientId: syncState.clientId,
    serverUrl: syncState.serverUrl,
    
    // Reconnection info
    reconnectAttempts: syncState.reconnectAttempts,
    maxReconnectAttempts: syncState.maxReconnectAttempts,
    
    // Notification data
    lastNotification: syncState.lastNotification,
    
    // Actions
    connect: syncActions.connect,
    disconnect: syncActions.disconnect,
    reconnect: syncActions.reconnect,
    reset: syncActions.reset
  }
}

/**
 * Lightweight hook that only returns connection status (for performance)
 */
export function useSyncStatus() {
  const connectionStatus = use$(connectionStatus$)
  const isConnected = use$(syncState$.isConnected)
  const error = use$(syncState$.error)
  
  return {
    connectionStatus,
    isConnected,
    error,
    isActive: connectionStatus === 'connected' && !error
  }
}

/**
 * Hook that only returns the last notification (for table change monitoring)
 */
export function useSyncNotification() {
  const lastNotification = use$(syncState$.lastNotification)
  
  return {
    lastNotification,
    hasNotification: lastNotification !== null
  }
}