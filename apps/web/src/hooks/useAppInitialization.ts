import { useMemo, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useSimpleAuth'
import { usePGliteContext } from '@/db/pglite-provider'
import { useAppState } from '@/state-machines/hooks'
import { getGlobalDataSource } from '@/db/global-datasource'
import { SyncManager } from '@/sync/SyncManager'

interface AppInitializationState {
  isInitialized: boolean;
  isLoading: boolean;
  hasError: boolean;
  loadingMessage: string;
  errorMessage?: string;
}

interface UseAppInitializationOptions {
  isOnline: boolean;
}

interface SystemReadyOptions {
  timeoutMs?: number
  maxConnectionRetries?: number
  retryIntervalMs?: number
  offlineModeAfterMs?: number
}

interface SystemReadyResult {
  dataSource: any
  syncReady: boolean
  mode: 'online' | 'offline' | 'degraded'
  connectionAttempts: number
}

/**
 * Enhanced helper function for route loaders to wait for both database and sync to be ready
 * Features offline mode detection and graceful degradation after connection retries
 */
export async function waitForSystemReady(options: SystemReadyOptions = {}): Promise<SystemReadyResult> {
  const {
    timeoutMs = 30000,
    maxConnectionRetries = 3,
    retryIntervalMs = 2000,
    offlineModeAfterMs = 8000
  } = options
  
  const startTime = Date.now()
  let connectionAttempts = 0
  let lastConnectionAttempt = 0
  
  // Get datasource first
  const dataSource = await getGlobalDataSource()
  if (!dataSource?.isInitialized) {
    throw new Error('Database not initialized')
  }
  
  // Check network connectivity
  const isOnline = navigator.onLine
  console.log(`[waitForSystemReady] Network status: ${isOnline ? 'online' : 'offline'}`)
  
  // If offline, proceed immediately with local data
  if (!isOnline) {
    console.log('[waitForSystemReady] 🔌 Network offline - entering offline mode immediately')
    return { dataSource, syncReady: false, mode: 'offline', connectionAttempts: 0 }
  }
  
  // Get sync manager and check if it's available
  const syncManager = SyncManager.getInstance()
  
  return new Promise((resolve) => {
    const checkSyncStatus = () => {
      try {
        const currentTime = Date.now()
        const elapsedTime = currentTime - startTime
        
        // Check if sync manager exists and has status method
        const hasSyncManager = syncManager && typeof syncManager.getStatus === 'function'
        
        if (!hasSyncManager) {
          console.log('[waitForSystemReady] No sync manager available - proceeding with database only')
          resolve({ dataSource, syncReady: false, mode: 'offline', connectionAttempts })
          return
        }
        
        const syncStatus = syncManager.getStatus()
        const isConnected = syncManager.isConnected()
        
        // Track connection attempts
        if (syncStatus === 'connecting' && currentTime - lastConnectionAttempt > retryIntervalMs) {
          connectionAttempts++
          lastConnectionAttempt = currentTime
          console.log(`[waitForSystemReady] Connection attempt ${connectionAttempts}/${maxConnectionRetries} - status: ${syncStatus}`)
        }
        
        // Check for offline mode conditions
        const shouldEnterOfflineMode = (
          // Too many failed connection attempts
          (connectionAttempts >= maxConnectionRetries && syncStatus !== 'live') ||
          // Been waiting too long for any connection
          (elapsedTime > offlineModeAfterMs && !isConnected) ||
          // Explicit offline state
          (syncStatus === 'disconnected' && elapsedTime > offlineModeAfterMs)
        )
        
        if (shouldEnterOfflineMode) {
          console.log(`[waitForSystemReady] 📱 Entering offline mode after ${connectionAttempts} connection attempts (${elapsedTime}ms elapsed)`)
          resolve({ dataSource, syncReady: false, mode: 'offline', connectionAttempts })
          return
        }
        
        // Accept good states for route loading
        const isAcceptableState = (
          syncStatus === 'live' || 
          (syncStatus === 'catchup' && elapsedTime > 12000) // Wait longer for catchup to complete
        )
        
        if (isAcceptableState) {
          const mode = syncStatus === 'live' ? 'online' : 'degraded'
          console.log(`[waitForSystemReady] ✅ System ready for route loading - sync status: ${syncStatus}, mode: ${mode}`)
          resolve({ dataSource, syncReady: syncStatus === 'live', mode, connectionAttempts })
          return
        }
        
        // Check overall timeout
        if (elapsedTime > timeoutMs) {
          console.warn(`[waitForSystemReady] ⚠️ Overall timeout (${timeoutMs}ms) - proceeding in degraded mode`)
          console.warn(`[waitForSystemReady] Final sync status: ${syncStatus}, connected: ${isConnected}, attempts: ${connectionAttempts}`)
          resolve({ dataSource, syncReady: false, mode: 'degraded', connectionAttempts })
          return
        }
        
        // Continue checking
        setTimeout(checkSyncStatus, 1000)
        
      } catch (error) {
        console.error('[waitForSystemReady] Error checking sync status:', error)
        // On error, proceed in offline mode
        resolve({ dataSource, syncReady: false, mode: 'offline', connectionAttempts })
      }
    }
    
    // Start checking immediately
    checkSyncStatus()
  })
}

export function useAppInitialization({ isOnline }: UseAppInitializationOptions): AppInitializationState {
  const [isTypeOrmReady, setIsTypeOrmReady] = useState(false);
  const [typeOrmError, setTypeOrmError] = useState<Error | null>(null);

  // Get auth state
  const { isAuthenticated, isLoading: isAuthStoreLoading } = useAuth();
  
  // Get database context state
  const dbContext = usePGliteContext();
  const isDbReady = dbContext?.isReady ?? false;
  const isDbLoading = dbContext?.isLoading ?? false;
  const dbError = dbContext?.error ?? null;
  
  // Get sync state from XState
  const { isDatabaseReady, isSyncLive } = useAppState();
  const isSyncLoading = !isSyncLive;
  const isSyncManagerReady = isDatabaseReady;

  // Check TypeORM DataSource readiness
  useEffect(() => {
    let isMounted = true;

    async function checkTypeOrmReadiness() {
      if (!isAuthenticated || !isDbReady) {
        setIsTypeOrmReady(false);
        return;
      }

      try {
        const dataSource = await getGlobalDataSource();
        if (isMounted) {
          if (dataSource && dataSource.isInitialized) {
            setIsTypeOrmReady(true);
            setTypeOrmError(null);
          } else {
            setIsTypeOrmReady(false);
          }
        }
      } catch (error) {
        if (isMounted) {
          setTypeOrmError(error instanceof Error ? error : new Error(String(error)));
          setIsTypeOrmReady(false);
        }
      }
    }

    checkTypeOrmReadiness();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isDbReady]);

  // Compute overall states
  const hasError = !!dbError || !!typeOrmError;
  
  const isLoading = useMemo(() => {
    if (!isAuthenticated) {
      return isAuthStoreLoading;
    }
    
    // If authenticated, check if database and sync are ready
    const isDatabaseLoading = isDbLoading || (!isTypeOrmReady && isDbReady);
    const isSyncInitializing = isSyncLoading || !isSyncManagerReady;
    
    return isDatabaseLoading || isSyncInitializing;
  }, [isAuthenticated, isAuthStoreLoading, isDbLoading, isDbReady, isTypeOrmReady, isSyncLoading, isSyncManagerReady]);

  const isInitialized = !isLoading && !hasError;

  // Simple loading message
  const loadingMessage = useMemo(() => {
    if (hasError) return 'Initialization failed';
    if (!isOnline) return 'Working offline...';
    if (!isAuthenticated) return 'Verifying authentication...';
    if (isDbLoading || (!isTypeOrmReady && isDbReady)) return 'Setting up database...';
    if (isSyncLoading || !isSyncManagerReady) return 'Initializing sync...';
    return 'Loading...';
  }, [hasError, isOnline, isAuthenticated, isDbLoading, isDbReady, isTypeOrmReady, isSyncLoading, isSyncManagerReady]);

  const errorMessage = dbError?.message || typeOrmError?.message;

  return {
    isInitialized,
    isLoading,
    hasError,
    loadingMessage,
    errorMessage,
  };
} 