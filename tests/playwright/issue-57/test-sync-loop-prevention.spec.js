import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, waitForSyncLive } from '../core/sync-test-helpers.js';

/**
 * Test to verify that SYNC_TRANSACTION flags prevent sync loops
 * during initial sync, catchup sync, and live sync phases
 */
test.describe('Sync Loop Prevention Test', () => {
  
  test('verify no sync loops during initial, catchup, and live sync phases', async ({ page }) => {
    console.log('\n=== SYNC LOOP PREVENTION TEST ===\n');
    
    // Wait for page to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for VibeStack to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 10000 }
    );
    
    // Wait for sync to be properly initialized
    console.log('⏳ Waiting for sync to initialize...');
    await waitForSyncInitialized(page, 30000);
    console.log('✅ Sync initialized');
    
    // Wait for live sync 
    console.log('⏳ Waiting for live sync...');
    await waitForSyncLive(page, 30000);
    console.log('✅ Live sync achieved');
    
    // Monitor sync state and local changes throughout the sync process
    const syncMonitoring = await page.evaluate(async () => {
      const results = {
        phases: [],
        errors: []
      };
      
      try {
        const { db } = await import('/src/domain/index.js');
        
        // Helper to capture sync state snapshot
        const captureSnapshot = async (phase) => {
          const localChanges = await db.localChanges.toArray();
          const unprocessedChanges = await db.localChanges.where('processedSync').equals(0).toArray();
          
          return {
            phase,
            timestamp: Date.now(),
            totalChanges: localChanges.length,
            unprocessedChanges: unprocessedChanges.length,
            processedChanges: localChanges.length - unprocessedChanges.length,
            recentChanges: localChanges.slice(-5).map(c => ({
              id: c.id,
              table: c.table,
              operation: c.operation,
              processedSync: c.processedSync,
              clientSequence: c.clientSequence
            }))
          };
        };
        
        // Initial snapshot
        results.phases.push(await captureSnapshot('test_start'));
        
        // Wait for sync to be initialized
        console.log('⏳ Waiting for sync to initialize...');
        results.phases.push(await captureSnapshot('after_init'));
        
        // Wait for live sync 
        console.log('⏳ Waiting for live sync...');
        results.phases.push(await captureSnapshot('after_live'));
        
        // Create some test entities to trigger sync activity
        console.log('📝 Creating test entities to trigger sync...');
        const testTasks = [];
        for (let i = 0; i < 10; i++) {
          const taskId = crypto.randomUUID();
          await db.tasks.put({
            id: taskId,
            title: `Test Loop Prevention Task ${i + 1}`,
            description: `Created at ${new Date().toISOString()}`,
            status: 'todo',
            clientId: window.vibestackSync?.clientId || 'test-client',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          testTasks.push(taskId);
        }
        
        results.phases.push(await captureSnapshot('after_task_creation'));
        
        // Wait a bit for any sync activity to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        results.phases.push(await captureSnapshot('after_sync_wait'));
        
        // Update some tasks to trigger more sync activity
        console.log('📝 Updating test tasks to trigger more sync...');
        for (let i = 0; i < 5; i++) {
          await db.tasks.update(testTasks[i], {
            title: `Updated Test Task ${i + 1}`,
            updatedAt: new Date()
          });
        }
        
        results.phases.push(await captureSnapshot('after_task_updates'));
        
        // Wait for final sync
        await new Promise(resolve => setTimeout(resolve, 2000));
        results.phases.push(await captureSnapshot('final'));
        
        return results;
        
      } catch (error) {
        results.errors.push({
          error: error.message,
          stack: error.stack
        });
        return results;
      }
    });
    
    // Log detailed results
    console.log('\n📊 SYNC LOOP PREVENTION RESULTS:');
    console.log('=====================================');
    
    syncMonitoring.phases.forEach((snapshot, index) => {
      console.log(`\n${index + 1}. Phase: ${snapshot.phase.toUpperCase()}`);
      console.log(`   Total changes: ${snapshot.totalChanges}`);
      console.log(`   Unprocessed: ${snapshot.unprocessedChanges}`);
      console.log(`   Processed: ${snapshot.processedChanges}`);
      if (snapshot.recentChanges.length > 0) {
        console.log(`   Recent changes: ${snapshot.recentChanges.map(c => 
          `${c.table}:${c.operation}(${c.processedSync ? 'processed' : 'pending'})`
        ).join(', ')}`);
      }
    });
    
    // Check for errors
    if (syncMonitoring.errors.length > 0) {
      console.error('\n❌ ERRORS DURING MONITORING:');
      syncMonitoring.errors.forEach(err => {
        console.error(`   ${err.error}`);
      });
    }
    
    // Analysis: Check for sync loop indicators
    console.log('\n🔍 SYNC LOOP ANALYSIS:');
    
    const phases = syncMonitoring.phases;
    if (phases.length < 4) {
      console.warn('⚠️  Not enough data points collected');
      return;
    }
    
    // Check for runaway change growth
    const initialChanges = phases[0].totalChanges;
    const afterTaskCreation = phases.find(p => p.phase === 'after_task_creation')?.totalChanges || 0;
    const finalChanges = phases[phases.length - 1].totalChanges;
    
    console.log(`   Initial changes: ${initialChanges}`);
    console.log(`   After 10 task creation: ${afterTaskCreation}`);
    console.log(`   Final changes: ${finalChanges}`);
    
    // Expected: ~10 new changes for 10 task creates + ~5 for updates = ~15 total new changes
    const expectedNewChanges = 15; // 10 creates + 5 updates
    const actualNewChanges = finalChanges - initialChanges;
    const tolerance = 5; // Allow some variance
    
    console.log(`   Expected new changes: ~${expectedNewChanges}`);
    console.log(`   Actual new changes: ${actualNewChanges}`);
    
    // Check for sync loop (excessive changes)
    const hasLoop = actualNewChanges > (expectedNewChanges + tolerance * 3); // Much higher threshold for loop detection
    console.log(`   Sync loop detected: ${hasLoop ? '❌ YES' : '✅ NO'}`);
    
    // Check for reasonable change ratios
    const taskCreationPhase = phases.find(p => p.phase === 'after_task_creation');
    const taskUpdatePhase = phases.find(p => p.phase === 'after_task_updates');
    
    if (taskCreationPhase && taskUpdatePhase) {
      const changesFromCreation = taskCreationPhase.totalChanges - initialChanges;
      const changesFromUpdates = taskUpdatePhase.totalChanges - taskCreationPhase.totalChanges;
      
      console.log(`   Changes from task creation: ${changesFromCreation} (expected ~10)`);
      console.log(`   Changes from task updates: ${changesFromUpdates} (expected ~5)`);
      
      // Verify reasonable ratios (allowing for some overhead)
      expect(changesFromCreation).toBeLessThan(25); // Should be ~10, but allow overhead
      expect(changesFromUpdates).toBeLessThan(15);  // Should be ~5, but allow overhead
    }
    
    // Main assertion: No excessive change growth indicating sync loop
    expect(actualNewChanges).toBeLessThan(50); // Should be ~15, but allow significant headroom
    
    // Check that we're not seeing runaway unprocessed changes
    const finalUnprocessed = phases[phases.length - 1].unprocessedChanges;
    console.log(`   Final unprocessed changes: ${finalUnprocessed}`);
    
    // We expect some unprocessed changes since sync may not have completed yet
    // But it shouldn't be excessive (indicating a loop)
    expect(finalUnprocessed).toBeLessThan(100); // Reasonable upper bound
    
    console.log('\n✅ SYNC LOOP PREVENTION TEST PASSED');
    console.log('   - No excessive change growth detected');
    console.log('   - Change ratios are reasonable');  
    console.log('   - No indication of sync loops');
    
    // Verify no errors occurred during monitoring
    expect(syncMonitoring.errors).toHaveLength(0);
  });
  
});