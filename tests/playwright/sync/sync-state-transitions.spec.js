// Realistic sync state transition testing using debug functions
import { test, expect } from '../fixtures/persistent-context.js';
import { 
  getSyncState, 
  getCurrentLSN,
  waitForSyncInitialized
} from '../core/sync-test-helpers.js';
import { 
  createEntity, 
  withTestContext 
} from '../core/db-test-helpers.js';

test.describe('Sync State Transitions - Issue #36', () => {
  test('verify sync state persistence and LSN tracking', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    console.log('\n=== SYNC STATE PERSISTENCE TEST ===');
    
    // Get initial sync state
    const initialState = await getSyncState(page);
    const initialLSN = await getCurrentLSN(page);
    
    console.log('📍 Initial sync state:', {
      clientId: initialState.clientId,
      currentLSN: initialLSN
    });
    
    // Verify sync state is properly stored in localStorage
    expect(initialState.clientId).toBeDefined();
    expect(initialLSN).toBeDefined();
    expect(initialLSN).not.toBe('0/0'); // Should have valid LSN
    
    // Test that sync state persists across page refresh
    console.log('🔄 Testing state persistence across page refresh...');
    await page.reload();
    await waitForSyncInitialized(page, 15000);
    
    const afterReloadState = await getSyncState(page);
    const afterReloadLSN = await getCurrentLSN(page);
    
    console.log('📍 State after reload:', {
      clientId: afterReloadState.clientId,
      currentLSN: afterReloadLSN
    });
    
    // Client ID and LSN should persist
    expect(afterReloadState.clientId).toBe(initialState.clientId);
    expect(afterReloadLSN).toBe(initialLSN);
    
    console.log('✅ Sync state persistence verified!');
  });

  test('verify LSN progression using debug functions', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    console.log('\n=== LSN PROGRESSION TEST ===');
    
    const initialLSN = await getCurrentLSN(page);
    console.log('📍 Initial LSN:', initialLSN);
    
    // Use debug function to manually set a new LSN
    console.log('🔧 Using debug function to set new LSN...');
    const testLSN = '0/2000000';
    
    const lsnResetResult = await page.evaluate(async (newLSN) => {
      // Access the debug function that's available globally
      if (typeof window.debugResetLSN === 'function') {
        return await window.debugResetLSN(newLSN, 'Playwright test LSN progression');
      } else {
        // Import debug function if not global
        const { resetLSNManual } = await import('/src/debug/manual-integrity-reset.ts');
        return await resetLSNManual(newLSN, 'Playwright test LSN progression');
      }
    }, testLSN);
    
    console.log('🔧 LSN reset result:', lsnResetResult);
    
    // Wait for sync machine to process the change
    await page.waitForTimeout(3000);
    
    // Verify LSN has been updated
    const updatedLSN = await getCurrentLSN(page);
    console.log('📍 Updated LSN:', updatedLSN);
    
    expect(updatedLSN).toBe(testLSN);
    
    // Verify the new LSN persists in localStorage
    const persistedState = await getSyncState(page);
    expect(persistedState.currentLSN).toBe(testLSN);
    
    console.log('✅ LSN progression verified!');
  });

  test('verify change tracking during sync phases', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    await withTestContext(page, async () => {
      console.log('\n=== CHANGE TRACKING TEST ===');
      
      // Check if change tracking is enabled
      const isTrackingEnabled = await page.evaluate(() => {
        // Access the change tracking state
        const trackingModule = window.__dexieChangeTracking || {};
        return trackingModule.isEnabled !== false; // Default to true if not set
      });
      
      console.log('📊 Change tracking enabled:', isTrackingEnabled);
      
      // Get initial localChanges count
      const initialChangesCount = await page.evaluate(async () => {
        const { db } = await import('/src/domain/index.js');
        return await db.localChanges.count();
      });
      
      console.log('📊 Initial localChanges count:', initialChangesCount);
      
      // Create an entity to trigger change tracking
      console.log('📝 Creating entity to test change tracking...');
      const task = await createEntity(page, 'task', {
        title: 'TEST_Change_Tracking_Task',
        description: 'Testing change tracking behavior',
        status: 'pending'
      });
      
      console.log('✅ Created task:', task.id);
      
      // Wait for change to be processed
      await page.waitForTimeout(1000);
      
      // Check if change was tracked
      const finalChangesCount = await page.evaluate(async () => {
        const { db } = await import('/src/domain/index.js');
        return await db.localChanges.count();
      });
      
      console.log('📊 Final localChanges count:', finalChangesCount);
      
      // If change tracking is enabled, we should see the change recorded
      if (isTrackingEnabled) {
        expect(finalChangesCount).toBeGreaterThan(initialChangesCount);
        console.log('✅ Change tracking is working - change recorded');
      } else {
        console.log('ℹ️ Change tracking disabled - no change recorded (expected)');
      }
    });
  });

  test('verify sync state after debug reset', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    console.log('\n=== SYNC RESET TEST ===');
    
    const initialState = await getSyncState(page);
    console.log('📍 Initial state before reset:', {
      clientId: initialState.clientId,
      currentLSN: initialState.currentLSN
    });
    
    // Trigger a debug reset to LSN 0/0
    console.log('🔧 Triggering debug LSN reset to 0/0...');
    const resetResult = await page.evaluate(async () => {
      if (typeof window.debugResetLSN === 'function') {
        return await window.debugResetLSN('0/0', 'Playwright test sync reset');
      } else {
        const { resetLSNManual } = await import('/src/debug/manual-integrity-reset.ts');
        return await resetLSNManual('0/0', 'Playwright test sync reset');
      }
    });
    
    console.log('🔧 Reset result:', resetResult);
    
    // Wait for reset to complete
    await page.waitForTimeout(5000);
    
    // Verify LSN was reset
    const resetState = await getSyncState(page);
    console.log('📍 State after reset:', {
      clientId: resetState.clientId,
      currentLSN: resetState.currentLSN
    });
    
    // Client ID should remain the same, LSN should be reset
    expect(resetState.clientId).toBe(initialState.clientId);
    expect(resetState.currentLSN).toBe('0/0');
    
    console.log('✅ Sync reset verified!');
  });

  test('verify sync integrity status via debug function', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    console.log('\n=== SYNC INTEGRITY STATUS TEST ===');
    
    // Get integrity status using debug function
    const integrityStatus = await page.evaluate(async () => {
      if (typeof window.debugIntegrityStatus === 'function') {
        return await window.debugIntegrityStatus();
      } else {
        const { showIntegrityStatus } = await import('/src/debug/manual-integrity-reset.ts');
        return await showIntegrityStatus();
      }
    });
    
    console.log('📊 Integrity Status:', integrityStatus);
    
    // Verify expected status fields
    expect(integrityStatus).toBeDefined();
    expect(typeof integrityStatus.integrityServiceAvailable).toBe('boolean');
    expect(typeof integrityStatus.isReady).toBe('boolean');
    expect(integrityStatus.lsn).toBeDefined();
    
    // Log detailed status for debugging
    console.log('📊 Detailed Status:', {
      serviceAvailable: integrityStatus.integrityServiceAvailable,
      isReady: integrityStatus.isReady,
      syncState: integrityStatus.syncManagerState,
      connected: integrityStatus.isConnected,
      lsn: integrityStatus.lsn
    });
    
    console.log('✅ Integrity status check completed!');
  });
});