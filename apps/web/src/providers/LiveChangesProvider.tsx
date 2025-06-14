/**
 * Live Changes Provider
 * 
 * Pure background provider that initializes live changes for all entities.
 * Operates completely in the background with no context exposure.
 * Errors bubble to global error boundary with retry options.
 */

import React, { useEffect } from 'react'
import { liveChangesManager } from '@/lib/live-changes-manager'
import { useAppState } from '@/state-machines/hooks'
import type { EntityConfig } from '@/types/live-changes'

interface LiveChangesProviderProps {
  entities: EntityConfig[]
  children: React.ReactNode
  // Optional delay before starting (allows atoms to hydrate first)
  startupDelay?: number
}

export function LiveChangesProvider({ 
  entities, 
  children, 
  startupDelay = 1000 // Default 1 second delay
}: LiveChangesProviderProps) {
  
  const { 
    isDatabaseReady, 
    isConnectionOnline, 
    isAuthenticated,
    isSyncLive,
    readinessInfo,
    send 
  } = useAppState()
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let isActive = true

    const startLiveChanges = async () => {
      try {
        console.log('[LiveChangesProvider] Starting live changes initialization...')
        
        // Wait for system to be ready using XState coordination
        if (!isDatabaseReady) {
          console.log('[LiveChangesProvider] Waiting for database to be ready...')
          return // useEffect will re-run when database becomes ready
        }
        
        if (!isAuthenticated) {
          console.log('[LiveChangesProvider] Waiting for authentication...')
          return // useEffect will re-run when auth completes
        }
        
        // 🔥 SYNC FIRST: Wait for sync to complete before starting live changes
        if (!isSyncLive) {
          console.log('[LiveChangesProvider] Waiting for sync to complete before starting live changes...')
          return // useEffect will re-run when sync reaches 'live' state
        }
        
        console.log('[LiveChangesProvider] System ready for live changes:', { 
          database: isDatabaseReady,
          online: isConnectionOnline,
          authenticated: isAuthenticated,
          syncLive: isSyncLive,
          readyPhase: readinessInfo.readyPhase
        })
        
        // Only initialize live changes if we have a working connection
        // Skip in offline mode since live changes require server connection
        if (!isConnectionOnline || readinessInfo.readyPhase === 'offline') {
          console.log('[LiveChangesProvider] Skipping live changes initialization in offline mode')
          return
        }
        
        // Wait for atoms to hydrate via route loaders
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, startupDelay)
        })

        // Only proceed if component is still mounted
        if (!isActive) return

        // Initialize live changes - the XState coordination ensures datasource is ready
        // Get datasource from global datasource since XState has coordinated readiness
        const { getGlobalDataSource } = await import('@/db/global-datasource')
        const dataSource = await getGlobalDataSource()
        
        await liveChangesManager.initialize(entities, dataSource)
        
        // Notify XState that live changes are active
        send({ type: 'LIVE_CHANGES_START' })
        
        console.log('[LiveChangesProvider] ✅ Live changes provider successfully initialized')

      } catch (error) {
        // Only throw if component is still mounted (avoids React warnings)
        if (isActive) {
          console.error('[LiveChangesProvider] ❌ Failed to initialize live changes:', error)
          
          // Notify XState of the error
          send({ type: 'LIVE_CHANGES_FAILED', error: error instanceof Error ? error.message : String(error) })
          
          // Error will bubble to global error boundary
          throw error
        }
      }
    }

    // Start the initialization process when all dependencies are ready
    if (isDatabaseReady && isAuthenticated && isSyncLive) {
      startLiveChanges()
    }

    // Cleanup on unmount
    return () => {
      isActive = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      // Stop live changes when provider unmounts
      liveChangesManager.stop().catch(error => 
        console.error('[LiveChangesProvider] Failed to stop live changes:', error)
      )
    }
  }, [isDatabaseReady, isAuthenticated, isConnectionOnline, isSyncLive, entities, startupDelay, send])

  // Pure background operation - just render children
  return <>{children}</>
}

/**
 * Hook to get live changes status (for debugging only)
 * Not intended for normal component use - live changes should be invisible
 */
export function useLiveChangesDebug() {
  const [stats, setStats] = React.useState(() => liveChangesManager.getStats())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(liveChangesManager.getStats())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return stats
} 