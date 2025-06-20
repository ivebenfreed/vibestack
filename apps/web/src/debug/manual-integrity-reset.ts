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
 * ✅ NEW: Direct access to IntegrityService for debug testing
 */
export async function getIntegrityService(): Promise<any> {
  try {
    // Method 1: Access globalServices directly from sync-machine-v2.ts (most reliable)
    try {
      const { getGlobalServices } = await import('../state-machines/machines/sync-machine-v2');
      const globalServices = getGlobalServices();
      
      if (globalServices?.integrityService) {
        console.log('[DEBUG] ✅ Found IntegrityService via globalServices export');
        return globalServices.integrityService;
      } else {
        console.log('[DEBUG] 🔍 GlobalServices found but no IntegrityService:', {
          hasGlobalServices: !!globalServices,
          hasWebSocketService: !!globalServices?.webSocketService,
          hasIncomingChangeService: !!globalServices?.incomingChangeService,
          hasOutgoingChangeService: !!globalServices?.outgoingChangeService,
          hasIntegrityService: !!globalServices?.integrityService
        });
      }
    } catch (importError) {
      console.log('[DEBUG] ⚠️ Could not import globalServices:', importError instanceof Error ? importError.message : String(importError));
    }

    // Method 2: Try sync machine context
    const syncActor = (window as any).syncActor;
    if (syncActor) {
      const snapshot = syncActor.getSnapshot();
      console.log('[DEBUG] 🔍 Sync machine state:', snapshot.value);
      console.log('[DEBUG] 🔍 Sync machine context keys:', Object.keys(snapshot.context || {}));
      
      // Check for services in context  
      if (snapshot.context?.services?.integrityService) {
        console.log('[DEBUG] ✅ Found IntegrityService via sync machine context');
        return snapshot.context.services.integrityService;
      }
    }

    // Method 3: Check orchestrator for debugging
    const orchestrator = (window as any).orchestratorActor;
    if (orchestrator) {
      const snapshot = orchestrator.getSnapshot();
      console.log('[DEBUG] 🔍 Orchestrator context keys:', Object.keys(snapshot.context || {}));
      
      if (snapshot.context?.services?.integrityService) {
        console.log('[DEBUG] ✅ Found IntegrityService via orchestrator context');
        return snapshot.context.services.integrityService;
      }
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
 * ✅ NEW: State-machine-aware integrity reset (proper disconnect/reconnect)
 */
export async function resetIntegrityViaSyncMachine(
  reason: string = 'Debug reset via sync machine', 
  resetType: 'full_reset' | 'table_reset' = 'full_reset'
): Promise<any> {
  try {
    console.log(`[DEBUG] 🚨 Starting state-machine-aware integrity reset (${resetType})...`);
    
    // Get the orchestrator to send the proper event
    const orchestrator = (window as any).orchestratorActor;
    if (!orchestrator) {
      console.error('[DEBUG] Orchestrator not available - cannot use state machine reset');
      return null;
    }

    console.log('[DEBUG] 📤 Sending INTEGRITY_RESET_REQUIRED to orchestrator...');
    
    // Send the event that will trigger the proper state machine flow
    orchestrator.send({
      type: 'INTEGRITY_RESET_REQUIRED',
      reason,
      resetType,
      triggerType: 'debug_manual'
    });

    console.log('[DEBUG] ✅ Reset event sent to orchestrator - state machine will handle the flow');
    console.log('[DEBUG] 🔍 Monitor the console for sync machine state transitions');
    
    // Return a promise that resolves when the reset is complete
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('[DEBUG] ⚠️ Reset timeout - no completion event received after 30 seconds');
        resolve({ success: false, error: 'Reset timeout', warning: 'Check console for sync machine state' });
      }, 30000);

      // Listen for reset completion (orchestrator will receive this from sync machine)
      const checkComplete = () => {
        try {
          const snapshot = orchestrator.getSnapshot();
          // Check if we're back in a stable state (not resetting anymore)
          const isResetting = snapshot.value === 'sync_resetting_integrity' || 
                            snapshot.context.syncState?.machineState === 'resetting_integrity';
          
          if (!isResetting && snapshot.context.syncState?.machineState === 'live_sync') {
            clearTimeout(timeout);
            console.log('[DEBUG] ✅ Reset completed - sync machine back in live_sync state');
            resolve({ 
              success: true, 
              machineState: snapshot.context.syncState?.machineState,
              currentLSN: snapshot.context.syncState?.currentLSN 
            });
            return;
          }
        } catch (error) {
          // Continue checking
        }
        
        // Keep checking every 500ms
        setTimeout(checkComplete, 500);
      };
      
      // Start checking after a brief delay
      setTimeout(checkComplete, 1000);
    });

  } catch (error) {
    console.error('[DEBUG] ❌ State machine reset failed:', error);
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
    
    // Get orchestrator context
    const orchestrator = (window as any).orchestratorActor;
    if (orchestrator) {
      const snapshot = orchestrator.getSnapshot();
      const baseline = snapshot.context?.integrityBaseline;
      status.integrityBaseline = baseline;
      
      console.log('  Baseline Status:');
      console.log('    Last Initial Sync:', baseline?.lastInitialSyncCompletedAt ? 
        new Date(baseline.lastInitialSyncCompletedAt).toISOString() : 'None');
      console.log('    Max Records Before Reset:', baseline?.maxRecordsBeforeReset || 'None');
      console.log('    Changes Since Baseline:', baseline?.recordChangesSinceBaseline || 0);
    }

    // Get connection status from orchestrator context (most reliable)
    const orchestratorActor = (window as any).orchestratorActor;
    if (orchestratorActor) {
      const orchestratorSnapshot = orchestratorActor.getSnapshot();
      const orchestratorContext = orchestratorSnapshot.context;
      
      // Use orchestrator's sync state which is synced from sync machine
      status.syncManagerState = orchestratorContext.syncState?.machineState || 'Unknown';
      status.lsn = orchestratorContext.syncState?.currentLSN || 'Unknown';
      status.isConnected = orchestratorContext.isSyncLive || false;
      
      console.log('  Orchestrator Sync State:', orchestratorContext.syncState?.machineState);
      console.log('  Sync Phase:', orchestratorContext.syncState?.phase);
      console.log('  Is Sync Live:', orchestratorContext.isSyncLive);
      console.log('  Connected:', status.isConnected);
      console.log('  LSN:', status.lsn);
    } else {
      // Fallback to sync machine if orchestrator not available
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
        
        console.log('  Sync Machine State (fallback):', status.syncManagerState);
        console.log('  Connected (fallback):', status.isConnected);
        console.log('  LSN (fallback):', status.lsn);
      }
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
  console.log('  Utility Functions:');
  console.log('    window.debugClearData() - Clear all local data');
  console.log('    window.debugGetIntegrityService() - Get IntegrityService instance');
} 