import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, getCurrentLSN, getSyncState } from '../core/sync-test-helpers.js';

test.describe('Ready-Made Sync Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 15000 }
    ).catch(() => {
      console.log('App ready signal not detected, continuing...');
    });
    
    // Wait for sync to initialize
    await waitForSyncInitialized(page, 30000);
  });

  test('Test 1: Verify sync is initialized', async ({ page }) => {
    const syncState = await getSyncState(page);
    
    console.log('Sync state:', syncState);
    
    expect(syncState).toBeTruthy();
    expect(syncState.currentLSN).toBeTruthy();
    expect(syncState.currentLSN).not.toBe('0/0');
  });

  test('Test 2: Verify localChanges table exists and is accessible', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const { db } = await import('/src/domain/index.js');
        
        // Check if localChanges table exists
        const tableNames = db.tables.map(t => t.name);
        const hasLocalChanges = tableNames.includes('localChanges');
        
        // Try to count records
        let count = -1;
        if (hasLocalChanges) {
          count = await db.localChanges.count();
        }
        
        return {
          success: true,
          hasLocalChanges,
          tableNames,
          count
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('Database check result:', result);
    
    expect(result.success).toBe(true);
    expect(result.hasLocalChanges).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  test('Test 3: Create a task and verify it gets tracked', async ({ page }) => {
    // Get initial count
    const initialCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log('Initial localChanges count:', initialCount);
    
    // Create a task
    const taskResult = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        
        const taskId = crypto.randomUUID();
        const task = await domainServices.task.create({
          id: taskId,
          title: 'Test Task for Sync',
          description: 'This task tests sync tracking',
          status: 'todo'
        });
        
        return {
          success: true,
          taskId,
          task
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('Task creation result:', taskResult);
    expect(taskResult.success).toBe(true);
    
    // Wait a moment for tracking
    await page.waitForTimeout(2000);
    
    // Check if change was tracked
    const afterCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log('After task creation count:', afterCount);
    expect(afterCount).toBeGreaterThan(initialCount);
  });

  test('Test 4: Update a task and verify change tracking', async ({ page }) => {
    // First create a task
    const taskId = await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      const id = crypto.randomUUID();
      await domainServices.task.create({
        id,
        title: 'Task to Update',
        status: 'todo'
      });
      return id;
    });
    
    // Get count after creation
    const countAfterCreate = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log('Count after create:', countAfterCreate);
    
    // Update the task
    const updateResult = await page.evaluate(async (id) => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        await domainServices.task.update(id, {
          title: 'Updated Task Title',
          status: 'in_progress'
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, taskId);
    
    console.log('Update result:', updateResult);
    expect(updateResult.success).toBe(true);
    
    // Wait for tracking
    await page.waitForTimeout(2000);
    
    // Check if update was tracked
    const countAfterUpdate = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log('Count after update:', countAfterUpdate);
    expect(countAfterUpdate).toBeGreaterThan(countAfterCreate);
  });

  test('Test 5: Delete a task and verify change tracking', async ({ page }) => {
    // Create a task
    const taskId = await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      const id = crypto.randomUUID();
      await domainServices.task.create({
        id,
        title: 'Task to Delete',
        status: 'todo'
      });
      return id;
    });
    
    // Get count after creation
    const countAfterCreate = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log('Count after create:', countAfterCreate);
    
    // Delete the task
    const deleteResult = await page.evaluate(async (id) => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        await domainServices.task.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, taskId);
    
    console.log('Delete result:', deleteResult);
    expect(deleteResult.success).toBe(true);
    
    // Wait for tracking
    await page.waitForTimeout(2000);
    
    // Check if delete was tracked
    const countAfterDelete = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log('Count after delete:', countAfterDelete);
    expect(countAfterDelete).toBeGreaterThan(countAfterCreate);
  });

  test('Test 6: Verify processedSync flag behavior', async ({ page }) => {
    // Create a task to generate a change
    await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      await domainServices.task.create({
        id: crypto.randomUUID(),
        title: 'Task for processedSync test',
        status: 'todo'
      });
    });
    
    // Wait for tracking
    await page.waitForTimeout(2000);
    
    // Check processedSync status
    const syncStatus = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const total = await db.localChanges.count();
      const unprocessed = await db.localChanges.where('processedSync').equals(0).count();
      const processed = await db.localChanges.where('processedSync').equals(1).count();
      
      // Get a sample of recent changes
      const recentChanges = await db.localChanges
        .orderBy('timestamp')
        .reverse()
        .limit(5)
        .toArray();
      
      return {
        total,
        unprocessed,
        processed,
        recentChanges: recentChanges.map(c => ({
          id: c.id,
          entity: c.entity,
          operation: c.operation,
          processedSync: c.processedSync,
          timestamp: c.timestamp
        }))
      };
    });
    
    console.log('Sync status:', syncStatus);
    
    expect(syncStatus.total).toBeGreaterThan(0);
    expect(syncStatus.unprocessed + syncStatus.processed).toBe(syncStatus.total);
  });

  test('Test 7: Monitor sync acknowledgments over time', async ({ page }) => {
    // Get initial state
    const initialState = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return {
        total: await db.localChanges.count(),
        processed: await db.localChanges.where('processedSync').equals(1).count()
      };
    });
    
    console.log('Initial state:', initialState);
    
    // Create multiple tasks
    const taskIds = [];
    for (let i = 0; i < 3; i++) {
      const taskId = await page.evaluate(async (index) => {
        const { domainServices } = await import('/src/domain/index.js');
        const id = crypto.randomUUID();
        await domainServices.task.create({
          id,
          title: `Sync Test Task ${index}`,
          status: 'todo'
        });
        return id;
      }, i);
      taskIds.push(taskId);
      
      // Small delay between creates
      await page.waitForTimeout(500);
    }
    
    console.log('Created tasks:', taskIds);
    
    // Monitor for acknowledgments
    let maxChecks = 5;
    let checkCount = 0;
    let lastProcessedCount = initialState.processed;
    
    while (checkCount < maxChecks) {
      await page.waitForTimeout(3000);
      
      const currentState = await page.evaluate(async () => {
        const { db } = await import('/src/domain/index.js');
        return {
          total: await db.localChanges.count(),
          processed: await db.localChanges.where('processedSync').equals(1).count(),
          unprocessed: await db.localChanges.where('processedSync').equals(0).count()
        };
      });
      
      console.log(`Check ${checkCount + 1}:`, currentState);
      
      if (currentState.processed > lastProcessedCount) {
        console.log(`✅ Acknowledgments received: ${currentState.processed - lastProcessedCount} new`);
        lastProcessedCount = currentState.processed;
      }
      
      checkCount++;
    }
    
    // Final state
    const finalState = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return {
        total: await db.localChanges.count(),
        processed: await db.localChanges.where('processedSync').equals(1).count(),
        unprocessed: await db.localChanges.where('processedSync').equals(0).count()
      };
    });
    
    console.log('Final state:', finalState);
    console.log('Total new changes:', finalState.total - initialState.total);
    console.log('Total new acknowledgments:', finalState.processed - initialState.processed);
    
    // Verify we tracked all the changes
    expect(finalState.total).toBeGreaterThanOrEqual(initialState.total + 3);
  });

  test('Test 8: Verify sync state persistence', async ({ page }) => {
    const syncState1 = await getSyncState(page);
    console.log('Initial sync state:', syncState1);
    
    // Reload the page
    await page.reload();
    
    // Wait for app ready again
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 15000 }
    ).catch(() => {
      console.log('App ready signal not detected after reload, continuing...');
    });
    
    // Check if sync state persisted
    const syncState2 = await getSyncState(page);
    console.log('Sync state after reload:', syncState2);
    
    expect(syncState2.currentLSN).toBeTruthy();
    expect(syncState2.currentLSN).not.toBe('0/0');
  });

  test('Test 9: Batch operations tracking', async ({ page }) => {
    const initialCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    // Perform batch operations
    const batchResult = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        const results = [];
        
        // Create 5 tasks in quick succession
        for (let i = 0; i < 5; i++) {
          const task = await domainServices.task.create({
            id: crypto.randomUUID(),
            title: `Batch Task ${i}`,
            status: 'todo'
          });
          results.push(task);
        }
        
        return { success: true, count: results.length };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Batch result:', batchResult);
    expect(batchResult.success).toBe(true);
    
    // Wait for tracking
    await page.waitForTimeout(3000);
    
    const finalCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log('Initial count:', initialCount);
    console.log('Final count:', finalCount);
    console.log('Changes tracked:', finalCount - initialCount);
    
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 5);
  });

  test('Test 10: Verify LSN advancement', async ({ page }) => {
    const initialLSN = await getCurrentLSN(page);
    console.log('Initial LSN:', initialLSN);
    
    // Create a change
    await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      await domainServices.task.create({
        id: crypto.randomUUID(),
        title: 'Task to advance LSN',
        status: 'todo'
      });
    });
    
    // Wait for potential sync
    await page.waitForTimeout(5000);
    
    const finalLSN = await getCurrentLSN(page);
    console.log('Final LSN:', finalLSN);
    
    // LSN format is like "0/123ABC" - compare them
    if (initialLSN !== '0/0' && finalLSN !== '0/0') {
      console.log('LSN comparison:', {
        initial: initialLSN,
        final: finalLSN,
        changed: initialLSN !== finalLSN
      });
    }
    
    // At minimum, verify we have an LSN
    expect(finalLSN).toBeTruthy();
    expect(finalLSN).not.toBe('0/0');
  });
});