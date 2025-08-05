// Debug sync state structure and progression
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Debug Sync State', () => {
  test('investigate sync state structure and progression', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(10000); // Wait longer for sync to stabilize
    
    console.log('\n=== DEBUGGING SYNC STATE STRUCTURE ===\n');
    
    // Get the full sync state
    const syncState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📡 Full sync state:', JSON.stringify(syncState, null, 2));
    
    // Check for different possible state locations
    const stateChecks = await page.evaluate(() => {
      const syncState = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      
      return {
        hasState: 'state' in syncState,
        hasCurrentState: 'currentState' in syncState,
        hasStatus: 'status' in syncState,
        hasValue: 'value' in syncState,
        hasContext: 'context' in syncState,
        allKeys: Object.keys(syncState),
        clientId: syncState.clientId,
        currentLSN: syncState.currentLSN
      };
    });
    
    console.log('🔍 State structure analysis:', stateChecks);
    
    // Check if there are other sync-related localStorage items
    const allSyncStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('sync') || key.includes('auth') || key.includes('session'))) {
          items[key] = localStorage.getItem(key);
        }
      }
      return items;
    });
    
    console.log('🗄️ All sync-related localStorage:', allSyncStorage);
    
    // Wait a bit more and check again
    await page.waitForTimeout(5000);
    
    const syncStateAfter = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📡 Sync state after 15s total:', JSON.stringify(syncStateAfter, null, 2));
    
    // Check if sync state changed
    const stateChanged = JSON.stringify(syncState) !== JSON.stringify(syncStateAfter);
    console.log('🔄 State changed during test:', stateChanged);
    
    // Log any state machine related info
    const machineInfo = await page.evaluate(() => {
      // Try to access any global sync machine if available
      if (window.syncMachine || window.syncService) {
        return {
          hasSyncMachine: !!window.syncMachine,
          hasSyncService: !!window.syncService,
          syncMachineState: window.syncMachine?.state?.value,
          syncServiceState: window.syncService?.state
        };
      }
      return { noGlobalSync: true };
    });
    
    console.log('🎰 Machine info:', machineInfo);
  });
});