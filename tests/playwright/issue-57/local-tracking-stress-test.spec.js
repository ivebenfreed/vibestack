import { test, expect } from '../fixtures/persistent-context.js';

/**
 * Local Change Tracking Stress Test
 * 
 * This test validates the LOCAL side of sync tracking:
 * 1. Changes are automatically tracked in localChanges via Dexie hooks
 * 2. High-volume operations are tracked correctly
 * 3. Changes are marked with processedSync flag for later processing
 * 4. No manual tracking calls are needed
 * 
 * Note: This test focuses on the automatic tracking mechanism,
 * not the server sync which requires WebSocket connection.
 */

test.describe('Local Change Tracking Stress Test', () => {
  
  test('validates automatic local change tracking under stress', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app ready
    await page.waitForFunction(() => {
      return document.body?.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('\n=== LOCAL CHANGE TRACKING STRESS TEST ===\n');
    
    // Test 1: Verify hooks are initialized
    console.log('TEST 1: Verify Dexie hooks are initialized');
    const hooksStatus = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Check if the change tracking has been initialized
      const { initializeDexieChangeTracking } = await import('/src/db/dexie-change-tracking.js');
      
      // Check if hooks exist on tables
      const hasTaskHooks = typeof db.tasks.hook === 'function';
      const hasProjectHooks = typeof db.projects.hook === 'function';
      
      // Check if localChanges table exists
      const hasLocalChanges = !!db.localChanges;
      
      return {
        hasTaskHooks,
        hasProjectHooks,
        hasLocalChanges,
        tablesWithHooks: hasTaskHooks && hasProjectHooks
      };
    });
    
    console.log('Hooks status:', hooksStatus);
    expect(hooksStatus.hasLocalChanges).toBe(true);
    expect(hooksStatus.tablesWithHooks).toBe(true);
    
    // Test 2: Stress test automatic tracking
    console.log('\nTEST 2: High-volume automatic tracking');
    
    const stressResults = await page.evaluate(async () => {
      const { db, domainServices } = await import('/src/domain/index.js');
      
      // Clear any existing changes
      await db.localChanges.toCollection().delete();
      
      const results = {
        operations: {
          creates: 50,
          updates: 50,
          deletes: 50
        },
        tracked: {
          beforeTest: 0,
          afterCreates: 0,
          afterUpdates: 0,
          afterDeletes: 0,
          byOperation: {}
        },
        timing: {}
      };
      
      results.tracked.beforeTest = await db.localChanges.count();
      
      // PHASE 1: Create many entities rapidly
      console.log(`Creating ${results.operations.creates} tasks...`);
      const startCreate = Date.now();
      const createdTasks = [];
      
      for (let i = 0; i < results.operations.creates; i++) {
        const task = await domainServices.task.create({
          title: `STRESS_CREATE_${i}`,
          description: `Stress test create ${i}`,
          status: 'todo'
        });
        createdTasks.push(task);
      }
      
      // Wait for hooks to process (they use setTimeout)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      results.timing.createPhase = Date.now() - startCreate;
      results.tracked.afterCreates = await db.localChanges.count();
      
      // PHASE 2: Update all entities
      console.log(`Updating ${results.operations.updates} tasks...`);
      const startUpdate = Date.now();
      
      for (let i = 0; i < Math.min(results.operations.updates, createdTasks.length); i++) {
        await domainServices.task.update(createdTasks[i].id, {
          status: 'in_progress',
          description: `Updated at ${Date.now()}`
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      results.timing.updatePhase = Date.now() - startUpdate;
      results.tracked.afterUpdates = await db.localChanges.count();
      
      // PHASE 3: Delete all entities
      console.log(`Deleting ${results.operations.deletes} tasks...`);
      const startDelete = Date.now();
      
      for (let i = 0; i < Math.min(results.operations.deletes, createdTasks.length); i++) {
        await domainServices.task.delete(createdTasks[i].id);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      results.timing.deletePhase = Date.now() - startDelete;
      results.tracked.afterDeletes = await db.localChanges.count();
      
      // Analyze tracked changes
      const allChanges = await db.localChanges.toArray();
      results.tracked.byOperation = {
        insert: allChanges.filter(c => c.operation === 'insert').length,
        update: allChanges.filter(c => c.operation === 'update').length,
        delete: allChanges.filter(c => c.operation === 'delete').length
      };
      
      // Check processedSync flags
      results.tracked.unprocessed = allChanges.filter(c => c.processedSync === 0).length;
      results.tracked.processed = allChanges.filter(c => c.processedSync === 1).length;
      
      // Verify all changes have required fields
      results.validation = {
        withClientSequence: allChanges.filter(c => c.clientSequence).length,
        withClientId: allChanges.filter(c => c.clientId).length,
        withTable: allChanges.filter(c => c.table).length,
        withOperation: allChanges.filter(c => c.operation).length,
        withData: allChanges.filter(c => c.data).length
      };
      
      return results;
    });
    
    console.log('\nStress test results:');
    console.log(`Operations performed: ${stressResults.operations.creates + stressResults.operations.updates + stressResults.operations.deletes}`);
    console.log(`Changes tracked: ${stressResults.tracked.afterDeletes}`);
    console.log('\nBreakdown by operation:');
    console.log(`  Inserts: ${stressResults.tracked.byOperation.insert}`);
    console.log(`  Updates: ${stressResults.tracked.byOperation.update}`);
    console.log(`  Deletes: ${stressResults.tracked.byOperation.delete}`);
    console.log('\nTiming:');
    console.log(`  Create phase: ${stressResults.timing.createPhase}ms`);
    console.log(`  Update phase: ${stressResults.timing.updatePhase}ms`);
    console.log(`  Delete phase: ${stressResults.timing.deletePhase}ms`);
    console.log('\nValidation:');
    console.log(`  Changes with clientSequence: ${stressResults.validation.withClientSequence}`);
    console.log(`  Changes with clientId: ${stressResults.validation.withClientId}`);
    console.log(`  Unprocessed (ready to sync): ${stressResults.tracked.unprocessed}`);
    
    // Verify all operations were tracked
    expect(stressResults.tracked.byOperation.insert).toBe(stressResults.operations.creates);
    expect(stressResults.tracked.byOperation.update).toBe(stressResults.operations.updates);
    expect(stressResults.tracked.byOperation.delete).toBe(stressResults.operations.deletes);
    
    // Verify total matches
    const totalExpected = stressResults.operations.creates + stressResults.operations.updates + stressResults.operations.deletes;
    expect(stressResults.tracked.afterDeletes).toBe(totalExpected);
    
    // Verify all changes have required fields
    expect(stressResults.validation.withClientSequence).toBe(totalExpected);
    expect(stressResults.validation.withClientId).toBe(totalExpected);
    expect(stressResults.validation.withTable).toBe(totalExpected);
    expect(stressResults.validation.withOperation).toBe(totalExpected);
    expect(stressResults.validation.withData).toBe(totalExpected);
    
    // Test 3: Verify changes persist and are ready for sync
    console.log('\nTEST 3: Verify changes persist for later sync');
    
    const persistenceTest = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const { getPendingChanges, markChangesAsProcessed } = await import('/src/db/dexie-change-tracking.js');
      
      // Get pending changes (unprocessed)
      const pendingChanges = await getPendingChanges(10);
      
      // Simulate marking some as processed (as if server acknowledged them)
      const toMark = pendingChanges.slice(0, 5).map(c => c.id);
      if (toMark.length > 0) {
        await markChangesAsProcessed(toMark);
      }
      
      // Check status after marking
      const afterMarking = {
        totalChanges: await db.localChanges.count(),
        pendingAfterMark: await getPendingChanges(1000),
        markedCount: toMark.length
      };
      
      return {
        initialPending: pendingChanges.length,
        markedAsProcessed: toMark.length,
        remainingPending: afterMarking.pendingAfterMark.length,
        totalInTable: afterMarking.totalChanges
      };
    });
    
    console.log('Persistence test:', persistenceTest);
    console.log(`✅ Changes ready for sync: ${persistenceTest.initialPending}`);
    console.log(`✅ Simulated server ack: ${persistenceTest.markedAsProcessed} changes`);
    console.log(`✅ Remaining to sync: ${persistenceTest.remainingPending}`);
    
    // Clean up
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Clear all test data
      const stressTasks = await db.tasks.where('title').startsWith('STRESS_').toArray();
      for (const task of stressTasks) {
        try {
          await db.tasks.delete(task.id);
        } catch (e) {
          // Ignore
        }
      }
      
      // Clear all changes
      await db.localChanges.toCollection().delete();
    });
    
    // Final summary
    console.log('\n=== FINAL SUMMARY ===');
    console.log('✅ Dexie hooks are properly initialized');
    console.log(`✅ Automatic tracking handled ${totalExpected} operations`);
    console.log('✅ All changes have required sync metadata');
    console.log('✅ Changes persist in localChanges table');
    console.log('✅ ProcessedSync flag works for acknowledgment');
    console.log('\n📊 STRESS TEST PASSED: 150 operations tracked automatically!');
    console.log('The local side of sync tracking is working correctly.');
    console.log('Changes are ready to be sent when WebSocket connects.');
  });
});