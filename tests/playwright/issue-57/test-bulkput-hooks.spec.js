import { test, expect } from '../fixtures/persistent-context.js';

/**
 * Test to investigate whether Dexie's bulkPut() operations trigger individual hooks
 * for each record in the bulk operation, and whether transaction context is passed correctly.
 * 
 * This is critical for understanding the sync loop issue where 2,623 changes are being tracked
 * when they should be ignored due to SYNC_TRANSACTION flags.
 */

test.describe('Dexie bulkPut Hook Behavior Investigation', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return document.body?.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Clear any existing test data and changes (safer approach)
    try {
      await page.evaluate(async () => {
        const { db } = await import('/src/domain/index.js');
        
        // Clear test tasks individually to avoid transaction issues
        const testTasks = await db.tasks.where('title').startsWith('BULKPUT_TEST_').toArray();
        console.log(`[Test Setup] Found ${testTasks.length} test tasks to clear`);
        
        for (const task of testTasks) {
          try {
            await db.tasks.delete(task.id);
          } catch (e) {
            console.warn(`[Test Setup] Failed to delete task ${task.id}:`, e.message);
          }
        }
        
        // Clear all pending changes
        try {
          await db.localChanges.toCollection().delete();
          console.log('[Test Setup] Cleared all pending changes');
        } catch (e) {
          console.warn('[Test Setup] Failed to clear changes:', e.message);
        }
      });
    } catch (setupError) {
      console.warn('[Test Setup] Setup failed:', setupError.message);
      // Continue with test anyway
    }
  });

  test('should investigate if bulkPut triggers individual hooks for each record', async ({ page }) => {
    console.log('=== Testing bulkPut Hook Triggering Behavior ===');
    
    // Create test data for bulk operation
    const testTasks = [];
    for (let i = 0; i < 5; i++) {
      testTasks.push({
        id: crypto.randomUUID(),
        title: `BULKPUT_TEST_Task_${i}`,
        description: `Bulk operation test ${i}`,
        status: 'todo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // Get initial change count
    const initialCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log(`Initial localChanges count: ${initialCount}`);
    
    // Test 1: bulkPut WITHOUT SYNC_TRANSACTION (should trigger hooks)
    console.log('--- Test 1: bulkPut without SYNC_TRANSACTION ---');
    
    const userBulkResult = await page.evaluate(async (tasks) => {
      const { db } = await import('/src/domain/index.js');
      
      // Perform bulkPut without SYNC_TRANSACTION flag
      await db.tasks.bulkPut(tasks);
      
      return { 
        tasksCreated: tasks.length,
        message: 'bulkPut completed without SYNC_TRANSACTION'
      };
    }, testTasks);
    
    console.log('User bulkPut result:', userBulkResult);
    
    // Wait for hooks to process (they use setTimeout)
    await page.waitForTimeout(1000);
    
    // Check if hooks were triggered for each record
    const userChanges = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      
      return {
        totalChanges: changes.length,
        insertChanges: changes.filter(c => c.operation === 'insert').length,
        changeDetails: changes.map(c => ({
          table: c.table,
          operation: c.operation,
          entityId: c.data?.id,
          clientSequence: c.clientSequence
        }))
      };
    });
    
    console.log('Changes after user bulkPut:', JSON.stringify(userChanges, null, 2));
    
    // Test 2: bulkPut WITH SYNC_TRANSACTION (should NOT trigger hooks)
    console.log('--- Test 2: bulkPut with SYNC_TRANSACTION ---');
    
    // Create more test tasks
    const syncTasks = [];
    for (let i = 5; i < 10; i++) {
      syncTasks.push({
        id: crypto.randomUUID(),
        title: `BULKPUT_TEST_Sync_Task_${i}`,
        description: `Sync bulk operation test ${i}`,
        status: 'todo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    const syncBulkResult = await page.evaluate(async (tasks) => {
      const { db } = await import('/src/domain/index.js');
      const { SYNC_TRANSACTION } = await import('/src/db/dexie-change-tracking.js');
      
      // Perform bulkPut WITH SYNC_TRANSACTION flag
      await db.transaction('rw', db.tasks, async (trans) => {
        // Mark transaction with SYNC_TRANSACTION
        trans[SYNC_TRANSACTION] = true;
        await db.tasks.bulkPut(tasks);
      });
      
      return { 
        tasksCreated: tasks.length,
        message: 'bulkPut completed with SYNC_TRANSACTION'
      };
    }, syncTasks);
    
    console.log('Sync bulkPut result:', syncBulkResult);
    
    // Wait for any potential hook processing
    await page.waitForTimeout(1000);
    
    // Check if sync changes were properly ignored
    const finalChanges = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      
      return {
        totalChanges: changes.length,
        insertChanges: changes.filter(c => c.operation === 'insert').length,
        changesByType: {
          userChanges: changes.filter(c => c.data?.title?.includes('BULKPUT_TEST_Task_')),
          syncChanges: changes.filter(c => c.data?.title?.includes('BULKPUT_TEST_Sync_Task_'))
        }
      };
    });
    
    console.log('Final changes after sync bulkPut:', JSON.stringify(finalChanges, null, 2));
    
    // Verification
    console.log('--- Verification Results ---');
    
    // User bulkPut should have triggered hooks for each record
    expect(userChanges.insertChanges).toBe(testTasks.length);
    console.log(`✅ User bulkPut triggered ${userChanges.insertChanges} individual hooks for ${testTasks.length} records`);
    
    // Sync bulkPut should NOT have added any new changes
    const syncChangesAdded = finalChanges.totalChanges - userChanges.totalChanges;
    expect(syncChangesAdded).toBe(0);
    console.log(`✅ Sync bulkPut with SYNC_TRANSACTION flag added ${syncChangesAdded} changes (expected: 0)`);
    
    // Cleanup
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const testTasks = await db.tasks.where('title').startsWith('BULKPUT_TEST_').toArray();
      for (const task of testTasks) {
        await db.tasks.delete(task.id);
      }
    });
  });

  test('should investigate transaction context passing in bulkPut operations', async ({ page }) => {
    console.log('=== Testing Transaction Context Passing in bulkPut ===');
    
    // Create hook monitoring system
    const hookResults = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const { SYNC_TRANSACTION } = await import('/src/db/dexie-change-tracking.js');
      
      const hookCalls = [];
      
      // Add temporary hook to monitor transaction context
      const originalCreatingHook = db.tasks.hook.creating;
      
      // Override the creating hook to capture transaction context
      db.tasks.hook('creating', function (primKey, obj, trans) {
        const isSyncTransaction = trans && trans[SYNC_TRANSACTION];
        const hasTransactionContext = !!trans;
        
        hookCalls.push({
          entityId: obj.id,
          title: obj.title,
          hasTransactionContext,
          isSyncTransaction,
          timestamp: Date.now()
        });
        
        console.log(`[Hook Monitor] Creating hook called:`, {
          entityId: obj.id,
          hasTransactionContext,
          isSyncTransaction
        });
      });
      
      return { message: 'Hook monitoring setup complete' };
    });
    
    console.log('Hook monitoring result:', hookResults);
    
    // Test bulkPut with explicit transaction
    console.log('--- Testing bulkPut with explicit transaction ---');
    
    const explicitTransactionTest = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const { SYNC_TRANSACTION } = await import('/src/db/dexie-change-tracking.js');
      
      const tasks = [
        {
          id: crypto.randomUUID(),
          title: 'BULKPUT_TEST_Explicit_Trans_1',
          description: 'Explicit transaction test',
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: crypto.randomUUID(), 
          title: 'BULKPUT_TEST_Explicit_Trans_2',
          description: 'Explicit transaction test',
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Perform bulkPut within explicit transaction marked as SYNC_TRANSACTION
      await db.transaction('rw', db.tasks, async (trans) => {
        trans[SYNC_TRANSACTION] = true;
        await db.tasks.bulkPut(tasks);
      });
      
      return { tasksCreated: tasks.length };
    });
    
    console.log('Explicit transaction test result:', explicitTransactionTest);
    
    // Wait for hooks to process
    await page.waitForTimeout(1000);
    
    // Test bulkPut without explicit transaction
    console.log('--- Testing bulkPut without explicit transaction ---');
    
    const implicitTransactionTest = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      const tasks = [
        {
          id: crypto.randomUUID(),
          title: 'BULKPUT_TEST_Implicit_Trans_1',
          description: 'Implicit transaction test',
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: crypto.randomUUID(),
          title: 'BULKPUT_TEST_Implicit_Trans_2', 
          description: 'Implicit transaction test',
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Perform bulkPut without explicit transaction
      await db.tasks.bulkPut(tasks);
      
      return { tasksCreated: tasks.length };
    });
    
    console.log('Implicit transaction test result:', implicitTransactionTest);
    
    // Wait for hooks to process  
    await page.waitForTimeout(1000);
    
    // Analyze hook call results
    const hookAnalysis = await page.evaluate(async () => {
      // Since we can't directly access the hookCalls array from the hook closure,
      // we'll check the actual changes tracked instead
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      
      return {
        totalChanges: changes.length,
        explicitTransChanges: changes.filter(c => c.data?.title?.includes('BULKPUT_TEST_Explicit_Trans')).length,
        implicitTransChanges: changes.filter(c => c.data?.title?.includes('BULKPUT_TEST_Implicit_Trans')).length,
        allChangeDetails: changes.map(c => ({
          title: c.data?.title,
          operation: c.operation,
          clientSequence: c.clientSequence
        }))
      };
    });
    
    console.log('Hook analysis results:', JSON.stringify(hookAnalysis, null, 2));
    
    // Verification
    console.log('--- Transaction Context Verification ---');
    
    // Explicit transaction with SYNC_TRANSACTION should not create changes
    expect(hookAnalysis.explicitTransChanges).toBe(0);
    console.log(`✅ Explicit transaction with SYNC_TRANSACTION: ${hookAnalysis.explicitTransChanges} changes (expected: 0)`);
    
    // Implicit transaction should create changes
    expect(hookAnalysis.implicitTransChanges).toBe(2);
    console.log(`✅ Implicit transaction without SYNC_TRANSACTION: ${hookAnalysis.implicitTransChanges} changes (expected: 2)`);
    
    // Cleanup
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const testTasks = await db.tasks.where('title').startsWith('BULKPUT_TEST_').toArray();
      for (const task of testTasks) {
        await db.tasks.delete(task.id);
      }
    });
  });

  test('should test IncomingChangeService bulkPut pattern', async ({ page }) => {
    console.log('=== Testing IncomingChangeService bulkPut Pattern ===');
    
    // Clear changes first
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.toCollection().delete();
    });
    
    // Simulate the exact pattern used in IncomingChangeService
    const incomingServiceTest = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const { SYNC_TRANSACTION } = await import('/src/db/dexie-change-tracking.js');
      
      const testTasks = [];
      for (let i = 0; i < 10; i++) {
        testTasks.push({
          id: crypto.randomUUID(),
          title: `BULKPUT_TEST_Incoming_${i}`,
          description: `IncomingChangeService pattern test ${i}`,
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      // Use the EXACT pattern from IncomingChangeService.processBulkInserts
      const dexieTable = db.tasks;
      
      // Use transaction with SYNC_TRANSACTION flag to prevent change tracking
      await db.transaction('rw', dexieTable, async (trans) => {
        trans[SYNC_TRANSACTION] = true;
        await dexieTable.bulkPut(testTasks);
      });
      
      return { 
        tasksCreated: testTasks.length,
        pattern: 'IncomingChangeService.processBulkInserts'
      };
    });
    
    console.log('IncomingChangeService pattern test result:', incomingServiceTest);
    
    // Wait for any potential hook processing
    await page.waitForTimeout(1000);
    
    // Check if changes were properly ignored
    const changeAnalysis = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      
      return {
        totalChanges: changes.length,
        incomingServiceChanges: changes.filter(c => c.data?.title?.includes('BULKPUT_TEST_Incoming')).length,
        allChanges: changes.map(c => ({
          title: c.data?.title,
          operation: c.operation,
          table: c.table
        }))
      };
    });
    
    console.log('Change analysis for IncomingChangeService pattern:', JSON.stringify(changeAnalysis, null, 2));
    
    // Verification
    expect(changeAnalysis.incomingServiceChanges).toBe(0);
    console.log(`✅ IncomingChangeService bulkPut pattern correctly ignored ${incomingServiceTest.tasksCreated} sync operations`);
    
    // Test what happens if the SYNC_TRANSACTION flag is missing
    console.log('--- Testing missing SYNC_TRANSACTION flag ---');
    
    const missingFlagTest = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      const testTasks = [];
      for (let i = 0; i < 3; i++) {
        testTasks.push({
          id: crypto.randomUUID(),
          title: `BULKPUT_TEST_NoFlag_${i}`,
          description: `Missing flag test ${i}`,
          status: 'todo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      // Same pattern but WITHOUT SYNC_TRANSACTION flag
      const dexieTable = db.tasks;
      
      await db.transaction('rw', dexieTable, async (trans) => {
        // NOTE: Missing trans[SYNC_TRANSACTION] = true;
        await dexieTable.bulkPut(testTasks);
      });
      
      return { tasksCreated: testTasks.length };
    });
    
    console.log('Missing flag test result:', missingFlagTest);
    
    // Wait for hooks
    await page.waitForTimeout(1000);
    
    // Check changes
    const finalAnalysis = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      
      return {
        totalChanges: changes.length,
        noFlagChanges: changes.filter(c => c.data?.title?.includes('BULKPUT_TEST_NoFlag')).length
      };
    });
    
    console.log('Final analysis with missing flag:', finalAnalysis);
    
    // Without SYNC_TRANSACTION flag, changes should be tracked
    expect(finalAnalysis.noFlagChanges).toBe(3);
    console.log(`✅ Missing SYNC_TRANSACTION flag resulted in ${finalAnalysis.noFlagChanges} tracked changes (expected: 3)`);
    
    // Cleanup
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const testTasks = await db.tasks.where('title').startsWith('BULKPUT_TEST_').toArray();
      for (const task of testTasks) {
        await db.tasks.delete(task.id);
      }
    });
  });
});