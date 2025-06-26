/**
 * Debug utility for manual integrity reset
 * Use this to trigger reset manually without automatic loops
 * 
 * Updated for new IntegrityService and event-driven architecture
 */

export async function manualIntegrityReset() {
  console.log('[DEBUG] Manual integrity reset triggered');
  
  try {
    // Get the sync machine actor to trigger reset
    const syncActor = (window as any).syncActor;
    if (syncActor) {
      syncActor.send({
        type: 'INTEGRITY_RESET_START',
        reason: 'Manual debug reset',
        resetType: 'full_reset'
      });
      console.log('[DEBUG] Manual integrity reset command sent to sync machine');
      return;
    }

    // Fallback to app actor
    const appActor = (window as any).appActor;
    if (appActor) {
      appActor.send({
        type: 'INTEGRITY_RESET_START',
        reason: 'Manual debug reset',
        resetType: 'full_reset'
      });
      console.log('[DEBUG] Manual integrity reset command sent to app actor');
      return;
    }

    console.error('[DEBUG] No actors found - make sure app is initialized');
    
  } catch (error) {
    console.error('[DEBUG] Failed to trigger manual reset:', error);
  }
}

export async function manualIntegrityValidation() {
  console.log('[DEBUG] Manual integrity validation triggered');
  
  try {
    // Get the sync machine actor to trigger validation
    const syncActor = (window as any).syncActor;
    if (syncActor) {
      syncActor.send({
        type: 'INTEGRITY_VALIDATE',
        reason: 'Manual debug validation'
      });
      console.log('[DEBUG] Manual integrity validation command sent to sync machine');
      return;
    }

    // Fallback to app actor
    const appActor = (window as any).appActor;
    if (appActor) {
      appActor.send({
        type: 'INTEGRITY_VALIDATE', 
        reason: 'Manual debug validation'
      });
      console.log('[DEBUG] Manual integrity validation command sent to app actor');
      return;
    }

    console.error('[DEBUG] No actors found - make sure app is initialized');
    
  } catch (error) {
    console.error('[DEBUG] Failed to trigger manual validation:', error);
  }
}

/**
 * ✅ UPDATED: Direct access to IntegrityService for debug testing (V3 system)
 */
export async function getIntegrityService(): Promise<any> {
  try {
    // Method 1: Access V3 services via app init machine's sync machine
    try {
      const appInitActor = (window as any).appInitActor;
      if (appInitActor) {
        const appInitSnapshot = appInitActor.getSnapshot();
        const syncActor = appInitSnapshot?.children?.syncMachine;
        
        if (syncActor) {
          const snapshot = syncActor.getSnapshot();
          console.log('[DEBUG] 🔍 Sync machine state:', snapshot.value);
          
          // Check for services in context via serviceCoordinator
          if (snapshot.context?.serviceCoordinator) {
            const services = snapshot.context.serviceCoordinator.getServices();
            if (services?.integrity) {
              console.log('[DEBUG] ✅ Found IntegrityService via sync machine V3 serviceCoordinator');
              return services.integrity;
            } else {
              console.log('[DEBUG] 🔍 ServiceCoordinator found but no IntegrityService:', {
                hasServiceCoordinator: !!snapshot.context.serviceCoordinator,
                hasServices: !!services,
                hasWebSocket: !!services?.webSocket,
                hasIncomingChanges: !!services?.incomingChanges,
                hasOutgoingChanges: !!services?.outgoingChanges,
                hasIntegrityService: !!services?.integrity
              });
            }
          }
        } else {
          console.log('[DEBUG] ⚠️ No sync machine found in app init children');
        }
      } else {
        console.log('[DEBUG] ⚠️ No app init actor available');
      }
    } catch (v3Error) {
      console.log('[DEBUG] ⚠️ Could not access V3 services:', v3Error instanceof Error ? v3Error.message : String(v3Error));
    }


    // Method 2: Fallback to V2 system
    try {
      const { getGlobalServices } = await import('../state-machines/machines/sync-machine-v2');
      const globalServices = getGlobalServices();
      
      if (globalServices?.integrityService) {
        console.log('[DEBUG] ✅ Found IntegrityService via V2 globalServices (fallback)');
        return globalServices.integrityService;
      }
    } catch (v2Error) {
      console.log('[DEBUG] ⚠️ V2 fallback also failed:', v2Error instanceof Error ? v2Error.message : String(v2Error));
    }

    console.warn('[DEBUG] ⚠️ IntegrityService not found - system may not be fully initialized');
    return null;
  } catch (error) {
    console.error('[DEBUG] ❌ Error accessing IntegrityService:', error);
    return null;
  }
}

/**
 * ✅ NEW: Direct integrity validation (bypass state machine)
 */
export async function validateIntegrityDirect(reason: string = 'Direct debug validation'): Promise<any> {
  try {
    const integrityService = await getIntegrityService();
    if (!integrityService) {
      console.error('[DEBUG] IntegrityService not available');
      return null;
    }

    console.log('[DEBUG] 🔍 Starting direct integrity validation...');
    const result = await integrityService.validateIntegrity(reason);
    
    console.log('[DEBUG] ✅ Direct validation completed:', {
      isValid: result.isValid,
      issueCount: result.issues?.length || 0,
      recommendedAction: result.recommendedAction
    });

    if (result.issues && result.issues.length > 0) {
      console.log('[DEBUG] 🚨 Issues found:');
      result.issues.forEach((issue: any, index: number) => {
        console.log(`[DEBUG] Issue ${index + 1}:`, issue);
      });
    }

    return result;
  } catch (error) {
    console.error('[DEBUG] ❌ Direct validation failed:', error);
    return null;
  }
}

/**
 * ✅ NEW: Direct integrity reset (bypass state machine)
 */
export async function resetIntegrityDirect(
  reason: string = 'Direct debug reset', 
  resetType: 'full_reset' | 'table_reset' = 'full_reset'
): Promise<any> {
  try {
    const integrityService = await getIntegrityService();
    if (!integrityService) {
      console.error('[DEBUG] IntegrityService not available');
      return null;
    }

    console.log(`[DEBUG] 🚨 Starting direct integrity reset (${resetType})...`);
    const result = await integrityService.executeReset(reason, resetType);
    
    console.log('[DEBUG] ✅ Direct reset completed:', {
      success: result.success,
      tablesCleared: result.tablesCleared?.length || 0,
      lsnReset: result.lsnReset,
      error: result.error
    });

    if (result.tablesCleared && result.tablesCleared.length > 0) {
      console.log('[DEBUG] 🗑️ Tables cleared:', result.tablesCleared);
    }

    if (result.error) {
      console.log('[DEBUG] ❌ Reset error:', result.error);
    }

    return result;
  } catch (error) {
    console.error('[DEBUG] ❌ Direct reset failed:', error);
    return null;
  }
}

/**
 * ✅ UPDATED: State-machine-aware integrity reset using new V3 system
 */
export async function resetIntegrityViaSyncMachine(
  reason: string = 'Debug reset via sync machine', 
  resetType: 'full_reset' | 'table_reset' = 'full_reset'
): Promise<any> {
  try {
    console.log(`[DEBUG] 🚨 Starting V3 state-machine-aware integrity reset (${resetType})...`);
    
    // Method 1: Use IntegrityService directly (most reliable for V3)
    const integrityService = await getIntegrityService();
    if (integrityService) {
      console.log('[DEBUG] 📤 Using IntegrityService.executeReset() for controlled reset...');
      
      const result = await integrityService.executeReset(reason, resetType);
      
      console.log('[DEBUG] ✅ V3 reset completed via IntegrityService:', {
        success: result.success,
        tablesCleared: result.tablesCleared?.length || 0,
        lsnReset: result.lsnReset,
        error: result.error
      });

      return result;
    }

    // Method 2: Fallback to sync machine events if IntegrityService not available
    const syncActor = (window as any).syncActor;
    if (!syncActor) {
      console.error('[DEBUG] No sync machine actor available');
      return { success: false, error: 'No sync machine actor available' };
    }

    console.log('[DEBUG] 📤 Fallback: Sending RESET event to sync machine...');
    
    // Send RESET event to sync machine
    syncActor.send({
      type: 'RESET',
      reason,
      resetType,
      triggerType: 'debug_manual'
    });

    console.log('[DEBUG] ✅ Reset event sent to sync machine - monitoring state transitions...');
    
    // Monitor sync machine state for completion
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('[DEBUG] ⚠️ Reset timeout - no completion after 30 seconds');
        resolve({ success: false, error: 'Reset timeout', warning: 'Check console for sync machine state' });
      }, 30000);

      const checkComplete = () => {
        try {
          const snapshot = syncActor.getSnapshot();
          const currentState = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0];
          
          console.log('[DEBUG] 🔍 Current sync machine state:', currentState);
          
          // Check if we're back in a normal state (not idle/error)
          if (currentState === 'live_sync' || currentState === 'connected') {
            clearTimeout(timeout);
            console.log('[DEBUG] ✅ Reset completed - sync machine back in operational state:', currentState);
            resolve({ 
              success: true, 
              machineState: currentState,
              currentLSN: snapshot.context?.currentLSN || 'unknown'
            });
            return;
          }
          
          // If still in reset-related states, keep checking
          if (currentState === 'idle' || currentState === 'error' || currentState === 'connecting') {
            setTimeout(checkComplete, 500);
            return;
          }
          
          // Unknown state - keep checking
          setTimeout(checkComplete, 500);
          
        } catch (error) {
          // Continue checking on error
          setTimeout(checkComplete, 500);
        }
      };
      
      // Start checking after a brief delay
      setTimeout(checkComplete, 1000);
    });

  } catch (error) {
    console.error('[DEBUG] ❌ V3 state machine reset failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * ✅ NEW: Generate local fingerprints for debugging
 */
export async function generateFingerprintsDirect(): Promise<any> {
  try {
    const integrityService = await getIntegrityService();
    if (!integrityService) {
      console.error('[DEBUG] IntegrityService not available');
      return null;
    }

    console.log('[DEBUG] 🔍 Generating local fingerprints...');
    const fingerprints = await integrityService.generateLocalFingerprints();
    
    console.log('[DEBUG] ✅ Generated fingerprints for', Object.keys(fingerprints).length, 'tables');
    console.log('[DEBUG] 📊 Fingerprints:', fingerprints);

    return fingerprints;
  } catch (error) {
    console.error('[DEBUG] ❌ Fingerprint generation failed:', error);
    return null;
  }
}

/**
 * ✅ NEW: Manual LSN reset (for testing sync restart without full reset)
 */
export async function resetLSNManual(newLSN: string = '0/0', reason: string = 'Manual LSN reset'): Promise<any> {
  try {
    console.log(`[DEBUG] 🔄 Manually resetting LSN to: ${newLSN}`);
    console.log(`[DEBUG] 🔄 Reason: ${reason}`);
    
    const results = {
      syncMachineState: false,
      machineEvent: false,
      syncRestart: false
    };

    // Method 1: Reset in sync machine state (localStorage)
    try {
      const SYNC_STATE_KEY = 'sync-machine-state';
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        const oldLSN = parsedState.currentLSN;
        parsedState.currentLSN = newLSN;
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
        console.log(`[DEBUG] ✅ LSN reset in sync machine localStorage: ${oldLSN} → ${newLSN}`);
        results.syncMachineState = true;
      } else {
        console.log('[DEBUG] ⚠️ No sync machine state found in localStorage');
      }
    } catch (error) {
      console.warn('[DEBUG] ❌ Error resetting LSN in sync machine state:', error);
    }

    // Orchestrator is not used in current system - removed

    // Method 3: Send LSN_UPDATE event to sync machine via app init machine
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
          console.log(`[DEBUG] ✅ LSN_UPDATE event sent to sync machine: ${newLSN}`);
          results.machineEvent = true;
        } else {
          console.log('[DEBUG] ⚠️ No sync machine found in app init children');
          console.log('[DEBUG] App init state:', appInitSnapshot?.value);
          console.log('[DEBUG] App init children:', Object.keys(appInitSnapshot?.children || {}));
        }
      } else {
        console.log('[DEBUG] ⚠️ No app init actor available');
      }
    } catch (error) {
      console.warn('[DEBUG] ❌ Error sending LSN_UPDATE to sync machine:', error);
    }

    // Method 4: Trigger controlled sync restart after LSN reset
    try {
      console.log('[DEBUG] 🔄 Triggering controlled sync restart after LSN reset...');
      
      const appInitActor = (window as any).appInitActor;
      if (appInitActor) {
        const appInitSnapshot = appInitActor.getSnapshot();
        const syncActor = appInitSnapshot?.children?.syncMachine;
        
        if (syncActor) {
          // Step 1: Disconnect to clean state
          console.log('[DEBUG] Step 1: Sending DISCONNECT event...');
          syncActor.send({ type: 'DISCONNECT', reason: 'LSN reset - preparing for fresh sync' });
          
          // Step 2: Wait for disconnect, then reconnect
          setTimeout(() => {
            // Re-get sync actor in case it changed
            const currentSnapshot = appInitActor.getSnapshot();
            const currentSyncActor = currentSnapshot?.children?.syncMachine;
            
            if (currentSyncActor) {
              console.log('[DEBUG] Step 2: Sending CONNECT event for fresh sync...');
              currentSyncActor.send({ type: 'CONNECT', reason: `LSN reset fresh sync from ${newLSN}` });
              console.log('[DEBUG] ✅ Controlled restart sequence completed');
            } else {
              console.log('[DEBUG] ⚠️ Sync machine not available after disconnect');
            }
          }, 1000); // Longer delay to ensure clean disconnect
          
          results.syncRestart = true;
        } else {
          console.log('[DEBUG] ⚠️ No sync machine found for restart');
        }
      } else {
        console.log('[DEBUG] ⚠️ No app init actor available for restart');
      }
    } catch (error) {
      console.warn('[DEBUG] ❌ Error triggering sync restart:', error);
    }

    console.log('[DEBUG] 📊 LSN reset results:', results);
    
    return {
      success: Object.values(results).some(Boolean),
      newLSN,
      reason,
      results,
      recommendation: newLSN === '0/0' ? 'Monitor console for initial sync from server' : 'Monitor sync for continuation from new LSN'
    };

  } catch (error) {
    console.error('[DEBUG] ❌ Manual LSN reset failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * ✅ NEW: Reset integrity baseline to force full validation
 */
export async function resetIntegrityBaseline(reason: string = 'Debug baseline reset'): Promise<any> {
  try {
    const integrityService = await getIntegrityService();
    if (!integrityService) {
      console.error('[DEBUG] IntegrityService not available');
      return null;
    }

    // Show baseline before reset
    console.log(`[DEBUG] 🔄 Resetting integrity baseline: ${reason}`);
    
    const beforeStatus = await showIntegrityStatus();
    console.log('[DEBUG] 📊 Baseline BEFORE reset:', {
      lastInitialSyncCompletedAt: beforeStatus.integrityBaseline?.lastInitialSyncCompletedAt,
      recordChangesSinceBaseline: beforeStatus.integrityBaseline?.recordChangesSinceBaseline
    });
    
    // Perform the reset
    await integrityService.resetIntegrityBaseline(reason);
    
    // Wait a moment for orchestrator to process the update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Show baseline after reset to confirm it worked
    const afterStatus = await showIntegrityStatus();
    console.log('[DEBUG] 📊 Baseline AFTER reset:', {
      lastInitialSyncCompletedAt: afterStatus.integrityBaseline?.lastInitialSyncCompletedAt,
      recordChangesSinceBaseline: afterStatus.integrityBaseline?.recordChangesSinceBaseline
    });
    
    const resetSuccessful = afterStatus.integrityBaseline?.lastInitialSyncCompletedAt === null;
    
    if (resetSuccessful) {
      console.log('[DEBUG] ✅ Baseline reset complete - next validation will be full comparison');
      console.log('[DEBUG] 💾 Baseline reset persisted to orchestrator context');
    } else {
      console.warn('[DEBUG] ⚠️ Baseline reset may not have been persisted correctly');
    }
    
    return { 
      success: resetSuccessful, 
      reason,
      beforeBaseline: beforeStatus.integrityBaseline?.lastInitialSyncCompletedAt,
      afterBaseline: afterStatus.integrityBaseline?.lastInitialSyncCompletedAt
    };
  } catch (error) {
    console.error('[DEBUG] ❌ Baseline reset failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function clearLocalData() {
  console.log('[DEBUG] Clearing local data manually');
  
  try {
    // Clear IndexedDB sync store
    const stores = ['sync-store'];
    for (const storeName of stores) {
      const deleteRequest = indexedDB.deleteDatabase(storeName);
      await new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
      console.log(`[DEBUG] Cleared IndexedDB store: ${storeName}`);
    }
    
    // Clear localStorage
    localStorage.clear();
    console.log('[DEBUG] Cleared localStorage');
    
    console.log('[DEBUG] Local data cleared - refresh page to reinitialize');
    
  } catch (error) {
    console.error('[DEBUG] Failed to clear local data:', error);
  }
}

/**
 * ✅ NEW: Show current integrity service status
 */
export async function showIntegrityStatus(): Promise<any> {
  try {
    const integrityService = await getIntegrityService();
    
    const status = {
      integrityServiceAvailable: !!integrityService,
      isReady: integrityService?.isReady?.() || false,
      syncManagerState: 'Unknown',
      isConnected: false,
      lsn: 'Unknown',
      integrityBaseline: null
    };

    if (!integrityService) {
      console.log('[DEBUG] ❌ IntegrityService not available');
      return status;
    }

    console.log('[DEBUG] 📊 IntegrityService Status:');
    console.log('  Ready:', status.isReady);
    
    // Baseline status from sync machine (orchestrator not used)
    const SYNC_STATE_KEY = 'sync-machine-state';
    try {
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        const baseline = parsedState.integrityBaseline;
        status.integrityBaseline = baseline;
        
        console.log('  Baseline Status:');
        console.log('    Last Initial Sync:', baseline?.lastInitialSyncCompletedAt ? 
          new Date(baseline.lastInitialSyncCompletedAt).toISOString() : 'None');
        console.log('    Max Records Before Reset:', baseline?.maxRecordsBeforeReset || 'None');
        console.log('    Changes Since Baseline:', baseline?.recordChangesSinceBaseline || 0);
      }
    } catch (error) {
      console.warn('[DEBUG] Error reading baseline from sync machine state:', error);
    }

    // Get connection status from sync machine (orchestrator not used)
    const syncActor = (window as any).syncActor;
    if (syncActor) {
      const syncSnapshot = syncActor.getSnapshot();
      status.syncManagerState = syncSnapshot.value;
      status.lsn = syncSnapshot.context?.currentLSN || 'Unknown';
      
      // Determine connection status from machine state
      const machineState = typeof syncSnapshot.value === 'string' ? 
        syncSnapshot.value : 
        typeof syncSnapshot.value === 'object' ? 
          Object.keys(syncSnapshot.value)[0] : 
          'unknown';
          
      // Connected states: connected, live_sync, connecting, catchup_sync, initial_sync
      const connectedStates = ['connected', 'live_sync', 'connecting', 'catchup_sync', 'initial_sync', 'determining_sync_phase'];
      status.isConnected = connectedStates.includes(machineState);
      
      console.log('  Sync Machine State:', status.syncManagerState);
      console.log('  Connected:', status.isConnected);
      console.log('  LSN:', status.lsn);
    }
    
    return status;
  } catch (error) {
    console.error('[DEBUG] ❌ Error showing integrity status:', error);
    return {
      integrityServiceAvailable: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Expose to global scope for console debugging
if (typeof window !== 'undefined') {
  // ✅ ENHANCED: Original functions updated for new system
  (window as any).debugReset = manualIntegrityReset;
  (window as any).debugValidate = manualIntegrityValidation;
  (window as any).debugClearData = clearLocalData;
  
  // ✅ NEW: Direct service access functions
  (window as any).debugResetDirect = resetIntegrityDirect;
  (window as any).debugResetProper = resetIntegrityViaSyncMachine;
  (window as any).debugValidateDirect = validateIntegrityDirect;
  (window as any).debugFingerprints = generateFingerprintsDirect;
  (window as any).debugIntegrityStatus = showIntegrityStatus;
  (window as any).debugGetIntegrityService = getIntegrityService;
  (window as any).debugResetBaseline = resetIntegrityBaseline;
  (window as any).debugResetLSN = resetLSNManual;
  
  // Add a function to show debug help when requested
  (window as any).debugIntegrityHelp = () => {
    console.log('[DEBUG] 🛠️ Manual integrity functions available:');
    console.log('  State Machine Functions:');
    console.log('    window.debugReset() - Trigger reset via state machine');
    console.log('    window.debugValidate() - Trigger validation via state machine');
    console.log('  Direct Service Functions:');
    console.log('    window.debugResetDirect(reason?, resetType?) - Direct reset (bypass state machine)');
    console.log('    window.debugResetProper(reason?, resetType?) - Proper reset (via state machine with disconnect/reconnect)');
    console.log('    window.debugValidateDirect(reason?) - Direct validation (bypass state machine)');
    console.log('    window.debugFingerprints() - Generate fingerprints directly');
    console.log('    window.debugIntegrityStatus() - Show current integrity status');
    console.log('    window.debugResetBaseline(reason?) - Reset baseline to force full validation');
    console.log('    window.debugResetLSN(newLSN?, reason?) - Reset LSN manually (default: "0/0")');
    console.log('  Utility Functions:');
    console.log('    window.debugClearData() - Clear all local data');
    console.log('    window.debugGetIntegrityService() - Get IntegrityService instance');
    console.log('  Help:');
    console.log('    window.debugIntegrityHelp() - Show this help message');
  };
  
  // Only show the help automatically on debug pages (not on app startup)
  const isDebugPage = window.location.pathname.includes('/debug') || 
                     window.location.pathname.includes('/admin') ||
                     window.location.search.includes('debug=true');
                     
  if (isDebugPage && import.meta.env.MODE === 'development') {
    console.log('[DEBUG] Debug page detected. Type window.debugIntegrityHelp() for available functions.');
  }
} 