import { log } from '@/logger';
const fileLog = log('debug/manual-integrity-reset.ts');
/**
 * Debug utility for manual integrity reset
 * Use this to trigger reset manually without automatic loops
 * 
 * Updated for new IntegrityService and event-driven architecture
 */

export async function manualIntegrityReset() {
  fileLog.info('[DEBUG] Manual integrity reset triggered');
  
  try {
    // Get the sync machine actor to trigger reset
    const syncActor = (window as any).syncActor;
    if (syncActor) {
      syncActor.send({
        type: 'INTEGRITY_RESET_START',
        reason: 'Manual debug reset',
        resetType: 'full_reset'
      });
      fileLog.info('[DEBUG] Manual integrity reset command sent to sync machine');
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
      fileLog.info('[DEBUG] Manual integrity reset command sent to app actor');
      return;
    }

    fileLog.error('[DEBUG] No actors found - make sure app is initialized');
    
  } catch (error) {
    fileLog.error('[DEBUG] Failed to trigger manual reset:', error);
  }
}

export async function manualIntegrityValidation() {
  fileLog.info('[DEBUG] Manual integrity validation triggered');
  
  try {
    // Get the sync machine actor to trigger validation
    const syncActor = (window as any).syncActor;
    if (syncActor) {
      syncActor.send({
        type: 'INTEGRITY_VALIDATE',
        reason: 'Manual debug validation'
      });
      fileLog.info('[DEBUG] Manual integrity validation command sent to sync machine');
      return;
    }

    // Fallback to app actor
    const appActor = (window as any).appActor;
    if (appActor) {
      appActor.send({
        type: 'INTEGRITY_VALIDATE', 
        reason: 'Manual debug validation'
      });
      fileLog.info('[DEBUG] Manual integrity validation command sent to app actor');
      return;
    }

    fileLog.error('[DEBUG] No actors found - make sure app is initialized');
    
  } catch (error) {
    fileLog.error('[DEBUG] Failed to trigger manual validation:', error);
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
          fileLog.info('[DEBUG] 🔍 Sync machine state:', snapshot.value);
          
          // Check for services in context via serviceCoordinator
          if (snapshot.context?.serviceCoordinator) {
            const services = snapshot.context.serviceCoordinator.getServices();
            if (services?.integrity) {
              fileLog.info('[DEBUG] ✅ Found IntegrityService via sync machine V3 serviceCoordinator');
              return services.integrity;
            } else {
              fileLog.info('[DEBUG] 🔍 ServiceCoordinator found but no IntegrityService:', {
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
          fileLog.info('[DEBUG] ⚠️ No sync machine found in app init children');
        }
      } else {
        fileLog.info('[DEBUG] ⚠️ No app init actor available');
      }
    } catch (v3Error) {
      fileLog.info('[DEBUG] ⚠️ Could not access V3 services:', v3Error instanceof Error ? v3Error.message : String(v3Error));
    }


    // Method 2: Try direct import from sync directory
    try {
      const { IntegrityService } = await import('../sync/IntegrityService');
      fileLog.info('[DEBUG] ✅ Found IntegrityService via direct import');
      // Note: This would need proper initialization with dependencies
      // For debug purposes, we'll indicate it's available but not fully initialized
      fileLog.info('[DEBUG] ⚠️ IntegrityService found but may need proper initialization');
      return null; // Return null since we can't properly initialize without context
    } catch (directImportError) {
      fileLog.info('[DEBUG] ⚠️ Direct import also failed:', directImportError instanceof Error ? directImportError.message : String(directImportError));
    }

    fileLog.warn('[DEBUG] ⚠️ IntegrityService not found - system may not be fully initialized');
    return null;
  } catch (error) {
    fileLog.error('[DEBUG] ❌ Error accessing IntegrityService:', error);
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
      fileLog.error('[DEBUG] IntegrityService not available');
      return null;
    }

    fileLog.info('[DEBUG] 🔍 Starting direct integrity validation...');
    const result = await integrityService.validateIntegrity(reason);
    
    fileLog.info('[DEBUG] ✅ Direct validation completed:', {
      isValid: result.isValid,
      issueCount: result.issues?.length || 0,
      recommendedAction: result.recommendedAction
    });

    if (result.issues && result.issues.length > 0) {
      fileLog.info('[DEBUG] 🚨 Issues found:');
      result.issues.forEach((issue: any, index: number) => {
        fileLog.info(`[DEBUG] Issue ${index + 1}:`, issue);
      });
    }

    return result;
  } catch (error) {
    fileLog.error('[DEBUG] ❌ Direct validation failed:', error);
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
      fileLog.error('[DEBUG] IntegrityService not available');
      return null;
    }

    fileLog.info(`[DEBUG] 🚨 Starting direct integrity reset (${resetType})...`);
    const result = await integrityService.executeReset(reason, resetType);
    
    fileLog.info('[DEBUG] ✅ Direct reset completed:', {
      success: result.success,
      tablesCleared: result.tablesCleared?.length || 0,
      lsnReset: result.lsnReset,
      error: result.error
    });

    if (result.tablesCleared && result.tablesCleared.length > 0) {
      fileLog.info('[DEBUG] 🗑️ Tables cleared:', result.tablesCleared);
    }

    if (result.error) {
      fileLog.info('[DEBUG] ❌ Reset error:', result.error);
    }

    return result;
  } catch (error) {
    fileLog.error('[DEBUG] ❌ Direct reset failed:', error);
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
    fileLog.info(`[DEBUG] 🚨 Starting V3 state-machine-aware integrity reset (${resetType})...`);
    
    // Method 1: Use IntegrityService directly (most reliable for V3)
    const integrityService = await getIntegrityService();
    if (integrityService) {
      fileLog.info('[DEBUG] 📤 Using IntegrityService.executeReset() for controlled reset...');
      
      const result = await integrityService.executeReset(reason, resetType);
      
      fileLog.info('[DEBUG] ✅ V3 reset completed via IntegrityService:', {
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
      fileLog.error('[DEBUG] No sync machine actor available');
      return { success: false, error: 'No sync machine actor available' };
    }

    fileLog.info('[DEBUG] 📤 Fallback: Sending RESET event to sync machine...');
    
    // Send RESET event to sync machine
    syncActor.send({
      type: 'RESET',
      reason,
      resetType,
      triggerType: 'debug_manual'
    });

    fileLog.info('[DEBUG] ✅ Reset event sent to sync machine - monitoring state transitions...');
    
    // Monitor sync machine state for completion
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        fileLog.warn('[DEBUG] ⚠️ Reset timeout - no completion after 30 seconds');
        resolve({ success: false, error: 'Reset timeout', warning: 'Check console for sync machine state' });
      }, 30000);

      const checkComplete = () => {
        try {
          const snapshot = syncActor.getSnapshot();
          const currentState = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0];
          
          fileLog.info('[DEBUG] 🔍 Current sync machine state:', currentState);
          
          // Check if we're back in a normal state (not idle/error)
          if (currentState === 'live_sync' || currentState === 'connected') {
            clearTimeout(timeout);
            fileLog.info('[DEBUG] ✅ Reset completed - sync machine back in operational state:', currentState);
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
    fileLog.error('[DEBUG] ❌ V3 state machine reset failed:', error);
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
      fileLog.error('[DEBUG] IntegrityService not available');
      return null;
    }

    fileLog.info('[DEBUG] 🔍 Generating local fingerprints...');
    const fingerprints = await integrityService.generateLocalFingerprints();
    
    fileLog.info('[DEBUG] ✅ Generated fingerprints for', Object.keys(fingerprints).length, 'tables');
    fileLog.info('[DEBUG] 📊 Fingerprints:', fingerprints);

    return fingerprints;
  } catch (error) {
    fileLog.error('[DEBUG] ❌ Fingerprint generation failed:', error);
    return null;
  }
}

/**
 * ✅ NEW: Manual LSN reset (for testing sync restart without full reset)
 */
export async function resetLSNManual(newLSN: string = '0/0', reason: string = 'Manual LSN reset'): Promise<any> {
  try {
    fileLog.info(`[DEBUG] 🔄 Manually resetting LSN to: ${newLSN}`);
    fileLog.info(`[DEBUG] 🔄 Reason: ${reason}`);
    
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
        fileLog.info(`[DEBUG] ✅ LSN reset in sync machine localStorage: ${oldLSN} → ${newLSN}`);
        results.syncMachineState = true;
      } else {
        fileLog.info('[DEBUG] ⚠️ No sync machine state found in localStorage');
      }
    } catch (error) {
      fileLog.warn('[DEBUG] ❌ Error resetting LSN in sync machine state:', error);
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
          fileLog.info(`[DEBUG] ✅ LSN_UPDATE event sent to sync machine: ${newLSN}`);
          results.machineEvent = true;
        } else {
          fileLog.info('[DEBUG] ⚠️ No sync machine found in app init children');
          fileLog.info('[DEBUG] App init state:', appInitSnapshot?.value);
          fileLog.info('[DEBUG] App init children:', Object.keys(appInitSnapshot?.children || {}));
        }
      } else {
        fileLog.info('[DEBUG] ⚠️ No app init actor available');
      }
    } catch (error) {
      fileLog.warn('[DEBUG] ❌ Error sending LSN_UPDATE to sync machine:', error);
    }

    // Method 4: Trigger controlled sync restart after LSN reset
    try {
      fileLog.info('[DEBUG] 🔄 Triggering controlled sync restart after LSN reset...');
      
      const appInitActor = (window as any).appInitActor;
      if (appInitActor) {
        const appInitSnapshot = appInitActor.getSnapshot();
        const syncActor = appInitSnapshot?.children?.syncMachine;
        
        if (syncActor) {
          // Step 1: Disconnect to clean state
          fileLog.info('[DEBUG] Step 1: Sending DISCONNECT event...');
          syncActor.send({ type: 'DISCONNECT', reason: 'LSN reset - preparing for fresh sync' });
          
          // Step 2: Wait for disconnect, then reconnect
          setTimeout(() => {
            // Re-get sync actor in case it changed
            const currentSnapshot = appInitActor.getSnapshot();
            const currentSyncActor = currentSnapshot?.children?.syncMachine;
            
            if (currentSyncActor) {
              fileLog.info('[DEBUG] Step 2: Sending CONNECT event for fresh sync...');
              currentSyncActor.send({ type: 'CONNECT', reason: `LSN reset fresh sync from ${newLSN}` });
              fileLog.info('[DEBUG] ✅ Controlled restart sequence completed');
            } else {
              fileLog.info('[DEBUG] ⚠️ Sync machine not available after disconnect');
            }
          }, 1000); // Longer delay to ensure clean disconnect
          
          results.syncRestart = true;
        } else {
          fileLog.info('[DEBUG] ⚠️ No sync machine found for restart');
        }
      } else {
        fileLog.info('[DEBUG] ⚠️ No app init actor available for restart');
      }
    } catch (error) {
      fileLog.warn('[DEBUG] ❌ Error triggering sync restart:', error);
    }

    fileLog.info('[DEBUG] 📊 LSN reset results:', results);
    
    return {
      success: Object.values(results).some(Boolean),
      newLSN,
      reason,
      results,
      recommendation: newLSN === '0/0' ? 'Monitor console for initial sync from server' : 'Monitor sync for continuation from new LSN'
    };

  } catch (error) {
    fileLog.error('[DEBUG] ❌ Manual LSN reset failed:', error);
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
      fileLog.error('[DEBUG] IntegrityService not available');
      return null;
    }

    // Show baseline before reset
    fileLog.info(`[DEBUG] 🔄 Resetting integrity baseline: ${reason}`);
    
    const beforeStatus = await showIntegrityStatus();
    fileLog.info('[DEBUG] 📊 Baseline BEFORE reset:', {
      lastInitialSyncCompletedAt: beforeStatus.integrityBaseline?.lastInitialSyncCompletedAt,
      recordChangesSinceBaseline: beforeStatus.integrityBaseline?.recordChangesSinceBaseline
    });
    
    // Perform the reset
    await integrityService.resetIntegrityBaseline(reason);
    
    // Wait a moment for orchestrator to process the update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Show baseline after reset to confirm it worked
    const afterStatus = await showIntegrityStatus();
    fileLog.info('[DEBUG] 📊 Baseline AFTER reset:', {
      lastInitialSyncCompletedAt: afterStatus.integrityBaseline?.lastInitialSyncCompletedAt,
      recordChangesSinceBaseline: afterStatus.integrityBaseline?.recordChangesSinceBaseline
    });
    
    const resetSuccessful = afterStatus.integrityBaseline?.lastInitialSyncCompletedAt === null;
    
    if (resetSuccessful) {
      fileLog.info('[DEBUG] ✅ Baseline reset complete - next validation will be full comparison');
      fileLog.info('[DEBUG] 💾 Baseline reset persisted to orchestrator context');
    } else {
      fileLog.warn('[DEBUG] ⚠️ Baseline reset may not have been persisted correctly');
    }
    
    return { 
      success: resetSuccessful, 
      reason,
      beforeBaseline: beforeStatus.integrityBaseline?.lastInitialSyncCompletedAt,
      afterBaseline: afterStatus.integrityBaseline?.lastInitialSyncCompletedAt
    };
  } catch (error) {
    fileLog.error('[DEBUG] ❌ Baseline reset failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function clearLocalData() {
  fileLog.info('[DEBUG] Clearing local data manually');
  
  try {
    // Clear IndexedDB sync store
    const stores = ['sync-store'];
    for (const storeName of stores) {
      const deleteRequest = indexedDB.deleteDatabase(storeName);
      await new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
      fileLog.info(`[DEBUG] Cleared IndexedDB store: ${storeName}`);
    }
    
    // Clear localStorage
    localStorage.clear();
    fileLog.info('[DEBUG] Cleared localStorage');
    
    fileLog.info('[DEBUG] Local data cleared - refresh page to reinitialize');
    
  } catch (error) {
    fileLog.error('[DEBUG] Failed to clear local data:', error);
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
      fileLog.info('[DEBUG] ❌ IntegrityService not available');
      return status;
    }

    fileLog.info('[DEBUG] 📊 IntegrityService Status:');
    fileLog.info('  Ready:', status.isReady);
    
    // Baseline status from sync machine (orchestrator not used)
    const SYNC_STATE_KEY = 'sync-machine-state';
    try {
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        const baseline = parsedState.integrityBaseline;
        status.integrityBaseline = baseline;
        
        fileLog.info('  Baseline Status:');
        fileLog.info('    Last Initial Sync:', baseline?.lastInitialSyncCompletedAt ? 
          new Date(baseline.lastInitialSyncCompletedAt).toISOString() : 'None');
        fileLog.info('    Max Records Before Reset:', baseline?.maxRecordsBeforeReset || 'None');
        fileLog.info('    Changes Since Baseline:', baseline?.recordChangesSinceBaseline || 0);
      }
    } catch (error) {
      fileLog.warn('[DEBUG] Error reading baseline from sync machine state:', error);
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
      
      fileLog.info('  Sync Machine State:', status.syncManagerState);
      fileLog.info('  Connected:', status.isConnected);
      fileLog.info('  LSN:', status.lsn);
    }
    
    return status;
  } catch (error) {
    fileLog.error('[DEBUG] ❌ Error showing integrity status:', error);
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
    fileLog.info('[DEBUG] 🛠️ Manual integrity functions available:');
    fileLog.info('  State Machine Functions:');
    fileLog.info('    window.debugReset() - Trigger reset via state machine');
    fileLog.info('    window.debugValidate() - Trigger validation via state machine');
    fileLog.info('  Direct Service Functions:');
    fileLog.info('    window.debugResetDirect(reason?, resetType?) - Direct reset (bypass state machine)');
    fileLog.info('    window.debugResetProper(reason?, resetType?) - Proper reset (via state machine with disconnect/reconnect)');
    fileLog.info('    window.debugValidateDirect(reason?) - Direct validation (bypass state machine)');
    fileLog.info('    window.debugFingerprints() - Generate fingerprints directly');
    fileLog.info('    window.debugIntegrityStatus() - Show current integrity status');
    fileLog.info('    window.debugResetBaseline(reason?) - Reset baseline to force full validation');
    fileLog.info('    window.debugResetLSN(newLSN?, reason?) - Reset LSN manually (default: "0/0")');
    fileLog.info('  Utility Functions:');
    fileLog.info('    window.debugClearData() - Clear all local data');
    fileLog.info('    window.debugGetIntegrityService() - Get IntegrityService instance');
    fileLog.info('  Help:');
    fileLog.info('    window.debugIntegrityHelp() - Show this help message');
  };
  
  // Only show the help automatically on debug pages (not on app startup)
  const isDebugPage = window.location.pathname.includes('/debug') || 
                     window.location.pathname.includes('/admin') ||
                     window.location.search.includes('debug=true');
                     
  if (isDebugPage && import.meta.env.MODE === 'development') {
    fileLog.info('[DEBUG] Debug page detected. Type window.debugIntegrityHelp() for available functions.');
  }
} 