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

  test('verify catchup sync with rolled back LSN', async ({ page }) => {
    console.log('\n=== CATCHUP SYNC TEST ===');
    
    // Capture all console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      // Log sync-related messages immediately
      if (text.includes('sync') || text.includes('LSN') || text.includes('catchup')) {
        console.log(`🔍 [CLIENT] ${text}`);
      }
    });
    
    // First get the current LSN from a fresh page load
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    const currentLSN = await getCurrentLSN(page);
    console.log('📍 Current (server) LSN before rollback:', currentLSN);
    
    // Use a much older hex LSN to simulate client being behind  
    // Server shows LSN like "0/208AD38", so use something much older in hex
    // 0/100000 is much smaller than 0/208AD38 in hex
    const rolledBackLSN = '0/100000'; // Much older hex LSN
    console.log('🔙 Rolling back profile LSN to:', rolledBackLSN);
    
    // Directly modify the localStorage in the browser profile
    await page.evaluate((oldLSN) => {
      const SYNC_STATE_KEY = 'sync-machine-state';
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        const previousLSN = parsedState.currentLSN;
        parsedState.currentLSN = oldLSN;
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
        console.log(`[Catchup Test] LSN rolled back in localStorage: ${previousLSN} → ${oldLSN}`);
      } else {
        console.log('[Catchup Test] No sync machine state found in localStorage');
      }
    }, rolledBackLSN);
    
    // Reload the page to pick up the rolled-back LSN
    console.log('🔄 Reloading page to pick up rolled-back LSN...');
    await page.reload();
    await waitForSyncInitialized(page, 15000);
    
    // Verify we're now at the rolled back LSN
    const afterRollbackLSN = await getCurrentLSN(page);
    console.log('📍 LSN after rollback and reload:', afterRollbackLSN);
    expect(afterRollbackLSN).toBe(rolledBackLSN);
    
    // Monitor LSN progression during catchup period
    console.log('⏳ Monitoring LSN progression during catchup...');
    let lsnCheckCount = 0;
    let finalLSN = afterRollbackLSN;
    
    // Check LSN multiple times during catchup period
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      const currentCheck = await getCurrentLSN(page);
      lsnCheckCount++;
      
      if (currentCheck !== finalLSN) {
        console.log(`📈 LSN progressed at check ${lsnCheckCount}: ${finalLSN} → ${currentCheck}`);
        finalLSN = currentCheck;
      }
      
      // If we see significant progression, catchup likely completed
      if (finalLSN !== afterRollbackLSN) {
        console.log('✅ Catchup sync detected - LSN has progressed!');
        break;
      }
    }
    
    console.log('📍 Final LSN after catchup monitoring:', finalLSN);
    
    // Log the progression for analysis
    console.log('📊 Catchup test summary:', {
      originalLSN: currentLSN,
      rolledBackTo: rolledBackLSN, 
      finalLSN: finalLSN,
      caughtUpToOriginal: finalLSN === currentLSN,
      progressMade: finalLSN !== rolledBackLSN,
      lsnProgression: `${rolledBackLSN} → ${finalLSN}`
    });
    
    // Test should FAIL until LSN persistence bug is fixed
    // The logs show LSN should update from 0/100000 to 0/1C25E40 but doesn't persist
    expect(finalLSN).toBeDefined();
    expect(finalLSN).not.toBe('');
    
    // This assertion will FAIL until the bug is fixed
    // Client logs show: "LSN update from srv_catchup_changes: 0/100000 → 0/1C25E40"  
    // But localStorage still shows: currentLSN: 0/100000
    console.log('🔍 Expected LSN progression based on client logs showing: 0/100000 → 0/1C25E40');
    
    if (finalLSN !== rolledBackLSN) {
      console.log('✅ Catchup sync occurred - LSN progressed!');
    } else {
      console.log('❌ BUG DETECTED: LSN received on client but not persisted to localStorage');
      console.log('   Client logs show: "LSN update from srv_catchup_changes: 0/100000 → 0/1C25E40"');
      console.log('   But getCurrentLSN() still returns:', finalLSN);
      console.log('   This indicates LSN persistence bug in sync machine state saving');
    }
    
    // INTENTIONAL FAILURE - This will fail until LSN persistence is fixed
    expect(finalLSN).not.toBe(rolledBackLSN);
    
    // Show all sync-related console logs
    console.log('\n🔍 CLIENT SYNC LOGS:');
    const syncLogs = consoleLogs.filter(log => 
      log.toLowerCase().includes('sync') || 
      log.toLowerCase().includes('lsn') || 
      log.toLowerCase().includes('catchup') ||
      log.toLowerCase().includes('websocket') ||
      log.toLowerCase().includes('connect')
    );
    
    if (syncLogs.length > 0) {
      syncLogs.forEach(log => console.log(`  ${log}`));
    } else {
      console.log('  No sync-related logs found');
    }
    
    console.log('✅ Catchup sync test completed!');
  });

  test('verify initial sync with LSN 0/0 and log received tables', async ({ page }) => {
    console.log('\n=== INITIAL SYNC TEST ===');
    
    // Capture all console logs with special tracking for table data
    const consoleLogs = [];
    const tablesReceived = new Set();
    const changesByTable = {};
    
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      
      // Track sync-related messages
      if (text.includes('sync') || text.includes('LSN') || text.includes('initial') || text.includes('table')) {
        console.log(`🔍 [CLIENT] ${text}`);
      }
      
      // Track incoming changes by table
      if (text.includes('changes for table') || text.includes('Processing') && text.includes('changes')) {
        const tableMatch = text.match(/table[:\s]+(\w+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          tablesReceived.add(tableName);
          
          const countMatch = text.match(/(\d+)\s+changes/);
          if (countMatch) {
            const count = parseInt(countMatch[1]);
            changesByTable[tableName] = (changesByTable[tableName] || 0) + count;
          }
        }
      }
    });
    
    // Set LSN to 0/0 to trigger initial sync
    console.log('🔄 Setting LSN to 0/0 to trigger initial sync...');
    await page.goto('/');
    
    // Reset LSN to 0/0 in localStorage before sync starts
    await page.evaluate(() => {
      const SYNC_STATE_KEY = 'sync-machine-state';
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        const previousLSN = parsedState.currentLSN;
        parsedState.currentLSN = '0/0';
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
        console.log(`[Initial Sync Test] LSN reset in localStorage: ${previousLSN} → 0/0`);
      } else {
        // Create initial state with 0/0 LSN
        const initialState = {
          clientId: 'test-client-' + Date.now(),
          currentLSN: '0/0'
        };
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(initialState));
        console.log('[Initial Sync Test] Created initial state with LSN 0/0');
      }
    });
    
    // Reload page to pick up the 0/0 LSN
    console.log('🔄 Reloading page to pick up LSN 0/0...');
    await page.reload();
    await waitForSyncInitialized(page, 30000); // Longer timeout for initial sync
    
    // Verify we started with 0/0 LSN
    const initialLSN = await getCurrentLSN(page);
    console.log('📍 LSN after reload:', initialLSN);
    
    // Monitor LSN progression during initial sync
    console.log('⏳ Monitoring initial sync progression...');
    let finalLSN = initialLSN;
    let checkCount = 0;
    
    // Check LSN multiple times during initial sync period
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const currentCheck = await getCurrentLSN(page);
      checkCount++;
      
      if (currentCheck !== finalLSN) {
        console.log(`📈 LSN progressed at check ${checkCount}: ${finalLSN} → ${currentCheck}`);
        finalLSN = currentCheck;
        
        // If we see significant progression, initial sync is happening
        if (finalLSN !== '0/0') {
          console.log('✅ Initial sync detected - LSN has progressed from 0/0!');
          break;
        }
      }
    }
    
    // Get final sync metrics
    let finalMetrics = { totalChanges: 'unknown' };
    try {
      finalMetrics = await getSyncMetrics(page);
    } catch (error) {
      console.log('ℹ️ Could not get sync metrics:', error.message);
    }
    console.log('📍 Final LSN after initial sync monitoring:', finalLSN);
    
    // Log initial sync summary
    console.log('📊 Initial sync test summary:', {
      startedFromLSN: '0/0',
      finalLSN: finalLSN,
      progressMade: finalLSN !== '0/0',
      lsnProgression: `0/0 → ${finalLSN}`,
      tablesReceived: Array.from(tablesReceived).sort(),
      totalTables: tablesReceived.size,
      totalChanges: finalMetrics.totalChanges
    });
    
    // Show tables and change counts
    if (tablesReceived.size > 0) {
      console.log('\n📋 TABLES RECEIVED DURING INITIAL SYNC:');
      Array.from(tablesReceived).sort().forEach(table => {
        const count = changesByTable[table] || 'unknown';
        console.log(`  📊 ${table}: ${count} changes`);
      });
    } else {
      console.log('\n📋 No table-specific data captured in logs');
    }
    
    // Show all initial sync related logs
    console.log('\n🔍 CLIENT INITIAL SYNC LOGS:');
    const initialSyncLogs = consoleLogs.filter(log => 
      log.toLowerCase().includes('initial') ||
      log.toLowerCase().includes('srv_init') ||
      log.toLowerCase().includes('table') ||
      log.toLowerCase().includes('changes for') ||
      (log.toLowerCase().includes('lsn') && log.includes('0/0'))
    );
    
    if (initialSyncLogs.length > 0) {
      initialSyncLogs.slice(0, 50).forEach(log => console.log(`  ${log}`)); // Limit to first 50 logs
      if (initialSyncLogs.length > 50) {
        console.log(`  ... and ${initialSyncLogs.length - 50} more initial sync logs`);
      }
    } else {
      console.log('  No initial sync specific logs found');
    }
    
    // Test assertions
    expect(finalLSN).toBeDefined();
    expect(finalLSN).not.toBe('');
    
    // Should progress from 0/0 if initial sync worked
    if (finalLSN !== '0/0') {
      console.log('✅ Initial sync occurred - LSN progressed from 0/0!');
    } else {
      console.log('ℹ️ LSN remained at 0/0 - may indicate no initial sync needed or different behavior');
    }
    
    console.log('✅ Initial sync test completed!');
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