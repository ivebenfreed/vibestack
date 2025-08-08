import { test, expect } from '../fixtures/persistent-context.js';
import { createEntity, updateEntity, deleteEntity, getAllEntities } from '../core/db-test-helpers.js';

// Helper function to wait for app ready state
async function waitForVibeStackReady(page) {
  await page.waitForFunction(() => {
    return document.body?.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
}

test.describe('Sync Tracking Stress Test', () => {
  let testProject;
  let createdTasks = [];

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForVibeStackReady(page);
    
    // Create a test project
    testProject = await createEntity(page, 'project', {
      name: `Stress Test Project ${Date.now()}`,
      description: 'Project for sync tracking stress testing'
    });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup
    for (const task of createdTasks) {
      try {
        await deleteEntity(page, 'task', task.id);
      } catch (e) {
        // Task might already be deleted
      }
    }
    createdTasks = [];

    if (testProject) {
      await deleteEntity(page, 'project', testProject.id);
    }
  });

  test('should handle rapid sequential task operations', async ({ page }) => {
    const numOperations = 20;
    
    // Navigate to project
    await page.goto(`/projects/${testProject.id}`);
    await waitForVibeStackReady(page);

    console.log('Starting rapid sequential operations test...');

    // 1. Create many tasks rapidly
    console.log(`Creating ${numOperations} tasks...`);
    for (let i = 0; i < numOperations; i++) {
      const task = await createEntity(page, 'task', {
        title: `Stress Task ${i}`,
        description: `Description for task ${i}`,
        projectId: testProject.id
      });
      createdTasks.push(task);
      
      // Minimal wait to allow UI to update
      await page.waitForTimeout(50);
    }

    // Verify all tasks were created
    const createdCount = await page.evaluate(() => {
      const taskElements = document.querySelectorAll('[data-testid^="task-"]');
      return taskElements.length;
    });
    expect(createdCount).toBeGreaterThanOrEqual(numOperations);

    // 2. Update all tasks rapidly
    console.log(`Updating ${numOperations} tasks...`);
    for (let i = 0; i < createdTasks.length; i++) {
      await updateEntity(page, 'task', createdTasks[i].id, {
        title: `Updated Stress Task ${i}`,
        description: `Updated description for task ${i}`
      });
      await page.waitForTimeout(50);
    }

    // 3. Delete half the tasks
    console.log(`Deleting ${Math.floor(numOperations / 2)} tasks...`);
    const tasksToDelete = createdTasks.slice(0, Math.floor(numOperations / 2));
    for (const task of tasksToDelete) {
      await deleteEntity(page, 'task', task.id);
      await page.waitForTimeout(50);
    }

    // Remove deleted tasks from our tracking
    createdTasks = createdTasks.slice(Math.floor(numOperations / 2));

    // Verify remaining tasks
    const remainingCount = await page.evaluate(() => {
      const taskElements = document.querySelectorAll('[data-testid^="task-"]');
      return taskElements.length;
    });
    expect(remainingCount).toBeGreaterThanOrEqual(Math.ceil(numOperations / 2));

    console.log('Rapid sequential operations test completed');
  });

  test('should handle concurrent bulk operations', async ({ page }) => {
    await page.goto(`/projects/${testProject.id}`);
    await waitForVibeStackReady(page);

    console.log('Starting concurrent bulk operations test...');

    // Create multiple tasks concurrently using Promise.all
    const createPromises = [];
    const numConcurrent = 10;

    console.log(`Creating ${numConcurrent} tasks concurrently...`);
    for (let i = 0; i < numConcurrent; i++) {
      createPromises.push(
        createEntity(page, 'task', {
          title: `Concurrent Task ${i}`,
          description: `Concurrent description ${i}`,
          projectId: testProject.id
        })
      );
    }

    const concurrentTasks = await Promise.all(createPromises);
    createdTasks.push(...concurrentTasks);

    // Wait for UI to stabilize
    await page.waitForTimeout(500);

    // Verify all concurrent tasks were created
    const createdCount = await page.evaluate(() => {
      const taskElements = document.querySelectorAll('[data-testid^="task-"]');
      return taskElements.length;
    });
    expect(createdCount).toBeGreaterThanOrEqual(numConcurrent);

    // Update multiple tasks concurrently
    console.log(`Updating ${numConcurrent} tasks concurrently...`);
    const updatePromises = [];
    for (let i = 0; i < concurrentTasks.length; i++) {
      updatePromises.push(
        updateEntity(page, 'task', concurrentTasks[i].id, {
          title: `Updated Concurrent Task ${i}`,
          status: 'in_progress'
        })
      );
    }

    await Promise.all(updatePromises);
    await page.waitForTimeout(500);

    // Delete multiple tasks concurrently
    console.log(`Deleting ${Math.floor(numConcurrent / 2)} tasks concurrently...`);
    const deletePromises = [];
    const tasksToDelete = concurrentTasks.slice(0, Math.floor(numConcurrent / 2));
    
    for (const task of tasksToDelete) {
      deletePromises.push(deleteEntity(page, 'task', task.id));
    }

    await Promise.all(deletePromises);
    
    // Update tracking
    createdTasks = createdTasks.filter(t => !tasksToDelete.includes(t));
    
    await page.waitForTimeout(500);

    console.log('Concurrent bulk operations test completed');
  });

  test('should maintain sync integrity under stress', async ({ page }) => {
    await page.goto(`/projects/${testProject.id}`);
    await waitForVibeStackReady(page);

    console.log('Starting sync integrity stress test...');

    // Perform mixed operations rapidly
    const operations = [];
    const numMixed = 30;

    for (let i = 0; i < numMixed; i++) {
      const operation = i % 3;
      
      if (operation === 0) {
        // Create
        operations.push(async () => {
          const task = await createEntity(page, 'task', {
            title: `Mixed Task ${i}`,
            description: `Mixed operation ${i}`,
            projectId: testProject.id
          });
          createdTasks.push(task);
          return task;
        });
      } else if (operation === 1 && createdTasks.length > 0) {
        // Update random existing task
        const randomIndex = Math.floor(Math.random() * createdTasks.length);
        const taskToUpdate = createdTasks[randomIndex];
        operations.push(async () => {
          await updateEntity(page, 'task', taskToUpdate.id, {
            title: `Re-updated Task ${i}`,
            priority: 'high'
          });
        });
      } else if (operation === 2 && createdTasks.length > 1) {
        // Delete random task
        const randomIndex = Math.floor(Math.random() * createdTasks.length);
        const taskToDelete = createdTasks[randomIndex];
        operations.push(async () => {
          await deleteEntity(page, 'task', taskToDelete.id);
          createdTasks = createdTasks.filter(t => t.id !== taskToDelete.id);
        });
      }
    }

    // Execute all operations
    console.log(`Executing ${operations.length} mixed operations...`);
    for (const op of operations) {
      await op();
      await page.waitForTimeout(100); // Small delay between operations
    }

    // Wait for sync to stabilize
    await page.waitForTimeout(1000);

    // Verify UI state matches our tracking
    const finalCount = await page.evaluate(() => {
      const taskElements = document.querySelectorAll('[data-testid^="task-"]');
      return taskElements.length;
    });

    console.log(`Final state: ${finalCount} tasks in UI, ${createdTasks.length} tracked`);
    
    // Allow some tolerance for async operations
    expect(Math.abs(finalCount - createdTasks.length)).toBeLessThanOrEqual(2);

    console.log('Sync integrity stress test completed');
  });

  test('should handle rapid status changes on same task', async ({ page }) => {
    await page.goto(`/projects/${testProject.id}`);
    await waitForVibeStackReady(page);

    console.log('Starting rapid status change test...');

    // Create a single task
    const task = await createEntity(page, 'task', {
      title: 'Status Change Test Task',
      description: 'Task for testing rapid status changes',
      projectId: testProject.id
    });
    createdTasks.push(task);

    const statuses = ['todo', 'in_progress', 'completed', 'archived'];
    const numChanges = 20;

    console.log(`Performing ${numChanges} rapid status changes...`);
    for (let i = 0; i < numChanges; i++) {
      const newStatus = statuses[i % statuses.length];
      await updateEntity(page, 'task', task.id, {
        status: newStatus
      });
      await page.waitForTimeout(50);
    }

    // Final status should be the last one we set
    const expectedFinalStatus = statuses[(numChanges - 1) % statuses.length];
    
    // Wait for sync to complete
    await page.waitForTimeout(500);

    // Verify final status
    const finalStatus = await page.evaluate((taskId) => {
      const taskElement = document.querySelector(`[data-testid="task-${taskId}"]`);
      return taskElement?.dataset.status || taskElement?.getAttribute('data-status');
    }, task.id);

    expect(finalStatus).toBe(expectedFinalStatus);

    console.log('Rapid status change test completed');
  });

  test('should handle dependency chain stress', async ({ page }) => {
    await page.goto(`/projects/${testProject.id}`);
    await waitForVibeStackReady(page);

    console.log('Starting dependency chain stress test...');

    // Create a chain of tasks with dependencies
    const chainLength = 15;
    let previousTask = null;

    console.log(`Creating dependency chain of ${chainLength} tasks...`);
    for (let i = 0; i < chainLength; i++) {
      const task = await createEntity(page, 'task', {
        title: `Chain Task ${i}`,
        description: `Task ${i} in dependency chain`,
        projectId: testProject.id,
        dependencies: previousTask ? [previousTask.id] : []
      });
      createdTasks.push(task);
      previousTask = task;
      await page.waitForTimeout(100);
    }

    // Now update all tasks in the chain
    console.log('Updating all tasks in chain...');
    for (let i = 0; i < createdTasks.length; i++) {
      await updateEntity(page, 'task', createdTasks[i].id, {
        title: `Updated Chain Task ${i}`,
        priority: i % 2 === 0 ? 'high' : 'low'
      });
      await page.waitForTimeout(50);
    }

    // Delete some tasks in the middle of the chain
    console.log('Deleting middle tasks in chain...');
    const middleStart = Math.floor(chainLength / 3);
    const middleEnd = Math.floor(2 * chainLength / 3);
    
    for (let i = middleStart; i < middleEnd; i++) {
      await deleteEntity(page, 'task', createdTasks[i].id);
      await page.waitForTimeout(50);
    }

    // Remove deleted tasks from tracking
    createdTasks = [
      ...createdTasks.slice(0, middleStart),
      ...createdTasks.slice(middleEnd)
    ];

    // Wait for sync to stabilize
    await page.waitForTimeout(1000);

    // Verify remaining tasks
    const remainingCount = await page.evaluate(() => {
      const taskElements = document.querySelectorAll('[data-testid^="task-"]');
      return taskElements.length;
    });

    expect(remainingCount).toBeGreaterThanOrEqual(createdTasks.length);

    console.log('Dependency chain stress test completed');
  });
});