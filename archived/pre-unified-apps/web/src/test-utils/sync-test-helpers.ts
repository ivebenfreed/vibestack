import { debugLog } from '@/logger';
const log = debugLog('test-utils/sync-test-helpers.ts);
/**
 * Test utilities for controlling sync state in Playwright tests
 * These are exposed to window for test access
 */

/**
 * Force set the sync state with specific LSN and clientId
 * This completely replaces the sync state, useful for testing
 */
export async function testForceSetSyncState(newLSN: string = '0/0', clientId?: string): Promise<boolean> {
  try {
    const SYNC_STATE_KEY = 'sync-machine-state';
    
    // Generate a client ID if not provided
    const finalClientId = clientId || crypto.randomUUID();
    
    // Create new state
    const newState = {
      clientId: finalClientId,
      currentLSN: newLSN
    };
    
    // Force set the state
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(newState));
    log.info(`[TEST] Force set sync state:`, newState);
    
    // Verify it was set
    const verification = localStorage.getItem(SYNC_STATE_KEY);
    if (verification) {
      const parsed = JSON.parse(verification);
      log.info(`[TEST] Verified state: LSN=${parsed.currentLSN}, ClientID=${parsed.clientId}`);
      return parsed.currentLSN === newLSN;
    }
    
    return false;
  } catch (error) {
    log.error('[TEST] Failed to force set sync state:', error);
    return false;
  }
}

/**
 * Completely reset sync to fresh state (no LSN, new client ID)
 */
export async function testResetToFreshState(): Promise<boolean> {
  try {
    log.info('[TEST] Resetting to completely fresh state...');
    
    const SYNC_STATE_KEY = 'sync-machine-state';
    
    // Method 1: Remove the key entirely
    localStorage.removeItem(SYNC_STATE_KEY);
    
    // Verify removal
    const afterRemoval = localStorage.getItem(SYNC_STATE_KEY);
    if (afterRemoval === null) {
      log.info('[TEST] ✅ Successfully removed sync state - will get fresh state on reload');
      return true;
    } else {
      log.info('[TEST] ⚠️ Sync state still exists after removal attempt');
      return false;
    }
  } catch (error) {
    log.error('[TEST] Failed to reset to fresh state:', error);
    return false;
  }
}

/**
 * Set the sync machine's LSN to simulate being behind or ahead
 * @param newLSN - The LSN to set (e.g., '0/0' for initial sync, '0/100' for catchup)
 * @param reason - Reason for the change (for logging)
 */
export async function testSetLSN(newLSN: string = '0/0', reason: string = 'Test LSN change'): Promise<boolean> {
  try {
    log.info(`[TEST] Setting LSN to: ${newLSN} (${reason})`);
    
    // Update sync machine state in localStorage
    const SYNC_STATE_KEY = 'sync-machine-state';
    const stored = localStorage.getItem(SYNC_STATE_KEY);
    
    if (stored) {
      const parsedState = JSON.parse(stored);
      const oldLSN = parsedState.currentLSN;
      parsedState.currentLSN = newLSN;
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
      log.info(`[TEST] LSN changed: ${oldLSN} → ${newLSN}`);
      
      // Also send LSN_UPDATE event to sync machine if available
      try {
        const appInitActor = (window as any).appInitActor;
        if (appInitActor) {
          const appInitSnapshot = appInitActor.getSnapshot();
          const syncActor = appInitSnapshot?.children?.syncMachine;
          
          if (syncActor) {
            syncActor.send({
              type: 'LSN_UPDATE',
              lsn: newLSN,
              reason: reason
            });
            log.info(`[TEST] LSN_UPDATE event sent to sync machine`);
          }
        }
      } catch (e) {
        log.warn('[TEST] Could not send LSN_UPDATE event:', e);
      }
      
      return true;
    } else {
      log.warn('[TEST] No sync machine state found in localStorage');
      // Try to create fresh state with the desired LSN
      return testForceSetSyncState(newLSN);
    }
  } catch (error) {
    log.error('[TEST] Failed to set LSN:', error);
    return false;
  }
}

/**
 * Get the current sync state including LSN and clientId
 */
export function testGetSyncState(): { clientId: string; currentLSN: string } | null {
  try {
    const SYNC_STATE_KEY = 'sync-machine-state';
    const stored = localStorage.getItem(SYNC_STATE_KEY);
    
    if (stored) {
      const parsedState = JSON.parse(stored);
      log.info('[TEST] Current sync state:', parsedState);
      return parsedState;
    } else {
      log.info('[TEST] No sync state found');
      return null;
    }
  } catch (error) {
    log.error('[TEST] Failed to get sync state:', error);
    return null;
  }
}

/**
 * Trigger a sync restart by disconnecting and reconnecting
 */
export async function testRestartSync(reason: string = 'Test sync restart'): Promise<boolean> {
  try {
    log.info(`[TEST] Restarting sync: ${reason}`);
    
    const appInitActor = (window as any).appInitActor;
    if (!appInitActor) {
      log.warn('[TEST] No app init actor available');
      return false;
    }
    
    const appInitSnapshot = appInitActor.getSnapshot();
    const syncActor = appInitSnapshot?.children?.syncMachine;
    
    if (!syncActor) {
      log.warn('[TEST] No sync machine available');
      return false;
    }
    
    // Disconnect
    log.info('[TEST] Sending DISCONNECT...');
    syncActor.send({ type: 'DISCONNECT', reason });
    
    // Wait and reconnect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log.info('[TEST] Sending CONNECT...');
    syncActor.send({ type: 'CONNECT', reason });
    
    log.info('[TEST] Sync restart triggered');
    return true;
    
  } catch (error) {
    log.error('[TEST] Failed to restart sync:', error);
    return false;
  }
}

/**
 * Clear all sync-related data for a fresh start
 */
export function testClearSyncData(): void {
  try {
    log.info('[TEST] Clearing sync data...');
    
    // Clear sync machine state
    localStorage.removeItem('sync-machine-state');
    
    // Clear any other sync-related keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('sync') || key.includes('LSN'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      log.info(`[TEST] Removed localStorage key: ${key}`);
    });
    
    log.info('[TEST] Sync data cleared');
  } catch (error) {
    log.error('[TEST] Failed to clear sync data:', error);
  }
}

// Expose to window for Playwright test access
if (typeof window !== 'undefined') {
  (window as any).testSyncHelpers = {
    setLSN: testSetLSN,
    getSyncState: testGetSyncState,
    restartSync: testRestartSync,
    clearSyncData: testClearSyncData,
    forceSetSyncState: testForceSetSyncState,
    resetToFreshState: testResetToFreshState
  };
  
  // Log availability in test/development mode
  if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
    log.info('[TEST] Sync test helpers available at window.testSyncHelpers');
    log.info('[TEST] New methods: forceSetSyncState(lsn, clientId?), resetToFreshState()');
  }
}