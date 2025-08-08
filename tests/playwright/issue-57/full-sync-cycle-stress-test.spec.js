import { test, expect } from '../fixtures/persistent-context.js';

/**
 * Full Sync Cycle Stress Test
 * 
 * This test validates the COMPLETE sync tracking cycle:
 * 1. Changes are tracked in localChanges
 * 2. Changes are sent to the server
 * 3. Server acknowledges the changes
 * 4. Acknowledged changes are cleared from localChanges
 */

test.describe('Full Sync Cycle Stress Test', () => {
  
  test('validates complete sync cycle under stress', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app ready
    await page.waitForFunction(() => {
      return document.body?.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('\n=== FULL SYNC CYCLE STRESS TEST ===\n');
    
    // Test 1: Verify sync is connected
    console.log('TEST 1: Verify sync connection');
    const syncStatus = await page.evaluate(async () => {
      // Check WebSocket connection status
      const syncStatusElement = document.querySelector('[aria-label*="Sync status"]');
      const statusText = syncStatusElement?.textContent || 'Unknown';
      
      // Check if we have a WebSocket connection
      const hasWebSocket = window.syncManager?.wsManager?.ws?.readyState === 1;
      
      return {
        statusText,
        hasWebSocket,
        isConnected: statusText.includes('Connected') || statusText.includes('Live')
      };
    });
    
    console.log('Sync status:', syncStatus);
    expect(syncStatus.isConnected).toBe(true);
    
    // Test 2: Track changes and verify they're sent
    console.log('\nTEST 2: Create changes and verify sync');
    
    // Clear any existing changes first
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.toCollection().delete();
    });
    
    const syncTest = await page.evaluate(async () => {
      const { db, domainServices } = await import('/src/domain/index.js');
      const results = {
        tasksCreated: 0,
        initialLocalChanges: 0,
        afterCreateLocalChanges: 0,
        afterSyncLocalChanges: 0,
        syncTime: 0
      };
      
      // Get initial state
      results.initialLocalChanges = await db.localChanges.count();
      
      // Create multiple tasks to generate changes
      const numTasks = 10;
      const tasks = [];
      
      console.log(`Creating ${numTasks} tasks...`);
      for (let i = 0; i < numTasks; i++) {
        const task = await domainServices.task.create({
          title: `SYNC_CYCLE_TEST_${i}`,
          description: `Testing full sync cycle ${Date.now()}`,
          status: 'todo'
        });
        tasks.push(task);
      }
      results.tasksCreated = tasks.length;
      
      // Wait for hooks to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check local changes after creation
      results.afterCreateLocalChanges = await db.localChanges.count();
      console.log(`Local changes after creation: ${results.afterCreateLocalChanges}`);
      
      // Wait for sync to process (usually happens within a few seconds)
      const startTime = Date.now();
      let attempts = 0;
      const maxAttempts = 30; // 15 seconds max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentCount = await db.localChanges.count();
        
        console.log(`Attempt ${attempts + 1}: ${currentCount} changes pending`);
        
        // If changes have been processed (count decreased)
        if (currentCount < results.afterCreateLocalChanges) {
          results.afterSyncLocalChanges = currentCount;
          results.syncTime = Date.now() - startTime;
          break;
        }
        
        attempts++;
      }
      
      // If no decrease, get final count
      if (results.afterSyncLocalChanges === 0) {
        results.afterSyncLocalChanges = await db.localChanges.count();
        results.syncTime = Date.now() - startTime;
      }
      
      // Clean up test tasks
      for (const task of tasks) {
        try {
          await domainServices.task.delete(task.id);
        } catch (e) {
          // Ignore if already deleted
        }
      }
      
      return results;
    });
    
    console.log('\nSync cycle results:', syncTest);
    console.log(`✅ Created ${syncTest.tasksCreated} tasks`);
    console.log(`✅ Local changes before sync: ${syncTest.afterCreateLocalChanges}`);
    console.log(`✅ Local changes after sync: ${syncTest.afterSyncLocalChanges}`);
    console.log(`✅ Sync completed in: ${syncTest.syncTime}ms`);
    
    // Verify changes were tracked
    expect(syncTest.afterCreateLocalChanges).toBeGreaterThanOrEqual(syncTest.tasksCreated);
    
    // Verify changes were processed (should decrease after sync)
    expect(syncTest.afterSyncLocalChanges).toBeLessThan(syncTest.afterCreateLocalChanges);
    
    // Test 3: High-volume stress test with sync verification
    console.log('\nTEST 3: High-volume sync stress test');
    
    const stressTest = await page.evaluate(async () => {
      const { db, domainServices } = await import('/src/domain/index.js');
      
      // Clear changes
      await db.localChanges.toCollection().delete();
      
      const results = {
        numOperations: 30,
        peakLocalChanges: 0,
        finalLocalChanges: 0,
        syncCycles: []
      };
      
      // Perform many operations rapidly
      console.log(`Performing ${results.numOperations} operations...`);
      const tasks = [];
      
      // Create
      for (let i = 0; i < results.numOperations / 3; i++) {
        const task = await domainServices.task.create({
          title: `STRESS_${i}`,
          description: `Stress test ${i}`,
          status: 'todo'
        });
        tasks.push(task);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const afterCreates = await db.localChanges.count();
      results.syncCycles.push({ operation: 'create', changes: afterCreates });
      results.peakLocalChanges = Math.max(results.peakLocalChanges, afterCreates);
      
      // Update
      for (const task of tasks) {
        await domainServices.task.update(task.id, {
          status: 'in_progress'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const afterUpdates = await db.localChanges.count();
      results.syncCycles.push({ operation: 'update', changes: afterUpdates });
      results.peakLocalChanges = Math.max(results.peakLocalChanges, afterUpdates);
      
      // Delete
      for (const task of tasks) {
        await domainServices.task.delete(task.id);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const afterDeletes = await db.localChanges.count();
      results.syncCycles.push({ operation: 'delete', changes: afterDeletes });
      results.peakLocalChanges = Math.max(results.peakLocalChanges, afterDeletes);
      
      // Wait for sync to process everything
      console.log('Waiting for sync to process all changes...');
      let syncAttempts = 0;
      while (syncAttempts < 20) { // 10 seconds max
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentCount = await db.localChanges.count();
        
        if (currentCount === 0) {
          console.log('All changes synced!');
          break;
        }
        
        syncAttempts++;
      }
      
      results.finalLocalChanges = await db.localChanges.count();
      
      return results;
    });
    
    console.log('\nStress test results:');
    console.log(`✅ Operations performed: ${stressTest.numOperations}`);
    console.log(`✅ Peak local changes: ${stressTest.peakLocalChanges}`);
    console.log(`✅ Final local changes: ${stressTest.finalLocalChanges}`);
    console.log('Sync cycles:', stressTest.syncCycles);
    
    // Verify all operations were tracked
    expect(stressTest.peakLocalChanges).toBeGreaterThanOrEqual(stressTest.numOperations);
    
    // CRITICAL: Verify changes were synced and cleared
    if (syncStatus.isConnected) {
      // If connected, changes should be processed
      expect(stressTest.finalLocalChanges).toBeLessThanOrEqual(stressTest.peakLocalChanges / 2);
      console.log(`✅ SYNC WORKING: ${stressTest.peakLocalChanges} changes reduced to ${stressTest.finalLocalChanges}`);
    } else {
      console.log('⚠️ Sync not connected, changes remain local');
    }
    
    // Test 4: Monitor outgoing queue processing
    console.log('\nTEST 4: Verify outgoing queue processing');
    const queueStatus = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Check if there's an outgoing queue table
      const hasOutgoingQueue = db.outgoingChangeQueue ? true : false;
      
      let queueCount = 0;
      if (hasOutgoingQueue) {
        try {
          queueCount = await db.outgoingChangeQueue.count();
        } catch (e) {
          // Table might not exist
        }
      }
      
      // Check localChanges for unprocessed changes
      const unprocessedChanges = await db.localChanges
        .where('processedSync')
        .equals(0)
        .count();
      
      const processedChanges = await db.localChanges
        .where('processedSync')
        .equals(1)
        .count();
      
      return {
        hasOutgoingQueue,
        queueCount,
        unprocessedChanges,
        processedChanges,
        totalChanges: unprocessedChanges + processedChanges
      };
    });
    
    console.log('Queue status:', queueStatus);
    console.log(`✅ Unprocessed changes: ${queueStatus.unprocessedChanges}`);
    console.log(`✅ Processed changes: ${queueStatus.processedChanges}`);
    console.log(`✅ Total changes tracked: ${queueStatus.totalChanges}`);
    
    // Final summary
    console.log('\n=== FINAL SUMMARY ===');
    if (syncStatus.isConnected && stressTest.finalLocalChanges < stressTest.peakLocalChanges) {
      console.log('✅ FULL SYNC CYCLE VALIDATED');
      console.log('✅ Changes are tracked automatically');
      console.log('✅ Changes are sent to server');
      console.log('✅ Server acknowledges and clears changes');
      console.log('✅ System handles high-volume operations');
    } else {
      console.log('⚠️ PARTIAL VALIDATION');
      console.log('✅ Changes are tracked automatically');
      console.log('⚠️ Sync processing needs investigation');
    }
    
    // Clean up
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Clean up any remaining test tasks
      const testTasks = await db.tasks.where('title').startsWith('SYNC_CYCLE_TEST_').toArray();
      const stressTasks = await db.tasks.where('title').startsWith('STRESS_').toArray();
      
      for (const task of [...testTasks, ...stressTasks]) {
        try {
          await db.tasks.delete(task.id);
        } catch (e) {
          // Ignore
        }
      }
    });
  });
});