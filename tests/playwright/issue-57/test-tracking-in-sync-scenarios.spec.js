import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, waitForSyncLive } from '../core/sync-test-helpers.js';

test.describe('Change Tracking in Different Sync Scenarios', () => {
  
  test('verify tracking is enabled in all sync paths', async ({ page }) => {
    console.log('\n=== TESTING CHANGE TRACKING IN ALL SYNC SCENARIOS ===\n');
    
    // Helper to check tracking status
    const checkTrackingStatus = async () => {
      return await page.evaluate(async () => {
        const { isTrackingEnabled } = await import('/src/db/dexie-change-tracking.js');
        return isTrackingEnabled();
      });
    };
    
    // Helper to verify user changes are tracked
    const verifyUserChangesTracked = async (scenario) => {
      console.log(`\n--- Testing ${scenario} ---`);
      
      // Clear localChanges
      await page.evaluate(async () => {
        const { db } = await import('/src/domain/index.js');
        await db.localChanges.clear();
      });
      
      // Check tracking status
      const trackingEnabled = await checkTrackingStatus();
      console.log(`Tracking enabled: ${trackingEnabled}`);
      
      // Create a test task
      const result = await page.evaluate(async () => {
        const { domainServices, db } = await import('/src/domain/index.js');
        
        const task = await domainServices.task.create({
          title: `Test Task ${Date.now()}`,
          description: 'Testing tracking after sync',
          status: 'todo'
        });
        
        // Wait for hooks
        await new Promise(r => setTimeout(r, 500));
        
        // Check if tracked
        const changes = await db.localChanges.toArray();
        const wasTracked = changes.some(c => c.data?.id === task.id);
        
        // Clean up
        await db.tasks.delete(task.id);
        await db.localChanges.clear();
        
        return { taskId: task.id, wasTracked, changeCount: changes.length };
      });
      
      console.log(`Task created: ${result.taskId}`);
      console.log(`Was tracked: ${result.wasTracked}`);
      console.log(`Total changes: ${result.changeCount}`);
      
      // Assert tracking works
      expect(trackingEnabled).toBe(true);
      expect(result.wasTracked).toBe(true);
      expect(result.changeCount).toBeGreaterThan(0);
      
      console.log(`✅ ${scenario}: Tracking is working!`);
      return result;
    };
    
    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Listen for console logs to detect which sync path was taken
    const syncPath = await new Promise((resolve) => {
      page.on('console', msg => {
        const text = msg.text();
        
        // Check for our three scenarios
        if (text.includes('RE-ENABLING change tracking (skipped initial_sync state)')) {
          console.log('📍 Detected: INITIAL_SYNC_COMPLETE path (skipped initial_sync)');
          resolve('INITIAL_SYNC_COMPLETE');
        } else if (text.includes('RE-ENABLING change tracking (skipped catchup_sync state)')) {
          console.log('📍 Detected: CATCHUP_SYNC_COMPLETE path (skipped catchup_sync)');
          resolve('CATCHUP_SYNC_COMPLETE');
        } else if (text.includes('RE-ENABLING change tracking (already in sync, skipping sync phases)')) {
          console.log('📍 Detected: START_LIVE_SYNC path (already in sync)');
          resolve('START_LIVE_SYNC');
        } else if (text.includes('RE-ENABLING change tracking after initial sync complete')) {
          console.log('📍 Detected: Normal initial_sync completion');
          resolve('NORMAL_INITIAL_SYNC');
        } else if (text.includes('RE-ENABLING change tracking after catchup sync complete')) {
          console.log('📍 Detected: Normal catchup_sync completion');
          resolve('NORMAL_CATCHUP_SYNC');
        }
      });
      
      // Timeout after 30 seconds
      setTimeout(() => resolve('UNKNOWN'), 30000);
    });
    
    // Wait for sync to be ready
    await waitForSyncInitialized(page, 30000);
    
    console.log(`\n🔍 Sync path taken: ${syncPath}`);
    
    // Test tracking based on which path was taken
    if (syncPath === 'UNKNOWN') {
      console.log('⚠️ Could not determine sync path, testing anyway...');
    }
    
    await verifyUserChangesTracked(syncPath || 'Unknown Sync Path');
    
    console.log('\n=== TEST COMPLETE ===');
    console.log('✅ Change tracking is properly enabled regardless of sync path!');
  });
  
  test('simulate different sync scenarios', async ({ page }) => {
    console.log('\n=== SIMULATING DIFFERENT SYNC SCENARIOS ===\n');
    
    // Test 1: Fresh client (should go through initial_sync)
    console.log('Test 1: Fresh client scenario');
    
    // Clear sync state to simulate fresh client
    await page.evaluate(() => {
      localStorage.removeItem('sync-machine-state');
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait and check tracking
    await waitForSyncInitialized(page, 30000);
    
    const scenario1 = await page.evaluate(async () => {
      const { isTrackingEnabled } = await import('/src/db/dexie-change-tracking.js');
      const { domainServices, db } = await import('/src/domain/index.js');
      
      const trackingEnabled = isTrackingEnabled();
      
      // Create test task
      const task = await domainServices.task.create({
        title: 'Scenario 1 Test',
        status: 'todo'
      });
      
      await new Promise(r => setTimeout(r, 500));
      
      const changes = await db.localChanges.toArray();
      const wasTracked = changes.some(c => c.data?.id === task.id);
      
      // Cleanup
      await db.tasks.delete(task.id);
      await db.localChanges.clear();
      
      return { trackingEnabled, wasTracked };
    });
    
    console.log('Scenario 1 - Fresh client:');
    console.log('  Tracking enabled:', scenario1.trackingEnabled);
    console.log('  Changes tracked:', scenario1.wasTracked);
    expect(scenario1.trackingEnabled).toBe(true);
    expect(scenario1.wasTracked).toBe(true);
    
    // Test 2: Existing client with valid LSN (should go straight to live or catchup)
    console.log('\nTest 2: Existing client scenario');
    
    // Set a valid LSN to simulate existing client
    await page.evaluate(() => {
      const state = {
        clientId: crypto.randomUUID(),
        currentLSN: '0/1000000'
      };
      localStorage.setItem('sync-machine-state', JSON.stringify(state));
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForSyncInitialized(page, 30000);
    
    const scenario2 = await page.evaluate(async () => {
      const { isTrackingEnabled } = await import('/src/db/dexie-change-tracking.js');
      const { domainServices, db } = await import('/src/domain/index.js');
      
      const trackingEnabled = isTrackingEnabled();
      
      // Create test task
      const task = await domainServices.task.create({
        title: 'Scenario 2 Test',
        status: 'todo'
      });
      
      await new Promise(r => setTimeout(r, 500));
      
      const changes = await db.localChanges.toArray();
      const wasTracked = changes.some(c => c.data?.id === task.id);
      
      // Cleanup
      await db.tasks.delete(task.id);
      await db.localChanges.clear();
      
      return { trackingEnabled, wasTracked };
    });
    
    console.log('Scenario 2 - Existing client:');
    console.log('  Tracking enabled:', scenario2.trackingEnabled);
    console.log('  Changes tracked:', scenario2.wasTracked);
    expect(scenario2.trackingEnabled).toBe(true);
    expect(scenario2.wasTracked).toBe(true);
    
    console.log('\n✅ All sync scenarios properly enable tracking!');
  });
  
  test('verify no sync loop in any scenario', async ({ page }) => {
    console.log('\n=== VERIFYING NO SYNC LOOP IN ANY SCENARIO ===\n');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForSyncInitialized(page, 30000);
    
    // Clear localChanges to start fresh
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.clear();
    });
    
    // Wait for any initial sync to complete
    await page.waitForTimeout(5000);
    
    // Check if any changes were incorrectly tracked during sync
    const syncLoopCheck = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      
      return {
        changeCount: changes.length,
        changes: changes.slice(0, 5).map(c => ({
          table: c.table,
          operation: c.operation,
          id: c.id?.substring(0, 8)
        }))
      };
    });
    
    console.log('Changes after sync:', syncLoopCheck.changeCount);
    if (syncLoopCheck.changeCount > 0) {
      console.log('Sample changes:', syncLoopCheck.changes);
    }
    
    // There should be NO changes from sync operations
    expect(syncLoopCheck.changeCount).toBe(0);
    
    // Now verify user changes ARE tracked
    const userChangeResult = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      const task = await domainServices.task.create({
        title: 'User Task After Sync',
        status: 'todo'
      });
      
      await new Promise(r => setTimeout(r, 500));
      
      const changes = await db.localChanges.toArray();
      const wasTracked = changes.some(c => c.data?.id === task.id);
      
      // Cleanup
      await db.tasks.delete(task.id);
      await db.localChanges.clear();
      
      return { wasTracked, changeCount: changes.length };
    });
    
    console.log('\nUser change tracking:');
    console.log('  Was tracked:', userChangeResult.wasTracked);
    console.log('  Change count:', userChangeResult.changeCount);
    
    expect(userChangeResult.wasTracked).toBe(true);
    expect(userChangeResult.changeCount).toBeGreaterThan(0);
    
    console.log('\n✅ No sync loop detected!');
    console.log('✅ User changes are properly tracked!');
  });
});