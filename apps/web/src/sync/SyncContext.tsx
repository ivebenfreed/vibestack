import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { SyncManager } from './SyncManager';
import type { SyncStatus } from './interfaces';
import { getSyncWebSocketUrl } from './config';
import { useAppState } from '@/state-machines/hooks';

// Define props for the SyncProvider component
interface SyncProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

// Define the context shape
export interface SyncContextState {
  isConnected: boolean;
  syncState: SyncStatus;
  lsn: string;
  pendingChanges: number;
  lastSyncTime: Date | null;
  clientId: string;
  connect: (url?: string) => Promise<boolean>;
  disconnect: () => void;
  resetLSN: () => Promise<void>;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  isLoading: boolean;
  isSyncManagerReady?: boolean; // Added for more explicit SyncManager status
  processQueuedChanges: () => Promise<void>;
  setAutoConnect: (value: boolean) => void;
  resyncAllEntities: () => Promise<number>;
}

// Create context with default values
const SyncContext = createContext<SyncContextState | undefined>(undefined);

// ⚡ PERFORMANCE: Initialize managers early
let _manager: SyncManager | null = null;

// Provider component
export const SyncProvider: React.FC<SyncProviderProps> = ({ children, autoConnect = true }) => {
  // State to track database and sync initialization
  const [isLoading, setIsLoading] = useState(true);
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);
  const [isSyncManagerReady, setIsSyncManagerReady] = useState(false); // Added state for SyncManager readiness
  
  // Use XState for database readiness instead of usePGliteContext
  const { isDatabaseReady, send } = useAppState();
  
  // Initialize sync managers only after database is ready
  useEffect(() => {
    if (!isDatabaseReady) {
      console.log('SyncContext: Waiting for database to be ready before initializing sync');
      return;
    }
    
    console.log('SyncContext: Database is ready, initializing SyncManager');
    
    // Initialize the SyncManager now that the database is ready
    const syncManagerInstance = SyncManager.getInstance();
    setSyncManager(syncManagerInstance);
    
  }, [isDatabaseReady]);
  
  // Configure auto-connect based on props
  useEffect(() => {
    if (!syncManager) return;
    syncManager.setAutoConnect(autoConnect);
  }, [autoConnect, syncManager]);
  
  // Keep the latest values in refs to avoid race conditions
  const latestSyncState = useRef<SyncStatus>('disconnected');
  const latestLSN = useRef<string>('0/0');
  const latestConnected = useRef<boolean>(false);
  const latestClientId = useRef<string>('');
  const latestPendingChanges = useRef<number>(0);
  
  // State for sync status
  const [state, setState] = useState({
    isConnected: false,
    syncState: 'disconnected' as SyncStatus,
    lsn: '0/0',
    pendingChanges: 0,
    lastSyncTime: null as Date | null,
    clientId: ''
  });
  
  // State for server URL
  const [serverUrl, setServerUrl] = useState<string>(getSyncWebSocketUrl());
  
  // Update state function - pulls directly from refs to ensure latest state
  const updateState = (forceUpdate = false) => {
    const newState = {
      isConnected: latestConnected.current,
      syncState: latestSyncState.current,
      lsn: latestLSN.current,
      pendingChanges: latestPendingChanges.current,
      lastSyncTime: new Date(),
      clientId: latestClientId.current
    };
    
    // Update state and log any changes for debugging
    setState(prev => {
      if (
        forceUpdate || 
        prev.isConnected !== newState.isConnected ||
        prev.syncState !== newState.syncState ||
        prev.lsn !== newState.lsn ||
        prev.pendingChanges !== newState.pendingChanges ||
        prev.clientId !== newState.clientId
      ) {
        return newState;
      }
      return prev;
    });
  };
  
  // Set up sync context state and listeners when syncManager is available
  useEffect(() => {
    if (!syncManager) return;
    
    console.log('SyncContext: Setting up React state management for already-initialized SyncManager');
    
    // Since PGliteProvider has already initialized SyncManager, just set up React state
    const setupStateManagement = async () => {
      try {
        // Verify SyncManager is initialized (it should be, since PGliteProvider finished)
        if (!syncManager.getIsInitialized()) {
          console.error('SyncContext: Expected SyncManager to be initialized by PGliteProvider, but it is not');
          setIsSyncManagerReady(false);
          setIsLoading(false);
          return;
        }
        
        console.log('SyncContext: SyncManager is initialized, setting up React state management');
        setIsSyncManagerReady(true);
        
        // Use multiple async chunks to avoid blocking React's message handler
        setTimeout(() => {
          try {
            // Read state in small chunks with yields between each call
            const readStateAsync = async () => {
              latestSyncState.current = syncManager.getStatus();
              await new Promise(resolve => setTimeout(resolve, 0));
              
              latestLSN.current = syncManager.getLSN();
              await new Promise(resolve => setTimeout(resolve, 0));
              
              latestConnected.current = syncManager.isConnected();
              await new Promise(resolve => setTimeout(resolve, 0));
              
              latestClientId.current = syncManager.getClientId();
              await new Promise(resolve => setTimeout(resolve, 0));
              
              latestPendingChanges.current = syncManager.getPendingChangesCount();
              
              console.log(`SyncContext: Context initialization complete - clientId: ${latestClientId.current}, LSN: ${latestLSN.current}`);
              
              updateState(true);
              setIsLoading(false);
            };
            
            readStateAsync().catch((stateError) => {
              console.error('SyncContext: Error reading initial state:', stateError);
              setIsLoading(false);
            });
          } catch (stateError) {
            console.error('SyncContext: Error setting up async state reading:', stateError);
            setIsLoading(false);
          }
        }, 0);
        
      } catch (error) {
        console.error('SyncContext: Error during initialization', error);
        
        // During HMR, the SyncManager might already be initialized
        if (import.meta.hot && error instanceof Error && 
            (error.message.includes('Already initialized') || 
             error.message.includes('already initialized') ||
             error.message.includes('Shared datasource must be set'))) {
          console.log('SyncContext: HMR detected - attempting to proceed with existing SyncManager state');
          
          try {
            // Use async chunks for HMR state reading as well
            setTimeout(() => {
              try {
                const readHMRStateAsync = async () => {
                  // Try to get the current state from SyncManager in chunks
                  const clientId = syncManager.getClientId();
                  await new Promise(resolve => setTimeout(resolve, 0));
                  
                  const lsn = syncManager.getLSN();
                  await new Promise(resolve => setTimeout(resolve, 0));
                  
                  if (clientId && lsn) {
                    console.log('SyncContext: HMR - SyncManager appears to be already initialized, proceeding');
                    setIsSyncManagerReady(true);
                    
                    // Set our initial state from the existing SyncManager
                    latestSyncState.current = syncManager.getStatus();
                    await new Promise(resolve => setTimeout(resolve, 0));
                    
                    latestLSN.current = lsn;
                    latestConnected.current = syncManager.isConnected();
                    await new Promise(resolve => setTimeout(resolve, 0));
                    
                    latestClientId.current = clientId;
                    latestPendingChanges.current = syncManager.getPendingChangesCount();
                    
                    console.log(`SyncContext: HMR recovery complete - clientId: ${clientId}, LSN: ${lsn}`);
                    
                    updateState(true);
                    setIsLoading(false);
                  } else {
                    console.error('SyncContext: HMR - SyncManager not properly initialized, cannot proceed');
                    setIsSyncManagerReady(false);
                    setIsLoading(false);
                    return;
                  }
                };
                
                readHMRStateAsync().catch((hmrStateError) => {
                  console.error('SyncContext: HMR state reading error:', hmrStateError);
                  setIsSyncManagerReady(false);
                  setIsLoading(false);
                });
              } catch (hmrStateError) {
                console.error('SyncContext: HMR setup error:', hmrStateError);
                setIsSyncManagerReady(false);
                setIsLoading(false);
              }
            }, 0);
          } catch (recoveryError) {
            console.error('SyncContext: HMR recovery failed:', recoveryError);
            setIsSyncManagerReady(false);
            setIsLoading(false);
            return;
          }
        } else {
          setIsSyncManagerReady(false);
          setIsLoading(false);
          return;
        }
      }
      
      // Set up event handlers (this code runs for both successful init and HMR recovery)
      try {
        // Set up direct event handlers for state-critical events
        const handleStateChange = (state: SyncStatus) => {
          console.log(`[SyncContext] State change event received: ${state}`);
          latestSyncState.current = state;
          updateState(true);
        };
        
        const handleLSNUpdate = (lsn: string) => {
          console.log(`[SyncContext] LSN update event received: ${lsn}`);
          latestLSN.current = lsn;
          updateState();
        };
        
        const handleConnection = (connected: boolean) => {
          console.log(`[SyncContext] Connection status event received: ${connected}`);
          latestConnected.current = connected;
          updateState();
        };
        
        const handleWebSocketOpen = (event: any) => {
          console.log(`[SyncContext] WebSocket open event received`);
          handleConnection(true);
        };
        
        const handleWebSocketClose = (event: any) => {
          console.log(`[SyncContext] WebSocket close event received`);
          handleConnection(false);
        };
        
        const handlePendingChangesUpdate = (count: number) => {
          if (count > 0 && process.env.NODE_ENV !== 'production') {
            console.debug(`SyncContext: Pending changes count updated to ${count}`);
          }
          latestPendingChanges.current = count;
          updateState();
        };
        
        // Register for all relevant events - listen to both event names for compatibility
        syncManager.on('stateChange', handleStateChange);
        syncManager.on('sync:statusChanged', handleStateChange); // Also listen to this event
        syncManager.on('lsnUpdate', handleLSNUpdate);
        syncManager.on('connection:status', handleConnection);
        syncManager.on('websocket:open', handleWebSocketOpen);
        syncManager.on('websocket:close', handleWebSocketClose);
        syncManager.on('pendingChangesUpdate', handlePendingChangesUpdate);
        
        // Set up periodic state synchronization to ensure we stay in sync
        const syncStateInterval = setInterval(() => {
          const currentManagerState = syncManager.getStatus();
          const currentManagerLSN = syncManager.getLSN();
          const currentManagerConnected = syncManager.isConnected();
          const currentManagerPendingChanges = syncManager.getPendingChangesCount();
          
          let hasChanges = false;
          
          if (latestSyncState.current !== currentManagerState) {
            console.log(`[SyncContext] Periodic sync: State mismatch detected. Context: ${latestSyncState.current}, Manager: ${currentManagerState}`);
            latestSyncState.current = currentManagerState;
            hasChanges = true;
          }
          
          if (latestLSN.current !== currentManagerLSN) {
            console.log(`[SyncContext] Periodic sync: LSN mismatch detected. Context: ${latestLSN.current}, Manager: ${currentManagerLSN}`);
            latestLSN.current = currentManagerLSN;
            hasChanges = true;
          }
          
          if (latestConnected.current !== currentManagerConnected) {
            console.log(`[SyncContext] Periodic sync: Connection mismatch detected. Context: ${latestConnected.current}, Manager: ${currentManagerConnected}`);
            latestConnected.current = currentManagerConnected;
            hasChanges = true;
          }
          
          if (latestPendingChanges.current !== currentManagerPendingChanges) {
            latestPendingChanges.current = currentManagerPendingChanges;
            hasChanges = true;
          }
          
          if (hasChanges) {
            updateState(true);
          }
        }, 1000); // Check every second
        
        // 🔥 XSTATE COORDINATION: Auto-connect is now handled by XState machine
        // Disable SyncContext auto-connect to prevent racing with XState coordination
        if (autoConnect) {
          console.log('SyncContext: Auto-connect disabled - XState will coordinate sync start');
          // Removed auto-connect logic - XState will send sync:start event when ready
        }
        
        // Cleanup on unmount
        return () => {
          // Clear the periodic sync interval
          clearInterval(syncStateInterval);
          
          // Unregister all event listeners
          syncManager.off('stateChange', handleStateChange);
          syncManager.off('sync:statusChanged', handleStateChange);
          syncManager.off('lsnUpdate', handleLSNUpdate);
          syncManager.off('connection:status', handleConnection);
          syncManager.off('websocket:open', handleWebSocketOpen);
          syncManager.off('websocket:close', handleWebSocketClose);
          syncManager.off('pendingChangesUpdate', handlePendingChangesUpdate);
        };
      } catch (eventSetupError) {
        console.error('SyncContext: Error setting up event handlers:', eventSetupError);
        setIsSyncManagerReady(false);
        setIsLoading(false);
      }
    };
    
    // Start the state management setup
    setupStateManagement();
    
    // No immediate cleanup needed since it's handled in the inner async function
    return () => {};
  }, [syncManager, autoConnect, serverUrl]);
  
  // 🔥 XSTATE INTEGRATION: Listen for sync start events from XState
  useEffect(() => {
    const handleSyncStart = (event: CustomEvent) => {
      if (syncManager && isDatabaseReady) {
        console.log('[SyncContext] XState requesting sync start:', event.detail);
        // Auto-connect to start sync
        syncManager.autoConnectToServer().catch(error => {
          console.error('[SyncContext] Auto-connect failed:', error);
          window.dispatchEvent(new CustomEvent('sync:error', { 
            detail: { error: error.message } 
          }));
        });
      }
    };
    
    window.addEventListener('sync:start', handleSyncStart as EventListener);
    
    return () => {
      window.removeEventListener('sync:start', handleSyncStart as EventListener);
    };
  }, [syncManager, isDatabaseReady]);
  
  // 🔥 XSTATE INTEGRATION: Monitor sync manager state and notify XState when live
  useEffect(() => {
    if (!syncManager) return;
    
    const handleSyncStateChange = (status: SyncStatus) => {
      console.log('[SyncContext] 🔥 Sync state changed to:', status);
      
      // Notify XState when sync reaches live state
      if (status === 'live') {
        console.log('[SyncContext] 🎉 Sync reached LIVE state - notifying XState');
        window.dispatchEvent(new CustomEvent('sync:live', { 
          detail: { status: 'live', timestamp: Date.now() } 
        }));
      } else if (status === 'initial_sync') {
        console.log('[SyncContext] 🔄 Sync in initial_sync state - waiting for live...');
      } else {
        console.log('[SyncContext] 📊 Sync status update:', status);
      }
    };
    
    // 🔥 NEW: Check initial state and notify XState if already live
    const initialStatus = syncManager.getStatus();
    console.log('[SyncContext] 🔍 Initial sync status check:', initialStatus);
    if (initialStatus === 'live') {
      console.log('[SyncContext] 🚀 Sync already LIVE on initialization - notifying XState');
      window.dispatchEvent(new CustomEvent('sync:live', { 
        detail: { status: 'live', timestamp: Date.now(), initial: true } 
      }));
    }
    
    // Listen to sync manager state changes
    syncManager.on('sync:statusChanged', handleSyncStateChange);
    syncManager.on('stateChange', handleSyncStateChange);
    
    // 🔥 NEW: Delayed recheck to catch fast transitions that happen during setup
    const recheckTimer = setTimeout(() => {
      const currentStatus = syncManager.getStatus();
      console.log('[SyncContext] 🔄 Delayed status recheck:', currentStatus);
      if (currentStatus === 'live' && initialStatus !== 'live') {
        console.log('[SyncContext] 🏃 Fast transition detected - sync reached LIVE during setup');
        window.dispatchEvent(new CustomEvent('sync:live', { 
          detail: { status: 'live', timestamp: Date.now(), fastTransition: true } 
        }));
      }
    }, 100); // Small delay to let transition complete
    
    return () => {
      clearTimeout(recheckTimer); // Clean up the recheck timer
      syncManager.off('sync:statusChanged', handleSyncStateChange);
      syncManager.off('stateChange', handleSyncStateChange);
    };
  }, [syncManager]);
  
  // Define handlers for context actions
  const handleConnect = async (url?: string): Promise<boolean> => {
    if (!syncManager) return false;
    
    try {
      const connectUrl = url || serverUrl;
      
      if (url) {
        setServerUrl(url);
      }
      
      return await syncManager.connect(connectUrl);
    } catch (error) {
      console.error('SyncContext: Connect error', error);
      return false;
    }
  };
  
  const handleDisconnect = () => {
    if (!syncManager) return;
    syncManager.disconnect();
  };
  
  const handleResetLSN = async () => {
    if (!syncManager) return;
    await syncManager.resetLSN();
  };
  
  const handleProcessQueuedChanges = async () => {
    if (!syncManager) return; // Or handle if syncManager might not be ready
    await syncManager.getOutgoingChangeProcessor().processQueuedChanges();
  };
  
  const handleSetAutoConnect = (value: boolean) => {
    if (!syncManager) return;
    syncManager.setAutoConnect(value);
  };
  
  const handleResyncAllEntities = async (): Promise<number> => {
    if (!syncManager) {
      // Or handle if syncManager might not be ready
      throw new Error('Sync manager not initialized for resync');
    }
    await syncManager.resetLSN();
    // The original function was expected to return a Promise<number>.
    // resetLSN() is Promise<void>. We need to decide on the return.
    // For now, returning 0 as a placeholder, assuming the number wasn't critical.
    // If the number of entities resynced was important, this needs further thought
    // or SyncManager.resetLSN() would need to be adapted.
    return 0;
  };
  
  // Show a loading state if database or sync is still loading
  if (isLoading && !syncManager) {
    return (
      <SyncContext.Provider value={{
        ...state,
        connect: handleConnect,
        disconnect: handleDisconnect,
        resetLSN: handleResetLSN,
        serverUrl,
        setServerUrl,
        isLoading: true,
        isSyncManagerReady, // Expose SyncManager readiness
        processQueuedChanges: handleProcessQueuedChanges,
        setAutoConnect: handleSetAutoConnect,
        resyncAllEntities: handleResyncAllEntities
      }}>
        {children}
      </SyncContext.Provider>
    );
  }
  
  // Provide the context value with all state and handlers
  return (
    <SyncContext.Provider value={{
      ...state,
      connect: handleConnect,
      disconnect: handleDisconnect,
      resetLSN: handleResetLSN,
      serverUrl,
      setServerUrl,
      isLoading: isLoading || !syncManager,
      isSyncManagerReady, // Expose SyncManager readiness
      processQueuedChanges: handleProcessQueuedChanges,
      setAutoConnect: handleSetAutoConnect,
      resyncAllEntities: handleResyncAllEntities
    }}>
      {children}
    </SyncContext.Provider>
  );
};

// Custom hook for consuming the context
export const useSyncContext = () => {
  // 🔥 TEMPORARY STUB: Return default values for debug components
  // TODO: Remove this entirely once all components are migrated to XState
  console.warn('🚨 useSyncContext is deprecated - use useAppState() instead');
  
  return {
    isConnected: false,
    syncState: 'disconnected' as const,
    lsn: '0/0',
    pendingChanges: 0,
    lastSyncTime: null,
    clientId: '',
    connect: async () => false,
    disconnect: () => {},
    resetLSN: async () => {},
    serverUrl: '',
    setServerUrl: () => {},
    isLoading: false,
    isSyncManagerReady: false,
    processQueuedChanges: async () => {},
    setAutoConnect: () => {},
    resyncAllEntities: async () => 0,
  };
};

// HMR: Accept hot updates for this module
if (import.meta.hot) {
  import.meta.hot.accept();
}