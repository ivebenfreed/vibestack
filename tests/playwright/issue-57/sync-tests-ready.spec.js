import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized } from '../core/sync-test-helpers.js';

test.describe('Sync Tests - Ready to Use', () => {
  test.setTimeout(15000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await waitForSyncInitialized(page, 10000);
  });

  test('Test 1: Sync is initialized and tracking is enabled', async ({ page }) => {
    const status = await page.evaluate(() => {
      const syncState = localStorage.getItem('sync-machine-state');
      return syncState ? JSON.parse(syncState) : null;
    });
    
    console.log('Sync status:', status);
    
    expect(status).toBeTruthy();
    expect(status.clientId).toBeTruthy();
    expect(status.currentLSN).toBeTruthy();
  });

  test('Test 2: Create task triggers automatic change tracking', async ({ page }) => {
    // Monitor console for hook activity
    let hookFired = false;
    page.on('console', msg => {
      if (msg.text().includes('[Dexie Hook Debug]') && msg.text().includes('Creating tasks')) {
        hookFired = true;
      }
    });
    
    const result = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      const before = await db.localChanges.count();
      
      // Create a task
      const task = await domainServices.task.create({
        id: crypto.randomUUID(),
        title: 'Test Task for Sync',
        status: 'todo'
      });
      
      // Wait for hook processing
      await new Promise(r => setTimeout(r, 100));
      
      const after = await db.localChanges.count();
      
      return {
        taskCreated: !!task,
        taskId: task.id,
        changesBefore: before,
        changesAfter: after,
        changeTracked: after > before
      };
    });
    
    console.log('Create result:', result);
    console.log('Hook fired:', hookFired);
    
    expect(result.taskCreated).toBe(true);
    expect(hookFired).toBe(true);
    expect(result.changeTracked).toBe(true);
  });

  test('Test 3: Update task triggers change tracking', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      // First create a task
      const task = await domainServices.task.create({
        id: crypto.randomUUID(),
        title: 'Task to Update',
        status: 'todo'
      });
      
      await new Promise(r => setTimeout(r, 100));
      
      const beforeUpdate = await db.localChanges.count();
      
      // Update it
      await domainServices.task.update(task.id, {
        title: 'Updated Title',
        status: 'in_progress'
      });
      
      await new Promise(r => setTimeout(r, 100));
      
      const afterUpdate = await db.localChanges.count();
      
      return {
        taskId: task.id,
        beforeUpdate,
        afterUpdate,
        updateTracked: afterUpdate > beforeUpdate
      };
    });
    
    console.log('Update result:', result);
    expect(result.updateTracked).toBe(true);
  });

  test('Test 4: Delete task triggers change tracking', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      // Create a task
      const task = await domainServices.task.create({
        id: crypto.randomUUID(),
        title: 'Task to Delete',
        status: 'todo'
      });
      
      await new Promise(r => setTimeout(r, 100));
      
      const beforeDelete = await db.localChanges.count();
      
      // Delete it
      await domainServices.task.delete(task.id);
      
      await new Promise(r => setTimeout(r, 100));
      
      const afterDelete = await db.localChanges.count();
      
      return {
        taskId: task.id,
        beforeDelete,
        afterDelete,
        deleteTracked: afterDelete > beforeDelete
      };
    });
    
    console.log('Delete result:', result);
    expect(result.deleteTracked).toBe(true);
  });

  test('Test 5: Changes are marked as processed after sync', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      // Create some tasks to generate changes
      for (let i = 0; i < 3; i++) {
        await domainServices.task.create({
          id: crypto.randomUUID(),
          title: `Sync Test Task ${i}`,
          status: 'todo'
        });
      }
      
      // Wait for processing
      await new Promise(r => setTimeout(r, 2000));
      
      // Check processed status
      const total = await db.localChanges.count();
      const unprocessed = await db.localChanges.where('processedSync').equals(0).count();
      const processed = await db.localChanges.where('processedSync').equals(1).count();
      
      return {
        total,
        unprocessed,
        processed,
        someProcessed: processed > 0
      };
    });
    
    console.log('Processing result:', result);
    expect(result.total).toBeGreaterThan(0);
    // Changes should be getting processed
    expect(result.someProcessed).toBe(true);
  });

  test('Test 6: Batch operations are tracked', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      const before = await db.localChanges.count();
      
      // Create multiple tasks quickly
      const taskIds = [];
      for (let i = 0; i < 5; i++) {
        const task = await domainServices.task.create({
          id: crypto.randomUUID(),
          title: `Batch Task ${i}`,
          status: 'todo'
        });
        taskIds.push(task.id);
      }
      
      // Wait for all hooks to process
      await new Promise(r => setTimeout(r, 500));
      
      const after = await db.localChanges.count();
      
      return {
        tasksCreated: taskIds.length,
        changesBefore: before,
        changesAfter: after,
        changesAdded: after - before,
        allTracked: (after - before) >= 5
      };
    });
    
    console.log('Batch result:', result);
    expect(result.allTracked).toBe(true);
  });

  test('Test 7: Outgoing changes are being sent', async ({ page }) => {
    // Monitor console for outgoing service activity
    const sentMessages = [];
    page.on('console', msg => {
      if (msg.text().includes('[DexieOutgoingChangeService]') && msg.text().includes('Successfully sent')) {
        sentMessages.push(msg.text());
      }
    });
    
    await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      
      // Create a task to trigger sync
      await domainServices.task.create({
        id: crypto.randomUUID(),
        title: 'Task to Sync',
        status: 'todo'
      });
    });
    
    // Wait for sync to happen
    await page.waitForTimeout(3000);
    
    console.log('Sent messages:', sentMessages.length);
    console.log('Sample:', sentMessages[0]);
    
    expect(sentMessages.length).toBeGreaterThan(0);
  });

  test('Test 8: Sync state persists across reload', async ({ page }) => {
    // Get initial state
    const before = await page.evaluate(() => {
      return {
        syncState: localStorage.getItem('sync-machine-state'),
        changeCount: 0 // Will be set below
      };
    });
    
    // Add a change
    await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      await domainServices.task.create({
        id: crypto.randomUUID(),
        title: 'Persistence Test',
        status: 'todo'
      });
    });
    
    // Get count before reload
    before.changeCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Get state after reload
    const after = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return {
        syncState: localStorage.getItem('sync-machine-state'),
        changeCount: await db.localChanges.count()
      };
    });
    
    console.log('Before reload - changes:', before.changeCount);
    console.log('After reload - changes:', after.changeCount);
    
    expect(after.syncState).toBeTruthy();
    expect(after.changeCount).toBeGreaterThanOrEqual(before.changeCount);
  });
});