import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Simple Sync Stress Test', () => {
  test('should handle multiple rapid task creations', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return document.body?.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });

    console.log('Creating tasks rapidly...');
    
    // Create tasks using the UI
    const numTasks = 10;
    const createdTasks = [];
    
    for (let i = 0; i < numTasks; i++) {
      // Create task via domain service
      const task = await page.evaluate(async (index) => {
        const { domainServices } = await import('/src/domain/index.js');
        return await domainServices.task.createUI({
          title: `Stress Test Task ${index}`,
          description: `Created at ${Date.now()}`,
          status: 'todo'
        });
      }, i);
      
      createdTasks.push(task);
      console.log(`Created task ${i + 1}/${numTasks}: ${task.id}`);
      
      // Small delay to allow sync to process
      await page.waitForTimeout(100);
    }
    
    // Wait for sync to stabilize
    await page.waitForTimeout(2000);
    
    // Verify all tasks exist in the database
    const dbTaskCount = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const tasks = await db.tasks.toArray();
      return tasks.filter(t => t.title.startsWith('Stress Test Task')).length;
    });
    
    console.log(`Database has ${dbTaskCount} stress test tasks`);
    expect(dbTaskCount).toBe(numTasks);
    
    // Check sync tracking state
    const syncState = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Get change history count
      const changeCount = await db.change_history.count();
      
      // Get outgoing queue count
      const queueCount = await db.outgoing_change_queue.count();
      
      // Get last few changes
      const recentChanges = await db.change_history
        .orderBy('hlc')
        .reverse()
        .limit(5)
        .toArray();
      
      return {
        changeCount,
        queueCount,
        recentChanges: recentChanges.map(c => ({
          entity_type: c.entity_type,
          entity_id: c.entity_id,
          operation: c.operation,
          hlc: c.hlc
        }))
      };
    });
    
    console.log('Sync state:', JSON.stringify(syncState, null, 2));
    
    // Verify changes were tracked
    expect(syncState.changeCount).toBeGreaterThanOrEqual(numTasks);
    
    // Clean up
    console.log('Cleaning up test tasks...');
    for (const task of createdTasks) {
      await page.evaluate(async (taskId) => {
        const { domainServices } = await import('/src/domain/index.js');
        await domainServices.task.deleteUI(taskId);
      }, task.id);
    }
  });

  test('should handle rapid updates to same task', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return document.body?.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });

    // Create a single task
    const task = await page.evaluate(async () => {
      const { domainServices } = await import('/src/domain/index.js');
      return await domainServices.task.createUI({
        title: 'Update Test Task',
        description: 'Task for rapid update testing',
        status: 'todo'
      });
    });
    
    console.log(`Created task: ${task.id}`);
    
    // Perform rapid updates
    const numUpdates = 15;
    const statuses = ['todo', 'in_progress', 'completed'];
    
    console.log(`Performing ${numUpdates} rapid updates...`);
    for (let i = 0; i < numUpdates; i++) {
      const newStatus = statuses[i % statuses.length];
      await page.evaluate(async ({ taskId, status, index }) => {
        const { domainServices } = await import('/src/domain/index.js');
        await domainServices.task.updateUI(taskId, {
          status: status,
          title: `Update Test Task - Version ${index}`
        });
      }, { taskId: task.id, status: newStatus, index: i });
      
      // Minimal delay
      await page.waitForTimeout(50);
    }
    
    // Wait for sync to stabilize
    await page.waitForTimeout(1000);
    
    // Verify final state
    const finalTask = await page.evaluate(async (taskId) => {
      const { db } = await import('/src/domain/index.js');
      return await db.tasks.get(taskId);
    }, task.id);
    
    console.log('Final task state:', {
      title: finalTask.title,
      status: finalTask.status
    });
    
    // Check how many changes were tracked
    const changeCount = await page.evaluate(async (taskId) => {
      const { db } = await import('/src/domain/index.js');
      const changes = await db.change_history
        .where('entity_id')
        .equals(taskId)
        .toArray();
      return changes.length;
    }, task.id);
    
    console.log(`Tracked ${changeCount} changes for the task`);
    
    // We should have at least the create + some updates
    expect(changeCount).toBeGreaterThanOrEqual(2);
    
    // Clean up
    await page.evaluate(async (taskId) => {
      const { domainServices } = await import('/src/domain/index.js');
      await domainServices.task.deleteUI(taskId);
    }, task.id);
  });

  test('should handle concurrent operations', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return document.body?.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });

    console.log('Starting concurrent operations test...');
    
    // Create multiple tasks concurrently
    const numConcurrent = 5;
    const createPromises = [];
    
    for (let i = 0; i < numConcurrent; i++) {
      createPromises.push(
        page.evaluate(async (index) => {
          const { domainServices } = await import('/src/domain/index.js');
          return await domainServices.task.createUI({
            title: `Concurrent Task ${index}`,
            description: `Created concurrently at ${Date.now()}`,
            status: 'todo'
          });
        }, i)
      );
    }
    
    const tasks = await Promise.all(createPromises);
    console.log(`Created ${tasks.length} tasks concurrently`);
    
    // Wait for sync
    await page.waitForTimeout(1000);
    
    // Update all tasks concurrently
    const updatePromises = [];
    for (let i = 0; i < tasks.length; i++) {
      updatePromises.push(
        page.evaluate(async ({ taskId, index }) => {
          const { domainServices } = await import('/src/domain/index.js');
          await domainServices.task.updateUI(taskId, {
            title: `Updated Concurrent Task ${index}`,
            status: 'in_progress'
          });
        }, { taskId: tasks[i].id, index: i })
      );
    }
    
    await Promise.all(updatePromises);
    console.log('Updated all tasks concurrently');
    
    // Wait for sync
    await page.waitForTimeout(1000);
    
    // Verify all tasks were updated
    const updatedTasks = await page.evaluate(async (taskIds) => {
      const { db } = await import('/src/domain/index.js');
      const tasks = [];
      for (const id of taskIds) {
        const task = await db.tasks.get(id);
        if (task) {
          tasks.push({
            id: task.id,
            title: task.title,
            status: task.status
          });
        }
      }
      return tasks;
    }, tasks.map(t => t.id));
    
    console.log('Updated tasks:', updatedTasks);
    
    // Verify all updates were applied
    for (const task of updatedTasks) {
      expect(task.title).toContain('Updated Concurrent');
      expect(task.status).toBe('in_progress');
    }
    
    // Check sync tracking
    const syncMetrics = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      const totalChanges = await db.change_history.count();
      const queueSize = await db.outgoing_change_queue.count();
      
      // Count by operation type
      const creates = await db.change_history.where('operation').equals('create').count();
      const updates = await db.change_history.where('operation').equals('update').count();
      
      return {
        totalChanges,
        queueSize,
        creates,
        updates
      };
    });
    
    console.log('Sync metrics:', syncMetrics);
    
    // We should have tracked all operations
    expect(syncMetrics.creates).toBeGreaterThanOrEqual(numConcurrent);
    expect(syncMetrics.updates).toBeGreaterThanOrEqual(numConcurrent);
    
    // Clean up
    const deletePromises = [];
    for (const task of tasks) {
      deletePromises.push(
        page.evaluate(async (taskId) => {
          const { domainServices } = await import('/src/domain/index.js');
          await domainServices.task.deleteUI(taskId);
        }, task.id)
      );
    }
    
    await Promise.all(deletePromises);
    console.log('Cleaned up all test tasks');
  });
});