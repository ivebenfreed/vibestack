import { test, expect } from '../fixtures/persistent-context.js';

/**
 * Stress Test for Dexie Hook-based Change Tracking
 * 
 * Tests the automatic change tracking system implemented via Dexie hooks.
 * Verifies that:
 * 1. User operations are automatically tracked in localChanges table
 * 2. Sync operations (marked with SYNC_TRANSACTION) are NOT tracked
 * 3. No duplicate changes are created
 * 4. Concurrent operations are handled correctly
 * 5. High-volume operations don't cause race conditions
 */

test.describe('Dexie Hooks Change Tracking Stress Test', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return document.body?.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Clear any existing test data
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Clear test tasks (delete individually to avoid transaction issues)
      const testTasks = await db.tasks.where('title').startsWith('STRESS_TEST_').toArray();
      for (const task of testTasks) {
        try {
          await db.tasks.delete(task.id);
        } catch (e) {
          console.warn('Failed to delete test task:', e);
        }
      }
      
      console.log(`[Test Setup] Cleared ${testTasks.length} test tasks`);
    });
    
    // Clear all pending changes separately (not in same transaction)
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      try {
        await db.localChanges.toCollection().delete();
        console.log('[Test Setup] Cleared all pending changes');
      } catch (e) {
        console.warn('[Test Setup] Failed to clear changes:', e);
      }
    });
  });

  test('should automatically track user operations via hooks', async ({ page }) => {
    console.log('=== Testing Automatic Hook-based Tracking ===');
    
    // Get initial change count
    const initialCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log(`Initial localChanges count: ${initialCount}`);
    
    // Create tasks using domain service (should trigger hooks)
    const numTasks = 5;
    const createdTasks = [];
    
    for (let i = 0; i < numTasks; i++) {
      const task = await page.evaluate(async (index) => {
        const { domainServices } = await import('/src/domain/index.js');
        return await domainServices.task.create({
          title: `STRESS_TEST_Task_${index}`,
          description: `Created for hook testing at ${Date.now()}`,
          status: 'todo'
        });
      }, i);
      
      createdTasks.push(task);
      console.log(`Created task ${i + 1}/${numTasks}: ${task.id}`);
    }
    
    // Wait for hooks to process (they use setTimeout)
    await page.waitForTimeout(500);
    
    // Check that changes were tracked
    const changesAfterCreate = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      return {
        count: changes.length,
        operations: changes.map(c => ({ 
          table: c.table, 
          operation: c.operation,
          entityId: c.data?.id
        }))
      };
    });
    
    console.log(`Changes after create: ${changesAfterCreate.count}`);
    console.log('Operations tracked:', JSON.stringify(changesAfterCreate.operations, null, 2));
    
    // Verify all creates were tracked
    expect(changesAfterCreate.count).toBeGreaterThanOrEqual(numTasks);
    const createOps = changesAfterCreate.operations.filter(op => op.operation === 'insert');
    expect(createOps.length).toBe(numTasks);
    
    // Update all tasks
    for (let i = 0; i < createdTasks.length; i++) {
      await page.evaluate(async ({ taskId, index }) => {
        const { domainServices } = await import('/src/domain/index.js');
        return await domainServices.task.update(taskId, {
          title: `STRESS_TEST_Updated_Task_${index}`,
          status: 'in_progress'
        });
      }, { taskId: createdTasks[i].id, index: i });
    }
    
    // Wait for hooks
    await page.waitForTimeout(500);
    
    // Check updates were tracked
    const changesAfterUpdate = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      const updateOps = changes.filter(c => c.operation === 'update');
      return {
        totalCount: changes.length,
        updateCount: updateOps.length
      };
    });
    
    console.log(`Total changes: ${changesAfterUpdate.totalCount}, Updates: ${changesAfterUpdate.updateCount}`);
    expect(changesAfterUpdate.updateCount).toBe(numTasks);
    
    // Clean up
    for (const task of createdTasks) {
      await page.evaluate(async (taskId) => {
        const { domainServices } = await import('/src/domain/index.js');
        await domainServices.task.delete(taskId);
      }, task.id);
    }
  });

  test('should NOT track sync operations marked with SYNC_TRANSACTION', async ({ page }) => {
    console.log('=== Testing Sync Transaction Exclusion ===');
    
    // Clear changes
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.toCollection().delete();
    });
    
    // Create tasks using sync methods (should NOT trigger tracking)
    const syncTasks = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      const { SYNC_TRANSACTION } = await import('/src/db/dexie-change-tracking.js');
      
      const tasks = [];
      
      // Run in a sync transaction
      await db.transaction('rw', db.tasks, async (trans) => {
        // Mark as sync transaction
        trans[SYNC_TRANSACTION] = true;
        
        for (let i = 0; i < 3; i++) {
          const task = {
            id: crypto.randomUUID(),
            title: `STRESS_TEST_Sync_Task_${i}`,
            description: 'Created via sync transaction',
            status: 'todo',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await db.tasks.add(task);
          tasks.push(task);
        }
      });
      
      return tasks;
    });
    
    console.log(`Created ${syncTasks.length} tasks via sync transaction`);
    
    // Wait for any potential hook processing
    await page.waitForTimeout(500);
    
    // Check that NO changes were tracked
    const changeCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log(`Changes tracked from sync operations: ${changeCount}`);
    expect(changeCount).toBe(0); // No changes should be tracked for sync operations
    
    // Clean up
    await page.evaluate(async (taskIds) => {
      const { db } = await import('/src/domain/index.js');
      for (const id of taskIds) {
        await db.tasks.delete(id);
      }
    }, syncTasks.map(t => t.id));
  });

  test('should prevent duplicate change tracking', async ({ page }) => {
    console.log('=== Testing Duplicate Prevention ===');
    
    // Clear changes
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.toCollection().delete();
    });
    
    // Create a task
    const task = await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      return await domainServices.task.create({
        title: 'STRESS_TEST_Duplicate_Test',
        description: 'Testing duplicate prevention',
        status: 'todo'
      });
    });
    
    // Rapidly update the same task multiple times within duplicate window
    const numRapidUpdates = 5;
    for (let i = 0; i < numRapidUpdates; i++) {
      await page.evaluate(async ({ taskId, index }) => {
        const { domainServices } = await import('/src/domain/index.js');
        await domainServices.task.update(taskId, {
          description: `Rapid update ${index}`
        });
      }, { taskId: task.id, index: i });
      
      // Very short delay (within duplicate window)
      await page.waitForTimeout(50);
    }
    
    // Wait for hooks to process
    await page.waitForTimeout(1000);
    
    // Check change count
    const changes = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const allChanges = await db.localChanges.toArray();
      return {
        total: allChanges.length,
        byOperation: {
          insert: allChanges.filter(c => c.operation === 'insert').length,
          update: allChanges.filter(c => c.operation === 'update').length,
          delete: allChanges.filter(c => c.operation === 'delete').length
        }
      };
    });
    
    console.log('Changes tracked:', JSON.stringify(changes, null, 2));
    
    // Should have 1 insert and reasonable number of updates (not all duplicates)
    expect(changes.byOperation.insert).toBe(1);
    expect(changes.byOperation.update).toBeGreaterThan(0);
    expect(changes.byOperation.update).toBeLessThanOrEqual(numRapidUpdates);
    
    // Clean up
    await page.evaluate(async (taskId) => {
      const { domainServices } = await import('/src/domain/index.js');
      await domainServices.task.delete(taskId);
    }, task.id);
  });

  test('should handle high-volume concurrent operations', async ({ page }) => {
    console.log('=== Testing High-Volume Concurrent Operations ===');
    
    // Clear changes
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.toCollection().delete();
    });
    
    const numConcurrent = 10;
    
    // Create many tasks concurrently
    console.log(`Creating ${numConcurrent} tasks concurrently...`);
    const createPromises = [];
    for (let i = 0; i < numConcurrent; i++) {
      createPromises.push(
        page.evaluate(async (index) => {
          const { domainServices } = await import('/src/domain/index.js');
          return await domainServices.task.create({
            title: `STRESS_TEST_Concurrent_${index}`,
            description: `Concurrent create test ${Date.now()}`,
            status: 'todo'
          });
        }, i)
      );
    }
    
    const tasks = await Promise.all(createPromises);
    console.log(`Created ${tasks.length} tasks concurrently`);
    
    // Wait for hooks to process
    await page.waitForTimeout(1000);
    
    // Verify all creates were tracked
    const createChanges = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.where('operation').equals('insert').toArray();
      return changes.length;
    });
    
    console.log(`Tracked ${createChanges} create operations`);
    expect(createChanges).toBe(numConcurrent);
    
    // Update all tasks concurrently
    console.log('Updating all tasks concurrently...');
    const updatePromises = [];
    for (let i = 0; i < tasks.length; i++) {
      updatePromises.push(
        page.evaluate(async ({ taskId, index }) => {
          const { domainServices } = await import('/src/domain/index.js');
          await domainServices.task.update(taskId, {
            title: `STRESS_TEST_Updated_Concurrent_${index}`,
            status: 'in_progress'
          });
        }, { taskId: tasks[i].id, index: i })
      );
    }
    
    await Promise.all(updatePromises);
    
    // Wait for hooks
    await page.waitForTimeout(1000);
    
    // Verify updates were tracked
    const updateChanges = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.where('operation').equals('update').toArray();
      return changes.length;
    });
    
    console.log(`Tracked ${updateChanges} update operations`);
    expect(updateChanges).toBe(numConcurrent);
    
    // Delete all tasks concurrently
    console.log('Deleting all tasks concurrently...');
    const deletePromises = [];
    for (const task of tasks) {
      deletePromises.push(
        page.evaluate(async (taskId) => {
          const { domainServices } = await import('/src/domain/index.js');
          await domainServices.task.delete(taskId);
        }, task.id)
      );
    }
    
    await Promise.all(deletePromises);
    
    // Wait for hooks
    await page.waitForTimeout(1000);
    
    // Verify deletes were tracked
    const deleteChanges = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.where('operation').equals('delete').toArray();
      return changes.length;
    });
    
    console.log(`Tracked ${deleteChanges} delete operations`);
    expect(deleteChanges).toBe(numConcurrent);
    
    // Final verification: total changes
    const totalChanges = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log(`Total changes tracked: ${totalChanges}`);
    expect(totalChanges).toBe(numConcurrent * 3); // create + update + delete for each task
  });

  test('should maintain change order and integrity under stress', async ({ page }) => {
    console.log('=== Testing Change Order and Integrity ===');
    
    // Clear changes
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.toCollection().delete();
    });
    
    // Perform mixed operations in sequence
    const operations = [];
    const numOperations = 20;
    
    for (let i = 0; i < numOperations; i++) {
      const opType = i % 3;
      
      if (opType === 0) {
        // Create
        const task = await page.evaluate(async (index) => {
          const { domainServices } = await import('/src/domain/index.js');
          return await domainServices.task.create({
            title: `STRESS_TEST_Order_${index}`,
            description: `Operation ${index}`,
            status: 'todo'
          });
        }, i);
        operations.push({ type: 'create', id: task.id, index: i });
      } else if (opType === 1 && operations.some(op => op.type === 'create')) {
        // Update a random created task
        const createOps = operations.filter(op => op.type === 'create');
        const target = createOps[Math.floor(Math.random() * createOps.length)];
        
        await page.evaluate(async ({ taskId, index }) => {
          const { domainServices } = await import('/src/domain/index.js');
          await domainServices.task.update(taskId, {
            description: `Updated at operation ${index}`
          });
        }, { taskId: target.id, index: i });
        
        operations.push({ type: 'update', id: target.id, index: i });
      } else if (operations.some(op => op.type === 'create')) {
        // Delete a random created task
        const createOps = operations.filter(op => op.type === 'create');
        const target = createOps[Math.floor(Math.random() * createOps.length)];
        
        await page.evaluate(async (taskId) => {
          const { domainServices } = await import('/src/domain/index.js');
          await domainServices.task.delete(taskId);
        }, target.id);
        
        operations.push({ type: 'delete', id: target.id, index: i });
        // Remove from create list to avoid double delete
        operations.splice(operations.indexOf(target), 1);
      }
      
      // Small delay between operations
      await page.waitForTimeout(100);
    }
    
    // Wait for all hooks to process
    await page.waitForTimeout(1000);
    
    // Analyze tracked changes
    const analysis = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.localChanges.toArray();
      
      // Group by operation type
      const byOperation = {
        insert: changes.filter(c => c.operation === 'insert').length,
        update: changes.filter(c => c.operation === 'update').length,
        delete: changes.filter(c => c.operation === 'delete').length
      };
      
      // Check for any null/undefined data
      const invalidChanges = changes.filter(c => !c.data || !c.table || !c.operation);
      
      // Check clientSequence is present
      const missingSequence = changes.filter(c => !c.clientSequence);
      
      return {
        total: changes.length,
        byOperation,
        invalidChanges: invalidChanges.length,
        missingSequence: missingSequence.length,
        firstChange: changes[0],
        lastChange: changes[changes.length - 1]
      };
    });
    
    console.log('Change analysis:', JSON.stringify(analysis, null, 2));
    
    // Verify integrity
    expect(analysis.invalidChanges).toBe(0);
    expect(analysis.missingSequence).toBe(0);
    expect(analysis.total).toBeGreaterThan(0);
    
    // Clean up any remaining tasks
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const testTasks = await db.tasks.where('title').startsWith('STRESS_TEST_').toArray();
      for (const task of testTasks) {
        await db.tasks.delete(task.id);
      }
    });
  });
});