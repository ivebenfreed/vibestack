/**
 * Debug utility for manual integrity reset
 * Use this to trigger reset manually without automatic loops
 */

export async function manualIntegrityReset() {
  console.log('[DEBUG] Manual integrity reset triggered');
  
  try {
    // Get the app actor to trigger reset
    const appActor = (window as any).appActor;
    if (!appActor) {
      console.error('[DEBUG] App actor not found - make sure app is initialized');
      return;
    }
    
    // Send manual reset command
    appActor.send({
      type: 'INTEGRITY_RESET_START',
      reason: 'Manual debug reset',
      resetType: 'full_reset'
    });
    
    console.log('[DEBUG] Manual integrity reset command sent');
    
  } catch (error) {
    console.error('[DEBUG] Failed to trigger manual reset:', error);
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

// Expose to global scope for console debugging
if (typeof window !== 'undefined') {
  (window as any).debugReset = manualIntegrityReset;
  (window as any).debugClearData = clearLocalData;
  console.log('[DEBUG] Manual reset functions available: window.debugReset(), window.debugClearData()');
} 