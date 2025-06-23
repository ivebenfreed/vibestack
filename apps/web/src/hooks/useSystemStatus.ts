import { useState, useEffect } from 'react'
import { useAppInit, useSystem } from '@/state-machines/orchestrator-hooks-v2'

export type SystemMode = 'online' | 'offline' | 'degraded'

interface SystemStatus {
  mode: SystemMode
  isOnline: boolean
  isSyncReady: boolean
  syncStatus: string
  connectionAttempts?: number
}

/**
 * Hook to monitor overall system status for UI indicators
 * Combines network status, sync status, and database status
 */
export function useSystemStatus(): SystemStatus {
  const { isDatabaseInitialized, isSyncReady, connectionStatus, liveChangesStatus } = useAppInit()
  const { isSystemReady } = useSystem()
  
  const isConnectionOnline = connectionStatus === 'connected'
  const isDatabaseReady = isDatabaseInitialized
  const isSyncLive = isSyncReady && liveChangesStatus === 'connected'
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  
  // Map v2 data to sync state
  const syncState = connectionStatus === 'connecting' ? 'syncing' : 
                   isSyncLive ? 'live' : 
                   'idle'

  // Monitor network status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Determine system mode based on various factors
  const mode: SystemMode = (() => {
    // Network offline = offline mode
    if (!isOnline) return 'offline'
    
    // Database not ready = degraded mode
    if (!isDatabaseReady) return 'degraded'
    
    // Sync is live = online mode
    if (isConnectionOnline && isSyncLive) return 'online'
    
    // Sync issues but network online = degraded mode
    if (syncState === 'idle' || syncState === 'error') return 'degraded'
    
    // Connecting states = degraded mode
    if (syncState === 'syncing') return 'degraded'
    
    // Default to degraded if unclear
    return 'degraded'
  })()

  const isSyncReady = isConnectionOnline && isSyncLive

  return {
    mode,
    isOnline,
    isSyncReady,
    syncStatus: syncState,
    connectionAttempts: undefined // Could be enhanced to track this
  }
}

/**
 * Utility to get user-friendly status messages
 */
export function getSystemStatusMessage(status: SystemStatus): string {
  switch (status.mode) {
    case 'online':
      return 'All systems online'
    case 'offline':
      return 'Working offline'
    case 'degraded':
      if (status.syncStatus === 'connecting') {
        return 'Connecting to server...'
      }
      if (status.syncStatus === 'catchup') {
        return 'Syncing latest changes...'
      }
      if (status.syncStatus === 'disconnected') {
        return 'Connection lost - working with local data'
      }
      return 'Limited connectivity'
    default:
      return 'Checking status...'
  }
}

/**
 * Utility to get status colors for UI
 */
export function getSystemStatusColor(status: SystemStatus): string {
  switch (status.mode) {
    case 'online':
      return 'text-green-600'
    case 'offline':
      return 'text-gray-600'
    case 'degraded':
      return 'text-yellow-600'
    default:
      return 'text-gray-400'
  }
} 